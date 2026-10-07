// ตรวจสถานการณ์น้ำรายสถานีเพื่อแจ้งเตือน (ไม่มีการเรียกฐานข้อมูล/เครือข่ายในไฟล์นี้)
// สถานะ: normal (ปกติ) → near (ใกล้ล้นตลิ่ง) → overflow (ล้นตลิ่ง)
// - แจ้งทันทีเมื่อสถานการณ์ "แย่ลง"
// - เมื่อดีขึ้น ต้องลดลงพ้นระยะกันแกว่ง (hysteresis) ก่อน จึงเปลี่ยนสถานะ — กันการแจ้งเตือนรัวเมื่อน้ำปริ่ม ๆ ตลิ่ง
import { bankText, isStale } from "@/lib/thaiWater";
import { isRainStale, rainCategory } from "@/lib/thaiWaterRain";

export const WATER_ALERT_STATES = ["normal", "near", "overflow"];
const RANK = { normal: 0, near: 1, overflow: 2 };

export const DEFAULT_THRESHOLDS = {
  nearMeters: 0.5,          // น้ำห่างตลิ่งไม่เกิน 0.5 ม. = ใกล้ล้นตลิ่ง
  overflowClearMeters: 0.1, // จะถือว่าพ้นล้นตลิ่ง ต้องต่ำกว่าตลิ่งอย่างน้อย 0.1 ม.
  nearClearMeters: 0.2      // จะถือว่าพ้นใกล้ล้น ต้องต่ำกว่าเกณฑ์ใกล้ล้นอีก 0.2 ม.
};

export function thresholdsFromEnv(env = process.env) {
  const near = Number(env.WATER_ALERT_NEAR_M);
  return { ...DEFAULT_THRESHOLDS, ...(Number.isFinite(near) && near > 0 && near < 5 ? { nearMeters: near } : {}) };
}

// สถานะตามตัวเลขล้วน ๆ (ยังไม่คิดกันแกว่ง)
export function rawState(station, thresholds = DEFAULT_THRESHOLDS) {
  const diff = station?.bankDiff;
  if (diff === null || diff === undefined || !Number.isFinite(Number(diff))) {
    return Number(station?.situationLevel) >= 5 ? "overflow" : null;
  }
  if (diff > 0) return "overflow";
  if (diff >= -thresholds.nearMeters) return "near";
  return "normal";
}

// สถานะใหม่เมื่อคิดกันแกว่งแล้ว
export function nextState(previous, station, thresholds = DEFAULT_THRESHOLDS) {
  const prev = WATER_ALERT_STATES.includes(previous) ? previous : "normal";
  const raw = rawState(station, thresholds);
  if (!raw) return prev;
  if (RANK[raw] >= RANK[prev]) return raw;
  const diff = Number(station.bankDiff);
  if (prev === "overflow") {
    if (diff > -thresholds.overflowClearMeters) return "overflow";
    return diff >= -thresholds.nearMeters ? "near" : "normal";
  }
  // prev === "near"
  return diff > -(thresholds.nearMeters + thresholds.nearClearMeters) ? "near" : "normal";
}

function stationPlace(station) {
  return [station.river, station.tambon && `ต.${station.tambon}`, station.amphoe && `อ.${station.amphoe}`].filter(Boolean).join(" · ");
}

function trendText(station) {
  const trend = station.trend;
  if (!trend) return "";
  return `${trend.arrow} ${trend.label}${trend.change ? ` (${trend.change > 0 ? "+" : ""}${trend.change.toFixed(2)} ม.)` : ""}`;
}

export function buildAlert(station, previous, state) {
  const worse = RANK[state] > RANK[previous];
  const level = state === "overflow" && worse ? "critical" : state === "near" && worse ? "serious" : "info";
  const title = state === "overflow" && worse ? `🚨 น้ำล้นตลิ่ง — สถานี${station.name}`
    : state === "near" && worse ? `⚠️ น้ำใกล้ล้นตลิ่ง — สถานี${station.name}`
      : previous === "overflow" ? `✅ น้ำลดลงต่ำกว่าตลิ่งแล้ว — สถานี${station.name}`
        : `✅ ระดับน้ำกลับสู่ปกติ — สถานี${station.name}`;
  const lines = [
    stationPlace(station),
    station.bankDiff !== null && station.bankDiff !== undefined ? bankText(station.bankDiff) : "",
    station.waterLevelMsl !== null && station.waterLevelMsl !== undefined
      ? `ระดับน้ำ ${station.waterLevelMsl.toFixed(2)} ม.รทก.${station.bankLevelMsl !== null && station.bankLevelMsl !== undefined ? ` (ตลิ่ง ${station.bankLevelMsl.toFixed(2)})` : ""}`
      : "",
    trendText(station) ? `แนวโน้ม: ${trendText(station)}` : ""
  ].filter(Boolean);
  return {
    kind: "water",
    stationId: station.id,
    stationName: station.name,
    level,
    state,
    previousState: previous,
    bankDiff: station.bankDiff ?? null,
    waterLevelMsl: station.waterLevelMsl ?? null,
    observedAt: station.observedAt || null,
    title,
    lines
  };
}

