// สัญญาณพยากรณ์และความเสี่ยงรายอำเภอ (ไม่มีการเรียกเครือข่ายในไฟล์นี้)
//  - ตอนนี้: ฝนวัดจริงและระดับน้ำจาก ThaiWater (สสน.)
//  - ข้างหน้า: ECMWF Ensemble (โอกาสฝนหนักจากการรันหลายชุด) และ GloFAS (ปริมาณน้ำในคลองเทียบสถิติ 20 ปี)

// เกณฑ์ฝน 24 ชม. ที่ ปภ. ใช้ในรายงานสถานการณ์ (ร่วมกับกรมอุตุนิยมวิทยา):
//   เล็กน้อย 0.1–10.0 · ปานกลาง 10.1–35.0 · หนัก 35.1–90.0 · หนักมาก 90.1 มม. ขึ้นไป (lib/thaiWaterRain.js RAIN_CATEGORIES)
export const HEAVY_RAIN_MM = 35.1;
export const VERY_HEAVY_RAIN_MM = 90.1;
// ขั้นกลางของ "ฝนหนัก" ใช้ให้คะแนนความเสี่ยงเท่านั้น (ฝนหนัก 60 มม. ขึ้นไปเสี่ยงกว่าฝนหนัก 35 มม.) — ไม่ใช่ชื่อประเภทฝน
export const HEAVY_RAIN_UPPER_MM = 60;
/** @deprecated ใช้ VERY_HEAVY_RAIN_MM (ฝนหนักมาก) */
export const EXTREME_RAIN_MM = VERY_HEAVY_RAIN_MM;
export const NOW_FRESH_HOURS = 2;

// อำเภอที่ติดทะเล (น้ำทะเลหนุนมีผลต่อการระบายน้ำ)
export const COASTAL_DISTRICTS = new Set(["เมืองสตูล", "ละงู", "ท่าแพ", "ทุ่งหว้า"]);
// คะแนนน้ำทะเลหนุน: หนุนสูง/สูงสุดเพิ่มความเสี่ยงเอง ส่วน "สูงกว่าปกติ" นับเมื่อมีฝน/น้ำในคลองสูงร่วมด้วย
export const SEA_POINTS = { normal: 0, elevated: 0, high: 1, record: 2 };
const SEA_RANK = { normal: 0, elevated: 1, high: 2, record: 3 };

/** สถานะน้ำทะเลที่ใช้คิดความเสี่ยง: ยอดน้ำรอบนี้ หรือรอบถัดไปใน 24 ชม. (ตัวที่สูงกว่า) */
export function seaRiskStatus(sea, now = Date.now()) {
  if (!sea?.status || sea.stale) return null;
  let key = sea.status.key;
  let level = sea.peak?.level ?? sea.level;
  let at = sea.peak?.at || sea.observed_at;
  for (const next of sea.next_highs || []) {
    if (!next.status || new Date(next.at).getTime() - now > 24 * 3600e3) continue;
    if ((SEA_RANK[next.status] ?? 0) > (SEA_RANK[key] ?? 0)) {
      key = next.status;
      level = next.est_level;
      at = next.at;
    }
  }
  return { key, level, at, label: { normal: "ปกติ", elevated: "หนุนสูงกว่าปกติ", high: "หนุนสูง", record: "หนุนสูงสุดในรอบ 30 วัน" }[key] || key, forecast: at !== (sea.peak?.at || sea.observed_at) };
} // ฝน 1 ชม. ต้องวัดไม่เกิน 2 ชม. ถึงนับเป็น "ตอนนี้"

export const round1 = (value) => Math.round(Number(value) * 10) / 10;

export function quantile(sorted, p) {
  if (!sorted.length) return null;
  const index = (sorted.length - 1) * p;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (index - lower);
}

// ---------- ECMWF Ensemble ----------

