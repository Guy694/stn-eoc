// ประวัติเหตุการณ์ EOC: สรุป "เกิดอะไรขึ้น" ของแต่ละครั้งจากข้อมูลจริงของทุกโมดูล
// ใช้ฝั่งเซิร์ฟเวอร์ — ตารางที่ยังไม่มี (ยังไม่ migrate) จะได้ค่าว่างแทนการล้ม
import { query } from "@/lib/db";
import { VULNERABLE_TYPES } from "@/lib/vulnerableEvent";

const SEVERE = ["สูง", "สูงมาก"];
const VULNERABLE_KEYS = VULNERABLE_TYPES.map((type) => type.key);

export const ACTION_LABELS = {
  data_create: "เพิ่มข้อมูล",
  data_update: "แก้ไขข้อมูล",
  data_delete: "ลบข้อมูล",
  data_restore: "กู้คืนข้อมูล",
  open_event: "เปิดเหตุการณ์",
  close_event: "ปิดเหตุการณ์",
  login: "เข้าสู่ระบบ",
  logout: "ออกจากระบบ",
  officer_create: "เพิ่มเจ้าหน้าที่",
  officer_update: "แก้ไขเจ้าหน้าที่",
  officer_delete: "ลบเจ้าหน้าที่"
};

export const TARGET_LABELS = {
  flood_records: "พื้นที่น้ำท่วม",
  affected_persons: "ผู้ได้รับผลกระทบ",
  shelter_centers: "ศูนย์พักพิง",
  shelter_session_activations: "ศูนย์พักพิง",
  shelter_disease_reports: "โรคในศูนย์พักพิง",
  disease_reports: "รายงานโรค",
  vulnerable_groups: "กลุ่มเปราะบาง",
  eoc_daily_directives: "ข้อสั่งการ",
  eoc_it_tickets: "IT support",
  eoc_team_member: "สมาชิกกลุ่มภารกิจ",
  public_incident_reports: "คำขอจากประชาชน",
  medical_inventory_stock: "เวชภัณฑ์",
  eoc_sessions: "เหตุการณ์"
};

async function safe(loader, fallback) {
  try {
    return await loader();
  } catch (error) {
    if (["ER_NO_SUCH_TABLE", "ER_BAD_FIELD_ERROR"].includes(error.code)) return fallback;
    throw error;
  }
}

const n = (value) => Number(value) || 0;
const placeholders = (list) => list.map(() => "?").join(", ");

function sessionEnd(session) {
  return session.closed_at || new Date();
}

