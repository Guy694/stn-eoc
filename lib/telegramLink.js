// เชื่อม Telegram ของเจ้าหน้าที่ผ่านบอท (deep link) — ไม่ต้องให้เจ้าหน้าที่หา/กรอก Chat ID เอง
// 1) createTelegramLink(officerId) → ลิงก์ https://t.me/<bot>?start=<รหัสครั้งเดียว>
// 2) เจ้าหน้าที่กด Start ในบอท → บอทได้ข้อความ "/start <รหัส>"
// 3) syncTelegramUpdates() ดึงข้อความจากบอท (getUpdates) แล้วผูก chat_id กับเจ้าหน้าที่เจ้าของรหัส
// ใช้ getUpdates จึงไม่ต้องเปิด webhook สาธารณะ — บอทนี้ต้องไม่ถูกตั้ง webhook หรือถูกระบบอื่นดึงข้อความอยู่
import crypto from "node:crypto";
import { query } from "@/lib/db";
import { escapeTelegramHtml, sendTelegramMessage } from "@/lib/telegram";

export const LINK_TTL_MINUTES = 15;
const TOKEN_PATTERN = /^\/start(?:@\w+)?\s+([A-Za-z0-9_-]{20,64})\s*$/;
const STATE_KEY = Symbol.for("stn-eoc.telegram-link");

const state = () => {
  if (!globalThis[STATE_KEY]) globalThis[STATE_KEY] = { offset: 0, running: null, lastRun: 0, username: null };
  return globalThis[STATE_KEY];
};

export const hashLinkToken = (token) => crypto.createHash("sha256").update(String(token)).digest("hex");

/** รหัสจากข้อความ "/start <รหัส>" (null ถ้าไม่ใช่) */
export function parseStartToken(text) {
  const match = String(text || "").trim().match(TOKEN_PATTERN);
  return match ? match[1] : null;
}

/** แยกข้อความ /start จากแชตส่วนตัวใน update ของ Telegram */
export function startMessages(updates = []) {
  return updates
    .map((update) => update?.message)
    .filter((message) => message?.chat?.type === "private" && typeof message.text === "string" && /^\/start\b/.test(message.text.trim()))
    .map((message) => ({ chatId: String(message.chat.id), token: parseStartToken(message.text), name: [message.from?.first_name, message.from?.last_name].filter(Boolean).join(" ") }));
}

async function telegramApi(method, params = {}, fetchImpl = fetch) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return { ok: false, description: "NO_TOKEN" };
  const response = await fetchImpl(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params)
  });
  const json = await response.json().catch(() => ({}));
  return { ...json, status: response.status };
}

/** ชื่อบอท: จาก env หรือถาม Telegram (getMe) ครั้งเดียวแล้วจำไว้ */
export async function getBotUsername(fetchImpl = fetch) {
  const fromEnv = String(process.env.TELEGRAM_BOT_USERNAME || process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME || "").replace(/^@/, "").trim();
  if (fromEnv) return fromEnv;
  const s = state();
  if (s.username) return s.username;
  if (!process.env.TELEGRAM_BOT_TOKEN) return "";
  const me = await telegramApi("getMe", {}, fetchImpl).catch(() => null);
  s.username = me?.ok ? me.result?.username || "" : "";
  return s.username;
}

export async function createTelegramLink(officerId, fetchImpl = fetch) {
  const username = await getBotUsername(fetchImpl);
  if (!username) return null;
  const token = crypto.randomBytes(18).toString("base64url");
  await query("DELETE FROM officer_telegram_links WHERE officer_id = ? OR expires_at < NOW()", [officerId]);
  await query(
    `INSERT INTO officer_telegram_links (token_hash, officer_id, expires_at) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL ${LINK_TTL_MINUTES} MINUTE))`,
    [hashLinkToken(token), officerId]
  );
  return { url: `https://t.me/${username}?start=${token}`, botUsername: username, expiresInMinutes: LINK_TTL_MINUTES };
}

