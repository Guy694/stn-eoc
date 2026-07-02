const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

const IMPORT_SOURCE = 'นำเข้าจากภาพตารางการเฝ้าระวังโรคที่มากับน้ำท่วม (สะสมตั้งแต่น้ำท่วม)';
const DEFAULT_START_DATE = '2025-11-30';
const DEFAULT_END_DATE = '2025-12-15';

const FACILITIES = [
  { key: 'satun', label: 'เมืองสตูล', name: 'รพ.สตูล' },
  { key: 'khuanDon', label: 'ควนโดน', name: 'รพ.ควนโดน' },
  { key: 'khuanKalong', label: 'ควนกาหลง', name: 'รพ.ควนกาหลง' },
  { key: 'thaPhae', label: 'ท่าแพ', name: 'รพ.ท่าแพ' },
  { key: 'laNgu', label: 'ละงู', name: 'รพ.ละงู' },
  { key: 'manang', label: 'มะนัง', name: 'รพ.มะนัง' },
  { key: 'thungWa', label: 'ทุ่งหว้า', name: 'รพ.ทุ่งหว้า' },
];

const DISEASES = [
  {
    name: 'ไข้หวัดใหญ่',
    description: 'โรคไข้หวัดใหญ่',
    facilities: {
      satun: 27,
      khuanDon: 16,
      khuanKalong: 1,
      thaPhae: 0,
      laNgu: 8,
      thungWa: 1,
      manang: 3,
    },
  },
  {
    name: 'ทางเดินอาหาร',
    description: 'กลุ่มอาการโรคระบบทางเดินอาหารที่สัมพันธ์กับน้ำท่วม',
    facilities: {
      satun: 2,
      khuanDon: 4,
      khuanKalong: 0,
      thaPhae: 0,
      laNgu: 0,
      thungWa: 0,
      manang: 1,
    },
  },
  {
    name: 'เวียนศีรษะ',
    description: 'อาการเวียนศีรษะที่รายงานในช่วงน้ำท่วม',
    facilities: {
      satun: 2,
      khuanDon: 0,
      khuanKalong: 0,
      thaPhae: 0,
      laNgu: 0,
      thungWa: 0,
      manang: 2,
    },
  },
  {
    name: 'ปวดเมื่อย',
    description: 'อาการปวดเมื่อยที่รายงานในช่วงน้ำท่วม',
    facilities: {
      satun: 10,
      khuanDon: 6,
      khuanKalong: 0,
      thaPhae: 0,
      laNgu: 12,
      thungWa: 0,
      manang: 7,
    },
  },
  {
    name: 'น้ำกัดเท้า',
    description: 'โรคน้ำกัดเท้าหรือผิวหนังอักเสบจากการสัมผัสน้ำท่วม',
    facilities: {
      satun: 32,
      khuanDon: 18,
      khuanKalong: 0,
      thaPhae: 50,
      laNgu: 22,
      thungWa: 0,
      manang: 35,
    },
  },
  {
    name: 'บาดแผล',
    description: 'บาดแผลที่รายงานในช่วงน้ำท่วม',
    facilities: {
      satun: 3,
      khuanDon: 0,
      khuanKalong: 0,
      thaPhae: 0,
      laNgu: 0,
      thungWa: 0,
      manang: 0,
    },
  },
];

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

function validateData() {
  const expectedByDisease = {
    'ไข้หวัดใหญ่': 56,
    'ทางเดินอาหาร': 7,
    'เวียนศีรษะ': 4,
    'ปวดเมื่อย': 35,
    'น้ำกัดเท้า': 157,
    'บาดแผล': 3,
  };
  let grandTotal = 0;

  for (const disease of DISEASES) {
    const rowTotal = FACILITIES.reduce((sum, facility) => sum + disease.facilities[facility.key], 0);
    const expectedTotal = expectedByDisease[disease.name];

    if (rowTotal !== expectedTotal) {
      throw new Error(`ยอดรวมโรค ${disease.name} ไม่ตรงกับภาพ: ${rowTotal}/${expectedTotal}`);
    }

    grandTotal += rowTotal;
  }

  if (grandTotal !== 262) {
    throw new Error(`ยอดรวมทั้งหมดไม่ตรงกับภาพ: ${grandTotal}/262`);
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

function buildRows({ sessionId, startDate, endDate, reporterId, facilityMap }) {
  const rows = [];
  const dates = dateRange(startDate, endDate);

  if (!dates.length) {
    throw new Error(`ช่วงวันที่ไม่ถูกต้อง: ${startDate} ถึง ${endDate}`);
  }

  for (const disease of DISEASES) {
    for (const facility of FACILITIES) {
      const totalCount = disease.facilities[facility.key];
      const facilityRecord = facilityMap.get(facility.key);
      const dailyCounts = distributeTotal(totalCount, dates.length);

      dailyCounts.forEach((patientCount, index) => {
        if (patientCount <= 0) return;
        rows.push({
          session_id: sessionId,
          report_date: dates[index],
          health_facility_id: facilityRecord.id,
          facility_name: facilityRecord.name,
          district_name: facilityRecord.district_name,
          disease_name: disease.name,
          patient_count: patientCount,
          notes: `${IMPORT_SOURCE} - เฉลี่ยช่วงวันที่ ${startDate} ถึง ${endDate} (ยอดรวม ${totalCount} ราย)`,
          reported_by: reporterId,
          bucket: 'average_range',
        });
      });
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
  const startDate = getArgValue('start-date') || getArgValue('date') || DEFAULT_START_DATE;
  const endDate = getArgValue('end-date') || DEFAULT_END_DATE;

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
    startDate,
    endDate,
    expectedTotals: { cumulative: 262 },
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
      startDate,
      endDate,
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
    startDate,
    endDate,
    rows: report.rows.length,
    created: report.rows.filter(row => row.action === 'created').length,
    updated: report.rows.filter(row => row.action === 'updated').length,
    cumulativeTotal: report.rows.reduce((sum, row) => sum + row.patient_count, 0),
    reportPath,
    csvPath,
  }, null, 2));
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
