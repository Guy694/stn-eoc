// สถานะระบบสำหรับหน้า "ตั้งค่าระบบ" ของผู้ดูแล — ส่วนที่ไม่แตะฐานข้อมูล (ทดสอบได้)
// หลักการ: แสดง "ตั้งค่าแล้วหรือยัง" เท่านั้น ห้ามส่งค่า secret (token/key/password) ออกไปที่หน้าเว็บ

/** การเชื่อมต่อภายนอกและค่าที่ต้องตั้งใน .env (ค่าจริงอยู่บนเซิร์ฟเวอร์เท่านั้น) */
export const INTEGRATIONS = [
  { key: "telegram", label: "Telegram แจ้งเตือนศูนย์", purpose: "ส่งเรื่องเร่งด่วนและคำขอช่วยเหลือเข้ากลุ่มของศูนย์", env: ["TELEGRAM_BOT_TOKEN", "TELEGRAM_HELP_NOTIFY_CHAT_IDS"], live: true },
  { key: "telegram-bot-link", label: "ชื่อ Bot สำหรับเจ้าหน้าที่", purpose: "ปุ่ม \"เปิด Bot ใน Telegram\" ในหน้าโปรไฟล์ ให้เจ้าหน้าที่สมัครรับแจ้งเตือนส่วนตัวเองได้", env: ["TELEGRAM_BOT_USERNAME"] },
  { key: "telegram-security", label: "Telegram แจ้งเหตุความปลอดภัย", purpose: "แจ้งเมื่อมีการล็อกบัญชีหรือเหตุผิดปกติ", env: ["TELEGRAM_BOT_TOKEN", "TELEGRAM_SECURITY_CHAT_IDS"] },
  { key: "open-meteo", label: "Open-Meteo (พยากรณ์อากาศ)", purpose: "ข้อมูลฝนและอากาศในหน้าเฝ้าระวังสภาพอากาศ", env: [], live: true },
  { key: "gistda", label: "GISTDA (พื้นที่น้ำท่วมจากดาวเทียม)", purpose: "ชั้นข้อมูลน้ำท่วมจากภาพดาวเทียม", env: ["GISTDA_API_KEY"] },
  { key: "gemini", label: "Gemini (AI ผู้ช่วย)", purpose: "ผู้ช่วยตอบคำถามประชาชนและวิเคราะห์ข้อมูล", env: ["GEMINI_API_KEY"], live: true },
  { key: "thaid", label: "ThaiD (ยืนยันตัวตน)", purpose: "ลงทะเบียนและเข้าสู่ระบบด้วย ThaiD", env: ["THAIID_CLIENT_ID", "THAIID_CLIENT_SECRET", "THAIID_CALLBACK_URL"] },
  { key: "backup-key", label: "กุญแจเข้ารหัสไฟล์สำรอง", purpose: "ไฟล์สำรองฐานข้อมูลถูกเข้ารหัสก่อนเก็บ", env: ["BACKUP_ENCRYPTION_KEY"] },
  { key: "alert-cron", label: "ตัวตั้งเวลาตรวจแจ้งเตือน", purpose: "ให้ระบบตรวจเรื่องเร่งด่วนตามรอบเวลา แม้ไม่มีใครบันทึกข้อมูล", env: ["ALERT_CRON_SECRET"] },
  { key: "app-url", label: "ที่อยู่เว็บไซต์ของระบบ", purpose: "ใช้สร้างลิงก์ในข้อความแจ้งเตือน", env: ["NEXT_PUBLIC_APP_URL"] }
];

const hasValue = (env, name) => Boolean(String(env?.[name] ?? "").trim());

/** สถานะการตั้งค่า (ไม่ส่งค่าจริงออกไป) */
export function integrationStatus(env = process.env) {
  return INTEGRATIONS.map(({ key, label, purpose, env: names, live = false }) => {
    const missing = names.filter((name) => !hasValue(env, name));
    return { key, label, purpose, required: names, missing, configured: missing.length === 0, live };
  });
}

/** แสดงรหัสกลุ่ม Telegram แบบปิดบัง เช่น -100…4821 */
export function maskId(value) {
  const text = String(value ?? "").trim();
  if (!text) return "";
  if (text.length <= 4) return "…" + text.slice(-2);
  return `${text.slice(0, text.startsWith("-") ? 4 : 2)}…${text.slice(-4)}`;
}

/** ตารางสิทธิ์ตามบทบาท (อ่านจาก rolePermissions ในโค้ด) */
export function buildRoleMatrix(rolePermissions = {}, roleDisplayNames = {}, roles = null) {
  const order = roles || Object.keys(rolePermissions).filter((role) => role !== "citizen");
  const can = (scope, action) => Boolean(scope && scope[action]);
  return order.filter((role) => rolePermissions[role]).map((role) => {
    const perm = rolePermissions[role];
    return {
      role,
      name: roleDisplayNames[role] || role,
      eoc: { view: can(perm.eoc, "view"), create: can(perm.eoc, "create"), edit: can(perm.eoc, "edit"), delete: can(perm.eoc, "delete") },
      admin: can(perm.admin, "view") ? (can(perm.admin, "edit") ? "จัดการ" : "ดูได้") : "-",
      reports: can(perm.reports, "export") ? "ดู + ส่งออก" : can(perm.reports, "view") ? "ดูได้" : "-",
      users: can(perm.users, "edit") ? "จัดการ" : can(perm.users, "view") ? "ดูได้" : "-"
    };
  });
}

