// เวลาเกิดเหตุที่ประชาชนกรอกในฟอร์ม (input datetime-local เช่น "2026-10-16T16:17" = เวลาไทย ไม่มีโซนเวลา)
// คืนเป็น Date ให้ mysql2 แปลงเป็น DATETIME ตามโซนเวลาของ pool (DB_TIMEZONE, ค่าเริ่มต้น +07:00)
// ห้ามส่งสตริง toISOString() (ลงท้าย Z) เข้า MySQL ตรง ๆ: MySQL 8 โหมด strict ปฏิเสธ "Incorrect datetime value"
// และเวลาจะเลื่อน 7 ชั่วโมงเมื่อเซิร์ฟเวอร์ตั้งโซนเป็น UTC
const DAY = 864e5;
const LOCAL_PATTERN = /^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2})(:\d{2})?$/;

export function parseOccurredAt(raw, { now = Date.now(), offset = "+07:00" } = {}) {
  const value = String(raw || "").trim();
  const local = value.match(LOCAL_PATTERN);
  const ms = local ? Date.parse(`${local[1]}T${local[2]}${local[3] || ":00"}${offset}`) : Date.parse(value);
  // ต้องเป็นวันที่จริง ไม่เกิน 1 วันข้างหน้า และไม่เก่ากว่า 30 วัน ไม่งั้นใช้เวลาปัจจุบัน
  if (!Number.isFinite(ms) || ms > now + DAY || ms < now - 30 * DAY) return new Date(now);
  return new Date(ms);
}
