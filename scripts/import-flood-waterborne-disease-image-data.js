const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

const IMPORT_SOURCE = 'นำเข้าจากภาพตารางโรคที่มากับน้ำท่วม';
const TIMEZONE = 'Asia/Bangkok';

const FACILITIES = [
  { key: 'satun', label: 'สตูล', name: 'รพ.สตูล' },
  { key: 'khuanDon', label: 'ควนโดน', name: 'รพ.ควนโดน' },
  { key: 'khuanKalong', label: 'ควนกาหลง', name: 'รพ.ควนกาหลง' },
  { key: 'thaPhae', label: 'ท่าแพ', name: 'รพ.ท่าแพ' },
  { key: 'laNgu', label: 'ละงู', name: 'รพ.ละงู' },
  { key: 'manang', label: 'มะนัง', name: 'รพ.มะนัง' },
  { key: 'thungWa', label: 'ทุ่งหว้า', name: 'รพ.ทุ่งหว้า' },
];

const DISEASES = [
  {
    name: 'ทางเดินอาหาร',
    description: 'กลุ่มอาการโรคระบบทางเดินอาหารที่สัมพันธ์กับน้ำท่วม',
    totalToday: 12,
    totalCumulative: 190,
    facilities: {
      satun: [10, 115],
      khuanDon: [0, 24],
      khuanKalong: [0, 9],
      thaPhae: [1, 6],
      laNgu: [1, 24],
      manang: [0, 7],
      thungWa: [0, 5],
    },
  },
  {
    name: 'ไข้หวัดใหญ่',
    description: 'โรคไข้หวัดใหญ่',
    totalToday: 16,
    totalCumulative: 245,
    facilities: {
      satun: [4, 89],
      khuanDon: [2, 34],
      khuanKalong: [2, 16],
      thaPhae: [0, 8],
      laNgu: [7, 40],
      manang: [1, 48],
      thungWa: [0, 10],
    },
  },
  {
    name: 'ปอดอักเสบ',
    description: 'โรคปอดอักเสบ',
    totalToday: 12,
    totalCumulative: 12,
    facilities: {
      satun: [3, 3],
      khuanDon: [0, 0],
      khuanKalong: [9, 9],
      thaPhae: [0, 0],
      laNgu: [0, 0],
      manang: [0, 0],
      thungWa: [0, 0],
    },
  },
  {
    name: 'เลปโตสไปโรซีส',
    description: 'โรคฉี่หนูหรือเลปโตสไปโรซีส',
    totalToday: 2,
    totalCumulative: 11,
    facilities: {
      satun: [1, 2],
      khuanDon: [0, 0],
      khuanKalong: [0, 0],
      thaPhae: [0, 0],
      laNgu: [1, 2],
      manang: [0, 7],
      thungWa: [0, 0],
    },
  },
  {
    name: 'ไข้เลือดออก',
    description: 'โรคไข้เลือดออก',
    totalToday: 0,
    totalCumulative: 5,
    facilities: {
      satun: [0, 2],
      khuanDon: [0, 0],
      khuanKalong: [0, 0],
      thaPhae: [0, 0],
      laNgu: [0, 1],
      manang: [0, 2],
      thungWa: [0, 0],
    },
  },
  {
    name: 'ตาแดง',
    description: 'โรคตาแดงหรือตาอักเสบ',
    totalToday: 3,
    totalCumulative: 4,
    facilities: {
      satun: [2, 2],
      khuanDon: [1, 2],
      khuanKalong: [0, 0],
      thaPhae: [0, 0],
      laNgu: [0, 0],
      manang: [0, 0],
      thungWa: [0, 0],
    },
  },
];

function getArgValue(name) {
  const prefix = `--${name}=`;
  const arg = process.argv.find(item => item.startsWith(prefix));
  return arg ? arg.slice(prefix.length) : null;
}

function todayInBangkok() {
  return new Date().toLocaleDateString('en-CA', { timeZone: TIMEZONE });
}

