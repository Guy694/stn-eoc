// อ่าน/บันทึกการตั้งค่าเมนู "รายงานระดับน้ำ" (ตาราง system_settings) — แคช 15 วินาที เพราะหน้าประชาชนเรียกบ่อย
import { query } from "@/lib/db";
import { WATER_REPORT_SETTING_KEY, normalizeWaterReportSetting } from "@/lib/waterReportSetting";

let cache = null;
const parse = (value) => {
  try {
    return typeof value === "string" ? JSON.parse(value) : Buffer.isBuffer(value) ? JSON.parse(value.toString("utf8")) : value;
  } catch {
    return null;
  }
};

export async function getWaterReportSetting({ fresh = false } = {}) {
  if (!fresh && cache && Date.now() - cache.at < 15000) return cache.value;
  let value;
  try {
    const rows = await query("SELECT setting_value FROM system_settings WHERE setting_key = ? LIMIT 1", [WATER_REPORT_SETTING_KEY]);
    value = normalizeWaterReportSetting(parse(rows[0]?.setting_value));
  } catch (error) {
    if (error?.code !== "ER_NO_SUCH_TABLE") throw error;
    value = normalizeWaterReportSetting(null); // ยังไม่ได้รัน migration → ทำงานแบบเดิม
  }
  cache = { value, at: Date.now() };
  return value;
}

export async function saveWaterReportSetting(mode, user) {
  const name = [user?.givenName || user?.given_name, user?.familyName || user?.family_name].filter(Boolean).join(" ") || user?.username || null;
  const stored = normalizeWaterReportSetting({ mode, updated_at: new Date().toISOString(), updated_by_name: name });
  await query(
    `INSERT INTO system_settings (setting_key, setting_value, updated_by) VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value), updated_by = VALUES(updated_by)`,
    [WATER_REPORT_SETTING_KEY, JSON.stringify(stored), user?.id ?? null]
  );
  cache = { value: stored, at: Date.now() };
  return stored;
}
