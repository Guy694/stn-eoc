// พยากรณ์น้ำขึ้นน้ำลงหน้าชายฝั่งสตูล + ตรวจกับค่าวัดจริง (ไม่มีการเรียกเครือข่ายในไฟล์นี้ ทดสอบได้)
//
// แหล่ง: Open-Meteo Marine "sea_level_height_msl" (แบบจำลองมหาสมุทร Météo-France SMOC: น้ำขึ้นน้ำลง + ผลความกดอากาศ)
//        เทียบระดับทะเลปานกลาง (ม.) รายชั่วโมง ย้อนหลัง 92 วัน + ล่วงหน้า 7 วัน ที่จุดหน้าเมืองสตูล
// "หนุน" = น้ำขึ้นสูงสุดแต่ละรอบ เทียบกับรอบน้ำขึ้นทั้งหมดใน 92 วันที่ผ่านมา (จุดเดียวกัน แหล่งเดียวกัน)
// ค่าวัดจริง (IOC ลังกาวี) ใช้ตรวจว่าระดับจริง "สูงกว่าที่คาด" หรือไม่ — ถ้าสูงกว่ามาก = มีคลื่นพายุซัดฝั่ง/ลมมรสุมดันน้ำ
import { SEA_STATUS, classifyHigh, findExtrema, percentile } from "@/lib/seaLevel";

export const MODEL_POINTS = {
  satun: { key: "satun", name: "หน้าเมืองสตูล (ปากคลองมำบัง–ตำมะลัง)", lat: 6.58, lon: 100.02 },
  langkawi: { key: "langkawi", name: "ลังกาวี (จุดเดียวกับสถานีวัด IOC)", lat: 6.416, lon: 99.767 }
};

const HOUR = 3600e3;
const round = (value, digits = 2) => (Number.isFinite(value) ? Math.round(value * 10 ** digits) / 10 ** digits : null);
const iso = (ms) => new Date(ms).toISOString();
const RANK = { normal: 0, elevated: 1, high: 2, record: 3 };
export const higherStatus = (a, b) => ((RANK[b] ?? 0) > (RANK[a] ?? 0) ? b : a);

/** hourly ของ Open-Meteo (timezone=GMT) → [{ t, v }] */
export function parseModelHourly(hourly) {
  const times = hourly?.time || [];
  const values = hourly?.sea_level_height_msl || [];
  const points = [];
  for (let i = 0; i < times.length; i += 1) {
    const v = Number(values[i]);
    const t = Date.parse(`${times[i]}Z`);
    if (Number.isFinite(v) && Number.isFinite(t) && values[i] !== null) points.push({ t, v });
  }
  return points;
}

/** เติมจุดระหว่างชั่วโมงแบบเส้นตรงทุก 10 นาที (ให้หายอดน้ำได้ละเอียดกว่าชั่วโมง) */
export function densify(points, stepMs = 10 * 60e3) {
  const out = [];
  for (let i = 0; i < points.length - 1; i += 1) {
    const a = points[i];
    const b = points[i + 1];
    if (b.t - a.t > 3 * HOUR) {
      out.push(a);
      continue;
    }
    for (let t = a.t; t < b.t; t += stepMs) out.push({ t, v: a.v + ((b.v - a.v) * (t - a.t)) / (b.t - a.t) });
  }
  if (points.length) out.push(points[points.length - 1]);
  return out;
}

/**
 * วิเคราะห์พยากรณ์ที่จุดหน้าสตูล
 * - เกณฑ์หนุน: P75 / P90 / สูงสุด ของยอดน้ำขึ้นในอดีต (ก่อนตอนนี้)
 * - น้ำขึ้นรอบถัดไป 3 วัน พร้อมระดับและสถานะ
 */