// ตัวเลขหลักของหลายเหตุการณ์พร้อมกัน (หน้ารายการ) — 1 query ต่อหัวข้อ ไม่วนทีละเหตุการณ์
export async function loadSessionMetrics(sessions) {
  const ids = sessions.map((session) => session.id);
  const result = Object.fromEntries(ids.map((id) => [id, { peakPeople: 0, peakDate: null, floodedVillages: 0, shelters: 0, patients: 0, deaths: 0, activities: 0, reportDays: 0 }]));
  if (!ids.length) return result;
  const inList = placeholders(ids);

  const [peaks, shelters, community, shelterCases, casualties, activities] = await Promise.all([
    safe(() => query(
      `SELECT session_id, d, people, villages FROM (
         SELECT session_id, DATE_FORMAT(flood_start_date, '%Y-%m-%d') AS d,
                SUM(affected_people) AS people, COUNT(*) AS villages,
                ROW_NUMBER() OVER (PARTITION BY session_id ORDER BY SUM(affected_people) DESC, COUNT(*) DESC) AS rn
         FROM flood_records
         WHERE session_id IN (${inList}) AND flood_level <> 'ไม่มี' AND flood_start_date IS NOT NULL
         GROUP BY session_id, flood_start_date
       ) ranked WHERE rn = 1`, ids), []),
    safe(() => query(`SELECT session_id, COUNT(*) AS count FROM shelter_session_activations WHERE session_id IN (${inList}) GROUP BY session_id`, ids), []),
    safe(() => query(`SELECT session_id, SUM(patient_count) AS cases FROM disease_reports WHERE session_id IN (${inList}) GROUP BY session_id`, ids), []),
    safe(() => query(`SELECT session_id, SUM(new_cases) AS cases, SUM(deaths) AS deaths FROM shelter_disease_reports WHERE session_id IN (${inList}) GROUP BY session_id`, ids), []),
    safe(() => query(`SELECT session_id, SUM(deaths) AS deaths FROM affected_persons WHERE session_id IN (${inList}) GROUP BY session_id`, ids), []),
    safe(() => query(`SELECT eoc_session_id AS session_id, COUNT(*) AS count FROM activity_logs WHERE eoc_session_id IN (${inList}) GROUP BY eoc_session_id`, ids), [])
  ]);

  for (const row of peaks) Object.assign(result[row.session_id] || {}, { peakPeople: n(row.people), peakDate: row.d, floodedVillages: n(row.villages) });
  for (const row of shelters) if (result[row.session_id]) result[row.session_id].shelters = n(row.count);
  for (const row of community) if (result[row.session_id]) result[row.session_id].patients += n(row.cases);
  for (const row of shelterCases) if (result[row.session_id]) {
    result[row.session_id].patients += n(row.cases);
    result[row.session_id].deaths += n(row.deaths);
  }
  for (const row of casualties) if (result[row.session_id]) result[row.session_id].deaths += n(row.deaths);
  for (const row of activities) if (result[row.session_id]) result[row.session_id].activities = n(row.count);
  return result;
}

async function loadFloodImpact(session) {
  const days = await safe(() => query(
    `SELECT DATE_FORMAT(flood_start_date, '%Y-%m-%d') AS d,
            SUM(CASE WHEN flood_level <> 'ไม่มี' THEN affected_people ELSE 0 END) AS people,
            SUM(CASE WHEN flood_level <> 'ไม่มี' THEN affected_households ELSE 0 END) AS households,
            SUM(flood_level <> 'ไม่มี') AS villages,
            SUM(flood_level IN (${placeholders(SEVERE)})) AS severe,
            COUNT(*) AS reported
     FROM flood_records WHERE session_id = ? AND flood_start_date IS NOT NULL
     GROUP BY flood_start_date ORDER BY flood_start_date`, [...SEVERE, session.id]), []);
  const districtRows = await safe(() => query(
    `SELECT district, MAX(people) AS people, MAX(villages) AS villages, MAX(severe) AS severe, MAX(depth) AS depth FROM (
       SELECT district, flood_start_date,
              SUM(affected_people) AS people, COUNT(*) AS villages,
              SUM(flood_level IN (${placeholders(SEVERE)})) AS severe, MAX(water_depth_cm) AS depth
       FROM flood_records WHERE session_id = ? AND flood_level <> 'ไม่มี' GROUP BY district, flood_start_date
     ) daily GROUP BY district ORDER BY people DESC`, [...SEVERE, session.id]), []);
  const series = days.map((row) => ({ date: row.d, people: n(row.people), households: n(row.households), villages: n(row.villages), severe: n(row.severe), reported: n(row.reported) }));
  const peak = series.reduce((best, row) => (!best || row.people > best.people || (row.people === best.people && row.villages > best.villages) ? row : best), null);
  return {
    days: series,
    peak: peak && (peak.people || peak.villages) ? peak : null,
    reportDays: series.length,
    districts: districtRows.map((row) => ({ district: row.district, people: n(row.people), villages: n(row.villages), severe: n(row.severe), depth: n(row.depth) }))
  };
}