/**
 * stations = จาก parseWaterLevelResponse, states = Map(stationId → state ล่าสุด)
 * คืนรายการแจ้งเตือน และสถานะใหม่ของทุกสถานีที่ประมวลผลได้
 */
export function detectWaterAlerts(stations, states, { thresholds = DEFAULT_THRESHOLDS, now = Date.now() } = {}) {
  const alerts = [];
  const updates = [];
  for (const station of stations || []) {
    if (!station?.id || isStale(station.observedAt, now)) continue; // ข้อมูลเก่า/ไม่มีเวลา ไม่ใช้ตัดสินการเตือน
    const previous = states.get(String(station.id)) || "normal";
    const state = nextState(previous, station, thresholds);
    updates.push({ station, state, changed: state !== previous });
    if (state === previous) continue;
    // กลับจาก "ใกล้ล้น" เป็นปกติ: เปลี่ยนสถานะเงียบ ๆ ไม่ต้องแจ้ง
    if (previous === "near" && state === "normal") continue;
    alerts.push(buildAlert(station, previous, state));
  }
  return { alerts, updates };
}

function formatThaiTime(iso) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("th-TH", { timeZone: "Asia/Bangkok", day: "numeric", month: "short", year: "2-digit", hour: "2-digit", minute: "2-digit" }) + " น.";
}

export function formatWaterAlertTelegram(alert, { escape = (value) => value, link } = {}) {
  const lines = [
    `<b>${escape(alert.title)}</b>`,
    ...alert.lines.map((line) => escape(line)),
    `วัดเมื่อ ${escape(formatThaiTime(alert.observedAt))}`,
    "ที่มา: คลังข้อมูลน้ำแห่งชาติ (ThaiWater) สสน."
  ];
  if (link) lines.push(`<a href="${escape(link)}">ดูแผนที่ระดับน้ำ</a>`);
  return lines.join("\n");
}

// ─── ฝนหนัก (สถานีวัดฝน) ─────────────────────────────────────────────
// สถานะ: normal → watch (ฝนหนัก ≥ 60 มม./24 ชม.) → severe (ฝนหนักมาก ≥ 90.1 มม. ตามเกณฑ์กรมอุตุฯ)
// แจ้งเฉพาะตอนแย่ลง ฝนสะสม 24 ชม. ลดลงเองตามเวลา จึงไม่แจ้ง "คลี่คลาย" และต้องลดต่ำกว่าเกณฑ์ 20% ก่อนนับใหม่ (กันแจ้งซ้ำ)
export const DEFAULT_RAIN_THRESHOLDS = { watchMm: 60, severeMm: 90.1 };
const RAIN_RANK = { normal: 0, watch: 1, severe: 2 };
export const RAIN_ID_PREFIX = "rain:";

export function rainThresholdsFromEnv(env = process.env) {
  const watch = Number(env.RAIN_ALERT_WATCH_MM);
  const severe = Number(env.RAIN_ALERT_SEVERE_MM);
  const result = { ...DEFAULT_RAIN_THRESHOLDS };
  if (Number.isFinite(watch) && watch > 0) result.watchMm = watch;
  if (Number.isFinite(severe) && severe > 0) result.severeMm = severe;
  // ตั้งค่ากลับด้าน (เกณฑ์ฝนหนัก ≥ ฝนหนักมาก) → ใช้ค่าเริ่มต้นทั้งคู่ ดีกว่าเตือนผิดลำดับ
  if (result.severeMm <= result.watchMm) return { ...DEFAULT_RAIN_THRESHOLDS };
  return result;
}

