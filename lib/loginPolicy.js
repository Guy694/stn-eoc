// เกณฑ์กันการสุ่มรหัสผ่านของหน้าเข้าสู่ระบบเจ้าหน้าที่ — ปรับได้ใน .env โดยไม่ต้องแก้โค้ด
// เดิม: ผิด 5 ครั้งใน 15 นาที (นับรวมทั้ง IP) → ทั้ง รพ./รพ.สต. ที่ใช้เน็ตเดียวกันถูกบล็อกพร้อมกัน
// ใหม่: แยกนับ "ต่อบัญชี" กับ "ต่อ IP" และเผื่อเครือข่ายที่ใช้ร่วมกันหลายคน

function envInt(env, name, fallback, { min = 1, max = 10000 } = {}) {
  const value = Number.parseInt(env?.[name] ?? "", 10);
  return Number.isFinite(value) && value >= min && value <= max ? value : fallback;
}

export function loginPolicy(env = process.env) {
  return {
    windowMinutes: envInt(env, "LOGIN_WINDOW_MINUTES", 15, { max: 1440 }),
    // ทุกคำขอเข้าสู่ระบบต่อ IP (รวมที่ถูก) — กันบอทยิงรัว
    ipRequestLimit: envInt(env, "LOGIN_IP_REQUEST_LIMIT", 100),
    // รหัสผิดต่อชื่อผู้ใช้ในช่วงเวลา → พักการเข้าสู่ระบบของชื่อนั้นชั่วคราว
    failedPerAccount: envInt(env, "LOGIN_MAX_FAILED_PER_ACCOUNT", 10),
    // รหัสผิดรวมทุกชื่อผู้ใช้จาก IP เดียว (เครือข่ายโรงพยาบาลใช้ IP เดียวกันหลายสิบคน)
    failedPerIp: envInt(env, "LOGIN_MAX_FAILED_PER_IP", 40),
    // รหัสผิดติดกันของบัญชี → ล็อกบัญชี
    lockAfterFailures: envInt(env, "LOGIN_LOCK_AFTER_FAILURES", 10),
    lockMinutes: envInt(env, "LOGIN_LOCK_MINUTES", 15, { max: 1440 })
  };
}

/** ตัดสินจากจำนวนครั้งที่ผิดล่าสุด: null = ผ่าน หรือ { scope, message } */
export function failedAttemptBlock({ byAccount = 0, byIp = 0 }, policy = loginPolicy()) {
  if (byAccount >= policy.failedPerAccount) {
    return { scope: "account", message: `ใส่รหัสผ่านผิดหลายครั้ง กรุณารอ ${policy.windowMinutes} นาทีแล้วลองใหม่ หรือติดต่อผู้ดูแลระบบให้ตั้งรหัสผ่านใหม่` };
  }
  if (byIp >= policy.failedPerIp) {
    return { scope: "ip", message: `มีการเข้าสู่ระบบผิดจากเครือข่ายนี้หลายครั้ง กรุณารอ ${policy.windowMinutes} นาทีแล้วลองใหม่` };
  }
  return null;
}