/** แปลง daily ของ ensemble API (precipitation_sum + precipitation_sum_memberXX) → รายวัน: โอกาสฝนเกินเกณฑ์ (%) */
export function ensembleRainDays(daily) {
  const times = daily?.time || [];
  const memberKeys = Object.keys(daily || {}).filter((key) => key.startsWith("precipitation_sum"));
  return times.map((date, index) => {
    const values = memberKeys
      .map((key) => Number(daily[key]?.[index]))
      .filter((value) => Number.isFinite(value))
      .sort((a, b) => a - b);
    if (values.length === 0) return { date, members: 0 };
    const share = (mm) => Math.round((values.filter((value) => value >= mm).length / values.length) * 100);
    return {
      date,
      members: values.length,
      median_mm: round1(quantile(values, 0.5)),
      p90_mm: round1(quantile(values, 0.9)),
      prob_heavy: share(HEAVY_RAIN_MM),
      prob_heavy_upper: share(HEAVY_RAIN_UPPER_MM),
      prob_very_heavy: share(VERY_HEAVY_RAIN_MM)
    };
  });
}

// ---------- GloFAS ----------

/** สถิติปริมาณน้ำย้อนหลัง → ค่าปกติ (มัธยฐาน), สูงกว่าปกติ (P90), สูงมาก (P99) */
export function dischargeClimatology(values) {
  const sorted = (values || []).map(Number).filter((value) => Number.isFinite(value)).sort((a, b) => a - b);
  if (sorted.length < 365) return null;
  return {
    p50: round1(quantile(sorted, 0.5)),
    p90: round1(quantile(sorted, 0.9)),
    p99: round1(quantile(sorted, 0.99)),
    max: round1(sorted[sorted.length - 1]),
    years: Math.round(sorted.length / 365)
  };
}

export const DISCHARGE_LEVELS = {
  normal: { label: "ปกติ", score: 0 },
  high: { label: "สูงกว่าปกติ", score: 1 },
  very_high: { label: "สูงมาก (เกิดไม่บ่อย)", score: 2 }
};

export function dischargeLevel(value, climatology) {
  if (!climatology || !Number.isFinite(Number(value))) return "normal";
  if (value >= climatology.p99) return "very_high";
  if (value >= climatology.p90) return "high";
  return "normal";
}

/**
 * แนวโน้มน้ำในคลอง: daily = { time, river_discharge, river_discharge_p75 } (มีย้อนหลังและพยากรณ์), today = 'YYYY-MM-DD'
 * ใช้ค่า P75 ของชุดพยากรณ์ (ค่อนไปทางระวัง แต่ไม่ใช่กรณีสุดโต่ง)
 */
export function dischargeOutlook(daily, climatology, today, days = 7) {
  const times = daily?.time || [];
  const main = daily?.river_discharge || [];
  const upper = daily?.river_discharge_p75 || main;
  const todayIndex = times.indexOf(today);
  if (todayIndex < 0) return null;
  const now = Number(main[todayIndex]);
  const byDate = {};
  let peak = { value: -Infinity, date: null };
  for (let index = todayIndex; index < Math.min(times.length, todayIndex + days); index += 1) {
    const value = Number(upper[index] ?? main[index]);
    if (!Number.isFinite(value)) continue;
    byDate[times[index]] = dischargeLevel(value, climatology);
    if (value > peak.value) peak = { value, date: times[index] };
  }
  if (!Number.isFinite(now) || peak.date === null) return null;
  const level = dischargeLevel(peak.value, climatology);
  return {
    now: round1(now),
    peak: round1(peak.value),
    peak_date: peak.date,
    change_pct: now > 0 ? Math.round(((peak.value - now) / now) * 100) : null,
    level,
    level_label: DISCHARGE_LEVELS[level].label,
    by_date: byDate,
    climatology
  };
}

// ---------- สถานี ThaiWater ในอำเภอ ----------

const isFresh = (observedAt, now, hours) => {
  const time = new Date(observedAt || 0).getTime();
  return Number.isFinite(time) && time > 0 && now - time <= hours * 3600 * 1000;
};

