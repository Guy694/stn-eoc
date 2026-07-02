const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

const SHEET_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSs49yOMfr54tr_JILpj7sVKhKz4hqo5EcVOifGorgHF-udlNRptn26ToObDoMPB_mRBnM1a5AagzkK/pub?gid=426083605&single=true&output=csv';
const IMPORT_SOURCE = 'Google Sheet: ประชากรกลุ่มเปราะบางที่ได้รับผลกระทบที่ให้การดูแล';
const DISTRICT_TOTAL_TAMBON = 'รวมทั้งอำเภอ';
const DISTRICT_TOTAL_VILLAGE = 'รวม';

function parseCsv(text) {
  const rows = [];
  let row = [];
  let value = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        value += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === ',' && !inQuotes) {
      row.push(value);
      value = '';
      continue;
    }

    if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && next === '\n') i += 1;
      row.push(value);
      rows.push(row);
      row = [];
      value = '';
      continue;
    }

    value += char;
  }

  if (value || row.length) {
    row.push(value);
    rows.push(row);
  }

  return rows;
}

function parseNumber(value) {
  const normalized = String(value || '').replace(/[,\s]/g, '').trim();
  if (!normalized) return 0;
  const number = Number(normalized);
  return Number.isFinite(number) ? number : 0;
}

function normalizeText(value) {
  return String(value || '').normalize('NFC').replace(/\s+/g, ' ').trim();
}

function getArgValue(name) {
  const prefix = `--${name}=`;
  const arg = process.argv.find(item => item.startsWith(prefix));
  return arg ? arg.slice(prefix.length) : null;
}

async function getActiveFloodSession(connection) {
  const sessionId = getArgValue('session-id');
  if (sessionId) {
    const [rows] = await connection.execute(
      'SELECT id, eoc_type, session_number, status FROM eoc_sessions WHERE id = ? LIMIT 1',
      [sessionId]
    );
    if (!rows.length) throw new Error(`ไม่พบ EOC session id=${sessionId}`);
    return rows[0];
  }

  const [rows] = await connection.execute(
    `SELECT id, eoc_type, session_number, status
     FROM eoc_sessions
     WHERE eoc_type = 'flood' AND status = 'active'
     ORDER BY opened_at DESC, id DESC
     LIMIT 1`
  );
  if (!rows.length) throw new Error('ไม่พบ flood EOC session ที่เปิดอยู่');
  return rows[0];
}

async function getReporterUsername(connection) {
  const [rows] = await connection.execute(
    `SELECT username FROM officer
     WHERE username = 'admin' OR role = 'admin'
     ORDER BY username = 'admin' DESC, id ASC
     LIMIT 1`
  );
  return rows[0]?.username || 'import';
}

async function columnExists(connection, tableName, columnName) {
  const [rows] = await connection.execute(
    `SELECT COLUMN_NAME
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = ?
       AND COLUMN_NAME = ?`,
    [tableName, columnName]
  );
  return rows.length > 0;
}

