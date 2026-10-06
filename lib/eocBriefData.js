// ดึงข้อมูลสรุปของเหตุการณ์จากทุกโมดูล (ใช้ร่วมกันโดย "สรุปสำหรับห้องประชุม" และ "แจ้งเตือนอัตโนมัติ")
// แต่ละส่วนโหลดแยกกัน ถ้าตารางยังไม่มี (ยังไม่รัน migration) ส่วนนั้นจะว่างแทนที่จะทำให้ทั้งหน้าพัง
import { query } from "@/lib/db";
import { buildHealthDashboard, dateKey } from "@/lib/healthDashboard";
import { summarizeShelters } from "@/lib/shelterDashboard";
import { stockLevel, summarizeStock } from "@/lib/medicalInventory";
import { VULNERABLE_TYPES, summarizeVulnerableEvent } from "@/lib/vulnerableEvent";
import { summarizeIt, sortTickets } from "@/lib/itSupport";
import { COMPLETENESS_SOURCES, buildCompleteness } from "@/lib/reportingCompleteness";

const TYPE_KEYS = VULNERABLE_TYPES.map((type) => type.key);

async function safe(loader, fallback = null) {
  try {
    return await loader();
  } catch (error) {
    if (["ER_NO_SUCH_TABLE", "ER_BAD_FIELD_ERROR"].includes(error.code)) return fallback;
    throw error;
  }
}

export async function resolveEventSession({ eocType = "flood", sessionId = null } = {}) {
  const rows = await query(
    sessionId
      ? `SELECT id, eoc_type, session_number, status, opened_at, closed_at FROM eoc_sessions WHERE id = ? LIMIT 1`
      : `SELECT id, eoc_type, session_number, status, opened_at, closed_at FROM eoc_sessions WHERE eoc_type = ? ORDER BY (status = 'active') DESC, opened_at DESC LIMIT 1`,
    [sessionId || eocType]
  );
  return rows[0] || null;
}

async function loadHealth(session, today) {
  const [community, shelter, population] = await Promise.all([
    safe(() => query(
      `SELECT DATE_FORMAT(report_date, '%Y-%m-%d') AS report_date, district_name AS district, tambon_name AS tambon, village_name AS village,
              disease_name AS disease, SUM(patient_count) AS cases
       FROM disease_reports WHERE session_id = ? GROUP BY report_date, district_name, tambon_name, village_name, disease_name`, [session.id]), []),
    safe(() => query(
      `SELECT DATE_FORMAT(r.report_date, '%Y-%m-%d') AS report_date, sc.district_name AS district, sc.sheltername AS shelter, r.disease_type AS disease,
              r.new_cases AS cases, r.hospitalized, r.deaths, r.severity
       FROM shelter_disease_reports r LEFT JOIN shelter_centers sc ON sc.id = r.shelter_id WHERE r.session_id = ?`, [session.id]), []),
    safe(() => query(`SELECT district_name AS district, MAX(population) AS population FROM area_population WHERE population_scope = 'all' GROUP BY district_name`), [])
  ]);
  return { community, shelter, population, ...buildHealthDashboard({ session, community, shelter, population }, today) };
}

async function loadShelters(session) {
  const rows = await safe(() => query(
    `SELECT sc.id, sc.sheltername, sc.district_name, sc.tambon, sc.shelter_capacity, sc.contact_phone, sc.coordinator_name, sc.coordinator_phone,
            CASE WHEN ssa.id IS NOT NULL AND ssa.is_active = 1 THEN 1 ELSE 0 END AS is_activated_for_session,
            COALESCE(ssa.current_occupancy, 0) AS session_occupancy, ssa.activated_at,
            COALESCE(ssa.updated_at, ssa.activated_at) AS activation_updated_at
     FROM shelter_centers sc
     LEFT JOIN shelter_session_activations ssa ON ssa.shelter_id = sc.id AND ssa.session_id = ?
     WHERE sc.eoc_type = ?`, [session.id, session.eoc_type]), null)
    ?? await safe(() => query(
      `SELECT sc.id, sc.sheltername, sc.district_name, sc.tambon, sc.shelter_capacity, sc.contact_phone,
              CASE WHEN ssa.id IS NOT NULL AND ssa.is_active = 1 THEN 1 ELSE 0 END AS is_activated_for_session,
              COALESCE(ssa.current_occupancy, 0) AS session_occupancy, ssa.activated_at, ssa.activated_at AS activation_updated_at
       FROM shelter_centers sc LEFT JOIN shelter_session_activations ssa ON ssa.shelter_id = sc.id AND ssa.session_id = ?
       WHERE sc.eoc_type = ?`, [session.id, session.eoc_type]), []);
  const byShelterRows = await safe(() => query(
    `SELECT shelter_id, SUM(new_cases) AS new_cases, SUM(CASE WHEN report_date = CURDATE() THEN new_cases ELSE 0 END) AS today_new_cases,
            MAX(FIELD(severity, 'low', 'medium', 'high', 'critical')) AS severity_rank
     FROM shelter_disease_reports WHERE session_id = ? GROUP BY shelter_id`, [session.id]), []);
  const names = [null, "low", "medium", "high", "critical"];
  const health = { by_shelter: Object.fromEntries(byShelterRows.map((row) => [row.shelter_id, { new_cases: Number(row.new_cases) || 0, today_new_cases: Number(row.today_new_cases) || 0, severity: names[Number(row.severity_rank) || 0] }])) };
  return summarizeShelters(rows, health);
}

