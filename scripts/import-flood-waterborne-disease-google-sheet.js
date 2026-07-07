const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

const CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQyeEvGjE-FVn2urcsPlhGF6Ctovggqm6pkFlmTAhP4FPSLNxFp9HNaXxw_8cU91S2v4snos5aENcHD/pub?gid=1588644713&single=true&output=csv';
const DEFAULT_SESSION_ID = 54;
const DEFAULT_START_DATE = '2025-11-23';
const DEFAULT_END_DATE = '2025-12-01';
const IMPORT_SOURCE = 'นำเข้าจาก Google Sheet การเฝ้าระวังโรคที่มากับน้ำท่วม session 3';
const DAILY_CURVE_WEIGHTS = [0.35, 0.7, 1.05, 1.35, 1.6, 1.25, 0.95, 0.65, 0.35];

const FACILITY_ALIASES = {
  'โรงพยาบาลสตูล': 'รพ.สตูล',
  'โรงพยาบาลควนโดน': 'รพ.ควนโดน',
  'โรงพยาบาลควนกาหลง': 'รพ.ควนกาหลง',
  'โรงพยาบาลท่าแพ': 'รพ.ท่าแพ',
  'โรงพยาบาลละงู': 'รพ.ละงู',
  'โรงพยาบาลมะนัง': 'รพ.มะนัง',
  'โรงพยาบาลทุ่งหว้า': 'รพ.ทุ่งหว้า',
};

function getArgValue(name) {
  const prefix = `--${name}=`;
  const arg = process.argv.find((item) => item.startsWith(prefix));
  return arg ? arg.slice(prefix.length) : null;
}

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const index = trimmed.indexOf('=');
    if (index === -1) continue;
    const key = trimmed.slice(0, index).trim();
    let value = trimmed.slice(index + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

function parseCsvLine(line) {
  const values = [];
  let current = '';
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];

    if (char === '"' && quoted && next === '"') {
      current += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === ',' && !quoted) {
      values.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  values.push(current.trim());
  return values;
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

function distributeTotal(total, weights) {
  if (total <= 0) return weights.map(() => 0);

  const weightTotal = weights.reduce((sum, weight) => sum + weight, 0);
  const raw = weights.map((weight) => (total * weight) / weightTotal);
  const values = raw.map(Math.floor);
  let remainder = total - values.reduce((sum, value) => sum + value, 0);
  const order = raw
    .map((value, index) => ({ index, fraction: value - Math.floor(value) }))
    .sort((a, b) => b.fraction - a.fraction);

  for (let index = 0; index < remainder; index += 1) {
    values[order[index].index] += 1;
  }

  return values;
}

async function fetchCsv(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`โหลด CSV ไม่สำเร็จ: HTTP ${response.status}`);
  }
  return response.text();
}

function parseDiseaseCsv(csvText) {
  const lines = csvText
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const headerIndex = lines.findIndex((line) => parseCsvLine(line).some((cell) => cell.trim() === 'โรค'));
  if (headerIndex === -1) throw new Error('ไม่พบ header โรคใน CSV');

  const headers = parseCsvLine(lines[headerIndex]);
  const facilities = headers.slice(1).filter(Boolean);
  if (facilities.length === 0) throw new Error('ไม่พบคอลัมน์โรงพยาบาลใน CSV');

  return lines.slice(headerIndex + 1).map((line) => {
    const cells = parseCsvLine(line);
    const diseaseName = cells[0]?.trim();
    if (!diseaseName) return null;

    const counts = facilities.map((facilityName, index) => ({
      source_facility_name: facilityName,
      facility_name: FACILITY_ALIASES[facilityName] || facilityName,
      total: Number.parseInt(String(cells[index + 1] || '0').replace(/,/g, ''), 10) || 0,
    }));

    return { disease_name: diseaseName, counts };
  }).filter(Boolean);
}

async function getSession(connection, sessionId) {
  const [rows] = await connection.execute(
    'SELECT id, eoc_type, session_number, status, opened_at, closed_at FROM eoc_sessions WHERE id = ? LIMIT 1',
    [sessionId]
  );
  if (!rows.length) throw new Error(`ไม่พบ EOC session id=${sessionId}`);
  return rows[0];
}

async function getReporterId(connection) {
  const [rows] = await connection.execute(
    `SELECT id
     FROM officer
     WHERE username = 'admin' OR role = 'admin'
     ORDER BY username = 'admin' DESC, id ASC
     LIMIT 1`
  );
  return rows[0]?.id || null;
}

async function loadFacilityMap(connection, sourceRows) {
  const facilityNames = [...new Set(sourceRows.flatMap((row) => row.counts.map((item) => item.facility_name)))];
  const facilityMap = new Map();

  for (const facilityName of facilityNames) {
    const [rows] = await connection.execute(
      'SELECT id, name, district_name FROM health_facilities WHERE name = ? LIMIT 1',
      [facilityName]
    );
    if (!rows.length) throw new Error(`ไม่พบหน่วยบริการ "${facilityName}" ใน health_facilities`);
    facilityMap.set(facilityName, rows[0]);
  }

  return facilityMap;
}

async function upsertCommonDiseases(connection, sourceRows) {
  for (const row of sourceRows) {
    await connection.execute(
      `INSERT INTO common_diseases (name, description, is_active)
       VALUES (?, ?, 1)
       ON DUPLICATE KEY UPDATE
         description = VALUES(description),
         is_active = 1`,
      [row.disease_name, `โรคที่มากับน้ำท่วม: ${row.disease_name}`]
    );
  }
}