/** ฝน "ตอนนี้" จากสถานีที่รายงานภายใน 2 ชม. */
export function rainNow(stations = [], now = Date.now()) {
  const fresh = stations.filter((station) => isFresh(station.observedAt, now, NOW_FRESH_HOURS));
  const raining = fresh.filter((station) => Number(station.rain1h) > 0).sort((a, b) => b.rain1h - a.rain1h);
  return {
    stations: fresh.length,
    raining: raining.length,
    max1h: raining[0] ? round1(raining[0].rain1h) : 0,
    maxStation: raining[0]?.name || null
  };
}

export function rainNowText(summary) {
  if (!summary || summary.stations === 0) return null;
  if (summary.raining === 0) return "ไม่มีฝนตกขณะนี้";
  const mm = summary.max1h;
  const intensity = mm >= 20 ? "ฝนตกหนัก" : mm >= 5 ? "ฝนตกปานกลาง" : "ฝนตกเล็กน้อย";
  return `${intensity} (${summary.raining}/${summary.stations} สถานี)`;
}

/** สถานะน้ำในคลองของอำเภอ จากสถานีระดับน้ำ (bankDiff ≥ 0 = ล้นตลิ่ง) */
export function waterStatus(stations = []) {
  const usable = stations.filter((station) => Number.isFinite(Number(station.bankDiff)) && station.bankDiff !== null || station?.source === "ddpm" && Number(station.statusCode) > 0);
  if (usable.length === 0) return null;
  const severity = (station) => station.source === "ddpm" ? (station.statusCode >= 4 ? 2 : station.statusCode >= 2 ? 1 : 0) : (station.bankDiff >= 0 ? 2 : station.bankDiff > -0.5 ? 1 : 0);
  const worst = [...usable].sort((a, b) => severity(b) - severity(a) || Number(b.bankDiff || -99) - Number(a.bankDiff || -99))[0];
  const state = severity(worst) === 2 ? "overflow" : severity(worst) === 1 ? "near" : "normal";
  return { state, station: worst.name, bank_diff: Number.isFinite(Number(worst.bankDiff)) && worst.bankDiff !== null ? round1(worst.bankDiff) : null, count: usable.length,
    ...(worst.source === "ddpm" ? { source: "ddpm", status_code: worst.statusCode, status_label: worst.statusLabel || null } : {}) };
}

// ---------- ความเสี่ยง ----------

export function levelFromScore(score) {
  if (score >= 7) return "critical";
  if (score >= 4) return "high";
  if (score >= 2) return "watch";
  return "normal";
}

function forecastRainPoints(day) {
  if (!day || !day.members) return 0;
  if (day.prob_very_heavy >= 30) return 3;
  if (day.prob_heavy_upper >= 50) return 2;
  if (day.prob_heavy >= 50 || day.prob_heavy_upper >= 20) return 1;
  return 0;
}

function windPoints(kmh) {
  if (kmh >= 40) return 2;
  if (kmh >= 30) return 1;
  return 0;
}

const pct = (value) => `${value}%`;

/**
 * ความเสี่ยงวันนี้ของอำเภอ: ให้น้ำหนักสิ่งที่วัดได้จริงก่อน แล้วค่อยเพิ่มด้วยพยากรณ์ที่มีความน่าจะเป็นสูง
 * - ไม่ใช้ "โอกาสฝน %" ของแบบจำลองชุดเดียว (ขึ้น 90–100% เกือบทุกวันในฤดูฝนแม้ฝนเล็กน้อย)
 * - ความเปราะบางของพื้นที่จะนับเมื่อมีสัญญาณอื่นแล้วเท่านั้น
 */
