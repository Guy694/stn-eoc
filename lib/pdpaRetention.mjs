// ระยะเก็บข้อมูลส่วนบุคคล (PDPA) — ขั้นตอนที่ใช้ร่วมกันระหว่างสคริปต์ scripts/pdpa-retention.mjs และงานเบื้องหลัง
// ไฟล์นี้เป็น .mjs ไม่ใช้ alias "@/" เพื่อให้ node รันสคริปต์ได้โดยตรง
//
// 1) งานบ้านที่ปลอดภัยเสมอ (ทำอัตโนมัติวันละครั้ง): session ที่หมดอายุ/ออกจากระบบแล้วเกิน 30 วัน (มีอีเมล/เบอร์เจ้าหน้าที่ติดอยู่),
//    ตัวนับ rate limit ที่หมดอายุ
// 2) คำขอช่วยเหลือ/แจ้งเหตุจากประชาชนที่ปิดเรื่องแล้วเกิน PDPA_RETENTION_DAYS วัน (ค่าเริ่มต้น 365):
//    ลบชื่อ เบอร์ เลขบัตร ตัวเชื่อมบัญชี ThaiD และรูปต้นฉบับ · ปัดพิกัดเหลือระดับ ~1 กม. · เก็บประเภท พื้นที่ วันเวลา สถานะ ไว้ทำสถิติ
//    ทำเฉพาะเมื่อสั่ง --apply (ต้องตกลงระยะเก็บกับผู้รับผิดชอบข้อมูลก่อน)

export const SESSION_KEEP_DAYS = 30;
// แจ้งเตือนความปลอดภัย และประวัติเปลี่ยนสิทธิ์/อนุมัติบัญชี เก็บ 2 ปี
export const SECURITY_LOG_KEEP_DAYS = 730;
export const PUSH_RECEIPT_KEEP_DAYS = 365; // สัญญาณ "แจ้งเตือนขึ้น/เปิดอ่าน" ของเครื่องผู้รับ
export const DEFAULT_RETENTION_DAYS = 365;
export const ANONYMIZED_NAME = "(ลบข้อมูลตามระยะเก็บ)";
export const CLOSED_STATUSES = ["resolved", "rejected"];

export function retentionDays(env = process.env) {
  const value = Number.parseInt(env.PDPA_RETENTION_DAYS || "", 10);
  return Number.isInteger(value) && value >= 30 ? value : DEFAULT_RETENTION_DAYS;
}

// ประวัติผู้เข้าชมเพื่อความปลอดภัย (ค่าเริ่มต้น 90 วัน · VISITOR_LOG_RETENTION_DAYS) — ตรงกับ lib/visitorLog.js
export function visitorLogDays(env = process.env) {
  const value = Number.parseInt(env.VISITOR_LOG_RETENTION_DAYS || "", 10);
  return Number.isInteger(value) && value >= 7 && value <= 3650 ? value : 90;
}

export const HOUSEKEEPING = [
  ["session เจ้าหน้าที่ที่หมดอายุแล้วเกิน 30 วัน",
    `DELETE FROM user_sessions WHERE (is_active = 0 OR expires_at < NOW()) AND COALESCE(last_activity, created_at) < DATE_SUB(NOW(), INTERVAL ${SESSION_KEEP_DAYS} DAY)`],
  ["ตัวนับ rate limit ที่หมดอายุ", "DELETE FROM rate_limit_hits WHERE expires_at < NOW()"],
  [`ประวัติผู้เข้าชม (IP/ตำแหน่ง) เกิน ${visitorLogDays()} วัน`,
    `DELETE FROM visitor_access_log WHERE visited_at < DATE_SUB(NOW(), INTERVAL ${visitorLogDays()} DAY)`],
  [`แจ้งเตือนความปลอดภัยเกิน ${SECURITY_LOG_KEEP_DAYS} วัน`,
    `DELETE FROM security_alert_log WHERE created_at < DATE_SUB(NOW(), INTERVAL ${SECURITY_LOG_KEEP_DAYS} DAY)`],
  [`ประวัติเปลี่ยนสิทธิ์บัญชีเกิน ${SECURITY_LOG_KEEP_DAYS} วัน`,
    `DELETE FROM security_audit_log WHERE created_at < DATE_SUB(NOW(), INTERVAL ${SECURITY_LOG_KEEP_DAYS} DAY)`],
  [`สัญญาณแจ้งเตือนขึ้น/เปิดอ่านเกิน ${PUSH_RECEIPT_KEEP_DAYS} วัน`,
    `DELETE FROM push_receipts WHERE created_at < DATE_SUB(NOW(), INTERVAL ${PUSH_RECEIPT_KEEP_DAYS} DAY)`]
];

const placeholders = (list) => list.map(() => "?").join(", ");
const DUE = `status IN (${placeholders(CLOSED_STATUSES)})
  AND reported_at < DATE_SUB(NOW(), INTERVAL ? DAY)
  AND (first_name <> ? OR phone IS NOT NULL OR photo_path IS NOT NULL)`;

export function dueParams(days) {
  return [...CLOSED_STATUSES, days, ANONYMIZED_NAME];
}

export const COUNT_DUE_SQL = `SELECT COUNT(*) AS count FROM public_incident_reports WHERE ${DUE}`;
export const PHOTOS_DUE_SQL = `SELECT id, photo_path FROM public_incident_reports WHERE ${DUE} AND photo_path IS NOT NULL`;
export const ANONYMIZE_SQL = `UPDATE public_incident_reports SET
    first_name = ?, last_name = '', phone = NULL, national_id = NULL, citizen_id = NULL, citizen_pid_hash = NULL,
    latitude = ROUND(latitude, 2), longitude = ROUND(longitude, 2), photo_path = NULL
  WHERE ${DUE}`;

export function anonymizeParams(days) {
  return [ANONYMIZED_NAME, ...dueParams(days)];
}

/** "/uploads/incidents/<ไฟล์>" → ชื่อไฟล์ที่ปลอดภัย หรือ null (กันลบไฟล์นอกโฟลเดอร์รูปประชาชน) */
export function incidentPhotoFile(photoPath) {
  const match = /^\/uploads\/incidents\/([A-Za-z0-9._-]+)$/.exec(String(photoPath || ""));
  return match && !match[1].startsWith(".") ? match[1] : null;
}