export function analyzeTideModel(points, { now = Date.now(), pastHours = 24, futureHours = 72 } = {}) {
  if (!points || points.length < 48) return null;
  const dense = densify(points);
  const { highs, lows } = findExtrema(dense, { windowMs: 3 * HOUR, minGapMs: 5 * HOUR });
  const pastHighs = highs.filter((h) => h.t < now - 2 * HOUR).map((h) => h.v);
  const thresholds = pastHighs.length >= 20
    ? { p75: percentile(pastHighs, 0.75), p90: percentile(pastHighs, 0.9), max: Math.max(...pastHighs), cycles: pastHighs.length }
    : null;
  const at = (t) => {
    const i = points.findIndex((p) => p.t >= t);
    if (i <= 0) return points[0]?.v ?? null;
    const a = points[i - 1];
    const b = points[i];
    return a.v + ((b.v - a.v) * (t - a.t)) / (b.t - a.t);
  };
  const levelNow = at(now);
  const slope = at(now + 30 * 60e3) - at(now - 30 * 60e3);
  const trend = slope > 0.05 ? { key: "rising", label: "น้ำกำลังขึ้น", arrow: "↑" } : slope < -0.05 ? { key: "falling", label: "น้ำกำลังลง", arrow: "↓" } : { key: "slack", label: "น้ำนิ่ง (ใกล้จุดสูงสุด/ต่ำสุด)", arrow: "→" };

  const classified = (h) => ({ at: iso(h.t), level: round(h.v), status: classifyHigh(h.v, thresholds).key });
  const upcoming = highs.filter((h) => h.t >= now - HOUR && h.t <= now + futureHours * HOUR).map(classified);
  const recent = highs.filter((h) => h.t >= now - pastHours * HOUR && h.t < now - HOUR).map(classified);

  // ช่วงน้ำเกิด/น้ำตาย: พิสัยน้ำ 25 ชม. รอบตอนนี้ เทียบพิสัยรายวันในอดีต
  const rangeAround = (center) => {
    const window = points.filter((p) => p.t >= center - 12.5 * HOUR && p.t <= center + 12.5 * HOUR).map((p) => p.v);
    return window.length > 12 ? Math.max(...window) - Math.min(...window) : null;
  };
  const ranges = [];
  for (let t = points[0].t + 13 * HOUR; t < now - 13 * HOUR; t += 24 * HOUR) {
    const r = rangeAround(t);
    if (r !== null) ranges.push(r);
  }
  const rangeNow = rangeAround(now);
  const phase = rangeNow === null || ranges.length < 20 ? null
    : rangeNow >= percentile(ranges, 0.7) ? { key: "spring", label: "ช่วงน้ำเกิด (น้ำขึ้นสูง-ลงต่ำมาก)" }
      : rangeNow <= percentile(ranges, 0.3) ? { key: "neap", label: "ช่วงน้ำตาย (น้ำขึ้น-ลงน้อย)" }
        : { key: "mid", label: "ช่วงระหว่างน้ำเกิด-น้ำตาย" };

  // วันที่หนุนสูงสุดใน 7 วันข้างหน้า (ช่วยวางแผน)
  const weekHighs = highs.filter((h) => h.t > now && h.t <= now + 7 * 24 * HOUR);
  const weekPeak = weekHighs.length ? weekHighs.reduce((best, h) => (h.v > best.v ? h : best)) : null;

  return {
    level_now: round(levelNow),
    trend,
    thresholds: thresholds ? { elevated: round(thresholds.p75), high: round(thresholds.p90), max: round(thresholds.max), cycles: thresholds.cycles } : null,
    upcoming_highs: upcoming,
    recent_highs: recent,
    lows: lows.filter((l) => l.t >= now - pastHours * HOUR && l.t <= now + futureHours * HOUR).map((l) => ({ at: iso(l.t), level: round(l.v) })),
    phase,
    range_24h: round(rangeNow),
    week_peak: weekPeak ? classified(weekPeak) : null,
    series: points.filter((p) => p.t >= now - pastHours * HOUR && p.t <= now + futureHours * HOUR).map((p) => [Math.round(p.t / 60000), round(p.v)])
  };
}

/**
 * ระดับจริงเทียบพยากรณ์ที่จุดเดียวกัน (ลังกาวี)
 * ค่าวัดกับแบบจำลองอ้างอิงศูนย์ต่างกัน และเวลา/ความสูงของน้ำขึ้นอาจเหลื่อมกันเล็กน้อย จึง
 *   1) หาการเลื่อนเวลา (−2 ถึง +2 ชม.) และสมการเส้นตรง obs ≈ a·model + b ที่เข้ากันดีที่สุดใน 48 ชม.
 *   2) ส่วนเหลือ (residual) 3 ชม. ล่าสุด = น้ำสูง/ต่ำกว่าที่คาด — บวกมาก = คลื่นพายุซัดฝั่ง/ลมดันน้ำ
 * fit_rmse_m = ความคลาดเคลื่อนหลังปรับ ถ้าเกิน 0.15 ม. ถือว่าเทียบกันไม่ได้ จะไม่ใช้ตัดสิน
 */