async function loadSupplies(session) {
  const events = await safe(() => query(`SELECT id, event_name FROM medical_inventory_events WHERE eoc_type = ? AND session_number = ? LIMIT 1`, [session.eoc_type, session.session_number]), []);
  if (!events.length) return { opened: false, summary: null, critical: [] };
  const stock = await safe(() => query(
    `SELECT id, agency_name, item_code, item_name, unit, opening_qty, received_qty, issued_qty, balance_qty, data_status
     FROM medical_inventory_stock WHERE inventory_event_id = ?`, [events[0].id]), []);
  const rows = stock.map((row) => ({ ...row, level: stockLevel(row) }));
  return {
    opened: true,
    eventName: events[0].event_name,
    summary: summarizeStock(rows),
    critical: rows.filter((row) => row.level === "out" || row.level === "low")
      .sort((a, b) => (a.level === b.level ? Number(a.balance_qty) - Number(b.balance_qty) : a.level === "out" ? -1 : 1))
      .slice(0, 12)
  };
}

async function loadVulnerable(session) {
  const hasCare = await safe(async () => {
    const rows = await query(`SELECT COUNT(*) AS count FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'vulnerable_groups' AND COLUMN_NAME IN ('cared_count','moved_count')`);
    return Number(rows[0]?.count) === 2;
  }, false);
  const rows = await safe(() => query(
    `SELECT id, district, tambon, village, ${TYPE_KEYS.join(", ")}, needs ${hasCare ? ", cared_count, moved_count, moved_to" : ""}
     FROM vulnerable_groups WHERE session_id = ?`, [session.id]), []);
  return summarizeVulnerableEvent(rows.map((row) => ({ ...row, cared_count: row.cared_count ?? 0, moved_count: row.moved_count ?? 0 })), []);
}

async function loadIt(session) {
  const [tickets, resources] = await Promise.all([
    safe(() => query(
      `SELECT id, ticket_no, DATE_FORMAT(reported_at, '%Y-%m-%dT%H:%i:%s') AS reported_at, unit_name, category, title, severity, status, assignee,
              workaround, DATE_FORMAT(resolved_at, '%Y-%m-%dT%H:%i:%s') AS resolved_at
       FROM eoc_it_tickets WHERE eoc_session_id = ?`, [session.id]), []),
    safe(() => query(`SELECT id, resource_type, unit_name, status, last_check FROM it_resources`), [])
  ]);
  return {
    summary: summarizeIt(tickets, resources),
    openTickets: sortTickets(tickets).filter((ticket) => ["open", "in_progress"].includes(ticket.status)).slice(0, 8),
    offline: resources.filter((row) => row.status === "offline")
  };
}

async function loadDirectives(session, today) {
  const latest = await safe(() => query(
    `SELECT DATE_FORMAT(MAX(report_date), '%Y-%m-%d') AS report_date FROM eoc_daily_directives WHERE eoc_session_id = ? AND report_date <= ?`, [session.id, today]), []);
  const date = latest[0]?.report_date;
  if (!date) return { date: null, items: [], open: 0 };
  const items = await safe(() => query(
    `SELECT id, item_level, content, item_status, team_code FROM eoc_daily_directives WHERE eoc_session_id = ? AND report_date = ? ORDER BY item_order, id`, [session.id, date]), []);
  return { date, items, open: items.filter((item) => item.item_status === "open").length };
}