async function ensureBaselineSchema(connection) {
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS vulnerable_group_baselines (
      id INT AUTO_INCREMENT PRIMARY KEY,
      province VARCHAR(100) NOT NULL DEFAULT 'สตูล',
      district VARCHAR(100) NOT NULL,
      tambon VARCHAR(100) NOT NULL,
      village VARCHAR(100) NULL,
      elderly INT NULL DEFAULT 0,
      children INT NULL DEFAULT 0,
      disabled INT NULL DEFAULT 0,
      bedridden INT NULL DEFAULT 0,
      pregnant INT NULL DEFAULT 0,
      chronic_illness INT NULL DEFAULT 0,
      total_cared INT NULL DEFAULT 0,
      moved INT NULL DEFAULT 0,
      notes TEXT NULL,
      needs TEXT NULL,
      import_source VARCHAR(255) NULL,
      source_url TEXT NULL,
      source_as_of_date DATE NULL,
      created_by VARCHAR(100) NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY unique_baseline_location (province, district, tambon, village),
      INDEX idx_location (district, tambon),
      INDEX idx_source_as_of_date (source_as_of_date)
    )
  `);

  const columns = [
    ['total_cared', 'INT NULL DEFAULT 0 AFTER chronic_illness'],
    ['moved', 'INT NULL DEFAULT 0 AFTER total_cared'],
    ['import_source', 'VARCHAR(255) NULL AFTER needs'],
    ['source_url', 'TEXT NULL AFTER import_source'],
    ['source_as_of_date', 'DATE NULL AFTER source_url'],
  ];

  for (const [name, definition] of columns) {
    if (!(await columnExists(connection, 'vulnerable_group_baselines', name))) {
      await connection.execute(`ALTER TABLE vulnerable_group_baselines ADD COLUMN ${name} ${definition}`);
    }
  }
}

function rowToVulnerableGroup(row) {
  const district = normalizeText(row[0]);
  if (!district || district === 'รวม') return null;

  const pregnant = parseNumber(row[2]);
  const bedridden = parseNumber(row[5]);
  const children = parseNumber(row[8]);
  const chronicIllness = parseNumber(row[11]);
  const mentalHealth = parseNumber(row[14]);
  const dialysis = parseNumber(row[17]);
  const disabled = parseNumber(row[20]);
  const elderly = parseNumber(row[23]);
  const totalAffected = parseNumber(row[25]);
  const totalCared = parseNumber(row[26]);
  const moved = parseNumber(row[27]);
  const sourceNotes = normalizeText(row[28]);
  const chronicIllnessCombined = chronicIllness + mentalHealth + dialysis;
  const mappedTotal = pregnant + bedridden + children + chronicIllnessCombined + disabled + elderly;

  if (mappedTotal !== totalAffected) {
    throw new Error(`ยอดรวมอำเภอ${district} ไม่ตรงกับชีต: map=${mappedTotal}, sheet=${totalAffected}`);
  }

  return {
    district,
    tambon: DISTRICT_TOTAL_TAMBON,
    village: DISTRICT_TOTAL_VILLAGE,
    elderly,
    children,
    disabled,
    bedridden,
    pregnant,
    chronic_illness: chronicIllnessCombined,
    total_affected: totalAffected,
    total_cared: totalCared,
    totalAffected,
    totalCared,
    moved,
    sourceNotes,
    breakdown: {
      chronic_illness: chronicIllness,
      mental_health: mentalHealth,
      dialysis,
    },
  };
}

function buildNotes(record) {
  const parts = [
    IMPORT_SOURCE,
    `ระดับข้อมูล: อำเภอ (${DISTRICT_TOTAL_TAMBON})`,
    `ได้รับการดูแลแล้ว ${record.totalCared} ราย`,
    `เคลื่อนย้ายแล้ว ${record.moved} ราย`,
    `โรคเรื้อรังรวม ${record.chronic_illness} ราย (โรคเรื้อรัง ${record.breakdown.chronic_illness}, จิตเวช ${record.breakdown.mental_health}, ฟอกไต ${record.breakdown.dialysis})`,
  ];

  if (record.sourceNotes) parts.push(`หมายเหตุจากชีต: ${record.sourceNotes}`);
  return parts.join(' | ');
}

function buildNeeds(record) {
  return record.moved > 0 ? `เคลื่อนย้ายแล้ว ${record.moved} ราย` : null;
}

async function upsertVulnerableGroup(connection, row) {
  const [result] = await connection.execute(
    `INSERT INTO vulnerable_groups
     (session_id, province, district, tambon, village,
      elderly, children, disabled, bedridden, pregnant, chronic_illness,
      notes, needs, created_by)
     VALUES (?, 'สตูล', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       elderly = VALUES(elderly),
       children = VALUES(children),
       disabled = VALUES(disabled),
       bedridden = VALUES(bedridden),
       pregnant = VALUES(pregnant),
       chronic_illness = VALUES(chronic_illness),
       notes = VALUES(notes),
       needs = VALUES(needs),
       created_by = VALUES(created_by),
       updated_at = CURRENT_TIMESTAMP`,
    [
      row.session_id,
      row.district,
      row.tambon,
      row.village,
      row.elderly,
      row.children,
      row.disabled,
      row.bedridden,
      row.pregnant,
      row.chronic_illness,
      row.notes,
      row.needs,
      row.created_by,
    ]
  );

  return result.affectedRows === 1 ? 'created' : 'updated';
}

async function upsertVulnerableGroupBaseline(connection, row) {
  const [result] = await connection.execute(
    `INSERT INTO vulnerable_group_baselines
     (province, district, tambon, village,
      elderly, children, disabled, bedridden, pregnant, chronic_illness,
      total_cared, moved, notes, needs, import_source, source_url, source_as_of_date, created_by)
     VALUES ('สตูล', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       elderly = VALUES(elderly),
       children = VALUES(children),
       disabled = VALUES(disabled),
       bedridden = VALUES(bedridden),
       pregnant = VALUES(pregnant),
       chronic_illness = VALUES(chronic_illness),
       total_cared = VALUES(total_cared),
       moved = VALUES(moved),
       notes = VALUES(notes),
       needs = VALUES(needs),
       import_source = VALUES(import_source),
       source_url = VALUES(source_url),
       source_as_of_date = VALUES(source_as_of_date),
       created_by = VALUES(created_by),
       updated_at = CURRENT_TIMESTAMP`,
    [
      row.district,
      row.tambon,
      row.village,
      row.elderly,
      row.children,
      row.disabled,
      row.bedridden,
      row.pregnant,
      row.chronic_illness,
      row.total_cared,
      row.moved,
      row.notes,
      row.needs,
      IMPORT_SOURCE,
      SHEET_URL,
      row.source_as_of_date,
      row.created_by,
    ]
  );

  return result.affectedRows === 1 ? 'created' : 'updated';
}

function writeReport(report) {
  const reportPath = path.join(process.cwd(), 'tmp_vulnerable_groups_import_report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8');

  const csvPath = path.join(process.cwd(), 'tmp_vulnerable_groups_import.csv');
  const header = [
    'action',
    'target',
    'session_id',
    'district',
    'tambon',
    'village',
    'pregnant',
    'bedridden',
    'children',
    'chronic_illness',
    'disabled',
    'elderly',
    'total_affected',
    'total_cared',
    'moved',
  ];
  const lines = [header.join(',')];
  for (const row of report.rows) {
    lines.push(header.map(key => `"${String(row[key] ?? '').replace(/"/g, '""')}"`).join(','));
  }
  fs.writeFileSync(csvPath, lines.join('\n'), 'utf8');

  return { reportPath, csvPath };
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const copyToSession = process.argv.includes('--copy-to-session');
  const sourceAsOfDate = getArgValue('source-date') || null;
  const response = await fetch(SHEET_URL);
  if (!response.ok) throw new Error(`โหลด CSV ไม่สำเร็จ: ${response.status}`);

  const csvText = await response.text();
  const csvRows = parseCsv(csvText);
  const records = csvRows.slice(3).map(rowToVulnerableGroup).filter(Boolean);

  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '123456',
    database: process.env.DB_NAME || 'stneoc',
    port: Number(process.env.DB_PORT || 3306),
    charset: 'utf8mb4',
  });

  const report = {
    dryRun,
    copyToSession,
    sourceUrl: SHEET_URL,
    importSource: IMPORT_SOURCE,
    sourceAsOfDate,
    csvRows: csvRows.length,
    importedRows: records.length,
    expectedTotalAffected: 6253,
    session: null,
    rows: [],
  };

  try {
    const createdBy = await getReporterUsername(connection);
    const totalAffected = records.reduce((sum, record) => sum + record.totalAffected, 0);

    if (totalAffected !== report.expectedTotalAffected) {
      throw new Error(`ยอดรวมกลุ่มเปราะบางไม่ตรงกับชีต: ${totalAffected}/${report.expectedTotalAffected}`);
    }

    if (copyToSession) {
      report.session = await getActiveFloodSession(connection);
    }

    await ensureBaselineSchema(connection);
    await connection.beginTransaction();

    for (const record of records) {
      const row = {
        ...record,
        session_id: report.session?.id || null,
        notes: buildNotes(record),
        needs: buildNeeds(record),
        created_by: createdBy,
        source_as_of_date: sourceAsOfDate,
      };
      const baselineAction = await upsertVulnerableGroupBaseline(connection, row);
      report.rows.push({ action: baselineAction, target: 'baseline', ...row });

      if (copyToSession) {
        const sessionAction = await upsertVulnerableGroup(connection, row);
        report.rows.push({ action: sessionAction, target: 'session', ...row });
      }
    }

    if (dryRun) await connection.rollback();
    else await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    await connection.end();
  }

  const { reportPath, csvPath } = writeReport(report);
  console.log(JSON.stringify({
    dryRun,
    sessionId: report.session?.id || null,
    copyToSession,
    importedRows: report.importedRows,
    baselineCreated: report.rows.filter(row => row.target === 'baseline' && row.action === 'created').length,
    baselineUpdated: report.rows.filter(row => row.target === 'baseline' && row.action === 'updated').length,
    sessionCreated: report.rows.filter(row => row.target === 'session' && row.action === 'created').length,
    sessionUpdated: report.rows.filter(row => row.target === 'session' && row.action === 'updated').length,
    totalAffected: report.rows
      .filter(row => row.target === 'baseline')
      .reduce((sum, row) => sum + row.total_affected, 0),
    reportPath,
    csvPath,
  }, null, 2));
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
