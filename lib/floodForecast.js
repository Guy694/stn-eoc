// พยากรณ์ "จุดเสี่ยงน้ำท่วม" รายตำบล + จำลองสถานการณ์ (ไม่มีการเรียกเครือข่ายในไฟล์นี้ ใช้ได้ทั้งเซิร์ฟเวอร์และหน้าเว็บ)
//
// แนวคิด: น้ำท่วมเกิดเมื่อ "น้ำเข้า" มากกว่า "น้ำออก" ในพื้นที่ที่รับน้ำได้น้อย
//   น้ำเข้า  = ฝน 24 ชม. + ฝนสะสม 3 วัน (ดินอิ่มน้ำ) + น้ำในคลองสูง/ล้นตลิ่ง (ตำบลริมคลอง/ที่ราบน้ำท่วมถึง)
//   น้ำออกไม่ได้ = น้ำทะเลหนุน (ตำบลติดทะเล) — ถ้าหนุนพร้อมฝนหนัก/คลองสูง เพิ่ม "ซ้ำซ้อน"
//   ความเปราะบาง = ประวัติน้ำท่วม + ที่ลุ่มต่ำ (จากการวิเคราะห์พื้นที่เสี่ยง) → ตัวคูณ 0.5–1.5
// จุดที่คาดว่าท่วม: แปลงที่ดาวเทียม GISTDA เคยพบน้ำท่วม — ยิ่งรุนแรง ยิ่งรวมแปลงที่ท่วมไม่บ่อย
//   วิกฤต → ทุกแปลงที่เคยท่วม, เสี่ยงสูง → ท่วม ≥ 2 ปี, เฝ้าระวัง → ท่วม ≥ 3 ปี (จุดท่วมประจำ)

export const CANAL_STATES = [
  { key: "normal", label: "ปกติ", points: 0 },
  { key: "high", label: "สูงกว่าปกติ (คาดการณ์)", points: 5 },
  { key: "near", label: "ใกล้ตลิ่ง", points: 8 },
  { key: "very_high", label: "สูงมาก (คาดการณ์)", points: 10 },
  { key: "overflow", label: "ล้นตลิ่ง", points: 14 }
];
export const SEA_STATES = [
  { key: "normal", label: "ปกติ", points: 0 },
  { key: "elevated", label: "หนุนสูงกว่าปกติ", points: 3 },
  { key: "high", label: "หนุนสูง", points: 7 },
  { key: "record", label: "หนุนสูงสุดในรอบ 30–90 วัน", points: 10 }
];
const CANAL = Object.fromEntries(CANAL_STATES.map((s) => [s.key, s]));
const SEA = Object.fromEntries(SEA_STATES.map((s) => [s.key, s]));
const CANAL_RANK = Object.fromEntries(CANAL_STATES.map((s, i) => [s.key, i]));
const SEA_RANK = Object.fromEntries(SEA_STATES.map((s, i) => [s.key, i]));
export const worseCanal = (a, b) => ((CANAL_RANK[b] ?? 0) > (CANAL_RANK[a] ?? 0) ? b : a);
export const worseSea = (a, b) => ((SEA_RANK[b] ?? 0) > (SEA_RANK[a] ?? 0) ? b : a);

export const FORECAST_LEVELS = ["normal", "watch", "high", "critical"];
export const EXTENT_MIN_FREQ = { critical: 1, high: 2, watch: 3, normal: null };

export function rainPoints(mm) {
  const r = Number(mm) || 0;
  return r >= 150 ? 16 : r >= 100 ? 12 : r >= 60 ? 8 : r >= 35 ? 4 : r >= 20 ? 1 : 0;
}
export function antecedentPoints(mm72) {
  const r = Number(mm72) || 0;
  return r >= 200 ? 6 : r >= 120 ? 3 : 0;
}

/** ตัวคูณความเปราะบางจากคะแนนพื้นที่ (0–40) */
export const DEFAULT_FACTOR_FLOOR = 0.5;
export const susceptibilityFactor = (score, floor = DEFAULT_FACTOR_FLOOR) => floor + (Math.max(0, Math.min(40, Number(score) || 0)) / 40) * (1.5 - floor);

/** ตัวคูณขั้นต่ำ (ตำบลที่ไม่มีประวัติ/ไม่ลุ่ม) — ปรับเทียบได้ 0.3–1.2 */
export function factorFloorOf(calibration) {
  const value = Number(calibration?.factor_floor);
  return value >= 0.3 && value <= 1.2 ? value : DEFAULT_FACTOR_FLOOR;
}

export const DEFAULT_THRESHOLDS = Object.freeze({ watch: 12, high: 20, critical: 30 });

/** เกณฑ์ที่ใช้จริง: ค่าเริ่มต้น หรือค่าที่ปรับเทียบจากการทดสอบย้อนหลัง (calibration.thresholds) */
export function thresholdsOf(calibration) {
  const t = calibration?.thresholds;
  if (!t) return DEFAULT_THRESHOLDS;
  const watch = Number(t.watch);
  const high = Number(t.high);
  const critical = Number(t.critical);
  if (!(watch > 0 && high > watch && critical > high)) return DEFAULT_THRESHOLDS;
  return { watch, high, critical };
}

