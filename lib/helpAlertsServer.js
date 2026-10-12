// คำขอความช่วยเหลือที่รอเจ้าหน้าที่รับเรื่อง — ฝั่งเซิร์ฟเวอร์
import { query } from "@/lib/db";
import { MAX_ESCALATIONS, escalationStep, helpAlertItem, officerHelpPayload } from "@/lib/helpAlerts";
import { sendOfficerAlert } from "@/lib/publicPushServer";

let mergedColumn = null;
async function hasMergedColumn() {
  if (mergedColumn !== null) return mergedColumn;
  const rows = await query(
    "SELECT COUNT(*) AS n FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'public_incident_reports' AND COLUMN_NAME = 'merged_into_id'"
  ).catch(() => [{ n: 0 }]);
  mergedColumn = Number(rows[0]?.n || 0) > 0;
  return mergedColumn;
}

/** คำขอความช่วยเหลือที่ยังไม่มีผู้รับเรื่อง (เก่าก่อน) */
export async function pendingHelpRequests({ limit = 30, now = Date.now() } = {}) {
  const merged = await hasMergedColumn();
  const rows = await query(
    `SELECT id, created_at, urgency, village, sub_district, district, description
       FROM public_incident_reports
      WHERE report_type = 'help_request' AND status = 'pending'${merged ? " AND merged_into_id IS NULL" : ""}
      ORDER BY created_at ASC
      LIMIT ${Math.min(100, Math.max(1, Number(limit) || 30))}`
  );
  return rows.map((row) => helpAlertItem(row, now));
}

/** แจ้งเจ้าหน้าที่ทันทีเมื่อมีคำขอใหม่ (เรียกหลังบันทึกคำขอ) */
export async function notifyOfficersOfNewHelp(id) {
  const rows = await query(
    "SELECT id, created_at, urgency, village, sub_district, district, description FROM public_incident_reports WHERE id = ? LIMIT 1",
    [id]
  );
  if (!rows[0]) return null;
  return sendOfficerAlert(`help:${id}:0`, officerHelpPayload(helpAlertItem(rows[0])));
}

/** เตือนซ้ำคำขอที่ค้าง: ทุก 30 นาที สูงสุด 6 ครั้ง — กุญแจ help:{id}:{ครั้ง} กันส่งซ้ำ */
export async function runHelpEscalations({ now = Date.now() } = {}) {
  const pending = await pendingHelpRequests({ limit: 50, now });
  let sent = 0;
  for (const item of pending) {
    const step = escalationStep(item.waited_min);
    if (step < 1 || step > MAX_ESCALATIONS) continue;
    const result = await sendOfficerAlert(`help:${item.id}:${step}`, officerHelpPayload(item, step, now));
    if (result) sent += 1;
  }
  return { pending: pending.length, sent };
}