export function assessDistrictRisk({
  observedRain24h = 0,
  observedSource = "gauge",
  maxStation = null,
  ensembleToday = null,
  ensembleTomorrow = null,
  water = null,
  discharge = null,
  windSpeed = 0,
  susceptibility = 0,
  sea = null
}) {
  const reasons = [];
  let score = 0;

  const rain = Number(observedRain24h) || 0;
  const rainPoints = rain >= VERY_HEAVY_RAIN_MM ? 3 : rain >= HEAVY_RAIN_UPPER_MM ? 2 : rain >= HEAVY_RAIN_MM ? 1 : 0;
  if (rainPoints) {
    score += rainPoints;
    reasons.push(observedSource === "gauge"
      ? `ฝนวัดได้ ${rain} มม. ใน 24 ชม.${maxStation ? ` ที่${maxStation}` : ""}`
      : `ฝน 24 ชม. ประมาณ ${rain} มม. (ไม่มีสถานีวัด ใช้ค่าจากแบบจำลอง)`);
  }

  const forecastDay = [ensembleToday, ensembleTomorrow]
    .filter(Boolean)
    .sort((a, b) => forecastRainPoints(b) - forecastRainPoints(a))[0];
  const forecastPoints = forecastRainPoints(forecastDay);
  if (forecastPoints) {
    score += forecastPoints;
    const when = forecastDay === ensembleToday ? "วันนี้" : "พรุ่งนี้";
    reasons.push(forecastDay.prob_very_heavy >= 20
      ? `โอกาสฝนหนักมาก (${VERY_HEAVY_RAIN_MM} มม. ขึ้นไป) ${when} ${pct(forecastDay.prob_very_heavy)}`
      : forecastDay.prob_heavy_upper >= 20
        ? `โอกาสฝนหนัก ${HEAVY_RAIN_UPPER_MM} มม. ขึ้นไป ${when} ${pct(forecastDay.prob_heavy_upper)}`
        : `โอกาสฝนหนัก (${HEAVY_RAIN_MM} มม. ขึ้นไป) ${when} ${pct(forecastDay.prob_heavy)}`);
  }

  if (water?.state === "overflow") {
    score += 3;
    reasons.push(water.source === "ddpm" ? `ระดับน้ำตามเกณฑ์ ปภ. ${water.status_label || "อันตราย"} ที่สถานี${water.station}` : `น้ำล้นตลิ่งที่สถานี${water.station} (+${water.bank_diff} ม.)`);
  } else if (water?.state === "near") {
    score += 2;
    reasons.push(water.source === "ddpm" ? `ระดับน้ำตามเกณฑ์ ปภ. ${water.status_label || "เฝ้าระวัง"} ที่สถานี${water.station}` : `น้ำใกล้ตลิ่งที่สถานี${water.station} (ต่ำกว่าตลิ่ง ${Math.abs(water.bank_diff)} ม.)`);
  }

  const dischargePoints = DISCHARGE_LEVELS[discharge?.level]?.score || 0;
  if (dischargePoints) {
    score += dischargePoints;
    reasons.push(`คาดน้ำในคลอง${discharge.level_label}ช่วง 7 วันข้างหน้า`);
  }

  // น้ำทะเลหนุน (เฉพาะอำเภอติดทะเล — ผู้เรียกส่ง sea มาเฉพาะอำเภอเหล่านั้น)
  if (sea && sea.key !== "normal") {
    const wetSignal = rainPoints > 0 || forecastPoints > 0 || water?.state === "overflow" || water?.state === "near" || dischargePoints > 0;
    const seaPoints = (SEA_POINTS[sea.key] || 0) + (wetSignal ? 1 : 0);
    if (seaPoints) {
      score += seaPoints;
      const levelText = Number.isFinite(sea.level) ? ` (${sea.level > 0 ? "+" : ""}${sea.level} ม. จากระดับเฉลี่ย)` : "";
      reasons.push(`น้ำทะเล${sea.label}${sea.forecast ? "ในรอบน้ำขึ้นถัดไป" : ""}${levelText}${wetSignal ? " ซ้ำกับฝน/น้ำในคลองสูง น้ำระบายลงทะเลช้า" : ""}`);
    }
  }

  const wind = windPoints(Number(windSpeed) || 0);
  if (wind) {
    score += wind;
    reasons.push(`ลมแรง ${Math.round(windSpeed)} กม./ชม.`);
  }

  if (score > 0 && Number(susceptibility) > 0) {
    score += Number(susceptibility);
    if (Number(susceptibility) >= 2) reasons.push("เป็นพื้นที่เสี่ยงน้ำท่วม/ดินถล่มตามข้อมูลพื้นที่");
  }

  if (reasons.length === 0) reasons.push("ฝนที่วัดได้ ระดับน้ำในคลอง และพยากรณ์อยู่ในเกณฑ์ปกติ");
  return { score, risk_level: levelFromScore(score), reasons };
}

