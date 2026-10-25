// ตัวรันแจ้งเตือนน้ำ/ฝน (ฝั่งเซิร์ฟเวอร์): ระดับน้ำจาก ปภ. และฝนจาก ThaiWater → เทียบสถานะเดิม → บันทึก → ส่ง Telegram
// popup บนหน้าจอเจ้าหน้าที่อ่านจาก water_alert_log (ดู /api/eoc/water-alerts)
// ระดับน้ำและฝนดึงแยกกัน ฝั่งหนึ่งล่ม อีกฝั่งยังตรวจได้
import { query } from "@/lib/db";
import { getSatunRainfall } from "@/lib/thaiWaterClient";
import { getDpmCanalStations } from "@/lib/dpmCanalsServer";
import { dpmStationForMap } from "@/lib/dpmCanals";
import {
  detectRainAlerts, detectWaterAlerts, formatRainAlertsTelegram, formatWaterAlertTelegram,
  rainThresholdsFromEnv, thresholdsFromEnv
} from "@/lib/waterAlerts";
import { alertSendingEnabled, telegramReady } from "@/lib/eocAlertRunner";
import { escapeTelegramHtml } from "@/lib/telegram";
import { sendCategorized } from "@/lib/telegramChannels";

function toDbDateTime(iso) {
  const match = String(iso || "").match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2}:\d{2})/);
  return match ? `${match[1]} ${match[2]}` : null;
}

async function loadStates() {
  try {
    const rows = await query("SELECT station_id, state FROM water_station_alert_state", []);
    return { ready: true, states: new Map(rows.map((row) => [String(row.station_id), row.state])) };
  } catch (error) {
    if (error.code === "ER_NO_SUCH_TABLE") return { ready: false, states: new Map() };
    throw error;
  }
}

function mapLink() {
  const base = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || "";
  return base ? `${base.replace(/\/$/, "")}/stn-eoc/public/disaster-map` : null;
}

async function saveState({ id, kind, name, state, bankDiff, observedAt, changed }) {
  await query(
    `INSERT INTO water_station_alert_state (station_id, kind, station_name, state, bank_diff, observed_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE kind = VALUES(kind), station_name = VALUES(station_name), state = VALUES(state),
       bank_diff = VALUES(bank_diff), observed_at = VALUES(observed_at)${changed ? ", changed_at = CURRENT_TIMESTAMP" : ""}`,
    [id, kind, name, state, bankDiff, toDbDateTime(observedAt)]
  );
}

