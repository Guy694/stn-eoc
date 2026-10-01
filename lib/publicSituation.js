import { query } from "@/lib/db";

// สรุปสถานการณ์สำหรับหน้าแรกของประชาชน
// หลักการ: ทุกตัวเลขมาจาก "รอบ EOC ที่เปิดอยู่" รอบเดียวกันเสมอ เพื่อไม่ให้ตัวเลขในหน้าขัดกันเอง
// และส่งออกเฉพาะข้อมูลรวม (ไม่มีชื่อ พิกัดบ้าน หรือข้อมูลรายบุคคล)

const EOC_LABELS = {
  flood: "อุทกภัย (น้ำท่วม)",
  disease: "โรคระบาด",
  "festival-accidents": "อุบัติเหตุช่วงเทศกาล",
  accident: "อุบัติเหตุ"
};

function toDateKey(value) {
  if (!value) return null;
  if (typeof value === "string") return value.slice(0, 10);
  const shifted = new Date(value.getTime() + 7 * 60 * 60 * 1000);
  return shifted.toISOString().slice(0, 10);
}

function todayBangkok() {
  return toDateKey(new Date());
}

function addDays(dateKey, days) {
  const date = new Date(`${dateKey}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function minDate(a, b) {
  return a < b ? a : b;
}

function percentChange(current, previous) {
  if (!previous) return current > 0 ? null : 0;
  return Math.round(((current - previous) / previous) * 100);
}

async function loadActiveSessions() {
  return query(
    `SELECT id, eoc_type, session_number, disease_name, festival_type, opened_at
     FROM eoc_sessions
     WHERE status = 'active'
     ORDER BY opened_at DESC`,
    []
  );
}

async function diseaseSituation(session) {
  const today = todayBangkok();
  const [totals] = await query(
    `SELECT COALESCE(SUM(patient_count), 0) AS patients,
            MAX(report_date) AS last_report_date
     FROM disease_reports WHERE session_id = ?`,
    [session.id]
  );
  const [recent] = await query(
    `SELECT
       COALESCE(SUM(CASE WHEN report_date > ? THEN patient_count ELSE 0 END), 0) AS last7,
       COALESCE(SUM(CASE WHEN report_date > ? AND report_date <= ? THEN patient_count ELSE 0 END), 0) AS prev7
     FROM disease_reports WHERE session_id = ? AND report_date > ?`,
    [addDays(today, -7), addDays(today, -14), addDays(today, -7), session.id, addDays(today, -14)]
  );
  const districts = await query(
    `SELECT COALESCE(NULLIF(dr.district_name, ''), hf.district_name) AS district,
            COALESCE(SUM(dr.patient_count), 0) AS patients
     FROM disease_reports dr
     LEFT JOIN health_facilities hf ON hf.id = dr.health_facility_id
     WHERE dr.session_id = ?
     GROUP BY district
     HAVING district IS NOT NULL
     ORDER BY patients DESC`,
    [session.id]
  );
  // กราฟแสดง 30 วันล่าสุดที่มีรายงาน (ถ้าไม่มีรายงานช่วงนี้ จะไม่แสดงกราฟว่างเปล่า)
  const trendEnd = minDate(today, toDateKey(totals?.last_report_date) || today);
  const since = addDays(trendEnd, -29);
  const daily = await query(
    `SELECT DATE_FORMAT(report_date, '%Y-%m-%d') AS date, COALESCE(SUM(patient_count), 0) AS value
     FROM disease_reports
     WHERE session_id = ? AND report_date BETWEEN ? AND ?
     GROUP BY report_date ORDER BY report_date`,
    [session.id, since, trendEnd]
  );

  const last7 = Number(recent?.last7 || 0);
  const prev7 = Number(recent?.prev7 || 0);
  return {
    disease_name: session.disease_name || "โรคระบาด",
    patients_total: Number(totals?.patients || 0),
    patients_last7: last7,
    patients_prev7: prev7,
    change_pct: percentChange(last7, prev7),
    last_report_date: toDateKey(totals?.last_report_date),
    districts: districts.map((row) => ({ district: row.district, value: Number(row.patients || 0) })),
    trend: { label: "ผู้ป่วยรายใหม่ต่อวัน", unit: "ราย", from: since, to: trendEnd, points: daily.map((row) => ({ date: row.date, value: Number(row.value || 0) })) }
  };
}

async function floodSituation(session) {
  const today = todayBangkok();
  const [latest] = await query(
    `SELECT MAX(flood_start_date) AS latest_date FROM flood_records WHERE session_id = ?`,
    [session.id]
  );
  const latestDate = toDateKey(latest?.latest_date);
  let villagesByLevel = {};
  let districts = [];
  let affectedPeople = 0;

  if (latestDate) {
    const levels = await query(
      `SELECT flood_level, COUNT(DISTINCT polygon_id) AS villages, COALESCE(SUM(affected_people), 0) AS people
       FROM flood_records
       WHERE session_id = ? AND flood_start_date = ? AND flood_level <> 'ไม่มี'
       GROUP BY flood_level`,
      [session.id, latestDate]
    );
    villagesByLevel = Object.fromEntries(levels.map((row) => [row.flood_level, Number(row.villages || 0)]));
    affectedPeople = levels.reduce((sum, row) => sum + Number(row.people || 0), 0);
    const byDistrict = await query(
      `SELECT district, COUNT(DISTINCT polygon_id) AS villages
       FROM flood_records
       WHERE session_id = ? AND flood_start_date = ? AND flood_level <> 'ไม่มี'
       GROUP BY district ORDER BY villages DESC`,
      [session.id, latestDate]
    );
    districts = byDistrict.map((row) => ({ district: row.district, value: Number(row.villages || 0) }));
  }

  let openShelters = 0;
  try {
    const [shelters] = await query(
      `SELECT COUNT(DISTINCT shelter_id) AS count FROM shelter_session_activations WHERE session_id = ? AND is_active = 1`,
      [session.id]
    );
    openShelters = Number(shelters?.count || 0);
  } catch {
    openShelters = 0;
  }

  const trendEnd = minDate(today, latestDate || today);
  const since = addDays(trendEnd, -29);
  const daily = await query(
    `SELECT DATE_FORMAT(flood_start_date, '%Y-%m-%d') AS date, COUNT(DISTINCT polygon_id) AS value
     FROM flood_records
     WHERE session_id = ? AND flood_start_date BETWEEN ? AND ? AND flood_level <> 'ไม่มี'
     GROUP BY flood_start_date ORDER BY flood_start_date`,
    [session.id, since, trendEnd]
  );

  return {
    latest_date: latestDate,
    flooded_villages: Object.values(villagesByLevel).reduce((sum, value) => sum + value, 0),
    villages_by_level: villagesByLevel,
    affected_people: affectedPeople,
    open_shelters: openShelters,
    districts,
    trend: { label: "หมู่บ้านที่มีน้ำท่วมต่อวัน", unit: "หมู่บ้าน", from: since, to: trendEnd, points: daily.map((row) => ({ date: row.date, value: Number(row.value || 0) })) }
  };
}

async function accidentSituation(session) {
  const [totals] = await query(
    `SELECT COUNT(*) AS accidents, COALESCE(SUM(injuries), 0) AS injuries, COALESCE(SUM(deaths), 0) AS deaths,
            COALESCE(SUM(drunk_driving), 0) AS drunk
     FROM accident_reports WHERE session_id = ?`,
    [session.id]
  );
  const districts = await query(
    `SELECT district, COUNT(*) AS accidents FROM accident_reports
     WHERE session_id = ? AND district IS NOT NULL AND district <> ''
     GROUP BY district ORDER BY accidents DESC`,
    [session.id]
  );
  const daily = await query(
    `SELECT DATE_FORMAT(report_date, '%Y-%m-%d') AS date, COUNT(*) AS value
     FROM accident_reports WHERE session_id = ? GROUP BY report_date ORDER BY report_date`,
    [session.id]
  );
  return {
    accidents: Number(totals?.accidents || 0),
    injuries: Number(totals?.injuries || 0),
    deaths: Number(totals?.deaths || 0),
    drunk_driving: Number(totals?.drunk || 0),
    districts: districts.map((row) => ({ district: row.district, value: Number(row.accidents || 0) })),
    trend: { label: "อุบัติเหตุรายวันช่วงเทศกาล", unit: "ครั้ง", points: daily.map((row) => ({ date: row.date, value: Number(row.value || 0) })) }
  };
}

export async function getPublicSituation() {
  const sessions = await loadActiveSessions();
  const seenTypes = new Set();
  const events = [];

  for (const session of sessions) {
    const type = session.eoc_type === "accident" ? "festival-accidents" : session.eoc_type;
    if (seenTypes.has(type)) continue; // หนึ่งภัยแสดงรอบที่เปิดล่าสุดรอบเดียว
    seenTypes.add(type);

    let detail = null;
    try {
      if (type === "disease") detail = await diseaseSituation(session);
      else if (type === "flood") detail = await floodSituation(session);
      else if (type === "festival-accidents") detail = await accidentSituation(session);
    } catch (error) {
      console.error(`Public situation (${type}) error:`, error?.code || error?.message);
    }

    events.push({
      type,
      label: EOC_LABELS[type] || type,
      session_id: session.id,
      session_number: session.session_number,
      opened_at: session.opened_at,
      disease_name: session.disease_name || null,
      festival_type: session.festival_type || null,
      detail
    });
  }

  return {
    generated_at: new Date().toISOString(),
    has_active_event: events.length > 0,
    events
  };
}