/** ความเสี่ยงของวันในอนาคต: พยากรณ์ฝน (ensemble) + น้ำในคลองวันนั้น + ลม */
export function assessForecastDay({ ensembleDay = null, dischargeLevelOfDay = "normal", windSpeed = 0, susceptibility = 0 }) {
  let score = forecastRainPoints(ensembleDay) + (DISCHARGE_LEVELS[dischargeLevelOfDay]?.score || 0) + windPoints(Number(windSpeed) || 0);
  if (score > 0) score += Number(susceptibility) || 0;
  return { score, risk_level: levelFromScore(score) };
}

// ---------- ประกาศเตือนของ สสน. ----------

/** แยกข้อความเตือนจาก ThaiWater (หลายรายการต่อหนึ่งข้อความ คั่นด้วยบรรทัดว่าง) เหลือเฉพาะ จ.สตูล */
export function satunWarnings(json, province = "สตูล") {
  const rows = Array.isArray(json?.data) ? json.data : [];
  const result = [];
  for (const row of rows) {
    const parts = String(row?.message || "").split(/\n\s*\n/).map((part) => part.trim()).filter(Boolean);
    for (const message of parts) {
      if (!message.includes(`จ.${province}`) && !message.includes(`จังหวัด${province}`)) continue;
      const severe = /หนักมาก|น้ำท่วมฉับพลัน|ล้นตลิ่ง|วิกฤต/.test(message);
      result.push({ issued_at: row.datetime || null, message, level: severe ? "high" : "watch", source: "ThaiWater (สสน.)" });
    }
  }
  return result;
}

// ---------- ภาพผลิตภัณฑ์ของ สสน. ----------

export const HII_IMAGE_BASE = "https://api-v3.thaiwater.net/api/v1/thaiwater30/shared/image?image=";

function listOf(section) {
  const data = section?.data?.data ?? section?.data ?? section;
  return Array.isArray(data) ? data : [];
}

function mediaItem(item) {
  if (!item?.media_path) return null;
  return {
    url: `${HII_IMAGE_BASE}${item.media_path}`,
    thumb: item.media_path_thumb ? `${HII_IMAGE_BASE}${item.media_path_thumb}` : `${HII_IMAGE_BASE}${item.media_path}`,
    datetime: item.media_datetime || null,
    filename: item.filename || ""
  };
}

/** เลือกภาพจาก thailand_main: พยากรณ์ฝน 3 วัน (WRF-ROMS 3 กม.), พยากรณ์คลื่น 7 วัน, เรดาร์ภาคใต้ */
export function pickHiiMedia(json, radarTypes = ["stp240", "pkt240"]) {
  const rain = listOf(json?.pre_rain).map(mediaItem).filter(Boolean).slice(0, 3);
  const wave = listOf(json?.wave).map(mediaItem).filter(Boolean).slice(0, 7);
  const radars = listOf(json?.radar)
    .filter((item) => radarTypes.includes(item.radar_type) && item.media_datetime)
    .map((item) => ({ ...mediaItem(item), name: item.radar_name, timezone: item.timezone || "UTC" }))
    .filter((item) => item.url);
  return { rain_forecast: rain, wave_forecast: wave, radar: radars };
}
