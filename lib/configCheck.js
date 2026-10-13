// ตรวจการตั้งค่าที่มีผลต่อความปลอดภัยของ production (เรียกตอนเซิร์ฟเวอร์เริ่ม) — คืนข้อความเตือน ไม่หยุดเซิร์ฟเวอร์
export function productionConfigWarnings(env = process.env) {
  const warnings = [];
  const trustProxy = Number.parseInt(env.TRUST_PROXY || "0", 10);
  if (!(trustProxy > 0)) {
    warnings.push("TRUST_PROXY ยังไม่ได้ตั้ง — ระบบจะเชื่อ header X-Real-IP ซึ่งผู้ใช้ปลอมได้ถ้าแอปไม่ได้อยู่หลัง nginx ที่เขียนทับค่านี้ (ตั้ง TRUST_PROXY=1 และให้ nginx เขียนทับ header ที่อยู่ IP ของผู้ใช้)");
  }
  const appUrl = env.APP_URL || env.NEXT_PUBLIC_APP_URL || "";
  if (!appUrl.startsWith("https://")) warnings.push("APP_URL ไม่ใช่ https:// — ระบบจะไม่เปิด HSTS และ cookie ต้องใช้ผ่าน https เท่านั้น");
  if (!env.SECRET_KEY || String(env.SECRET_KEY).length < 32) warnings.push("SECRET_KEY ว่างหรือสั้นกว่า 32 ตัวอักษร");
  if (!env.VULNERABLE_DATA_KEY) warnings.push("VULNERABLE_DATA_KEY ยังไม่ได้ตั้ง — ข้อมูลกลุ่มเปราะบางจะเข้ารหัสด้วย SECRET_KEY (ห้ามเปลี่ยนคีย์หลังมีข้อมูล)");
  if (String(env.DB_USER || "").toLowerCase() === "root") warnings.push("DB_USER เป็น root — ควรสร้างผู้ใช้เฉพาะแอปที่มีสิทธิ์เฉพาะฐานข้อมูลนี้");
  return warnings;
}
