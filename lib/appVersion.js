// เวอร์ชันของระบบ แสดงที่ footer
// เปลี่ยนพร้อม "version" ใน package.json (มีเทสต์ตรวจให้ตรงกัน) — ไม่ import package.json ตรง ๆ
// เพื่อไม่ให้รายการ dependency ทั้งหมดหลุดไปในไฟล์ฝั่งเบราว์เซอร์
export const APP_VERSION = "1.0.0";
export const APP_VERSION_LABEL = `v.${APP_VERSION}`;
