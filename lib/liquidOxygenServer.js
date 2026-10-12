// ออกซิเจนเหลว (ฝั่งเซิร์ฟเวอร์): รายงานล่าสุดของแต่ละโรงพยาบาลในเหตุการณ์
import { query } from "@/lib/db";

export const OXYGEN_FIELDS = "tank_qty, tank_use_per_day, big_qty, big_use_per_day, small_qty, small_use_per_day, procurement_problem, problem_note";

export async function loadOxygenLatest(sessionId) {
  return query(
    `SELECT r.id, r.health_facility_id, DATE_FORMAT(r.report_date, '%Y-%m-%d') AS report_date, ${OXYGEN_FIELDS.split(", ").map((f) => `r.${f}`).join(", ")},
            r.reported_by_name, r.updated_at, hf.name AS facility_name, hf.district_name, hf.typecode
     FROM liquid_oxygen_reports r
     JOIN (SELECT health_facility_id, MAX(report_date) AS d FROM liquid_oxygen_reports WHERE session_id = ? GROUP BY health_facility_id) last
       ON last.health_facility_id = r.health_facility_id AND last.d = r.report_date
     JOIN health_facilities hf ON hf.id = r.health_facility_id
     WHERE r.session_id = ?`,
    [sessionId, sessionId]
  );
}