function addDays(dateString, days) {
  const date = new Date(`${dateString}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function validateData() {
  const totals = { today: 0, cumulative: 0 };

  for (const disease of DISEASES) {
    const rowToday = FACILITIES.reduce((sum, facility) => sum + disease.facilities[facility.key][0], 0);
    const rowCumulative = FACILITIES.reduce((sum, facility) => sum + disease.facilities[facility.key][1], 0);

    if (rowToday !== disease.totalToday || rowCumulative !== disease.totalCumulative) {
      throw new Error(`ยอดรวมโรค ${disease.name} ไม่ตรงกับภาพ: วันนี้ ${rowToday}/${disease.totalToday}, สะสม ${rowCumulative}/${disease.totalCumulative}`);
    }

    totals.today += rowToday;
    totals.cumulative += rowCumulative;
  }

  if (totals.today !== 45 || totals.cumulative !== 467) {
    throw new Error(`ยอดรวมทั้งหมดไม่ตรงกับภาพ: วันนี้ ${totals.today}/45, สะสม ${totals.cumulative}/467`);
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

async function loadFacilityIds(connection) {
  const map = new Map();
  for (const facility of FACILITIES) {
    const [rows] = await connection.execute(
      'SELECT id, name, district_name FROM health_facilities WHERE name = ? LIMIT 1',
      [facility.name]
    );
    if (!rows.length) throw new Error(`ไม่พบหน่วยบริการ ${facility.name}`);
    map.set(facility.key, rows[0]);
  }
  return map;
}

async function upsertCommonDiseases(connection) {
  for (const disease of DISEASES) {
    await connection.execute(
      `INSERT INTO common_diseases (name, description, is_active)
       VALUES (?, ?, 1)
       ON DUPLICATE KEY UPDATE
         description = COALESCE(description, VALUES(description)),
         is_active = 1`,
      [disease.name, disease.description]
    );
  }
}

function buildRows({ sessionId, reportDate, baselineDate, reporterId, facilityMap }) {
  const rows = [];
  for (const disease of DISEASES) {
    for (const facility of FACILITIES) {
      const [todayCount, cumulativeCount] = disease.facilities[facility.key];
      const priorCount = cumulativeCount - todayCount;
      const facilityRecord = facilityMap.get(facility.key);

      if (priorCount < 0) {
        throw new Error(`ยอดสะสมน้อยกว่ายอดวันนี้: ${disease.name}/${facility.name}`);
      }

      if (priorCount > 0) {
        rows.push({
          session_id: sessionId,
          report_date: baselineDate,
          health_facility_id: facilityRecord.id,
          facility_name: facilityRecord.name,
          district_name: facilityRecord.district_name,
          disease_name: disease.name,
          patient_count: priorCount,
          notes: `${IMPORT_SOURCE} - ยอดสะสมก่อนวันที่ ${reportDate}`,
          reported_by: reporterId,
          bucket: 'baseline',
        });
      }

      if (todayCount > 0) {
        rows.push({
          session_id: sessionId,
          report_date: reportDate,
          health_facility_id: facilityRecord.id,
          facility_name: facilityRecord.name,
          district_name: facilityRecord.district_name,
          disease_name: disease.name,
          patient_count: todayCount,
          notes: `${IMPORT_SOURCE} - ยอดวันนี้`,
          reported_by: reporterId,
          bucket: 'today',
        });
      }
    }
  }
  return rows;
}

async function upsertDiseaseReport(connection, row) {
  const [result] = await connection.execute(
    `INSERT INTO disease_reports
     (session_id, report_date, health_facility_id, disease_name, patient_count, notes, reported_by)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       session_id = VALUES(session_id),
       patient_count = VALUES(patient_count),
       notes = VALUES(notes),
       reported_by = VALUES(reported_by),
       updated_at = CURRENT_TIMESTAMP`,
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

  return result.affectedRows === 1 ? 'created' : 'updated';
}

function writeReport(report) {
  const reportPath = path.join(process.cwd(), 'tmp_flood_waterborne_disease_import_report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8');

  const csvPath = path.join(process.cwd(), 'tmp_flood_waterborne_disease_import.csv');
  const header = [
    'action',
    'bucket',
    'session_id',
    'report_date',
    'facility_name',
    'district_name',
    'disease_name',
    'patient_count',
  ];
  const lines = [header.join(',')];
  for (const row of report.rows) {
    lines.push(header.map(key => `"${String(row[key] ?? '').replace(/"/g, '""')}"`).join(','));
  }
  fs.writeFileSync(csvPath, lines.join('\n'), 'utf8');

  return { reportPath, csvPath };
}

async function main() {
  validateData();

  const dryRun = process.argv.includes('--dry-run');
  const reportDate = getArgValue('date') || todayInBangkok();
  const baselineDate = getArgValue('baseline-date') || addDays(reportDate, -1);

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
    importSource: IMPORT_SOURCE,
    reportDate,
    baselineDate,
    expectedTotals: { today: 45, cumulative: 467 },
    session: null,
    rows: [],
  };

  try {
    const session = await getActiveFloodSession(connection);
    const reporterId = await getReporterId(connection);
    const facilityMap = await loadFacilityIds(connection);

    report.session = session;

    await connection.beginTransaction();
    await upsertCommonDiseases(connection);

    const rows = buildRows({
      sessionId: session.id,
      reportDate,
      baselineDate,
      reporterId,
      facilityMap,
    });

    for (const row of rows) {
      const action = await upsertDiseaseReport(connection, row);
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

  const { reportPath, csvPath } = writeReport(report);
  console.log(JSON.stringify({
    dryRun,
    sessionId: report.session.id,
    reportDate,
    baselineDate,
    rows: report.rows.length,
    created: report.rows.filter(row => row.action === 'created').length,
    updated: report.rows.filter(row => row.action === 'updated').length,
    todayTotal: report.rows
      .filter(row => row.bucket === 'today')
      .reduce((sum, row) => sum + row.patient_count, 0),
    cumulativeTotal: report.rows.reduce((sum, row) => sum + row.patient_count, 0),
    reportPath,
    csvPath,
  }, null, 2));
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
