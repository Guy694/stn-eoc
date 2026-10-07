import { randomBytes } from "crypto";
import { generateTrackingCode } from "@/lib/helpTracking";

// ช่องติดตามมาจาก migration 20261007_incident_tracking — ระบบยังทำงานได้ถ้ายังไม่ได้รัน
let cachedHas = null;
let cachedAt = 0;

export async function hasTrackingColumns(connection) {
  if (cachedHas === true) return true;
  if (cachedHas === false && Date.now() - cachedAt < 60 * 1000) return false;
  const [rows] = await connection.execute(
    `SELECT
       (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'public_incident_reports'
          AND COLUMN_NAME IN ('tracking_code', 'citizen_message')) AS columns_found,
       (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'incident_status_events') AS table_found`
  );
  cachedHas = Number(rows[0]?.columns_found) === 2 && Number(rows[0]?.table_found) === 1;
  cachedAt = Date.now();
  return cachedHas;
}

/** ให้เลขติดตามแก่รายงานที่เพิ่งบันทึก (สุ่มใหม่ถ้าชนเลขเดิม) และเริ่มประวัติสถานะ */
export async function startTracking(connection, reportId) {
  if (!(await hasTrackingColumns(connection))) return null;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = generateTrackingCode(randomBytes);
    try {
      await connection.execute("UPDATE public_incident_reports SET tracking_code = ? WHERE id = ?", [code, reportId]);
      await connection.execute("INSERT INTO incident_status_events (report_id, status) VALUES (?, 'pending')", [reportId]);
      return code;
    } catch (error) {
      if (error?.code !== "ER_DUP_ENTRY") {
        console.error("startTracking error:", error.message);
        return null;
      }
    }
  }
  return null;
}

export async function recordStatusEvent(connection, { reportId, status, citizenMessage = null, userId = null }) {
  if (!(await hasTrackingColumns(connection))) return;
  await connection.execute(
    "INSERT INTO incident_status_events (report_id, status, citizen_message, created_by) VALUES (?, ?, ?, ?)",
    [reportId, status, citizenMessage, userId]
  );
}
