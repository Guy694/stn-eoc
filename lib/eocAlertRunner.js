// ตัวรันแจ้งเตือนอัตโนมัติ (ฝั่งเซิร์ฟเวอร์): โหลดสรุป → หาเหตุสำคัญ → ตัดเรื่องที่เคยส่ง → ส่ง Telegram → บันทึก
import { query } from "@/lib/db";
import { getEocTypeLabel } from "@/lib/eocDisplay";
import { loadEventBrief } from "@/lib/eocBriefData";
import { detectAlerts, formatAlertMessage } from "@/lib/eocAlerts";
import { escapeTelegramHtml, getTelegramHelpNotifyChatIds, sendTelegramMessage } from "@/lib/telegram";

export function telegramReady() {
  return Boolean(process.env.TELEGRAM_BOT_TOKEN && getTelegramHelpNotifyChatIds().length);
}

/** ปิดการส่ง Telegram ชั่วคราว (เช่น ช่วงทดสอบ/ซ้อมแผน) ด้วย EOC_ALERTS_TELEGRAM=off — ยังบันทึกประวัติตามปกติ */
export function alertSendingEnabled() {
  return !["off", "false", "0", "no"].includes(String(process.env.EOC_ALERTS_TELEGRAM || "").trim().toLowerCase());
}

const TEST_TAG = "[ทดสอบ]";
/** เรื่องที่มาจากข้อมูลทดสอบ จะบันทึกไว้แต่ไม่ส่งออกนอกระบบ */
export function isTestAlert(alert) {
  return String(alert?.text || "").includes(TEST_TAG);
}

async function sentKeys(sessionId) {
  try {
    const rows = await query(`SELECT alert_key FROM eoc_alert_log WHERE eoc_session_id = ?`, [sessionId]);
    return { ready: true, keys: new Set(rows.map((row) => row.alert_key)) };
  } catch (error) {
    if (error.code === "ER_NO_SUCH_TABLE") return { ready: false, keys: new Set() };
    throw error;
  }
}

/** dryRun = แค่ดูว่าจะมีอะไรถูกส่ง */
export async function runEventAlerts(session, { dryRun = false } = {}) {
  const eventLabel = `${getEocTypeLabel(session.eoc_type)} ครั้งที่ ${session.session_number}`;
  const brief = await loadEventBrief(session);
  const detected = detectAlerts(brief, { eventLabel });
  const { ready, keys } = await sentKeys(session.id);
  const fresh = detected.filter((alert) => !keys.has(alert.key));
  if (dryRun || !ready || !fresh.length || session.status !== "active") {
    return { detected, fresh, sent: 0, logReady: ready, telegramReady: telegramReady() };
  }

  const outgoing = fresh.filter((alert) => !isTestAlert(alert));
  let delivered = 0;
  if (outgoing.length && telegramReady() && alertSendingEnabled()) {
    const base = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || "";
    const text = formatAlertMessage({ eventLabel, alerts: outgoing, escape: escapeTelegramHtml, link: base ? `${base.replace(/\/$/, "")}/stn-eoc/eoc/${session.eoc_type}/meeting-brief` : null });
    const results = await Promise.all(getTelegramHelpNotifyChatIds().map((chatId) => sendTelegramMessage(chatId, text)));
    delivered = results.filter((result) => result.ok).length;
  }
  // บันทึกทุกเรื่องที่ตรวจพบ (แม้ยังไม่ได้ตั้งค่า Telegram) เพื่อให้หน้าเว็บแสดงประวัติ และไม่ส่งซ้ำเมื่อเปิดใช้ภายหลัง
  for (const alert of fresh) {
    await query(
      `INSERT IGNORE INTO eoc_alert_log (eoc_session_id, alert_key, level, message, delivered_count) VALUES (?, ?, ?, ?, ?)`,
      [session.id, alert.key, alert.level, alert.text, isTestAlert(alert) ? 0 : delivered]
    );
  }
  return { detected, fresh, sent: fresh.length, delivered, logReady: ready, telegramReady: telegramReady() };
}

// เรียกหลังบันทึกข้อมูลสำคัญ (ไม่รอผล) — รันไม่เกิน 1 ครั้ง/นาที/เหตุการณ์
// ถ้ามีการบันทึกระหว่างช่วงพัก จะนัดรันอีกครั้งเมื่อครบนาที (ไม่ทิ้งเรื่องที่เกิดระหว่างนั้น)
const THROTTLE_MS = 60000;
const lastRun = new Map();
const queued = new Set();
export function triggerEventAlerts(sessionId) {
  const id = Number(sessionId);
  if (!id || queued.has(id)) return;
  const wait = Math.max(0, (lastRun.get(id) || 0) + THROTTLE_MS - Date.now());
  queued.add(id);
  setTimeout(async () => {
    queued.delete(id);
    lastRun.set(id, Date.now());
    try {
      const rows = await query(`SELECT id, eoc_type, session_number, status, opened_at, closed_at FROM eoc_sessions WHERE id = ? LIMIT 1`, [id]);
      if (rows[0]) await runEventAlerts(rows[0]);
    } catch (error) {
      console.error("Auto alert error:", error.message);
    }
  }, wait + 1500);
}
