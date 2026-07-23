import { query } from "@/lib/db";
import { getSessionTeamAccessByCode } from "@/lib/eocTeamAccess";

export function parsePositiveId(value) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export function parseDateKey(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00+07:00`);
  if (Number.isNaN(date.getTime())) return null;
  const normalized = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
  return normalized === value ? value : null;
}

export function bangkokTodayKey(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export async function resolveFloodSessionAccess(user, requestedSessionId) {
  let sessionId = parsePositiveId(requestedSessionId);

  if (!sessionId) {
    const privileged = ["admin", "commander"].includes(user.role);
    const rows = privileged
      ? await query(`
          SELECT s.id
          FROM eoc_sessions s
          WHERE s.eoc_type = 'flood'
          ORDER BY CASE WHEN s.status = 'active' THEN 0 ELSE 1 END, s.opened_at DESC, s.id DESC
          LIMIT 1
        `)
      : await query(`
          SELECT DISTINCT s.id
          FROM eoc_sessions s
          JOIN eoc_session_teams st ON st.eoc_session_id = s.id AND st.is_active = TRUE
          JOIN eoc_teams t ON t.id = st.team_id AND t.is_active = TRUE
          JOIN eoc_team_members tm
            ON tm.session_team_id = st.id
           AND tm.officer_id = ?
           AND tm.is_active = TRUE
          WHERE s.eoc_type = 'flood'
            AND UPPER(t.team_code) = 'SAT'
          ORDER BY CASE WHEN s.status = 'active' THEN 0 ELSE 1 END, s.opened_at DESC, s.id DESC
          LIMIT 1
        `, [user.id]);
    sessionId = rows[0]?.id ? Number(rows[0].id) : null;
  }

  if (!sessionId) {
    return { ok: false, status: 404, message: "ไม่พบ EOC Session อุทกภัยที่เข้าถึงได้" };
  }

  const access = await getSessionTeamAccessByCode(user, sessionId, "sat");
  if (!access.ok) return access;
  if (access.context.eoc_type !== "flood") {
    return { ok: false, status: 400, message: "Session ที่เลือกไม่ใช่ EOC อุทกภัย" };
  }
  return { ...access, sessionId };
}

export async function getFloodDailyData({ sessionId, reportDate }) {
  const date = parseDateKey(reportDate);
  const parsedSessionId = parsePositiveId(sessionId);
  if (!parsedSessionId || !date) throw new Error("INVALID_FLOOD_DAILY_FILTER");

  const [
    sessions,
    riskSummary,
    districtSummary,
    details,
    totalStatsRows,
    availableDateRows,
  ] = await Promise.all([
    query(`
      SELECT id, session_number, status, opened_at, closed_at, open_reason,
             TIMESTAMPDIFF(HOUR, opened_at, COALESCE(closed_at, NOW())) AS hours_open,
             TIMESTAMPDIFF(DAY, opened_at, COALESCE(closed_at, NOW())) AS days_open
      FROM eoc_sessions
      WHERE id = ? AND eoc_type = 'flood'
      LIMIT 1
    `, [parsedSessionId]),
    query(`
      SELECT flood_level, status, COUNT(*) AS village_count,
             COALESCE(SUM(affected_households), 0) AS total_households,
             COALESCE(SUM(affected_people), 0) AS total_population,
             COALESCE(AVG(water_depth_cm), 0) AS avg_water_level,
             COALESCE(MAX(water_depth_cm), 0) AS max_water_level
      FROM flood_records
      WHERE session_id = ? AND DATE(flood_start_date) = ?
      GROUP BY flood_level, status
      ORDER BY FIELD(flood_level, 'สูงมาก', 'สูง', 'ปานกลาง', 'ต่ำ', 'ไม่มี')
    `, [parsedSessionId, date]),
    query(`
      SELECT district,
             COUNT(DISTINCT tambon) AS tambon_count,
             COUNT(*) AS village_count,
             COALESCE(SUM(affected_households), 0) AS total_households,
             COALESCE(SUM(affected_people), 0) AS total_population,
             MAX(CASE WHEN flood_level IN ('สูงมาก', 'สูง') THEN 1 ELSE 0 END) AS has_severe,
             MAX(CASE WHEN flood_level = 'ปานกลาง' THEN 1 ELSE 0 END) AS has_moderate,
             COALESCE(AVG(water_depth_cm), 0) AS avg_water_level
      FROM flood_records
      WHERE session_id = ? AND DATE(flood_start_date) = ?
      GROUP BY district
      ORDER BY has_severe DESC, has_moderate DESC, total_population DESC
    `, [parsedSessionId, date]),
    query(`
      SELECT id, polygon_id, province, district, tambon, village, flood_level, status,
             water_depth_cm, affected_area_sqm, affected_households, affected_people,
             description AS notes, flood_start_date AS report_date, created_by, updated_at
      FROM flood_records
      WHERE session_id = ? AND DATE(flood_start_date) = ?
      ORDER BY FIELD(flood_level, 'สูงมาก', 'สูง', 'ปานกลาง', 'ต่ำ', 'ไม่มี'),
               district, tambon, village
    `, [parsedSessionId, date]),
    query(`
      SELECT COUNT(DISTINCT district) AS affected_districts,
             COUNT(DISTINCT CONCAT(district, '-', tambon)) AS affected_tambons,
             COUNT(*) AS affected_villages,
             COALESCE(SUM(affected_households), 0) AS total_households,
             COALESCE(SUM(affected_people), 0) AS total_population,
             SUM(CASE WHEN flood_level IN ('สูงมาก', 'สูง') THEN 1 ELSE 0 END) AS severe_count,
             SUM(CASE WHEN flood_level = 'ปานกลาง' THEN 1 ELSE 0 END) AS moderate_count,
             SUM(CASE WHEN flood_level = 'ต่ำ' THEN 1 ELSE 0 END) AS mild_count,
             SUM(CASE WHEN flood_level = 'ไม่มี' THEN 1 ELSE 0 END) AS safe_count
      FROM flood_records
      WHERE session_id = ? AND DATE(flood_start_date) = ?
    `, [parsedSessionId, date]),
    query(`
      SELECT DISTINCT DATE_FORMAT(flood_start_date, '%Y-%m-%d') AS report_date
      FROM flood_records
      WHERE session_id = ? AND flood_start_date IS NOT NULL
      ORDER BY report_date DESC
    `, [parsedSessionId]),
  ]);

  if (!sessions.length) throw new Error("FLOOD_SESSION_NOT_FOUND");
  const totalStats = totalStatsRows[0] || {};

  return {
    success: true,
    date,
    reportDate: date,
    session_id: parsedSessionId,
    totalStats: {
      affected_districts: Number(totalStats.affected_districts || 0),
      affected_tambons: Number(totalStats.affected_tambons || 0),
      affected_villages: Number(totalStats.affected_villages || 0),
      total_households: Number(totalStats.total_households || 0),
      total_population: Number(totalStats.total_population || 0),
      severe_count: Number(totalStats.severe_count || 0),
      moderate_count: Number(totalStats.moderate_count || 0),
      mild_count: Number(totalStats.mild_count || 0),
      safe_count: Number(totalStats.safe_count || 0),
    },
    riskSummary,
    districtSummary,
    details,
    activeSession: sessions[0],
    session: sessions[0],
    availableDates: availableDateRows.map((row) => row.report_date),
  };
}
