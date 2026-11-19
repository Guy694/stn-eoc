import crypto from "node:crypto";

/** ตรวจ header x-cron-secret แบบเวลาคงที่ (กันเดาทีละตัวอักษรจากเวลาตอบ) — ไม่ตั้งค่า secret = ไม่ผ่าน */
export function isCronRequest(request, secret = process.env.ALERT_CRON_SECRET) {
  const given = request?.headers?.get?.("x-cron-secret") || "";
  if (!secret || !given) return false;
  const a = crypto.createHash("sha256").update(String(given)).digest();
  const b = crypto.createHash("sha256").update(String(secret)).digest();
  return crypto.timingSafeEqual(a, b);
}