async function saveLog(alert) {
  const result = await query(
    `INSERT INTO water_alert_log (kind, station_id, station_name, level, state, previous_state, bank_diff, water_level_msl, title, message, observed_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [alert.kind, alert.stationId, alert.stationName, alert.level, alert.state, alert.previousState, alert.bankDiff, alert.waterLevelMsl, alert.title, alert.lines.join("\n"), toDbDateTime(alert.observedAt)]
  );
  return result?.insertId || null;
}

/** category: "water" (ระดับน้ำ) | "rain" (ฝน) — ส่งกลุ่มเจ้าหน้าที่ + เจ้าหน้าที่ที่เชื่อม Telegram ส่วนตัว */
async function sendTelegram(category, text) {
  return (await sendCategorized(category, text)).delivered;
}

/** dryRun = ดูว่าจะมีอะไรถูกแจ้ง โดยไม่บันทึกและไม่ส่ง */
export async function runWaterAlerts({ dryRun = false } = {}) {
  const [waterResult, rainResult, { ready, states }] = await Promise.all([
    getDpmCanalStations().then((value) => ({ ok: true, value: { ...value, stations: value.stations.map(dpmStationForMap) } })).catch((error) => ({ ok: false, error })),
    getSatunRainfall().then((value) => ({ ok: true, value })).catch((error) => ({ ok: false, error })),
    loadStates()
  ]);
  if (!waterResult.ok && !rainResult.ok) throw waterResult.error;

  const water = waterResult.ok
    ? detectWaterAlerts(waterResult.value.stations, states, { thresholds: thresholdsFromEnv() })
    : { alerts: [], updates: [] };
  const rain = rainResult.ok
    ? detectRainAlerts(rainResult.value.stations, states, { thresholds: rainThresholdsFromEnv() })
    : { alerts: [], updates: [] };
  const alerts = [...water.alerts, ...rain.alerts];
  const base = {
    stations: (waterResult.ok ? waterResult.value.stations.length : 0),
    rainStations: (rainResult.ok ? rainResult.value.stations.length : 0),
    sourceErrors: [!waterResult.ok && "ระดับน้ำ", !rainResult.ok && "ฝน"].filter(Boolean),
    logReady: ready,
    telegramReady: telegramReady(),
    sendingEnabled: alertSendingEnabled()
  };
  if (dryRun || !ready) return { ...base, alerts, saved: 0, delivered: 0 };

  for (const { station, state, changed } of water.updates) {
    await saveState({ id: String(station.id), kind: "water", name: station.name, state, bankDiff: station.bankDiff, observedAt: station.observedAt, changed });
  }
  for (const { key, station, state, changed } of rain.updates) {
    await saveState({ id: key, kind: "rain", name: station.name, state, bankDiff: null, observedAt: station.observedAt, changed });
  }

  const canSend = telegramReady() && alertSendingEnabled();
  let delivered = 0;
  // ระดับน้ำ: ส่งทีละสถานี (แต่ละเรื่องสำคัญ)
  for (const alert of water.alerts) {
    const id = await saveLog(alert);
    if (!canSend) continue;
    const ok = await sendTelegram("water", formatWaterAlertTelegram(alert, { escape: escapeTelegramHtml, link: mapLink() }));
    delivered += ok;
    if (ok && id) await query("UPDATE water_alert_log SET delivered_count = ? WHERE id = ?", [ok, id]);
  }
  // ฝนหนัก: บันทึกทีละสถานี แต่รวมเป็นข้อความ Telegram เดียวต่อรอบ
  const rainIds = [];
  for (const alert of rain.alerts) rainIds.push(await saveLog(alert));
  if (rain.alerts.length && canSend) {
    const ok = await sendTelegram("rain", formatRainAlertsTelegram(rain.alerts, { escape: escapeTelegramHtml, link: mapLink() }));
    delivered += ok;
    const ids = rainIds.filter(Boolean);
    if (ok && ids.length) await query(`UPDATE water_alert_log SET delivered_count = ? WHERE id IN (${ids.map(() => "?").join(",")})`, [ok, ...ids]);
  }
  // น้ำลดต่ำกว่าตลิ่งแล้ว → แจ้งประชาชนในอำเภอนั้น (ถ้าเปิดการส่งอัตโนมัติ) — ล้มเหลวไม่กระทบการแจ้งเตือนเจ้าหน้าที่
  if (water.alerts.some((alert) => alert.previousState === "overflow" && alert.state !== "overflow")) {
    try {
      const { sendResolvedAlerts } = await import("@/lib/publicPushServer");
      const result = await sendResolvedAlerts(water.alerts);
      if (result?.sent) console.info(`[public-push] แจ้งน้ำลดแล้ว ${result.sent} สถานี ถึง ${result.delivered}/${result.recipients} เครื่อง`);
    } catch (error) {
      console.error("[public-push] แจ้งน้ำลดแล้วไม่สำเร็จ:", error.message);
    }
  }
  return { ...base, alerts, saved: alerts.length, delivered };
}

// ตั้งเวลาตรวจอัตโนมัติภายในเซิร์ฟเวอร์ (เรียกจาก instrumentation.js ตอนเซิร์ฟเวอร์เริ่ม)
// ค่าเริ่มต้น: ทุก 10 นาที เฉพาะ production — ปิดด้วย WATER_ALERTS_INTERVAL_MIN=off, บังคับเปิดตอน dev ด้วย WATER_ALERTS_SCHEDULER=on
export function startWaterAlertScheduler() {
  const setting = String(process.env.WATER_ALERTS_INTERVAL_MIN || "10").trim().toLowerCase();
  const forced = String(process.env.WATER_ALERTS_SCHEDULER || "").trim().toLowerCase() === "on";
  if (["off", "0", "false", "no"].includes(setting)) return false;
  if (process.env.NODE_ENV !== "production" && !forced) return false;
  if (globalThis.__waterAlertTimer) return true;
  const minutes = Math.min(60, Math.max(5, Number(setting) || 10));
  const tick = () => import("@/lib/schedulerLock").then(({ withSchedulerLock }) => withSchedulerLock("water-alerts", runWaterAlerts)).then((result) => {
    if (result?.skipped) return;
    if (result.saved) console.info(`[water-alerts] แจ้งเตือน ${result.saved} เรื่อง ส่ง Telegram ${result.delivered} ครั้ง`);
    if (result.sourceErrors.length) console.warn(`[water-alerts] ดึงข้อมูลไม่ได้: ${result.sourceErrors.join(", ")}`);
  }).catch((error) => console.error("[water-alerts] ตรวจไม่สำเร็จ:", error.message));
  globalThis.__waterAlertTimer = setInterval(tick, minutes * 60 * 1000);
  setTimeout(tick, 30 * 1000); // รอบแรกหลังเซิร์ฟเวอร์เริ่ม 30 วินาที
  console.info(`[water-alerts] ตรวจระดับน้ำอัตโนมัติทุก ${minutes} นาที`);
  return true;
}
