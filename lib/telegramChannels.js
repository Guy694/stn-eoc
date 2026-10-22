// แยกกลุ่มผู้รับแจ้งเตือน Telegram ตามประเภทเรื่อง และหัวข้อความแบบเดียวกันทุกเรื่อง
//
// ประเภท        ส่งเข้ากลุ่ม                           ส่งส่วนตัว (เจ้าหน้าที่ที่เชื่อม Telegram ในหน้าโปรไฟล์)
// ─────────────────────────────────────────────────────────────────────────────────────────────
// water/rain    กลุ่มเจ้าหน้าที่ (หรือ TELEGRAM_WATER_CHAT_IDS)  เจ้าหน้าที่ทุกคน + ผู้ดูแลระบบ
// help          กลุ่มเจ้าหน้าที่                        เจ้าหน้าที่ทุกคน + ผู้ดูแลระบบ
// event/report  กลุ่มเจ้าหน้าที่                        ผู้ดูแลระบบ
// security      กลุ่มผู้ดูแลระบบ (TELEGRAM_SECURITY_CHAT_IDS)  ผู้ดูแลระบบเท่านั้น — ไม่ส่งเข้ากลุ่มเจ้าหน้าที่
// test          กลุ่มเจ้าหน้าที่                        —
import { query } from "@/lib/db";
import { escapeTelegramHtml, sendTelegramMessage, sendTelegramPhoto } from "@/lib/telegram";

export const AUDIENCE_LABELS = { staff: "เจ้าหน้าที่ทุกคน", admin: "ผู้ดูแลระบบเท่านั้น" };

export const TELEGRAM_CATEGORIES = {
  water: { icon: "🌊", label: "แจ้งเตือนระดับน้ำ", audience: "staff", personal: "all" },
  rain: { icon: "🌧️", label: "แจ้งเตือนฝนตกหนัก", audience: "staff", personal: "all" },
  help: { icon: "🆘", label: "คำขอความช่วยเหลือจากประชาชน", audience: "staff", personal: "all" },
  event: { icon: "📋", label: "สถานการณ์ EOC", audience: "staff", personal: "admin" },
  report: { icon: "📝", label: "ติดตามการส่งรายงาน", audience: "staff", personal: "admin" },
  staff: { icon: "🧑‍⚕️", label: "เจ้าหน้าที่ขอความช่วยเหลือ", audience: "staff", personal: "admin" },
  security: { icon: "🔐", label: "ความปลอดภัยระบบ", audience: "admin", personal: "admin" },
  test: { icon: "🔔", label: "ทดสอบการแจ้งเตือน", audience: "staff", personal: "none" }
};

/** เหตุด้านความปลอดภัย → ข้อความภาษาไทยที่ผู้ดูแลอ่านแล้วรู้ทันทีว่าเกิดอะไร */
export const SECURITY_EVENT_LABELS = {
  login_ip_rate_limit_triggered: "เข้าสู่ระบบถี่ผิดปกติจาก IP เดียว (ถูกพักชั่วคราว)",
  login_rate_limit_triggered: "ใส่รหัสผ่านผิดหลายครั้ง (ถูกพักชั่วคราว)",
  account_locked_after_failed_logins: "บัญชีถูกล็อกเพราะใส่รหัสผ่านผิดติดกัน",
  thaiid_oauth_state_mismatch: "การเข้าสู่ระบบด้วย ThaiD ไม่ตรงกับคำขอเดิม (อาจถูกปลอมคำขอ)",
  provider_id_oauth_state_mismatch: "การเข้าสู่ระบบด้วย Provider ID ไม่ตรงกับคำขอเดิม (อาจถูกปลอมคำขอ)",
  tampered_registration_session: "ข้อมูลลงทะเบียนถูกแก้ไขระหว่างทาง",
  chatbot_oversized_prompt: "ส่งข้อความยาวผิดปกติเข้าผู้ช่วย",
  chatbot_sql_probe_blocked: "พยายามส่งคำสั่งฐานข้อมูลผ่านผู้ช่วย (ถูกบล็อก)"
};

const DETAIL_LABELS = {
  username: "ชื่อผู้ใช้",
  userId: "รหัสผู้ใช้",
  ip: "IP",
  userAgent: "อุปกรณ์/เบราว์เซอร์",
  failedAttempts: "จำนวนครั้งที่ผิด",
  scope: "นับจาก",
  hasState: "มีรหัสคำขอ",
  length: "ความยาวข้อความ"
};
const SCOPE_LABELS = { account: "ชื่อผู้ใช้เดียวกัน", ip: "เครือข่าย/IP เดียวกัน" };

function splitIds(raw) {
  return [...new Set(String(raw || "").split(/[\s,;]+/).map((value) => value.trim()).filter(Boolean))];
}

/** กลุ่ม Telegram ของประเภทนั้น (จาก .env) */
export function groupChatIds(category, env = process.env) {
  const staff = splitIds(env.TELEGRAM_HELP_NOTIFY_CHAT_IDS || env.TELEGRAM_NOTIFY_CHAT_IDS);
  if (category === "security") return splitIds(env.TELEGRAM_SECURITY_CHAT_IDS || env.TELEGRAM_ADMIN_CHAT_IDS);
  if (category === "water" || category === "rain") {
    const water = splitIds(env.TELEGRAM_WATER_CHAT_IDS);
    return water.length ? water : staff;
  }
  return staff;
}

