// ตรวจสถานการณ์น้ำรายสถานีเพื่อแจ้งเตือน (ไม่มีการเรียกฐานข้อมูล/เครือข่ายในไฟล์นี้)
// สถานี ปภ. แยกตามสถานะต้นทางครบ 5 ระดับ: ปกติ → เฝ้าระวัง → เตือนภัย → อันตราย → วิกฤต
// - แจ้งทันทีเมื่อสถานการณ์ "แย่ลง"
// - เมื่อดีขึ้น ต้องลดลงพ้นระยะกันแกว่ง (hysteresis) ก่อน จึงเปลี่ยนสถานะ — กันการแจ้งเตือนรัวเมื่อน้ำปริ่ม ๆ ตลิ่ง
import { bankText, isStale } from "@/lib/thaiWater";
import { isRainStale, rainCategory } from "@/lib/thaiWaterRain";
import { DPM_STATUS, nextThreshold } from "@/lib/dpmCanals";
import { DDPM_CCTV_CREDIT } from "@/lib/ddpmCctv";

// สถานี ปภ.: normal → watch (เฝ้าระวัง) → warning (เตือนภัย) → danger (อันตราย) → critical (วิกฤต) ตรงกับ waterLevelStatus 1–5
// สถานีรูปแบบอื่น (เทียบตลิ่ง): normal → near → overflow — ค่า near/overflow เดิมในฐานข้อมูลของสถานี ปภ. อ่านเป็น watch/danger
export const WATER_ALERT_STATES = ["normal", "near", "overflow", "watch", "warning", "danger", "critical"];
const RANK = { normal: 0, near: 1, overflow: 2 };
export const DPM_STATE_RANK = { normal: 0, watch: 1, warning: 2, danger: 3, critical: 4 };
const DPM_STATE_BY_STATUS = { 1: "normal", 2: "watch", 3: "warning", 4: "danger", 5: "critical" };
const DPM_STATE_LABEL = { normal: "ปกติ", watch: "เฝ้าระวัง", warning: "เตือนภัย", danger: "อันตราย", critical: "วิกฤต" };
const DPM_LEGACY = { near: "watch", overflow: "danger" };
export const DPM_CLEAR_METERS = 0.1; // ลดลงต่ำกว่าเกณฑ์ของระดับเดิมอย่างน้อย 0.10 ม. จึงลดระดับ — กันแกว่งรอบเกณฑ์
const isDpm = (station) => station?.source === "ddpm" && Number(station.statusCode) > 0;
const dpmPrevious = (previous) => (DPM_STATE_RANK[previous] !== undefined ? previous : DPM_LEGACY[previous] || "normal");

/** น้ำลดลงจากเกณฑ์อันตราย (อันตราย/วิกฤต/ล้นตลิ่งเดิม) เป็นระดับที่ต่ำกว่า — ใช้แจ้งประชาชนว่า "น้ำลดแล้ว" */
export function isDangerResolved(alert) {
  if (alert?.kind !== "water") return false;
  if (alert.source === "ddpm") {
    const prev = dpmPrevious(alert.previousState);
    return DPM_STATE_RANK[prev] >= DPM_STATE_RANK.danger && (DPM_STATE_RANK[dpmPrevious(alert.state)] ?? 0) < DPM_STATE_RANK.danger;
  }
  return alert.previousState === "overflow" && alert.state !== "overflow";
}

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
  if (isDpm(station)) return DPM_STATE_BY_STATUS[Math.min(5, Math.round(Number(station.statusCode)))] || "normal";
  const diff = station?.bankDiff;
  if (diff === null || diff === undefined || !Number.isFinite(Number(diff))) {
    return Number(station?.situationLevel) >= 5 ? "overflow" : null;
  }
  if (diff > 0) return "overflow";
  if (diff >= -thresholds.nearMeters) return "near";
  return "normal";
}