async function loadCompleteness(session, today) {
  const source = COMPLETENESS_SOURCES[session.eoc_type];
  if (!source) return null;
  const [areas, reported] = await Promise.all([
    safe(() => query(`SELECT DISTINCT distname AS district, subdistnam AS tambon FROM satun_village_polygon WHERE distname IS NOT NULL AND subdistnam IS NOT NULL`), []),
    safe(() => query(source.sql, [session.id, today]), [])
  ]);
  return buildCompleteness(areas, reported);
}

// ผลกระทบจากน้ำท่วม: ใช้ "รายงานวันล่าสุด" เป็นสถานการณ์ปัจจุบัน (บันทึกเป็นรายวันต่อหมู่บ้าน ถ้ารวมทุกวันจะนับซ้ำ)
// เทียบกับวันก่อนหน้าเพื่อดูแนวโน้ม + ผู้เสียชีวิต/สูญหาย/บาดเจ็บสะสมรายอำเภอ
const SEVERE_LEVELS = ["สูงมาก", "สูง"];
async function loadImpact(session) {
  const dates = await safe(() => query(
    `SELECT DISTINCT DATE_FORMAT(flood_start_date, '%Y-%m-%d') AS d FROM flood_records
     WHERE session_id = ? AND flood_start_date IS NOT NULL ORDER BY d DESC LIMIT 2`, [session.id]), []);
  const byDate = async (date) => safe(() => query(
    `SELECT district, COUNT(*) AS villages, COALESCE(SUM(affected_households), 0) AS households, COALESCE(SUM(affected_people), 0) AS people,
            SUM(CASE WHEN flood_level IN (${SEVERE_LEVELS.map(() => "?").join(", ")}) THEN 1 ELSE 0 END) AS severe,
            COALESCE(MAX(water_depth_cm), 0) AS maxDepth
     FROM flood_records WHERE session_id = ? AND DATE(flood_start_date) = ? AND flood_level <> 'ไม่มี' GROUP BY district`,
    [...SEVERE_LEVELS, session.id, date]), []);
  const total = (rows, date) => (date ? rows.reduce((sum, row) => ({
    date,
    villages: sum.villages + Number(row.villages || 0), households: sum.households + Number(row.households || 0),
    people: sum.people + Number(row.people || 0), severe: sum.severe + Number(row.severe || 0)
  }), { date, villages: 0, households: 0, people: 0, severe: 0 }) : null);
  const [latestRows, previousRows, casualtyRows] = await Promise.all([
    dates[0] ? byDate(dates[0].d) : [],
    dates[1] ? byDate(dates[1].d) : [],
    safe(() => query(
      `SELECT district_name AS district, SUM(deaths) AS deaths, SUM(missing) AS missing, SUM(injured) AS injured
       FROM affected_persons WHERE session_id = ? GROUP BY district_name`, [session.id]), [])
  ]);
  const casualtyTotals = casualtyRows.reduce((sum, row) => ({
    deaths: sum.deaths + Number(row.deaths || 0), missing: sum.missing + Number(row.missing || 0), injured: sum.injured + Number(row.injured || 0)
  }), { deaths: 0, missing: 0, injured: 0 });
  return {
    latest: total(latestRows, dates[0]?.d),
    previous: total(previousRows, dates[1]?.d),
    districts: latestRows.map((row) => ({ ...row, villages: Number(row.villages), households: Number(row.households), people: Number(row.people), severe: Number(row.severe), maxDepth: Number(row.maxDepth) })),
    casualties: { ...casualtyTotals, districts: casualtyRows.map((row) => ({ district: row.district, deaths: Number(row.deaths || 0), missing: Number(row.missing || 0), injured: Number(row.injured || 0) })) }
  };
}

/** โหลดทุกส่วนพร้อมกัน */
export async function loadEventBrief(session, now = new Date()) {
  const today = dateKey(now);
  const [health, shelters, supplies, vulnerable, it, directives, completeness, impact] = await Promise.all([
    loadHealth(session, today), loadShelters(session), loadSupplies(session), loadVulnerable(session),
    loadIt(session), loadDirectives(session, today), loadCompleteness(session, today),
    session.eoc_type === "flood" ? loadImpact(session) : null
  ]);
  return { today, health, shelters, supplies, vulnerable, it, directives, completeness, impact };
}
