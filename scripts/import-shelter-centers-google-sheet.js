const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

const SHEET_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSs49yOMfr54tr_JILpj7sVKhKz4hqo5EcVOifGorgHF-udlNRptn26ToObDoMPB_mRBnM1a5AagzkK/pub?gid=653690817&single=true&output=csv';
const SOURCE_AS_OF_DATE = '2025-12-01';
const IMPORT_SOURCE = 'Google Sheet: ข้อมูลศูนย์พักพิงรองรับสถานการณ์อุทกภัยจังหวัดสตูล';

function normalizeText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function normalizeKeyPart(value) {
  return normalizeText(value).replace(/\s+/g, '').toLowerCase();
}

function parseNumber(value) {
  const normalized = String(value || '').replace(/[,\s]/g, '').trim();
  if (!normalized) return 0;
  const number = Number(normalized);
  return Number.isFinite(number) ? number : 0;
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

function buildSourceKey(row) {
  const rawKey = [
    normalizeKeyPart(row.districtName),
    normalizeKeyPart(row.tambon),
    normalizeKeyPart(row.village),
    normalizeKeyPart(row.sheltername),
  ].join('|');

  return crypto.createHash('sha1').update(rawKey).digest('hex');
}

function rowToShelter(row, index) {
  const districtName = normalizeText(row[0]);
  const tambon = normalizeText(row[1]);
  const sheltername = normalizeText(row[2]);
  const village = normalizeText(row[4]);

  if (!districtName || !tambon || !sheltername) return null;

  const occupancy = {
    child0To5: parseNumber(row[6]),
    child6To17: parseNumber(row[7]),
    youth18To25: parseNumber(row[8]),
    working26To59: parseNumber(row[9]),
    elderly60Plus: parseNumber(row[10]),
    disabled: parseNumber(row[11]),
    bedridden: parseNumber(row[12]),
  };
  const currentOccupancyTotal = Object.values(occupancy).reduce((sum, value) => sum + value, 0);

  const shelter = {
    rowNumber: index + 1,
    districtName,
    tambon,
    sheltername,
    shelterStatus: normalizeText(row[3]),
    village,
    capacity: parseNumber(row[5]),
    currentOccupancyTotal,
    ...occupancy,
    responsibleOrg: normalizeText(row[13]),
    coordinatorName: normalizeText(row[14]),
    coordinatorPhone: normalizeText(row[15]),
    healthServiceName: normalizeText(row[16]),
    healthStaffPerDay: normalizeText(row[17]),
    healthContactPhone: normalizeText(row[18]),
  };

  shelter.sourceKey = buildSourceKey(shelter);
  shelter.address = [
    village ? `หมู่ ${village}` : '',
    tambon ? `ต.${tambon}` : '',
    districtName ? `อ.${districtName}` : '',
    'จ.สตูล',
  ].filter(Boolean).join(' ');

  return shelter;
}

async function columnExists(connection, columnName) {
  const [rows] = await connection.execute(
    `SELECT COLUMN_NAME
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'shelter_centers'
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
       AND TABLE_NAME = 'shelter_centers'
       AND INDEX_NAME = ?`,
    [indexName]
  );
  return rows.length > 0;
}

async function ensureSchema(connection) {
  await connection.execute('ALTER TABLE shelter_centers MODIFY lat DECIMAL(10,7) NULL');
  await connection.execute('ALTER TABLE shelter_centers MODIFY lon DECIMAL(10,7) NULL');

  const columns = [
    ['source_key', 'VARCHAR(80) NULL COMMENT "Stable import key from source sheet" AFTER id'],
    ['shelter_status', 'VARCHAR(50) NULL COMMENT "สถานะจากชีต เช่น ปิด/ยังไม่เปิด/เปิด" AFTER eoc_type'],
    ['current_occupancy_total', 'INT NULL DEFAULT 0 COMMENT "จำนวนผู้พักพิง/อพยพรวมจากชีต" AFTER shelter_capacity'],
    ['occupancy_child_0_5', 'INT NULL DEFAULT 0 AFTER current_occupancy_total'],
    ['occupancy_child_6_17', 'INT NULL DEFAULT 0 AFTER occupancy_child_0_5'],
    ['occupancy_youth_18_25', 'INT NULL DEFAULT 0 AFTER occupancy_child_6_17'],
    ['occupancy_working_26_59', 'INT NULL DEFAULT 0 AFTER occupancy_youth_18_25'],
    ['occupancy_elderly_60_plus', 'INT NULL DEFAULT 0 AFTER occupancy_working_26_59'],
    ['occupancy_disabled', 'INT NULL DEFAULT 0 AFTER occupancy_elderly_60_plus'],
    ['occupancy_bedridden', 'INT NULL DEFAULT 0 AFTER occupancy_disabled'],
    ['responsible_org', 'VARCHAR(255) NULL AFTER contact_phone'],
    ['coordinator_name', 'VARCHAR(255) NULL AFTER responsible_org'],
    ['coordinator_phone', 'VARCHAR(100) NULL AFTER coordinator_name'],
    ['health_service_name', 'VARCHAR(255) NULL AFTER coordinator_phone'],
    ['health_staff_per_day', 'VARCHAR(255) NULL AFTER health_service_name'],
    ['health_contact_phone', 'VARCHAR(255) NULL AFTER health_staff_per_day'],
    ['source_as_of_date', 'DATE NULL AFTER health_contact_phone'],
    ['import_source', 'VARCHAR(255) NULL AFTER source_as_of_date'],
  ];

  for (const [name, definition] of columns) {
    if (!(await columnExists(connection, name))) {
      await connection.execute(`ALTER TABLE shelter_centers ADD COLUMN ${name} ${definition}`);
    }
  }

  if (!(await indexExists(connection, 'uq_shelter_centers_source_key'))) {
    await connection.execute('ALTER TABLE shelter_centers ADD UNIQUE KEY uq_shelter_centers_source_key (source_key)');
  }
}

async function findExistingShelter(connection, shelter) {
  const [byKey] = await connection.execute(
    'SELECT id FROM shelter_centers WHERE source_key = ? LIMIT 1',
    [shelter.sourceKey]
  );
  if (byKey.length) return byKey[0].id;

  const [byNaturalKey] = await connection.execute(
    `SELECT id
     FROM shelter_centers
     WHERE sheltername = ?
       AND tambon = ?
       AND COALESCE(district_name, '') = ?
       AND COALESCE(village, '') = ?
     LIMIT 1`,
    [shelter.sheltername, shelter.tambon, shelter.districtName, shelter.village]
  );
  return byNaturalKey[0]?.id || null;
}

async function upsertShelter(connection, shelter) {
  const existingId = await findExistingShelter(connection, shelter);
  const values = [
    shelter.sourceKey,
    shelter.sheltername,
    'flood',
    shelter.shelterStatus || null,
    null,
    null,
    shelter.address,
    shelter.tambon,
    shelter.districtName,
    shelter.village || null,
    1,
    shelter.capacity,
    shelter.currentOccupancyTotal,
    shelter.child0To5,
    shelter.child6To17,
    shelter.youth18To25,
    shelter.working26To59,
    shelter.elderly60Plus,
    shelter.disabled,
    shelter.bedridden,
    shelter.coordinatorPhone || null,
    shelter.responsibleOrg || null,
    shelter.coordinatorName || null,
    shelter.coordinatorPhone || null,
    shelter.healthServiceName || null,
    shelter.healthStaffPerDay || null,
    shelter.healthContactPhone || null,
    SOURCE_AS_OF_DATE,
    IMPORT_SOURCE,
  ];

  if (existingId) {
    await connection.execute(
      `UPDATE shelter_centers
       SET source_key = ?,
           sheltername = ?,
           eoc_type = ?,
           shelter_status = ?,
           lat = ?,
           lon = ?,
           address = ?,
           tambon = ?,
           district_name = ?,
           village = ?,
           is_active = ?,
           shelter_capacity = ?,
           current_occupancy_total = ?,
           occupancy_child_0_5 = ?,
           occupancy_child_6_17 = ?,
           occupancy_youth_18_25 = ?,
           occupancy_working_26_59 = ?,
           occupancy_elderly_60_plus = ?,
           occupancy_disabled = ?,
           occupancy_bedridden = ?,
           contact_phone = ?,
           responsible_org = ?,
           coordinator_name = ?,
           coordinator_phone = ?,
           health_service_name = ?,
           health_staff_per_day = ?,
           health_contact_phone = ?,
           source_as_of_date = ?,
           import_source = ?,
           updated_at = NOW()
       WHERE id = ?`,
      [...values, existingId]
    );
    return { action: 'updated', id: existingId };
  }

  const [result] = await connection.execute(
    `INSERT INTO shelter_centers
     (source_key, sheltername, eoc_type, shelter_status, lat, lon, address, tambon, district_name, village,
      is_active, shelter_capacity, current_occupancy_total,
      occupancy_child_0_5, occupancy_child_6_17, occupancy_youth_18_25, occupancy_working_26_59,
      occupancy_elderly_60_plus, occupancy_disabled, occupancy_bedridden,
      contact_phone, responsible_org, coordinator_name, coordinator_phone,
      health_service_name, health_staff_per_day, health_contact_phone, source_as_of_date, import_source)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    values
  );
  return { action: 'created', id: result.insertId };
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const response = await fetch(SHEET_URL);
  if (!response.ok) throw new Error(`โหลด CSV ไม่สำเร็จ: ${response.status}`);
  const csvText = await response.text();
  const rows = parseCsv(csvText);
  const shelters = rows.slice(5).map(rowToShelter).filter(Boolean);

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
    sourceAsOfDate: SOURCE_AS_OF_DATE,
    totalCsvRows: rows.length,
    importedRows: shelters.length,
    shelters: [],
  };

  try {
    await ensureSchema(connection);

    await connection.beginTransaction();

    for (const shelter of shelters) {
      const result = await upsertShelter(connection, shelter);
      report.shelters.push({ ...shelter, ...result });
    }

    if (dryRun) await connection.rollback();
    else await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    await connection.end();
  }

  const reportPath = path.join(process.cwd(), 'tmp_shelter_centers_import_report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8');

  const csvPath = path.join(process.cwd(), 'tmp_shelter_centers_import.csv');
  const header = [
    'id', 'action', 'districtName', 'tambon', 'village', 'sheltername', 'shelterStatus',
    'capacity', 'currentOccupancyTotal', 'responsibleOrg', 'coordinatorName', 'coordinatorPhone',
    'healthServiceName', 'healthStaffPerDay', 'healthContactPhone',
  ];
  const output = [header.join(',')];
  for (const shelter of report.shelters) {
    output.push(header.map(key => `"${String(shelter[key] ?? '').replace(/"/g, '""')}"`).join(','));
  }
  fs.writeFileSync(csvPath, output.join('\n'), 'utf8');

  console.log(JSON.stringify({
    dryRun,
    csvRows: rows.length,
    importedRows: shelters.length,
    created: report.shelters.filter(item => item.action === 'created').length,
    updated: report.shelters.filter(item => item.action === 'updated').length,
    reportPath,
    csvPath,
  }, null, 2));
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