/** ใช้รหัส (ครั้งเดียว) → ผูก chat_id กับเจ้าหน้าที่ · คืน officer หรือ null */
export async function consumeLinkToken(token, chatId) {
  if (!token) return null;
  const hash = hashLinkToken(token);
  const rows = await query("SELECT officer_id FROM officer_telegram_links WHERE token_hash = ? AND expires_at > NOW() LIMIT 1", [hash]);
  if (!rows[0]) return null;
  const removed = await query("DELETE FROM officer_telegram_links WHERE token_hash = ?", [hash]);
  if (removed?.affectedRows !== 1) return null; // อีกคำขอใช้รหัสนี้ไปแล้ว
  const officerId = rows[0].officer_id;
  await query("UPDATE officer SET telegram_chat_id = ?, telegram_notify_enabled = 1 WHERE id = ?", [chatId, officerId]);
  const officers = await query("SELECT id, title, given_name, family_name, username FROM officer WHERE id = ? LIMIT 1", [officerId]);
  return officers[0] || { id: officerId };
}

/** ประมวลผลข้อความ /start ที่บอทได้รับ (ใช้ได้ทั้งจาก getUpdates และ webhook) */
export async function processTelegramUpdates(updates, { send = sendTelegramMessage } = {}) {
  const linked = [];
  for (const message of startMessages(updates)) {
    const officer = await consumeLinkToken(message.token, message.chatId);
    if (officer) {
      linked.push(officer.id);
      const name = [officer.title, officer.given_name, officer.family_name].filter(Boolean).join("") || officer.username || "";
      await send(message.chatId, `✅ เชื่อม Telegram กับบัญชี <b>${escapeTelegramHtml(name)}</b> ในระบบ ศูนย์ข้อมูลสถานการณ์ฉุกเฉิน จังหวัดสตูล แล้ว\nจะได้รับแจ้งเตือนเมื่อประชาชนส่งคำขอความช่วยเหลือ (ปิดได้ที่หน้าโปรไฟล์)`);
    } else {
      await send(message.chatId, "บอทนี้ใช้ส่งแจ้งเตือนของระบบ ศูนย์ข้อมูลสถานการณ์ฉุกเฉิน จังหวัดสตูล\nเชื่อมบัญชีได้ที่หน้าโปรไฟล์ในระบบ › รับแจ้งเตือนทาง Telegram › เชื่อม Telegram (ลิงก์ใช้ได้ 15 นาที)");
    }
  }
  return linked;
}

/**
 * ดึงข้อความใหม่จากบอทแล้วผูกบัญชี — เรียกระหว่างที่เจ้าหน้าที่รอเชื่อมบนหน้าโปรไฟล์
 * ทำทีละครั้ง (single-flight) และไม่ถี่กว่า 2 วินาที
 */
export async function syncTelegramUpdates({ fetchImpl = fetch, send } = {}) {
  const s = state();
  if (s.running) return s.running;
  if (Date.now() - s.lastRun < 2000) return { ok: true, linked: [], skipped: true };
  s.running = (async () => {
    try {
      const result = await telegramApi("getUpdates", { offset: s.offset || undefined, timeout: 0, allowed_updates: ["message"] }, fetchImpl);
      if (!result.ok) {
        // 409 = บอทถูกตั้ง webhook หรือมีระบบอื่นดึงข้อความอยู่
        return { ok: false, conflict: result.status === 409 || result.error_code === 409, linked: [] };
      }
      const updates = Array.isArray(result.result) ? result.result : [];
      if (updates.length) s.offset = Math.max(...updates.map((update) => Number(update.update_id) || 0)) + 1;
      const linked = await processTelegramUpdates(updates, send ? { send } : undefined);
      return { ok: true, linked };
    } catch (error) {
      console.error("[telegram-link] getUpdates error:", error?.message);
      return { ok: false, linked: [] };
    } finally {
      s.lastRun = Date.now();
      s.running = null;
    }
  })();
  return s.running;
}

export function resetTelegramLinkState() {
  globalThis[STATE_KEY] = null;
}
