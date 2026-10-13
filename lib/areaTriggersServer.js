// ประกาศธง/Trigger รายพื้นที่ (อ่านจากฐานข้อมูล) ใช้ร่วมกันหลายหน้า
import { query } from "@/lib/db";

/** ประกาศล่าสุดของแต่ละพื้นที่ในเหตุการณ์ (รวมรายการยกเลิก stage = null ไว้ให้ผู้เรียกกรอง) */
export async function loadCurrentTriggers(sessionId) {
  try {
    return await query(
      `SELECT t.id, t.district, t.tambon, t.stage, t.note, t.declared_by_name, t.declared_at
         FROM eoc_area_triggers t
         JOIN (SELECT MAX(id) AS id FROM eoc_area_triggers WHERE session_id = ? GROUP BY COALESCE(district, ''), COALESCE(tambon, '')) latest ON latest.id = t.id
        ORDER BY (t.district IS NULL) DESC, t.district, (t.tambon IS NULL) DESC, t.tambon`,
      [sessionId]
    );
  } catch (error) {
    if (error?.code === "ER_NO_SUCH_TABLE") return null;
    throw error;
  }
}

/** สถานะการติ๊กของแต่ละประกาศ → { [trigger_id]: { [index]: { done, updated_by_name, updated_at } } } */
export async function loadTriggerActions(ids = []) {
  if (!ids.length) return {};
  try {
    const rows = await query(
      `SELECT trigger_id, action_index, done, updated_by_name, updated_at FROM eoc_area_trigger_actions WHERE trigger_id IN (${ids.map(() => "?").join(",")})`,
      ids
    );
    const result = {};
    for (const row of rows) {
      result[row.trigger_id] ||= {};
      result[row.trigger_id][row.action_index] = { done: Boolean(Number(row.done)), updated_by_name: row.updated_by_name, updated_at: row.updated_at };
    }
    return result;
  } catch (error) {
    if (error?.code === "ER_NO_SUCH_TABLE") return {};
    throw error;
  }
}