export function compareObserved(observed = [], model = [], { now = Date.now() } = {}) {
  if (observed.length < 60 || model.length < 24) return null;
  const from = now - 48 * HOUR;
  const STEP = 10 * 60e3;
  const buckets = new Map();
  for (const p of observed) {
    if (p.t < from) continue;
    const key = Math.floor(p.t / STEP) * STEP + STEP / 2;
    const bucket = buckets.get(key) || { sum: 0, n: 0 };
    bucket.sum += p.v;
    bucket.n += 1;
    buckets.set(key, bucket);
  }
  const obs = [...buckets.entries()].sort((a, b) => a[0] - b[0]).map(([t, b]) => ({ t, v: b.sum / b.n }));
  if (obs.length < 100) return null;
  const modelAt = (t) => {
    let lo = 0;
    let hi = model.length - 1;
    if (t < model[0].t || t > model[hi].t) return null;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (model[mid].t <= t) lo = mid;
      else hi = mid;
    }
    const a = model[lo];
    const b = model[hi];
    if (b.t - a.t > 3 * HOUR) return null;
    return b.t === a.t ? a.v : a.v + ((b.v - a.v) * (t - a.t)) / (b.t - a.t);
  };
  let best = null;
  for (let lag = -120; lag <= 120; lag += 10) {
    const pairs = obs.map((p) => ({ t: p.t, y: p.v, x: modelAt(p.t + lag * 60e3) })).filter((p) => p.x !== null);
    if (pairs.length < 100) continue;
    const n = pairs.length;
    const mx = pairs.reduce((s, p) => s + p.x, 0) / n;
    const my = pairs.reduce((s, p) => s + p.y, 0) / n;
    const sxx = pairs.reduce((s, p) => s + (p.x - mx) ** 2, 0);
    const sxy = pairs.reduce((s, p) => s + (p.x - mx) * (p.y - my), 0);
    const a = sxx ? sxy / sxx : 1;
    const b = my - a * mx;
    const residuals = pairs.map((p) => ({ t: p.t, r: p.y - (a * p.x + b) }));
    const rmse = Math.sqrt(residuals.reduce((s, p) => s + p.r ** 2, 0) / n);
    if (!best || rmse < best.rmse) best = { lag, a, rmse, residuals };
  }
  if (!best) return null;
  const lastT = best.residuals[best.residuals.length - 1].t;
  const recent = best.residuals.filter((p) => p.t >= lastT - 3 * HOUR);
  const anomaly = recent.reduce((s, p) => s + p.r, 0) / recent.length;
  return {
    anomaly_m: round(anomaly),
    fit_rmse_m: round(best.rmse),
    lag_minutes: best.lag,
    amplitude_ratio: round(best.a),
    usable: best.rmse <= 0.15 && best.a > 0.5 && best.a < 2,
    hours: Math.round((best.residuals.length * STEP) / HOUR)
  };
}

/** สถานะน้ำทะเลรวม: ยอดน้ำรอบนี้/รอบถัดไป 24 ชม. จากพยากรณ์ + ปรับขึ้นถ้าค่าจริงสูงกว่าที่คาดชัดเจน */
export function combinedStatus(model, comparison, now = Date.now()) {
  if (!model) return null;
  const window = [...model.recent_highs, ...model.upcoming_highs].filter((h) => {
    const t = Date.parse(h.at);
    return t >= now - 6 * HOUR && t <= now + 24 * HOUR;
  });
  let peak = window.reduce((best, h) => (!best || (RANK[h.status] ?? 0) > (RANK[best.status] ?? 0) || ((RANK[h.status] ?? 0) === (RANK[best.status] ?? 0) && h.level > best.level) ? h : best), null);
  let key = peak?.status || "normal";
  const reasons = [];
  if (comparison?.usable && Number.isFinite(comparison.anomaly_m)) {
    if (comparison.anomaly_m >= 0.35) {
      key = higherStatus(key, "high");
      reasons.push(`ระดับจริงสูงกว่าที่คาด ${Math.round(comparison.anomaly_m * 100)} ซม. (มีคลื่นพายุ/ลมดันน้ำ)`);
    } else if (comparison.anomaly_m >= 0.2) {
      key = higherStatus(key, "elevated");
      reasons.push(`ระดับจริงสูงกว่าที่คาด ${Math.round(comparison.anomaly_m * 100)} ซม.`);
    }
  }
  if (!peak && model.upcoming_highs[0]) peak = model.upcoming_highs[0];
  const meta = SEA_STATUS[key] || SEA_STATUS.normal;
  return { key, label: meta.label, color: meta.color, text: meta.text, advice: meta.advice, peak, reasons };
}