// สถานี ปภ.: ขึ้นระดับทันที ส่วนลดระดับต้องต่ำกว่าเกณฑ์ของระดับเดิมเกิน DPM_CLEAR_METERS (ถ้ามีเกณฑ์ให้เทียบ)
function nextDpmState(previous, station) {
  const prev = dpmPrevious(previous);
  const raw = rawState(station);
  if (DPM_STATE_RANK[raw] >= DPM_STATE_RANK[prev]) return raw;
  const finite = (value) => (value === null || value === undefined || value === "" ? null : Number.isFinite(Number(value)) ? Number(value) : null);
  const level = finite(station.level);
  const edge = finite(station.thresholds?.[prev]); // เกณฑ์ที่ ปภ. ไม่ได้ตั้งไว้ (null) ไม่ใช้กันแกว่ง
  if (level !== null && edge !== null && level > edge - DPM_CLEAR_METERS) return prev;
  return raw;
}

// สถานะใหม่เมื่อคิดกันแกว่งแล้ว
export function nextState(previous, station, thresholds = DEFAULT_THRESHOLDS) {
  if (isDpm(station)) return nextDpmState(previous, station);
  const legacy = { watch: "near", warning: "near", danger: "overflow", critical: "overflow" }[previous] || previous;
  const prev = RANK[legacy] !== undefined ? legacy : "normal";
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

const dpmLabelOf = (state) => DPM_STATE_LABEL[state] || "-";

function buildDpmAlert(station, previousRaw, state) {
  const previous = dpmPrevious(previousRaw);
  const worse = DPM_STATE_RANK[state] > DPM_STATE_RANK[previous];
  const high = DPM_STATE_RANK[state] >= DPM_STATE_RANK.danger;
  const label = dpmLabelOf(state);
  const title = worse
    ? `${state === "critical" ? "🆘" : high ? "🚨" : "⚠️"} ระดับน้ำ${label} — สถานี${station.name}`
    : state === "normal" ? `✅ ระดับน้ำกลับสู่เกณฑ์ปกติ — สถานี${station.name}`
      : `🔽 ระดับน้ำลดลงเป็น${label} (จาก${dpmLabelOf(previous)}) — สถานี${station.name}`;
  const next = nextThreshold(station);
  const lines = [
    stationPlace(station),
    `สถานะ ปภ.: ${label}${previous !== state ? ` (จาก${dpmLabelOf(previous)})` : ""}`,
    station.bankDiff !== null && station.bankDiff !== undefined ? bankText(station.bankDiff) : "",
    station.waterLevelMsl !== null && station.waterLevelMsl !== undefined
      ? `ระดับน้ำปัจจุบัน ${station.waterLevelMsl.toFixed(2)} ม.${station.bankLevelMsl !== null && station.bankLevelMsl !== undefined ? ` (ระดับตลิ่ง ${station.bankLevelMsl.toFixed(2)} ม.)` : ""}`
      : "",
    next ? `เกณฑ์ถัดไป: ${next.label} ${next.level.toFixed(2)} ม. (อีก ${next.gap.toFixed(2)} ม.)` : "",
    trendText(station) ? `แนวโน้ม: ${trendText(station)}` : ""
  ].filter(Boolean);
  return {
    kind: "water",
    stationId: station.id,
    stationName: station.name,
    amphoe: station.amphoe || null,
    level: worse ? (high ? "critical" : "serious") : "info",
    state,
    previousState: previous,
    bankDiff: station.bankDiff ?? null,
    waterLevelMsl: station.waterLevelMsl ?? null,
    observedAt: station.observedAt || null,
    source: "ddpm",
    statusCode: station.statusCode ?? null,
    title,
    lines
  };
}

// ขึ้นระดับ = แจ้งทุกครั้ง · ลดระดับ = แจ้งเมื่อลงจากอันตราย/วิกฤต หรือกลับปกติจากเตือนภัยขึ้นไป (เฝ้าระวัง→ปกติ เปลี่ยนเงียบ ๆ)
function shouldAlert(station, previousRaw, state) {
  if (!isDpm(station)) return !(previousRaw === "near" && state === "normal");
  const previous = dpmPrevious(previousRaw);
  const drop = DPM_STATE_RANK[state] < DPM_STATE_RANK[previous];
  if (!drop) return true;
  return DPM_STATE_RANK[previous] >= DPM_STATE_RANK.danger || (state === "normal" && DPM_STATE_RANK[previous] >= DPM_STATE_RANK.warning);
}

export function buildAlert(station, previous, state) {
  if (isDpm(station)) return buildDpmAlert(station, previous, state);
  const worse = RANK[state] > RANK[previous];
  const level = state === "overflow" && worse ? "critical" : state === "near" && worse ? "serious" : "info";
  const title = state === "overflow" && worse ? `🚨 น้ำล้นตลิ่ง — สถานี${station.name}`
    : state === "near" && worse ? `⚠️ น้ำใกล้ล้นตลิ่ง — สถานี${station.name}`
      : previous === "overflow" ? `✅ น้ำลดลงต่ำกว่าตลิ่งแล้ว — สถานี${station.name}`
        : `✅ ระดับน้ำกลับสู่ปกติ — สถานี${station.name}`;
  const lines = [
    stationPlace(station),
    station.source === "ddpm" && station.statusCode > 0 ? `สถานะ ปภ.: ${DPM_STATUS[station.statusCode]?.label || "-"}` : "",
    station.bankDiff !== null && station.bankDiff !== undefined ? bankText(station.bankDiff) : "",
    station.waterLevelMsl !== null && station.waterLevelMsl !== undefined
      ? `${station.source === "ddpm" ? "ระดับน้ำปัจจุบัน" : "ระดับน้ำ"} ${station.waterLevelMsl.toFixed(2)} ม.${station.source === "ddpm" ? ` (ระดับตลิ่ง ${station.bankLevelMsl?.toFixed(2) ?? "-"} ม.)` : ` รทก.${station.bankLevelMsl !== null && station.bankLevelMsl !== undefined ? ` (ตลิ่ง ${station.bankLevelMsl.toFixed(2)})` : ""}`}`
      : "",
    trendText(station) ? `แนวโน้ม: ${trendText(station)}` : ""
  ].filter(Boolean);
  return {
    kind: "water",
    stationId: station.id,
    stationName: station.name,
    amphoe: station.amphoe || null,
    level,
    state,
    previousState: previous,
    bankDiff: station.bankDiff ?? null,
    waterLevelMsl: station.waterLevelMsl ?? null,
    observedAt: station.observedAt || null,
    source: station.source || "thaiwater",
    statusCode: station.statusCode ?? null,
    title,
    lines
  };
}

/**
 * stations = สถานีระดับน้ำรูปแบบกลาง, states = Map(stationId → state ล่าสุด)
 * คืนรายการแจ้งเตือน และสถานะใหม่ของทุกสถานีที่ประมวลผลได้
 */
export function detectWaterAlerts(stations, states, { thresholds = DEFAULT_THRESHOLDS, now = Date.now() } = {}) {
  const alerts = [];
  const updates = [];
  for (const station of stations || []) {
    if (!station?.id || isStale(station.observedAt, now)) continue; // ข้อมูลเก่า/ไม่มีเวลา ไม่ใช้ตัดสินการเตือน
    const stored = states.get(String(station.id)) || "normal";
    const previous = isDpm(station) ? dpmPrevious(stored) : stored; // near/overflow เดิมของสถานี ปภ. อ่านเป็น watch/danger
    const state = nextState(previous, station, thresholds);
    updates.push({ station, state, changed: state !== previous });
    if (state === previous) continue;
    // เปลี่ยนสถานะเงียบ ๆ เมื่อลดจากระดับต่ำ (เช่น ใกล้ล้น/เฝ้าระวัง → ปกติ) ไม่ต้องแจ้ง
    if (!shouldAlert(station, previous, state)) continue;
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
    `ที่มา: ${alert.source === "ddpm" ? DDPM_CCTV_CREDIT : "คลังข้อมูลน้ำแห่งชาติ (ThaiWater) สสน."}`
  ];
  if (link) lines.push(`<a href="${escape(link)}">ดูแผนที่ระดับน้ำ</a>`);
  return lines.join("\n");
}

// ─── ฝนหนัก (สถานีวัดฝน) ─────────────────────────────────────────────
// สถานะ: normal → watch (ฝนหนัก ≥ 35.1 มม./24 ชม.) → severe (ฝนหนักมาก ≥ 90.1 มม.) ตามเกณฑ์ ปภ./กรมอุตุฯ
// แจ้งเฉพาะตอนแย่ลง ฝนสะสม 24 ชม. ลดลงเองตามเวลา จึงไม่แจ้ง "คลี่คลาย" และต้องลดต่ำกว่าเกณฑ์ 20% ก่อนนับใหม่ (กันแจ้งซ้ำ)
export const DEFAULT_RAIN_THRESHOLDS = { watchMm: 35.1, severeMm: 90.1 };
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