function buildRows({ sourceRows, sessionId, dates, facilityMap, reporterId }) {
  if (dates.length !== DAILY_CURVE_WEIGHTS.length) {
    throw new Error(`ช่วงวันที่ต้องมี ${DAILY_CURVE_WEIGHTS.length} วันสำหรับ curve ที่กำหนด`);
  }

  const rows = [];
  for (const disease of sourceRows) {
    for (const count of disease.counts) {
      const facility = facilityMap.get(count.facility_name);
      const dailyCounts = distributeTotal(count.total, DAILY_CURVE_WEIGHTS);

      dailyCounts.forEach((patientCount, index) => {
        if (patientCount <= 0) return;
        rows.push({
          session_id: sessionId,
          report_date: dates[index],
          health_facility_id: facility.id,
          facility_name: facility.name,
          district_name: facility.district_name,
          disease_name: disease.disease_name,
          patient_count: patientCount,
          notes: `${IMPORT_SOURCE}; ${count.source_facility_name} ยอดรวม ${count.total} ราย กระจายตาม curve รายวัน`,
          reported_by: reporterId,
        });
      });
    }
  }
  return rows;
}

async function replaceSessionRows(connection, { sessionId, dates, rows }) {
  await connection.execute('DELETE FROM disease_reports WHERE session_id = ?', [sessionId]);

  const startDate = dates[0];
  const endDate = dates[dates.length - 1];
  const facilityIds = [...new Set(rows.map((row) => row.health_facility_id))];
  const diseases = [...new Set(rows.map((row) => row.disease_name))];

  if (facilityIds.length > 0 && diseases.length > 0) {
    await connection.query(
      `DELETE FROM disease_reports
       WHERE report_date BETWEEN ? AND ?
         AND health_facility_id IN (?)
         AND disease_name IN (?)`,
      [startDate, endDate, facilityIds, diseases]
    );
  }

  for (const row of rows) {
    await connection.execute(
      `INSERT INTO disease_reports
       (session_id, report_date, health_facility_id, disease_name, patient_count, notes, reported_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        row.session_id,
        row.report_date,
        row.health_facility_id,
        row.disease_name,
        row.patient_count,
        row.notes,
        row.reported_by,
      ]
    );
  }
}

function summarize(rows) {
  const byDate = {};
  const byDisease = {};
  const byFacility = {};

  for (const row of rows) {
    byDate[row.report_date] = (byDate[row.report_date] || 0) + row.patient_count;
    byDisease[row.disease_name] = (byDisease[row.disease_name] || 0) + row.patient_count;
    byFacility[row.facility_name] = (byFacility[row.facility_name] || 0) + row.patient_count;
  }

  return { byDate, byDisease, byFacility };
}

function writeReport(report) {
  const reportPath = path.join(process.cwd(), 'tmp_flood_waterborne_disease_google_sheet_import_report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8');

  const csvPath = path.join(process.cwd(), 'tmp_flood_waterborne_disease_google_sheet_import.csv');
  const header = ['session_id', 'report_date', 'facility_name', 'district_name', 'disease_name', 'patient_count'];
  const lines = [header.join(',')];
  for (const row of report.rows) {
    lines.push(header.map((key) => `"${String(row[key] ?? '').replace(/"/g, '""')}"`).join(','));
  }
  fs.writeFileSync(csvPath, lines.join('\n'), 'utf8');

  return { reportPath, csvPath };
}

async function main() {
  loadEnvFile(path.join(process.cwd(), '.env'));

  const dryRun = process.argv.includes('--dry-run');
  const sessionId = Number.parseInt(getArgValue('session-id') || String(DEFAULT_SESSION_ID), 10);
  const startDate = getArgValue('start-date') || DEFAULT_START_DATE;
  const endDate = getArgValue('end-date') || DEFAULT_END_DATE;
  const csvUrl = getArgValue('url') || CSV_URL;
  const dates = dateRange(startDate, endDate);

  const sourceRows = parseDiseaseCsv(await fetchCsv(csvUrl));
  const sourceTotal = sourceRows.reduce(
    (sum, row) => sum + row.counts.reduce((rowSum, count) => rowSum + count.total, 0),
    0
  );

  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'stneoc',
    port: Number(process.env.DB_PORT || 3306),
    charset: 'utf8mb4',
  });

  const report = {
    dryRun,
    csvUrl,
    importSource: IMPORT_SOURCE,
    session: null,
    startDate,
    endDate,
    sourceTotal,
    rows: [],
    summary: null,
  };

  try {
    report.session = await getSession(connection, sessionId);
    const reporterId = await getReporterId(connection);
    const facilityMap = await loadFacilityMap(connection, sourceRows);
    const rows = buildRows({ sourceRows, sessionId, dates, facilityMap, reporterId });

    report.rows = rows;
    report.summary = summarize(rows);

    if (rows.reduce((sum, row) => sum + row.patient_count, 0) !== sourceTotal) {
      throw new Error('ยอดรวมหลังแบ่งรายวันไม่ตรงกับยอดรวมจาก CSV');
    }

    await connection.beginTransaction();
    await upsertCommonDiseases(connection, sourceRows);
    await replaceSessionRows(connection, { sessionId, dates, rows });

    if (dryRun) await connection.rollback();
    else await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    await connection.end();
  }

  const paths = writeReport(report);
  console.log(JSON.stringify({
    dryRun,
    sessionId,
    startDate,
    endDate,
    sourceTotal,
    insertedRows: report.rows.length,
    summary: report.summary,
    ...paths,
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