export function rawRainState(rain24h, thresholds = DEFAULT_RAIN_THRESHOLDS) {
  const value = Number(rain24h);
  if (!Number.isFinite(value)) return null;
  if (value >= thresholds.severeMm) return "severe";
  if (value >= thresholds.watchMm) return "watch";
  return "normal";
}

export function nextRainState(previous, rain24h, thresholds = DEFAULT_RAIN_THRESHOLDS) {
  const prev = RAIN_RANK[previous] !== undefined ? previous : "normal";
  const raw = rawRainState(rain24h, thresholds);
  if (!raw) return prev;
  if (RAIN_RANK[raw] >= RAIN_RANK[prev]) return raw;
  const value = Number(rain24h);
  if (prev === "severe" && value >= thresholds.severeMm * 0.8) return "severe";
  if (prev === "watch" && value >= thresholds.watchMm * 0.8) return "watch";
  return raw;
}

export function buildRainAlert(station, previous, state) {
  const category = rainCategory(station.rain24h);
  const severe = state === "severe";
  return {
    kind: "rain",
    stationId: `${RAIN_ID_PREFIX}${station.id}`,
    stationName: station.name,
    level: severe ? "critical" : "serious",
    state,
    previousState: previous,
    bankDiff: null,
    waterLevelMsl: null,
    rain24h: station.rain24h,
    observedAt: station.observedAt || null,
    title: `${severe ? "⛈️ ฝนหนักมาก" : "🌧️ ฝนหนัก"} — สถานีวัดฝน${station.name}`,
    lines: [
      [station.tambon && `ต.${station.tambon}`, station.amphoe && `อ.${station.amphoe}`].filter(Boolean).join(" "),
      `ฝน 24 ชม. ${station.rain24h.toFixed(1)} มม. (${category.label})`,
      station.rain1h ? `ฝน 1 ชม.ล่าสุด ${station.rain1h.toFixed(1)} มม.` : "",
      severe ? "เฝ้าระวังน้ำป่าไหลหลาก น้ำท่วมฉับพลัน และดินถล่มในพื้นที่ลาดชัน" : "ติดตามระดับน้ำในคลองใกล้เคียง"
    ].filter(Boolean)
  };
}

/** stations = จาก parseRainResponse, states = Map("rain:<id>" → state) */
export function detectRainAlerts(stations, states, { thresholds = DEFAULT_RAIN_THRESHOLDS, now = Date.now() } = {}) {
  const alerts = [];
  const updates = [];
  for (const station of stations || []) {
    if (!station?.id || isRainStale(station.observedAt, now)) continue;
    const key = `${RAIN_ID_PREFIX}${station.id}`;
    const previous = states.get(key) || "normal";
    const state = nextRainState(previous, station.rain24h, thresholds);
    updates.push({ key, station, state, changed: state !== previous });
    if (RAIN_RANK[state] > RAIN_RANK[previous]) alerts.push(buildRainAlert(station, previous, state));
  }
  return { alerts, updates };
}

// ฝนหนักหลายสถานีในรอบเดียว → รวมเป็นข้อความ Telegram เดียว (ไม่ให้กลุ่มถูกถล่มด้วยข้อความ)
export function formatRainAlertsTelegram(alerts, { escape = (value) => value, link } = {}) {
  if (!alerts.length) return "";
  const severe = alerts.some((alert) => alert.state === "severe");
  const lines = [
    `<b>${severe ? "⛈️ ฝนหนักมาก" : "🌧️ ฝนหนัก"}${alerts.length > 1 ? ` ${alerts.length} สถานี` : ""} ในจังหวัดสตูล</b>`,
    ...[...alerts]
      .sort((a, b) => b.rain24h - a.rain24h)
      .map((alert) => `• ${escape(alert.stationName)} (${escape(alert.lines[0] || "-")}) ${alert.rain24h.toFixed(1)} มม./24 ชม.`),
    severe ? "เฝ้าระวังน้ำป่าไหลหลาก น้ำท่วมฉับพลัน และดินถล่ม" : "ติดตามระดับน้ำในคลองใกล้เคียง",
    `วัดเมื่อ ${escape(formatThaiTime(alerts.map((alert) => alert.observedAt).filter(Boolean).sort().pop()))}`,
    "ที่มา: คลังข้อมูลน้ำแห่งชาติ (ThaiWater) สสน."
  ];
  if (link) lines.push(`<a href="${escape(link)}">ดูแผนที่ฝน</a>`);
  return lines.join("\n");
}