/** migration ที่อยู่ใน manifest แต่ยังไม่ได้รัน (เรียงตามลำดับใน manifest) */
export function pendingMigrations(manifestNames = [], appliedNames = []) {
  const applied = new Set(appliedNames);
  return manifestNames.filter((name) => !applied.has(name));
}

/** สรุปสุขภาพระบบเป็นรายการตรวจ ok/warn/bad เพื่อแสดงบนสุดของหน้า */
export function healthChecks(status = {}) {
  const checks = [];
  const db = status.db || {};
  checks.push(db.ok
    ? { key: "db", tone: db.timezoneOk === false ? "warn" : "ok", title: "ฐานข้อมูล", detail: db.timezoneOk === false ? `เชื่อมต่อได้ แต่ time zone ของ session เป็น ${db.sessionTimezone} (ควรเป็น +07:00)` : `เชื่อมต่อได้ · ${db.tables} ตาราง · ${db.sizeMb} MB` }
    : { key: "db", tone: "bad", title: "ฐานข้อมูล", detail: db.error || "เชื่อมต่อไม่ได้" });
  const pending = status.migrations?.pending || [];
  checks.push(status.migrations?.error
    ? { key: "migrations", tone: "warn", title: "โครงสร้างฐานข้อมูล", detail: status.migrations.error }
    : pending.length
      ? { key: "migrations", tone: "bad", title: "โครงสร้างฐานข้อมูล", detail: `มี migration ค้าง ${pending.length} ไฟล์ — บางเมนูอาจใช้ไม่ได้ ให้รัน npm run db:migrate` }
      : { key: "migrations", tone: "ok", title: "โครงสร้างฐานข้อมูล", detail: `เป็นปัจจุบัน (${status.migrations?.total || 0} ไฟล์)` });
  const telegram = (status.integrations || []).find((item) => item.key === "telegram");
  const alerts = status.alerts || {};
  checks.push(!telegram?.configured
    ? { key: "alerts", tone: "bad", title: "การแจ้งเตือน", detail: "ยังไม่ได้ตั้งค่า Telegram — เรื่องเร่งด่วนจะไม่ถูกส่งถึงผู้บัญชาการ" }
    : alerts.sendingEnabled === false
      ? { key: "alerts", tone: "warn", title: "การแจ้งเตือน", detail: "ปิดการส่งอยู่ (EOC_ALERTS_TELEGRAM=off)" }
      : { key: "alerts", tone: "ok", title: "การแจ้งเตือน", detail: `ส่งเข้า ${alerts.chatCount || 0} กลุ่ม` });
  const latest = status.backups?.files?.[0];
  const ageDays = latest ? (Date.now() - new Date(latest.modifiedAt).getTime()) / 86400000 : null;
  checks.push(!latest
    ? { key: "backup", tone: "warn", title: "สำรองข้อมูล", detail: "ไม่พบไฟล์สำรองในโฟลเดอร์ backups ของเซิร์ฟเวอร์" }
    : ageDays > 7
      ? { key: "backup", tone: "warn", title: "สำรองข้อมูล", detail: `ไฟล์ล่าสุดเก่า ${Math.floor(ageDays)} วัน` }
      : { key: "backup", tone: "ok", title: "สำรองข้อมูล", detail: `ล่าสุด ${Math.max(0, Math.floor(ageDays))} วันที่แล้ว` });
  return checks;
}

const csvCell = (value) => {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

/** สถิติผู้เข้าชมเป็น CSV (ขึ้นต้นด้วย BOM ให้ Excel อ่านภาษาไทยถูก) */
export function visitorStatsToCsv(stats = {}) {
  const lines = [["หมวด", "รายการ", "จำนวน"]];
  lines.push(["สรุป", "ผู้เข้าชมทั้งหมด", stats.totalVisits ?? 0]);
  lines.push(["สรุป", "วันนี้", stats.todayVisits ?? 0]);
  lines.push(["สรุป", "7 วันล่าสุด", stats.last7DaysVisits ?? 0]);
  for (const row of stats.dailyVisits || []) lines.push(["รายวัน", row.date, row.visits]);
  for (const row of stats.topPages || []) lines.push(["หน้าที่เข้าชม", row.path, row.visits]);
  for (const row of stats.devices || []) lines.push(["อุปกรณ์", row.type, row.visits]);
  const help = stats.helpRequests || {};
  lines.push(["ขอความช่วยเหลือ", "เปิดหน้าขอความช่วยเหลือ", help.opened ?? 0]);
  lines.push(["ขอความช่วยเหลือ", "ส่งคำขอสำเร็จ", help.submitted ?? 0]);
  for (const row of help.sources || []) lines.push(["หน้าก่อนขอความช่วยเหลือ", row.path, row.starts]);
  return "﻿" + lines.map((line) => line.map(csvCell).join(",")).join("\r\n");
}