async function loadVulnerableTotals(sessionId) {
  const sums = VULNERABLE_KEYS.map((key) => `SUM(${key}) AS ${key}`).join(", ");
  const withCare = await safe(() => query(`SELECT ${sums}, SUM(cared_count) AS cared, SUM(moved_count) AS moved FROM vulnerable_groups WHERE session_id = ?`, [sessionId]), null);
  if (withCare) return withCare;
  return safe(() => query(`SELECT ${sums} FROM vulnerable_groups WHERE session_id = ?`, [sessionId]), []);
}

export async function loadSessionHistory(session) {
  const id = session.id;
  const end = sessionEnd(session);
  const [
    impact, casualtyRows, shelterRows, communityRows, shelterHealthRows, vulnerableRows, directiveRows,
    citizenRows, teamRows, ticketRows, actionRows, dayRows, userRows, recentRows
  ] = await Promise.all([
    session.eoc_type === "flood" ? loadFloodImpact(session) : null,
    safe(() => query(
      `SELECT SUM(deaths) AS deaths, SUM(missing) AS missing, SUM(injured) AS injured, SUM(evacuated) AS evacuated
       FROM affected_persons WHERE session_id = ?`, [id]), []),
    safe(() => query(
      `SELECT sc.sheltername AS name, sc.district_name AS district, sc.shelter_capacity AS capacity, ssa.current_occupancy AS occupancy, ssa.is_active
       FROM shelter_session_activations ssa JOIN shelter_centers sc ON sc.id = ssa.shelter_id
       WHERE ssa.session_id = ? ORDER BY ssa.current_occupancy DESC`, [id]), []),
    safe(() => query(`SELECT disease_name AS disease, SUM(patient_count) AS cases FROM disease_reports WHERE session_id = ? GROUP BY disease_name`, [id]), []),
    safe(() => query(`SELECT disease_type AS disease, SUM(new_cases) AS cases, SUM(deaths) AS deaths FROM shelter_disease_reports WHERE session_id = ? GROUP BY disease_type`, [id]), []),
    loadVulnerableTotals(id),
    safe(() => query(`SELECT COUNT(*) AS total, SUM(item_status = 'done') AS done, COUNT(DISTINCT report_date) AS days FROM eoc_daily_directives WHERE eoc_session_id = ?`, [id]), []),
    safe(() => query(
      `SELECT COUNT(*) AS total, SUM(report_type = 'help_request') AS help, SUM(report_type <> 'help_request') AS points,
              SUM(status IN ('resolved', 'verified')) AS handled, SUM(status = 'rejected') AS rejected
       FROM public_incident_reports WHERE created_at >= ? AND created_at <= ?`, [session.opened_at, end]), []),
    safe(() => query(
      `SELECT COUNT(DISTINCT st.id) AS teams, COUNT(m.id) AS members
       FROM eoc_session_teams st LEFT JOIN eoc_team_members m ON m.session_team_id = st.id AND m.is_active = TRUE
       WHERE st.eoc_session_id = ? AND st.is_active = TRUE`, [id]), []),
    safe(() => query(`SELECT COUNT(*) AS total, SUM(status IN ('resolved', 'closed')) AS resolved FROM eoc_it_tickets WHERE eoc_session_id = ?`, [id]), []),
    safe(() => query(`SELECT action_type, COUNT(*) AS count FROM activity_logs WHERE eoc_session_id = ? GROUP BY action_type ORDER BY count DESC`, [id]), []),
    safe(() => query(`SELECT DATE_FORMAT(created_at, '%Y-%m-%d') AS d, COUNT(*) AS count FROM activity_logs WHERE eoc_session_id = ? GROUP BY d ORDER BY d`, [id]), []),
    safe(() => query(
      `SELECT COALESCE(NULLIF(CONCAT_WS(' ', o.title, o.given_name, o.family_name), ''), a.username, 'ระบบ') AS name, COUNT(*) AS count
       FROM activity_logs a LEFT JOIN officer o ON o.id = a.user_id
       WHERE a.eoc_session_id = ? GROUP BY a.user_id, name ORDER BY count DESC LIMIT 8`, [id]), []),
    safe(() => query(
      `SELECT a.id, a.action_type, a.target_type, a.description, a.change_reason,
              DATE_FORMAT(a.created_at, '%Y-%m-%dT%H:%i:%s') AS created_at,
              COALESCE(NULLIF(CONCAT_WS(' ', o.title, o.given_name, o.family_name), ''), a.username, 'ระบบ') AS name
       FROM activity_logs a LEFT JOIN officer o ON o.id = a.user_id
       WHERE a.eoc_session_id = ? ORDER BY a.created_at DESC LIMIT 200`, [id]), [])
  ]);

  const casualty = casualtyRows[0] || {};
  const vulnerable = vulnerableRows[0] || {};
  const directives = directiveRows[0] || {};
  const citizen = citizenRows[0] || {};
  const teams = teamRows[0] || {};
  const tickets = ticketRows[0] || {};

  const diseaseMap = new Map();
  for (const row of [...communityRows, ...shelterHealthRows]) {
    const key = row.disease || "ไม่ระบุ";
    diseaseMap.set(key, (diseaseMap.get(key) || 0) + n(row.cases));
  }
  const diseases = [...diseaseMap.entries()].map(([disease, cases]) => ({ disease, cases })).filter((row) => row.cases > 0).sort((a, b) => b.cases - a.cases);

  return {
    impact,
    casualties: { deaths: n(casualty.deaths) + shelterHealthRows.reduce((sum, row) => sum + n(row.deaths), 0), missing: n(casualty.missing), injured: n(casualty.injured), evacuated: n(casualty.evacuated) },
    shelters: {
      opened: shelterRows.length,
      occupancy: shelterRows.reduce((sum, row) => sum + n(row.occupancy), 0),
      capacity: shelterRows.reduce((sum, row) => sum + n(row.capacity), 0),
      top: shelterRows.slice(0, 5).map((row) => ({ name: row.name, district: row.district, occupancy: n(row.occupancy), capacity: n(row.capacity) }))
    },
    health: { patients: diseases.reduce((sum, row) => sum + row.cases, 0), diseases: diseases.slice(0, 6) },
    vulnerable: {
      total: VULNERABLE_KEYS.reduce((sum, key) => sum + n(vulnerable[key]), 0),
      cared: n(vulnerable.cared),
      moved: n(vulnerable.moved),
      bedridden: n(vulnerable.bedridden)
    },
    directives: { total: n(directives.total), done: n(directives.done), days: n(directives.days) },
    citizen: { total: n(citizen.total), help: n(citizen.help), points: n(citizen.points), handled: n(citizen.handled), rejected: n(citizen.rejected) },
    teams: { teams: n(teams.teams), members: n(teams.members) },
    it: { total: n(tickets.total), resolved: n(tickets.resolved) },
    activity: {
      total: actionRows.reduce((sum, row) => sum + n(row.count), 0),
      byAction: actionRows.map((row) => ({ action: row.action_type, label: ACTION_LABELS[row.action_type] || row.action_type || "อื่น ๆ", count: n(row.count) })),
      byDay: dayRows.map((row) => ({ date: row.d, count: n(row.count) })),
      users: userRows.map((row) => ({ name: row.name, count: n(row.count) })),
      recent: recentRows.map((row) => ({
        ...row,
        actionLabel: ACTION_LABELS[row.action_type] || row.action_type || "อื่น ๆ",
        targetLabel: TARGET_LABELS[row.target_type] || null
      }))
    }
  };
}

// ระยะเวลาเหตุการณ์ (วัน) นับวันเปิดเป็นวันที่ 1
export function eventDays(session, now = new Date()) {
  const start = new Date(session.opened_at);
  const end = session.closed_at ? new Date(session.closed_at) : now;
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
  const startDay = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const endDay = new Date(end.getFullYear(), end.getMonth(), end.getDate());
  return Math.max(1, Math.round((endDay - startDay) / 86400000) + 1);
}
