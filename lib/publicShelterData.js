import { query } from "@/lib/db";
import { getOpenEocSessions } from "@/lib/eocOpen";
import { toPublicShelter } from "@/lib/publicShelters";

/**
 * ศูนย์พักพิงที่เปิดใช้ในเหตุการณ์ (EOC) ที่ยังเปิดอยู่ — ข้อมูลสาธารณะเท่านั้น
 * sessionId: จำกัดเฉพาะเหตุการณ์นั้น (ถ้าเหตุการณ์ปิดแล้วจะได้ค่าว่าง)
 */
export async function loadOpenShelters({ sessionId = null, eocType = null } = {}) {
  const openSessions = await getOpenEocSessions();
  let sessionIds = openSessions
    .filter((session) => !eocType || session.eoc_type === eocType)
    .map((session) => Number(session.id));
  const requested = Number.parseInt(sessionId ?? "", 10);
  if (Number.isFinite(requested)) sessionIds = sessionIds.filter((id) => id === requested);
  if (sessionIds.length === 0) return { open: openSessions.length > 0, data: [] };

  let rows;
  try {
    rows = await query(
      `SELECT sc.*, ssa.session_id, ssa.activated_at, COALESCE(ssa.current_occupancy, 0) AS current_occupancy
       FROM shelter_centers sc
       INNER JOIN shelter_session_activations ssa ON ssa.shelter_id = sc.id AND ssa.is_active = 1
       WHERE sc.is_active = 1
         AND ssa.session_id IN (${sessionIds.map(() => "?").join(",")})
         ${eocType ? "AND sc.eoc_type = ?" : ""}
       ORDER BY sc.district_name, sc.sheltername`,
      [...sessionIds, ...(eocType ? [eocType] : [])]
    );
  } catch (error) {
    // ฐานข้อมูลเก่าที่ยังไม่มีตารางเปิดใช้ศูนย์รายเหตุการณ์ → ยังไม่มีศูนย์ที่เปิด
    if (error.code !== "ER_NO_SUCH_TABLE") throw error;
    rows = [];
  }

  // ศูนย์เดียวอาจเปิดในหลายเหตุการณ์พร้อมกัน → แสดงครั้งเดียว
  const seen = new Set();
  const data = rows.filter((row) => (seen.has(row.id) ? false : seen.add(row.id))).map(toPublicShelter);
  return { open: true, data };
}
