// เวอร์ชันของระบบ แสดงที่ footer
// เปลี่ยนพร้อม "version" ใน package.json (มีเทสต์ตรวจให้ตรงกัน) — ไม่ import package.json ตรง ๆ
// เพื่อไม่ให้รายการ dependency ทั้งหมดหลุดไปในไฟล์ฝั่งเบราว์เซอร์
export const APP_VERSION = "1.0.0";
export const APP_VERSION_LABEL = `v.${APP_VERSION}`;

// เจ้าของลิขสิทธิ์ (ตรงกับไฟล์ LICENSE)
export const COPYRIGHT_OWNER_TH = "สำนักงานสาธารณสุขจังหวัดสตูล";
export const COPYRIGHT_OWNER_EN = "Satun Provincial Health Office";
export const COPYRIGHT_START_YEAR = 2025;

/** "© 2025–2026 ..." — ปีสิ้นสุดตามปีปัจจุบัน (ค.ศ.) */
export function copyrightYears(now = new Date()) {
  const year = now.getFullYear();
  return year > COPYRIGHT_START_YEAR ? `${COPYRIGHT_START_YEAR}–${year}` : String(COPYRIGHT_START_YEAR);
}
