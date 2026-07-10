const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const mysql = require('mysql2/promise');

const DEFAULT_SHEET_URL = 'https://docs.google.com/spreadsheets/d/1EEzzRc8Nr-diWAmEmwqrZvkRcOp69n3-01Z_X4-IBxc/edit?usp=sharing';
const DEFAULT_SHEET_NAME = 'Sheet1';
const DISEASE_NAME = 'ไข้เลือดออก';
const IMPORT_SOURCE = 'Raw_Dengue.csv';

function loadEnv(file) {
  if (!fs.existsSync(file)) return;

  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!match || match[1].startsWith('#')) continue;

    let value = match[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    process.env[match[1]] = value;
  }
}

function getArg(name, fallback = null) {
  const prefix = `--${name}=`;
  const arg = process.argv.find(item => item.startsWith(prefix));
  return arg ? arg.slice(prefix.length) : fallback;
}

function hasFlag(name) {
  return process.argv.includes(`--${name}`);
}

function normalizeText(value) {
  return String(value || '')
    .normalize('NFC')
    .replace(/^(จังหวัด|จ\.|อำเภอ|อ\.|ตำบล|ต\.)/u, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeHeader(value) {
  return String(value || '')
    .normalize('NFC')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeKey(value) {
  return normalizeText(value)
    .replace(/[.\s_-]/g, '')
    .toLowerCase();
}

function normalizeMoo(value) {
  const text = normalizeText(value).replace(/^หมู่(?:ที่)?/u, '').trim();
  const number = text.match(/\d+/);
  return number ? String(Number(number[0])) : text;
}

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

function columnIndex(headers, names) {
  const headerKeys = new Set(names.map(name => normalizeHeader(name).toLowerCase()));
  const exactIndex = headers.findIndex(header => headerKeys.has(normalizeHeader(header).toLowerCase()));
  if (exactIndex >= 0) return exactIndex;

  const keys = new Set(names.map(normalizeKey));
  return headers.findIndex(header => keys.has(normalizeKey(header)));
}

function parseDate(value, fallback = null) {
  const text = normalizeText(value);
  if (!text) return fallback;

  const iso = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (iso) return `${iso[1]}-${iso[2].padStart(2, '0')}-${iso[3].padStart(2, '0')}`;

  const thai = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (thai) {
    let year = Number(thai[3]);
    if (year < 100) year += 2500;
    if (year > 2400) year -= 543;
    return `${year}-${thai[2].padStart(2, '0')}-${thai[1].padStart(2, '0')}`;
  }

  return fallback;
}

function normalizeSex(value) {
  const text = normalizeText(value);
  if (/^(ชาย|ช|male|m)$/i.test(text)) return 'ชาย';
  if (/^(หญิง|ญ|female|f)$/i.test(text)) return 'หญิง';
  return text || 'ไม่ระบุ';
}

function parseAge(value) {
  const match = normalizeText(value).match(/\d+/);
  if (!match) return null;
  const age = Number(match[0]);
  return Number.isFinite(age) ? age : null;
}

function sheetCsvUrl(inputUrl, sheetName) {
  if (/output=csv|format=csv|tqx=out:csv/.test(inputUrl)) return inputUrl;

  const match = inputUrl.match(/\/spreadsheets\/d\/([^/]+)/);
  if (!match) return inputUrl;

  return `https://docs.google.com/spreadsheets/d/${match[1]}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheetName)}`;
}

async function fetchCsv(url) {
  const response = await fetch(url, { redirect: 'follow' });
  const text = await response.text();

  if (!response.ok) {
    throw new Error(`ดึงชีตไม่สำเร็จ: HTTP ${response.status}`);
  }

  if (/ลงชื่อเข้าสู่บัญชีผู้ใช้ Google|ServiceLogin|InteractiveLogin|accounts\.google\.com/i.test(text)) {
    throw new Error('ยังเข้าถึง Google Sheet ไม่ได้ กรุณาแชร์เป็น Anyone with the link can view');
  }

  if (/<!DOCTYPE html>|<html/i.test(text.slice(0, 300))) {
    throw new Error('ลิงก์ที่ได้ไม่ใช่ CSV กรุณาตรวจสอบชื่อ sheet/gid หรือสิทธิ์เข้าถึง');
  }

  return text;
}

function requiredIndex(headers, names) {
  const index = columnIndex(headers, names);
  if (index < 0) throw new Error(`ไม่พบคอลัมน์: ${names.join(' / ')}`);
  return index;
}

function rowsToPatientRows(rows, fallbackDate) {
  const nonEmptyRows = rows.filter(row => row.some(cell => normalizeText(cell)));
  if (nonEmptyRows.length < 2) throw new Error('ไม่พบข้อมูลในชีต');

  const headers = nonEmptyRows[0].map(normalizeHeader);
  const agencyIndex = requiredIndex(headers, ['หน่วยงาน']);
  const sexIndex = columnIndex(headers, ['เพศ']);
  const ageIndex = columnIndex(headers, ['อายุปี']);
  const districtIndex = requiredIndex(headers, ['อำเภอขณะป่วย']);
  const tambonIndex = requiredIndex(headers, ['ตำบลขณะป่วย']);
  const mooIndex = requiredIndex(headers, ['หมู่ขณะป่วย']);
  const diagnosisDateIndex = requiredIndex(headers, ['วันที่วินิจฉัยโรค']);
  const treatmentDateIndex = columnIndex(headers, ['วันที่เริ่มรักษา']);
  const onsetDateIndex = columnIndex(headers, ['วันที่เริ่มมีอาการ']);
  const diseaseCodeIndex = columnIndex(headers, ['รหัสกลุ่มโรค']);
  const patientTypeIndex = columnIndex(headers, ['ประเภทผู้ป่วย']);

  const patientRows = [];
  let skipped = 0;
  let missingDate = 0;

  nonEmptyRows.slice(1).forEach((row, rowIndex) => {
    const district = normalizeText(row[districtIndex]) || 'ไม่ระบุ';
    const tambon = normalizeText(row[tambonIndex]) || 'ไม่ระบุ';
    const moo = normalizeMoo(row[mooIndex]) || 'ไม่ระบุ';

    const diagnosisDate = parseDate(row[diagnosisDateIndex]);
    const treatmentDate = parseDate(treatmentDateIndex >= 0 ? row[treatmentDateIndex] : null);
    const onsetDate = parseDate(onsetDateIndex >= 0 ? row[onsetDateIndex] : null);
    const reportDate = diagnosisDate
      || treatmentDate
      || onsetDate
      || fallbackDate;
    if (!diagnosisDate) missingDate += 1;

    const diseaseCode = normalizeText(diseaseCodeIndex >= 0 ? row[diseaseCodeIndex] : '') || 'ไม่ระบุ';
    const patientType = normalizeText(patientTypeIndex >= 0 ? row[patientTypeIndex] : '') || 'ไม่ระบุ';
    const agency = normalizeText(row[agencyIndex]) || 'ไม่ระบุ';
    const sourceRowNumber = rowIndex + 2;
    const key = [
      sourceRowNumber,
      reportDate,
      normalizeKey(district),
      normalizeKey(tambon),
      moo,
      normalizeKey(diseaseCode),
      normalizeKey(patientType),
      normalizeKey(agency)
    ].join('|');

    patientRows.push({
      source_key_seed: key,
      source_row: sourceRowNumber,
      report_date: reportDate,
      diagnosis_date: diagnosisDate,
      treatment_date: treatmentDate,
      onset_date: onsetDate,
      district_name: district,
      tambon_name: tambon,
      moo,
      disease_code: diseaseCode,
      patient_type: patientType,
      agency,
      sex: normalizeSex(sexIndex >= 0 ? row[sexIndex] : ''),
      age_years: parseAge(ageIndex >= 0 ? row[ageIndex] : ''),
      patient_count: 1
    });
  });

  return {
    patientRows,
    skipped,
    missingDate
  };
}

async function ensureSchema(connection) {
  await connection.execute(
    "ALTER TABLE disease_reports MODIFY health_facility_id INT NULL COMMENT 'รหัสหน่วยบริการ (nullable for village-level imports)'"
  );

  const columns = [
    ['village_polygon_id', 'INT NULL AFTER health_facility_id'],
    ['district_name', 'VARCHAR(100) NULL AFTER disease_name'],
    ['tambon_name', 'VARCHAR(100) NULL AFTER district_name'],
    ['moo', 'VARCHAR(10) NULL AFTER tambon_name'],
    ['village_name', 'VARCHAR(150) NULL AFTER moo'],
    ['home_lat', 'DECIMAL(10,7) NULL AFTER village_name'],
    ['home_lng', 'DECIMAL(11,7) NULL AFTER home_lat'],
    ['source_key', 'VARCHAR(191) NULL AFTER home_lng'],
    ['import_source', 'VARCHAR(255) NULL AFTER source_key'],
    ['disease_code', 'VARCHAR(30) NULL AFTER import_source'],
    ['patient_type', 'VARCHAR(80) NULL AFTER disease_code'],
    ['sex', 'VARCHAR(20) NULL AFTER patient_type'],
    ['age_years', 'INT NULL AFTER sex'],
    ['agency', 'VARCHAR(255) NULL AFTER age_years'],
    ['diagnosis_date', 'DATE NULL AFTER agency'],
    ['treatment_date', 'DATE NULL AFTER diagnosis_date'],
    ['onset_date', 'DATE NULL AFTER treatment_date']
  ];

  for (const [name, definition] of columns) {
    const [[exists]] = await connection.execute(
      `SELECT COUNT(*) as count
       FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'disease_reports'
         AND COLUMN_NAME = ?`,
      [name]
    );
    if (!exists.count) {
      await connection.execute(`ALTER TABLE disease_reports ADD COLUMN ${name} ${definition}`);
    }
  }

  const indexes = [
    ['unique_disease_reports_source_key', 'CREATE UNIQUE INDEX unique_disease_reports_source_key ON disease_reports (source_key)'],
    ['idx_disease_reports_village', 'CREATE INDEX idx_disease_reports_village ON disease_reports (session_id, disease_name, district_name, tambon_name, moo)'],
    ['idx_disease_reports_polygon', 'CREATE INDEX idx_disease_reports_polygon ON disease_reports (village_polygon_id)']
  ];

  for (const [name, sql] of indexes) {
    const [[exists]] = await connection.execute(
      `SELECT COUNT(*) as count
       FROM INFORMATION_SCHEMA.STATISTICS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'disease_reports'
         AND INDEX_NAME = ?`,
      [name]
    );
    if (!exists.count) await connection.execute(sql);
  }
}

async function getActiveDengueSession(connection, explicitSessionId) {
  if (explicitSessionId) {
    const [rows] = await connection.execute(
      `SELECT id, session_number, opened_at, disease_name, status
       FROM eoc_sessions
       WHERE id = ? AND eoc_type = 'disease'
       LIMIT 1`,
      [explicitSessionId]
    );
    if (!rows.length) throw new Error(`ไม่พบ disease EOC session id=${explicitSessionId}`);
    return rows[0];
  }

  const [rows] = await connection.execute(
    `SELECT id, session_number, opened_at, disease_name, status
     FROM eoc_sessions
     WHERE eoc_type = 'disease'
       AND status = 'active'
       AND (disease_name IS NULL OR disease_name LIKE ?)
     ORDER BY opened_at DESC, id DESC
     LIMIT 1`,
    [`%${DISEASE_NAME}%`]
  );
  if (!rows.length) throw new Error('ไม่พบ EOC ไข้เลือดออกที่เปิดอยู่');
  return rows[0];
}

async function getVillageMap(connection) {
  const [rows] = await connection.execute(
    `SELECT id, distname, subdistnam, moo, villname, shape_area
     FROM satun_village_polygon
     ORDER BY distname, subdistnam, CAST(moo AS UNSIGNED), shape_area DESC, id`
  );

  const map = new Map();
  for (const row of rows) {
    if (!row.moo) continue;
    const key = [normalizeKey(row.distname), normalizeKey(row.subdistnam), normalizeMoo(row.moo)].join('|');
    if (!map.has(key)) map.set(key, row);
  }

  const polygonByVillageToken = new Map();
  for (const row of rows) {
    const tokens = String(row.villname || '')
      .split(/[,，、/]+/u)
      .map(token => normalizeKey(token))
      .filter(Boolean);
    for (const token of tokens) {
      const key = [normalizeKey(row.distname), normalizeKey(row.subdistnam), token].join('|');
      if (!polygonByVillageToken.has(key)) polygonByVillageToken.set(key, row);
    }
  }

  const [[villagesTable]] = await connection.execute(
    `SELECT COUNT(*) as count
     FROM INFORMATION_SCHEMA.TABLES
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'villages'`
  );

  if (villagesTable.count) {
    const [villages] = await connection.execute(
      `SELECT amphoe, tambon, moo, village_name
       FROM villages
       WHERE moo IS NOT NULL AND moo <> '' AND moo <> '0'
       ORDER BY CAST(moo AS UNSIGNED)`
    );

    for (const village of villages) {
      const directKey = [normalizeKey(village.amphoe), normalizeKey(village.tambon), normalizeMoo(village.moo)].join('|');
      if (map.has(directKey)) continue;

      const tokens = String(village.village_name || '')
        .split(/[,，、/]+/u)
        .map(token => normalizeKey(token))
        .filter(Boolean);
      for (const token of tokens) {
        const polygon = polygonByVillageToken.get([normalizeKey(village.amphoe), normalizeKey(village.tambon), token].join('|'));
        if (polygon) {
          map.set(directKey, { ...polygon, moo: normalizeMoo(village.moo), villname: village.village_name });
          break;
        }
      }
    }
  }

  return map;
}

function buildSourceKey(sessionId, item) {
  const base = [sessionId, item.source_key_seed].join('|');
  return `dengue-raw:${crypto.createHash('sha1').update(base).digest('hex')}`;
}

async function replaceExistingDengueRows(connection, sessionId, apply) {
  const [rows] = await connection.execute(
    `SELECT COUNT(*) as count, COALESCE(SUM(patient_count), 0) as patients
     FROM disease_reports
     WHERE session_id = ? AND disease_name = ?`,
    [sessionId, DISEASE_NAME]
  );
  const existing = {
    deletedRows: Number(rows[0]?.count || 0),
    deletedPatients: Number(rows[0]?.patients || 0)
  };

  if (apply && existing.deletedRows > 0) {
    await connection.execute(
      `DELETE FROM disease_reports
       WHERE session_id = ? AND disease_name = ?`,
      [sessionId, DISEASE_NAME]
    );
  }

  return existing;
}

async function upsertPatientRows(connection, session, patientRows, villageMap, apply) {
  let inserted = 0;
  let updated = 0;
  let wouldInsert = 0;
  let wouldUpdate = 0;
  let matchedVillage = 0;
  let unmatchedVillage = 0;
  let matchedPatients = 0;
  let unmatchedPatients = 0;

  for (const item of patientRows) {
    const villageKey = [normalizeKey(item.district_name), normalizeKey(item.tambon_name), item.moo].join('|');
    const village = villageMap.get(villageKey);
    if (village) {
      matchedVillage += 1;
      matchedPatients += item.patient_count;
    } else {
      unmatchedVillage += 1;
      unmatchedPatients += item.patient_count;
    }

    const sourceKey = buildSourceKey(session.id, item);
    const notes = [
      `นำเข้าจาก Raw_Dengue.csv โรคไข้เลือดออก`,
      `รหัสกลุ่มโรค: ${item.disease_code}`,
      `ประเภทผู้ป่วย: ${item.patient_type}`,
      `เพศ: ${item.sex}`,
      `อายุปี: ${item.age_years ?? 'ไม่ระบุ'}`,
      `หน่วยงาน: ${item.agency}`,
      `source row: ${item.source_row}`
    ].join('; ');

    const [existing] = await connection.execute(
      'SELECT id FROM disease_reports WHERE source_key = ? LIMIT 1',
      [sourceKey]
    );

    if (!apply) {
      if (existing.length) wouldUpdate += 1;
      else wouldInsert += 1;
      continue;
    }

    const [result] = await connection.execute(
      `INSERT INTO disease_reports
       (session_id, report_date, health_facility_id, village_polygon_id, disease_name,
        district_name, tambon_name, moo, village_name, patient_count, notes,
        source_key, import_source, disease_code, patient_type, sex, age_years, agency,
        diagnosis_date, treatment_date, onset_date)
       VALUES (?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         report_date = VALUES(report_date),
         village_polygon_id = VALUES(village_polygon_id),
         district_name = VALUES(district_name),
         tambon_name = VALUES(tambon_name),
         moo = VALUES(moo),
         village_name = VALUES(village_name),
         patient_count = VALUES(patient_count),
         notes = VALUES(notes),
         import_source = VALUES(import_source),
         disease_code = VALUES(disease_code),
         patient_type = VALUES(patient_type),
         sex = VALUES(sex),
         age_years = VALUES(age_years),
         agency = VALUES(agency),
         diagnosis_date = VALUES(diagnosis_date),
         treatment_date = VALUES(treatment_date),
         onset_date = VALUES(onset_date),
         updated_at = CURRENT_TIMESTAMP`,
      [
        session.id,
        item.report_date,
        village?.id || null,
        DISEASE_NAME,
        item.district_name,
        item.tambon_name,
        item.moo,
        village?.villname || null,
        item.patient_count,
        notes,
        sourceKey,
        IMPORT_SOURCE,
        item.disease_code,
        item.patient_type,
        item.sex,
        item.age_years,
        item.agency,
        item.diagnosis_date,
        item.treatment_date,
        item.onset_date
      ]
    );

    if (existing.length || result.affectedRows === 2) updated += 1;
    else inserted += 1;
  }

  return { inserted, updated, wouldInsert, wouldUpdate, matchedVillage, unmatchedVillage, matchedPatients, unmatchedPatients };
}

async function writeReport(report) {
  const reportPath = path.join(process.cwd(), 'tmp_dengue_cases_import_report.json');
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  return reportPath;
}

async function main() {
  loadEnv(path.join(process.cwd(), '.env'));

  const url = getArg('url', DEFAULT_SHEET_URL);
  const sheet = getArg('sheet', DEFAULT_SHEET_NAME);
  const file = getArg('file');
  const sessionId = getArg('session-id');
  const apply = hasFlag('apply');
  const replace = hasFlag('replace');
  const csvUrl = sheetCsvUrl(url, sheet);

  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'stneoc',
    port: Number(process.env.DB_PORT || 3306),
    charset: 'utf8mb4'
  });

  try {
    await ensureSchema(connection);
    await connection.execute(
      `INSERT INTO common_diseases (name, description, is_active)
       VALUES (?, ?, 1)
       ON DUPLICATE KEY UPDATE is_active = 1`,
      [DISEASE_NAME, 'ไข้เลือดออกจากยุงลาย']
    );

    const session = await getActiveDengueSession(connection, sessionId);
    const fallbackDate = new Date(session.opened_at).toISOString().slice(0, 10);
    const csv = file
      ? fs.readFileSync(path.resolve(process.cwd(), file), 'utf8')
      : await fetchCsv(csvUrl);
    const rows = parseCsv(csv);
    const { patientRows, skipped, missingDate } = rowsToPatientRows(rows, fallbackDate);
    const villageMap = await getVillageMap(connection);
    const replaceResult = replace
      ? await replaceExistingDengueRows(connection, session.id, apply)
      : { deletedRows: 0, deletedPatients: 0 };
    const importResult = await upsertPatientRows(connection, session, patientRows, villageMap, apply);

    const report = {
      apply,
      replace,
      csvSource: file ? path.resolve(process.cwd(), file) : csvUrl,
      session: {
        id: session.id,
        session_number: session.session_number,
        disease_name: session.disease_name,
        status: session.status
      },
      sourceRows: Math.max(rows.filter(row => row.some(cell => normalizeText(cell))).length - 1, 0),
      patientRows: patientRows.length,
      skippedRows: skipped,
      rowsUsingFallbackDate: missingDate,
      ...replaceResult,
      ...importResult
    };
    const reportPath = await writeReport(report);

    console.log(JSON.stringify({ ...report, reportPath }, null, 2));
  } finally {
    await connection.end();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