export function levelFromForecastScore(score, thresholds = DEFAULT_THRESHOLDS) {
  if (score >= thresholds.critical) return "critical";
  if (score >= thresholds.high) return "high";
  if (score >= thresholds.watch) return "watch";
  return "normal";
}

/**
 * ประเมินหนึ่งตำบลภายใต้เงื่อนไขหนึ่ง (วันพยากรณ์ หรือสถานการณ์จำลอง)
 * area: { coastal, riverine, susceptibility } — conditions: { rain24, rain72, canal, sea, compoundTiming }
 */
export function assessConditions(area, conditions, calibration = null) {
  const factors = [];
  const rain24 = Math.round(Number(conditions.rain24) || 0);
  const rain72 = Math.round(Number(conditions.rain72) || 0);
  const rp = rainPoints(rain24);
  if (rp) factors.push({ points: rp, label: `ฝน 24 ชม. ${rain24} มม.` });
  const ap = antecedentPoints(rain72);
  if (ap) factors.push({ points: ap, label: `ฝนสะสม 3 วัน ${rain72} มม. ดินอิ่มน้ำ` });
  const canal = area.riverine ? CANAL[conditions.canal] || CANAL.normal : CANAL.normal;
  if (canal.points) factors.push({ points: canal.points, label: `น้ำในคลอง${canal.label}` });
  const sea = area.coastal ? SEA[conditions.sea] || SEA.normal : SEA.normal;
  if (sea.points) factors.push({ points: sea.points, label: `น้ำทะเล${sea.label}` });
  // ซ้ำซ้อน: น้ำทะเลหนุนขณะที่มีน้ำจากฝน/คลองต้องระบายออก
  if (sea.points && (rp >= 4 || canal.points >= 8)) {
    factors.push({ points: conditions.compoundTiming ? 7 : 5, label: conditions.compoundTiming ? "ฝนหนักตรงกับช่วงน้ำขึ้นสูงสุด น้ำระบายลงทะเลไม่ได้" : "น้ำทะเลหนุนขณะมีน้ำจากฝน/คลองต้องระบาย" });
  }
  const hazard = factors.reduce((sum, item) => sum + item.points, 0);
  const factor = susceptibilityFactor(area.susceptibility, factorFloorOf(calibration));
  const score = Math.round(hazard * factor);
  const level = levelFromForecastScore(score, thresholdsOf(calibration));
  return { hazard, factor: Math.round(factor * 100) / 100, score, level, factors };
}

/** พื้นที่ที่คาดว่าท่วม (ไร่) และหมู่บ้าน ตามระดับความเสี่ยง — area.extent: { [minFreq]: { rai, villages:[{name, households}] } } */
export function expectedExtent(area, level) {
  const minFreq = EXTENT_MIN_FREQ[level];
  if (!minFreq || !area.extent) return null;
  const bucket = area.extent[minFreq] || null;
  if (!bucket || (!bucket.rai && !bucket.villages?.length)) return null;
  return { min_freq: minFreq, rai: bucket.rai, villages: bucket.villages || [], households: (bucket.villages || []).reduce((s, v) => s + (v.households || 0), 0) };
}

/** สถานการณ์จำลองกับทุกตำบล → เรียงตำบลเสี่ยงสุดก่อน */
export function runScenario(areas = [], conditions = {}, calibration = null) {
  const results = areas.map((area) => {
    const result = assessConditions(area, conditions, calibration);
    return { key: area.key, district: area.district, tambon: area.tambon, ...result, extent: expectedExtent(area, result.level) };
  });
  results.sort((a, b) => FORECAST_LEVELS.indexOf(b.level) - FORECAST_LEVELS.indexOf(a.level) || b.score - a.score);
  const counts = Object.fromEntries(FORECAST_LEVELS.map((level) => [level, results.filter((r) => r.level === level).length]));
  return { results, counts };
}

/**
 * พยากรณ์รายวันของตำบลหนึ่ง
 * days: [{ date, rain24, rain72, canal, sea, compoundTiming }] (เตรียมจากข้อมูลจริงฝั่งเซิร์ฟเวอร์)
 */
export function forecastArea(area, days = [], calibration = null) {
  const out = days.map((day) => {
    const result = assessConditions(area, day, calibration);
    return { date: day.date, rain24: Math.round(day.rain24 || 0), rain72: Math.round(day.rain72 || 0), canal: day.canal, sea: day.sea, compound: Boolean(day.compoundTiming), ...result, extent: expectedExtent(area, result.level) };
  });
  const peak = out.reduce((best, day) => (!best || day.score > best.score ? day : best), null);
  return { days: out, peak };
}

/** ช่วงเวลาที่ฝนหนัก (≥ 10 มม./ชม.) ตรงกับน้ำขึ้นสูงสุดที่หนุน (±3 ชม.) ในวันนั้น */
export function rainAtHighTide(hourlyRain = [], highs = [], { minRain = 10, windowMs = 3 * 3600e3 } = {}) {
  const heavy = hourlyRain.filter((h) => h.mm >= minRain);
  return highs.some((high) => high.status && high.status !== "normal" && heavy.some((h) => Math.abs(h.t - Date.parse(high.at)) <= windowMs));
}
