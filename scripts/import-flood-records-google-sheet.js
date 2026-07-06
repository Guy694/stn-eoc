const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

const DEFAULT_SHEET_URL = 'https://docs.google.com/spreadsheets/d/15CskzCEhHvI2jYyOLByr6ptbTTMXKnM04r-sLU3KXTE/edit?usp=sharing';
const DEFAULT_SESSION_NUMBER = 3;
const DEFAULT_FLOOD_LEVEL = 'ต่ำ';
const DEFAULT_STATUS = 'กำลังดำเนินการ';
const IMPORT_SOURCE = 'Google Sheet: บันทึกน้ำท่วม session 3';
const FLOOD_LEVELS = new Set(['ไม่มี', 'ต่ำ', 'ปานกลาง', 'สูง', 'สูงมาก']);

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
    .replace(/^(จังหวัด|จ|อำเภอ|อ|ตำบล|ต)/u, '')
    .toLowerCase();
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

function parseNumber(value) {
  const text = String(value || '').replace(/[,\s]/g, '').trim();
  if (!text || text === '-') return null;
  const number = Number(text);
  return Number.isFinite(number) ? number : null;
}

function parseDate(value, fallback) {
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

function localDateString(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  const local = new Date(date.getTime() + (7 * 60 * 60 * 1000));
  return local.toISOString().slice(0, 10);
}

function columnIndex(headers, patterns) {
  return headers.findIndex(header => {
    const normalizedHeader = normalizeHeader(header).toLowerCase();
    const normalizedKey = normalizeKey(header);
    return patterns.some(pattern => pattern.test(normalizedHeader) || pattern.test(normalizedKey));
  });
}

function sheetCsvUrl(inputUrl, gid) {
  if (/output=csv|format=csv/.test(inputUrl)) return inputUrl;

  const match = inputUrl.match(/\/spreadsheets\/d\/([^/]+)/);
  if (!match) return inputUrl;

  return `https://docs.google.com/spreadsheets/d/${match[1]}/export?format=csv&gid=${gid}`;
}

async function fetchSheetCsv(url) {
  const response = await fetch(url, { redirect: 'follow' });
  const text = await response.text();

  if (!response.ok) {
    throw new Error(`ดึงชีตไม่สำเร็จ: HTTP ${response.status}`);
  }

  if (/ลงชื่อเข้าสู่บัญชีผู้ใช้ Google|ServiceLogin|InteractiveLogin|accounts\.google\.com/i.test(text)) {
    throw new Error('ยังเข้าถึง Google Sheet ไม่ได้ กรุณาแชร์เป็น Anyone with the link can view หรือส่งลิงก์ export CSV');
  }

  if (/<!DOCTYPE html>|<html/i.test(text.slice(0, 300))) {
    throw new Error('ลิงก์ที่ได้ไม่ใช่ CSV กรุณาตรวจสอบสิทธิ์หรือระบุ gid/tab ให้ถูกต้อง');
  }

  return text;
}

function rowsToRecords(rows, sessionStartDate) {
  const nonEmptyRows = rows.filter(row => row.some(cell => normalizeText(cell)));
  if (nonEmptyRows.length < 2) throw new Error('ไม่พบข้อมูลในชีต');

  const headers = nonEmptyRows[0].map(normalizeHeader);
  const districtIndex = columnIndex(headers, [/อำเภอ/u, /district/]);
  const tambonIndex = columnIndex(headers, [/ตำบล/u, /ตําบล/u, /subdistrict/, /tambon/]);
  const villageIndex = columnIndex(headers, [/หมู่/u, /village/]);
  const dateIndex = columnIndex(headers, [/วันที่/u, /date/, /floodstart/]);
  const levelIndex = columnIndex(headers, [/ระดับน้ำท่วม/u, /ระดับความรุนแรง/u, /floodlevel/, /^level$/]);
  const depthIndex = columnIndex(headers, [/ความลึก/u, /ระดับน้ำ/u, /depth/, /cm/]);
  const householdsIndex = columnIndex(headers, [/ครัวเรือน/u, /household/]);
  const peopleIndex = columnIndex(headers, [/ประชาชน/u, /ประชากร/u, /people/, /population/]);
  const areaIndex = columnIndex(headers, [/พื้นที่/u, /area/]);
  const descriptionIndex = columnIndex(headers, [/หมายเหตุ/u, /รายละเอียด/u, /description/, /note/]);

  if (tambonIndex < 0) {
    throw new Error(`ไม่พบคอลัมน์ตำบลในชีต หัวตารางที่พบ: ${headers.join(', ')}`);
  }

  const defaultFloodLevel = getArg('default-flood-level', DEFAULT_FLOOD_LEVEL);
  if (!FLOOD_LEVELS.has(defaultFloodLevel)) {
    throw new Error(`default flood level ไม่ถูกต้อง: ${defaultFloodLevel}`);
  }

  const records = [];
  const seen = new Set();

  for (const row of nonEmptyRows.slice(1)) {
    const tambon = normalizeText(row[tambonIndex]);
    if (!tambon || tambon === 'รวม') continue;

    const district = districtIndex >= 0 ? normalizeText(row[districtIndex]) : '';
    const village = villageIndex >= 0 ? normalizeText(row[villageIndex]) : '';
    const floodDate = parseDate(dateIndex >= 0 ? row[dateIndex] : '', sessionStartDate);
    const floodLevel = normalizeText(levelIndex >= 0 ? row[levelIndex] : '') || defaultFloodLevel;

    if (!FLOOD_LEVELS.has(floodLevel)) {
      throw new Error(`ระดับน้ำท่วมไม่ถูกต้อง "${floodLevel}" ที่ตำบล ${tambon}`);
    }

    const key = [normalizeKey(district), normalizeKey(tambon), normalizeKey(village), floodDate].join('|');
    if (seen.has(key)) continue;
    seen.add(key);

    records.push({
      district,
      tambon,
      village,
      flood_start_date: floodDate,
      flood_level: floodLevel,
      water_depth_cm: depthIndex >= 0 ? parseNumber(row[depthIndex]) : null,
      affected_area_sqm: areaIndex >= 0 ? parseNumber(row[areaIndex]) : null,
      affected_households: householdsIndex >= 0 ? (parseNumber(row[householdsIndex]) || 0) : 0,
      affected_people: peopleIndex >= 0 ? (parseNumber(row[peopleIndex]) || 0) : 0,
      description: descriptionIndex >= 0 ? normalizeText(row[descriptionIndex]) : null,
    });
  }

  return { headers, records };
}

async function getSession(connection, sessionNumber) {
  const [rows] = await connection.execute(
    `SELECT id, session_number, status, opened_at, closed_at
     FROM eoc_sessions
     WHERE eoc_type = 'flood' AND session_number = ?
     ORDER BY id DESC
     LIMIT 1`,
    [sessionNumber]
  );

  if (!rows.length) throw new Error(`ไม่พบ flood EOC session_number=${sessionNumber}`);
  return rows[0];
}

async function getPolygons(connection, source) {
  const params = [];
  let where = 'subdistnam = ?';
  params.push(source.tambon);

  if (source.district) {
    where += ' AND distname = ?';
    params.push(source.district);
  }

  if (source.village) {
    where += ' AND villname = ?';
    params.push(source.village);
  }

  const [rows] = await connection.execute(
    `SELECT id, distname, subdistnam, villname, shape_area
     FROM satun_village_polygon
     WHERE ${where}
     ORDER BY distname, subdistnam, villname, id`,
    params
  );

  return rows;
}

async function upsertFloodRecord(connection, session, source, polygon, apply) {
  const [existing] = await connection.execute(
    `SELECT id
     FROM flood_records
     WHERE session_id = ? AND polygon_id = ? AND flood_start_date = ?
     LIMIT 1`,
    [session.id, polygon.id, source.flood_start_date]
  );

  if (!apply) {
    return existing.length ? 'would_update' : 'would_insert';
  }

  const values = [
    session.opened_at.getFullYear(),
    polygon.id,
    'สตูล',
    polygon.distname,
    polygon.subdistnam,
    polygon.villname,
    source.flood_level,
    source.flood_start_date,
    source.water_depth_cm,
    session.id,
    source.affected_area_sqm,
    source.affected_households,
    source.affected_people,
    source.description,
    DEFAULT_STATUS,
    IMPORT_SOURCE,
  ];

  if (existing.length) {
    await connection.execute(
      `UPDATE flood_records
       SET year = ?, polygon_id = ?, province = ?, district = ?, tambon = ?, village = ?,
           flood_level = ?, flood_start_date = ?, water_depth_cm = ?, session_id = ?,
           affected_area_sqm = ?, affected_households = ?, affected_people = ?,
           description = ?, status = ?, created_by = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [...values, existing[0].id]
    );
    return 'updated';
  }

  await connection.execute(
    `INSERT INTO flood_records
     (year, polygon_id, province, district, tambon, village, flood_level, flood_start_date,
      water_depth_cm, session_id, affected_area_sqm, affected_households, affected_people,
      description, status, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    values
  );
  return 'inserted';
}

async function main() {
  loadEnv(path.join(process.cwd(), '.env.local'));
  loadEnv(path.join(process.cwd(), '.env'));

  const apply = hasFlag('apply');
  const sheetUrl = getArg('sheet-url', DEFAULT_SHEET_URL);
  const gid = getArg('gid', '0');
  const sessionNumber = Number(getArg('session-number', DEFAULT_SESSION_NUMBER));
  const csvUrl = sheetCsvUrl(sheetUrl, gid);

  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'stneoc',
    port: Number(process.env.DB_PORT || 3306),
  });

  try {
    const session = await getSession(connection, sessionNumber);
    const sessionStartDate = localDateString(session.opened_at);
    const sessionEndDate = localDateString(session.closed_at) || sessionStartDate;
    const csv = await fetchSheetCsv(csvUrl);
    const rows = parseCsv(csv);
    const { headers, records } = rowsToRecords(rows, sessionStartDate);
    const report = {
      mode: apply ? 'apply' : 'dry-run',
      session,
      sessionStartDate,
      sessionEndDate,
      sheet: { url: sheetUrl, csvUrl, headers },
      sourceRows: records.length,
      inserted: 0,
      updated: 0,
      would_insert: 0,
      would_update: 0,
      unmatched: [],
      outOfRange: [],
      tambons: [],
    };

    await connection.beginTransaction();

    for (const record of records) {
      if (record.flood_start_date < sessionStartDate || record.flood_start_date > sessionEndDate) {
        report.outOfRange.push(record);
        continue;
      }

      const polygons = await getPolygons(connection, record);
      if (!polygons.length) {
        report.unmatched.push(record);
        continue;
      }

      report.tambons.push({
        district: record.district || polygons[0].distname,
        tambon: record.tambon,
        date: record.flood_start_date,
        polygons: polygons.length,
      });

      for (const polygon of polygons) {
        const action = await upsertFloodRecord(connection, session, record, polygon, apply);
        report[action] += 1;
      }
    }

    if (apply) {
      await connection.commit();
    } else {
      await connection.rollback();
    }

    const reportPath = path.join(process.cwd(), 'tmp_flood_records_session3_import_report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8');

    console.log(JSON.stringify({
      mode: report.mode,
      sessionId: session.id,
      sessionNumber: session.session_number,
      sourceRows: report.sourceRows,
      inserted: report.inserted,
      updated: report.updated,
      would_insert: report.would_insert,
      would_update: report.would_update,
      unmatched: report.unmatched.length,
      outOfRange: report.outOfRange.length,
      reportPath,
    }, null, 2));
  } catch (error) {
    try {
      await connection.rollback();
    } catch (_) {
      // Ignore rollback errors before a transaction starts.
    }
    throw error;
  } finally {
    await connection.end();
  }
}

main().catch(error => {
  console.error(error.message);
  process.exit(1);
});
