const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

const SHEET_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSs49yOMfr54tr_JILpj7sVKhKz4hqo5EcVOifGorgHF-udlNRptn26ToObDoMPB_mRBnM1a5AagzkK/pub?gid=1227196982&single=true&output=csv';
const IMPORT_SOURCE = 'Google Sheet: ประชาชน/อสม./บุคลากร/ ที่ได้รับผลกระทบที่ให้การดูแล';
const DEFAULT_START_DATE = '2025-11-20';
const DEFAULT_END_DATE = '2025-11-30';
const DISTRICT_TOTAL_TAMBON = 'รวมทั้งอำเภอ';

const IMPACT_FIELDS = [
  'citizen_property',
  'citizen_injured',
  'citizen_deaths',
  'citizen_missing',
  'volunteer_property',
  'volunteer_injured',
  'volunteer_deaths',
  'volunteer_missing',
  'staff_property',
  'staff_injured',
  'staff_deaths',
  'staff_missing',
  'medicine_support',
  'evacuated',
  'not_evacuated',
];

const EXPECTED_TOTALS = {
  citizen_property: 86932,
  citizen_injured: 30,
  citizen_deaths: 3,
  citizen_missing: 0,
  volunteer_property: 1200,
  volunteer_injured: 0,
  volunteer_deaths: 0,
  volunteer_missing: 0,
  staff_property: 215,
  staff_injured: 0,
  staff_deaths: 0,
  staff_missing: 0,
  medicine_support: 26555,
  evacuated: 1701,
  not_evacuated: 86646,
};

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