/** ใครได้รับข้อความส่วนตัวของประเภทนี้ (ตามบทบาท) */
export function personalAllowed(category, role) {
  const rule = TELEGRAM_CATEGORIES[category]?.personal || "none";
  if (rule === "none") return false;
  if (role === "admin") return true;
  return rule === "all";
}

/** chat id ส่วนตัวของเจ้าหน้าที่ที่เปิดรับแจ้งเตือน (บัญชีอนุมัติแล้ว ไม่ถูกระงับ) */
export async function personalChatIds(category, { run = query } = {}) {
  const rule = TELEGRAM_CATEGORIES[category]?.personal || "none";
  if (rule === "none") return [];
  try {
    const rows = await run(
      `SELECT telegram_chat_id, role FROM officer
       WHERE telegram_notify_enabled = 1 AND telegram_chat_id IS NOT NULL AND telegram_chat_id <> ''
         AND COALESCE(is_approved, 0) = 1
         AND (account_locked_until IS NULL OR account_locked_until < NOW())
         ${rule === "admin" ? "AND role = 'admin'" : ""}`,
      []
    );
    return (Array.isArray(rows) ? rows : []).filter((row) => personalAllowed(category, row.role)).map((row) => String(row.telegram_chat_id).trim()).filter(Boolean);
  } catch (error) {
    // ฐานข้อมูลเก่ายังไม่มีคอลัมน์ Telegram ส่วนตัว → ส่งเฉพาะกลุ่ม
    if (error?.code === "ER_BAD_FIELD_ERROR" || error?.code === "ER_NO_SUCH_TABLE") return [];
    throw error;
  }
}

export function formatThaiDateTime(date = new Date()) {
  return date.toLocaleString("th-TH", { timeZone: "Asia/Bangkok", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) + " น.";
}

/**
 * ข้อความแบบเดียวกันทุกประเภท:
 *   🌊 แจ้งเตือนระดับน้ำ
 *   ━━━━━━━━━━━━
 *   (เนื้อหา)
 *   ━━━━━━━━━━━━
 *   🕒 22 ต.ค. 2569 15:30 น. · ถึง: เจ้าหน้าที่ทุกคน
 */
export function formatCategorized(category, body, { now = new Date() } = {}) {
  const meta = TELEGRAM_CATEGORIES[category] || TELEGRAM_CATEGORIES.test;
  const rule = "━━━━━━━━━━━━";
  return [
    `${meta.icon} <b>${meta.label}</b>`,
    rule,
    String(body || "").trim(),
    rule,
    `🕒 ${formatThaiDateTime(now)} · ถึง: ${AUDIENCE_LABELS[meta.audience]}`
  ].join("\n");
}

/** ข้อความเหตุความปลอดภัย (ภาษาไทย ไม่ส่งข้อมูลลับ) */
export function formatSecurityBody(eventType, details = {}, escape = escapeTelegramHtml) {
  const title = SECURITY_EVENT_LABELS[eventType] || eventType;
  const lines = Object.entries(details)
    .filter(([, value]) => value !== undefined && value !== null && value !== "")
    .slice(0, 10)
    .map(([key, value]) => {
      const text = key === "scope" ? (SCOPE_LABELS[value] || value) : String(value).slice(0, 300);
      return `${escape(DETAIL_LABELS[key] || key)}: ${escape(text)}`;
    });
  return [`<b>${escape(title)}</b>`, ...lines, `รหัสเหตุการณ์: <code>${escape(eventType)}</code>`, "ตรวจรายละเอียดที่ ตั้งค่าระบบ › ความปลอดภัย"].join("\n");
}

/**
 * ส่งข้อความตามประเภท: กลุ่มของประเภทนั้น + ข้อความส่วนตัวตามบทบาท (ไม่ส่งซ้ำ chat เดิม)
 * @returns {Promise<{ delivered: number, total: number, groups: number }>}
 */
export async function sendCategorized(category, body, { photo, photoCaption, env = process.env, includePersonal = true, send = sendTelegramMessage, sendPhoto = sendTelegramPhoto, run } = {}) {
  if (!env.TELEGRAM_BOT_TOKEN) return { delivered: 0, total: 0, groups: 0, skipped: true };
  const groups = groupChatIds(category, env);
  const personal = includePersonal ? await personalChatIds(category, run ? { run } : undefined).catch(() => []) : [];
  const recipients = [...new Set([...groups, ...personal])];
  if (!recipients.length) return { delivered: 0, total: 0, groups: 0, skipped: true };
  const text = formatCategorized(category, body);
  const caption = photoCaption ? formatCategorized(category, photoCaption) : null;
  const results = await Promise.allSettled(recipients.map(async (chatId) => {
    if (photo && caption) {
      const sent = await sendPhoto(chatId, photo, caption);
      if (sent?.ok) return sent;
    }
    return send(chatId, text);
  }));
  const delivered = results.filter((result) => result.status === "fulfilled" && result.value?.ok).length;
  return { delivered, total: recipients.length, groups: groups.length };
}

export function categoryReady(category, env = process.env) {
  return Boolean(env.TELEGRAM_BOT_TOKEN && groupChatIds(category, env).length);
}