function addDays(dateString, days) {
  const date = new Date(`${dateString}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function dateRange(startDate, endDate) {
  const dates = [];
  for (let date = startDate; date <= endDate; date = addDays(date, 1)) {
    dates.push(date);
  }
  return dates;
}

function distributeTotal(total, slots) {
  if (total <= 0) return Array.from({ length: slots }, () => 0);
  const base = Math.floor(total / slots);
  const remainder = total % slots;
  return Array.from({ length: slots }, (_, index) => base + (index < remainder ? 1 : 0));
}

function rowToAffectedDistrict(row) {
  const district = normalizeText(row[0]);
  if (!district || district === 'รวม') return null;

  return {
    district_name: district,
    tambon: DISTRICT_TOTAL_TAMBON,
    citizen_property: parseNumber(row[1]),
    citizen_injured: parseNumber(row[2]),
    citizen_deaths: parseNumber(row[3]),
    citizen_missing: parseNumber(row[4]),
    volunteer_property: parseNumber(row[5]),
    volunteer_injured: parseNumber(row[6]),
    volunteer_deaths: parseNumber(row[7]),
    volunteer_missing: parseNumber(row[8]),
    staff_property: parseNumber(row[9]),
    staff_injured: parseNumber(row[10]),
    staff_deaths: parseNumber(row[11]),
    staff_missing: parseNumber(row[12]),
    medicine_support: parseNumber(row[13]),
    evacuated: parseNumber(row[14]),
    not_evacuated: parseNumber(row[15]),
  };
}

function aggregateLegacyFields(row) {
  return {
    deaths: row.citizen_deaths + row.volunteer_deaths + row.staff_deaths,
    missing: row.citizen_missing + row.volunteer_missing + row.staff_missing,
    injured: row.citizen_injured + row.volunteer_injured + row.staff_injured,
    affected: row.citizen_property + row.volunteer_property + row.staff_property,
  };
}

function validateTotals(records) {
  const totals = Object.fromEntries(IMPACT_FIELDS.map(field => [field, 0]));
  for (const record of records) {
    for (const field of IMPACT_FIELDS) {
      totals[field] += record[field];
    }
  }

  for (const [field, expected] of Object.entries(EXPECTED_TOTALS)) {
    if (totals[field] !== expected) {
      throw new Error(`ยอดรวม ${field} ไม่ตรงกับชีต: ${totals[field]}/${expected}`);
    }
  }

  if (totals.evacuated + totals.not_evacuated !== totals.citizen_property + totals.volunteer_property + totals.staff_property) {
    throw new Error('ยอดอพยพ + ไม่อพยพ ไม่เท่ากับยอดทรัพย์สินรวม');
  }
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

async function getReporterId(connection) {
  const [rows] = await connection.execute(
    `SELECT id FROM officer
     WHERE username = 'admin' OR role = 'admin'
     ORDER BY username = 'admin' DESC, id ASC
     LIMIT 1`
  );
  return rows[0]?.id || null;
}

async function columnExists(connection, columnName) {
  const [rows] = await connection.execute(
    `SELECT COLUMN_NAME
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'affected_persons'
       AND COLUMN_NAME = ?`,
    [columnName]
  );
  return rows.length > 0;
}

async function indexExists(connection, indexName) {
  const [rows] = await connection.execute(
    `SELECT INDEX_NAME
     FROM INFORMATION_SCHEMA.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'affected_persons'
       AND INDEX_NAME = ?`,
    [indexName]
  );
  return rows.length > 0;
}

async function ensureSchema(connection) {
  const columns = [
    ['citizen_property', 'INT NOT NULL DEFAULT 0 AFTER tambon'],
    ['citizen_injured', 'INT NOT NULL DEFAULT 0 AFTER citizen_property'],
    ['citizen_deaths', 'INT NOT NULL DEFAULT 0 AFTER citizen_injured'],
    ['citizen_missing', 'INT NOT NULL DEFAULT 0 AFTER citizen_deaths'],
    ['volunteer_property', 'INT NOT NULL DEFAULT 0 AFTER citizen_missing'],
    ['volunteer_injured', 'INT NOT NULL DEFAULT 0 AFTER volunteer_property'],
    ['volunteer_deaths', 'INT NOT NULL DEFAULT 0 AFTER volunteer_injured'],
    ['volunteer_missing', 'INT NOT NULL DEFAULT 0 AFTER volunteer_deaths'],
    ['staff_property', 'INT NOT NULL DEFAULT 0 AFTER volunteer_missing'],
    ['staff_injured', 'INT NOT NULL DEFAULT 0 AFTER staff_property'],
    ['staff_deaths', 'INT NOT NULL DEFAULT 0 AFTER staff_injured'],
    ['staff_missing', 'INT NOT NULL DEFAULT 0 AFTER staff_deaths'],
    ['medicine_support', 'INT NOT NULL DEFAULT 0 AFTER affected'],
    ['evacuated', 'INT NOT NULL DEFAULT 0 AFTER medicine_support'],
    ['not_evacuated', 'INT NOT NULL DEFAULT 0 AFTER evacuated'],
  ];

  for (const [name, definition] of columns) {
    if (!(await columnExists(connection, name))) {
      await connection.execute(`ALTER TABLE affected_persons ADD COLUMN ${name} ${definition}`);
    }
  }

  if (!(await indexExists(connection, 'idx_affected_persons_assistance'))) {
    await connection.execute('ALTER TABLE affected_persons ADD INDEX idx_affected_persons_assistance (medicine_support, evacuated, not_evacuated)');
  }
}

function buildRows({ records, dates, sessionId, reporterId, startDate, endDate }) {
  const rows = [];

  for (const record of records) {
    const dailyDistributions = Object.fromEntries(
      IMPACT_FIELDS.map(field => [field, distributeTotal(record[field], dates.length)])
    );

    dates.forEach((reportDate, index) => {
      const row = {
        session_id: sessionId,
        report_date: reportDate,
        district_name: record.district_name,
        tambon: record.tambon,
        notes: `${IMPORT_SOURCE} - เฉลี่ยช่วงวันที่ ${startDate} ถึง ${endDate}`,
        reported_by: reporterId,
      };

      for (const field of IMPACT_FIELDS) {
        row[field] = dailyDistributions[field][index];
      }

      Object.assign(row, aggregateLegacyFields(row));
      rows.push(row);
    });
  }

  return rows;
}

async function upsertAffectedPerson(connection, row) {
  const [result] = await connection.execute(
    `INSERT INTO affected_persons
     (session_id, report_date, district_name, tambon,
      citizen_property, citizen_injured, citizen_deaths, citizen_missing,
      volunteer_property, volunteer_injured, volunteer_deaths, volunteer_missing,
      staff_property, staff_injured, staff_deaths, staff_missing,
      deaths, missing, injured, affected, medicine_support, evacuated, not_evacuated,
      notes, reported_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       citizen_property = VALUES(citizen_property),
       citizen_injured = VALUES(citizen_injured),
       citizen_deaths = VALUES(citizen_deaths),
       citizen_missing = VALUES(citizen_missing),
       volunteer_property = VALUES(volunteer_property),
       volunteer_injured = VALUES(volunteer_injured),
       volunteer_deaths = VALUES(volunteer_deaths),
       volunteer_missing = VALUES(volunteer_missing),
       staff_property = VALUES(staff_property),
       staff_injured = VALUES(staff_injured),
       staff_deaths = VALUES(staff_deaths),
       staff_missing = VALUES(staff_missing),
       deaths = VALUES(deaths),
       missing = VALUES(missing),
       injured = VALUES(injured),
       affected = VALUES(affected),
       medicine_support = VALUES(medicine_support),
       evacuated = VALUES(evacuated),
       not_evacuated = VALUES(not_evacuated),
       notes = VALUES(notes),
       reported_by = VALUES(reported_by),
       updated_at = CURRENT_TIMESTAMP`,
    [
      row.session_id,
      row.report_date,
      row.district_name,
      row.tambon,
      row.citizen_property,
      row.citizen_injured,
      row.citizen_deaths,
      row.citizen_missing,
      row.volunteer_property,
      row.volunteer_injured,
      row.volunteer_deaths,
      row.volunteer_missing,
      row.staff_property,
      row.staff_injured,
      row.staff_deaths,
      row.staff_missing,
      row.deaths,
      row.missing,
      row.injured,
      row.affected,
      row.medicine_support,
      row.evacuated,
      row.not_evacuated,
      row.notes,
      row.reported_by,
    ]
  );

  return result.affectedRows === 1 ? 'created' : 'updated';
}

function writeReport(report) {
  const reportPath = path.join(process.cwd(), 'tmp_affected_persons_import_report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8');

  const csvPath = path.join(process.cwd(), 'tmp_affected_persons_import.csv');
  const header = [
    'action',
    'session_id',
    'report_date',
    'district_name',
    'tambon',
    ...IMPACT_FIELDS,
    'deaths',
    'missing',
    'injured',
    'affected',
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
  const startDate = getArgValue('start-date') || DEFAULT_START_DATE;
  const endDate = getArgValue('end-date') || DEFAULT_END_DATE;
  const dates = dateRange(startDate, endDate);
  if (!dates.length) throw new Error(`ช่วงวันที่ไม่ถูกต้อง: ${startDate} ถึง ${endDate}`);

  const response = await fetch(SHEET_URL);
  if (!response.ok) throw new Error(`โหลด CSV ไม่สำเร็จ: ${response.status}`);

  const csvRows = parseCsv(await response.text());
  const records = csvRows.slice(3).map(rowToAffectedDistrict).filter(Boolean);
  validateTotals(records);

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
    sourceUrl: SHEET_URL,
    importSource: IMPORT_SOURCE,
    startDate,
    endDate,
    dates: dates.length,
    csvRows: csvRows.length,
    importedDistricts: records.length,
    expectedTotals: EXPECTED_TOTALS,
    session: null,
    rows: [],
  };

  try {
    const session = await getActiveFloodSession(connection);
    const reporterId = await getReporterId(connection);
    report.session = session;

    await ensureSchema(connection);
    await connection.beginTransaction();

    const rows = buildRows({
      records,
      dates,
      sessionId: session.id,
      reporterId,
      startDate,
      endDate,
    });

    for (const row of rows) {
      const action = await upsertAffectedPerson(connection, row);
      report.rows.push({ action, ...row });
    }

    if (dryRun) await connection.rollback();
    else await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    await connection.end();
  }

  const totals = report.rows.reduce((acc, row) => {
    for (const field of IMPACT_FIELDS) {
      acc[field] = (acc[field] || 0) + row[field];
    }
    return acc;
  }, {});
  const { reportPath, csvPath } = writeReport(report);

  console.log(JSON.stringify({
    dryRun,
    sessionId: report.session.id,
    startDate,
    endDate,
    importedDistricts: report.importedDistricts,
    rows: report.rows.length,
    created: report.rows.filter(row => row.action === 'created').length,
    updated: report.rows.filter(row => row.action === 'updated').length,
    totals,
    reportPath,
    csvPath,
  }, null, 2));
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
