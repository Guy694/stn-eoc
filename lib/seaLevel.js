// ระดับน้ำทะเลและ "น้ำทะเลหนุน" จากสถานีวัดระดับน้ำ IOC (ไม่มีการเรียกเครือข่ายในไฟล์นี้ ทดสอบได้)
//
// สตูลไม่มีสถานีของ IOC — ใช้สถานีลังกาวี (lank, UHSLC) ห่างจากเมืองสตูลราว 35 กม. ทะเลฝั่งเดียวกัน
// ค่าที่วัดได้อ้างอิงศูนย์ของเครื่องวัด (ไม่ใช่ รทก.) จึงแสดงเป็น "สูงกว่า/ต่ำกว่าระดับเฉลี่ย 30 วัน"
// และตัดสินว่า "หนุน" จากการเทียบกับน้ำขึ้นสูงสุดแต่ละรอบใน 30 วันที่ผ่านมาของสถานีเดียวกัน
// ไม่มีค่าพยากรณ์น้ำขึ้นน้ำลงจากแหล่งข้อมูล: เวลาน้ำขึ้นครั้งถัดไปเป็นค่าประมาณจากรอบน้ำ (~12 ชม. 25 นาที)

export const SEA_STATIONS = [
  { code: "lank", name: "ลังกาวี (มาเลเซีย)", operator: "UHSLC / IOC", lat: 6.416, lon: 99.7667, sensor: "rad" },
  { code: "ms001", name: "ปอร์โตมาไล ลังกาวี (มาเลเซีย)", operator: "JUPEM / IOC", lat: 6.257092, lon: 99.734422, sensor: "prs" }
];

export const SATUN_TOWN = { lat: 6.6238, lon: 100.0674 };
export const TIDE_PERIOD_MS = 12.42 * 60 * 60 * 1000; // รอบน้ำขึ้น-ลงครึ่งวัน (M2)
export const LUNAR_DAY_MS = 24.84 * 60 * 60 * 1000;
const BUCKET_MS = 10 * 60 * 1000;
const STALE_AFTER_MS = 3 * 60 * 60 * 1000;

export const SEA_STATUS = {
  normal: { key: "normal", label: "ปกติ", color: "#2a9db0", text: "#ffffff", rank: 0, advice: "ระดับน้ำทะเลอยู่ในช่วงปกติของสถานี น้ำในคลองระบายลงทะเลได้ตามปกติ" },
  elevated: { key: "elevated", label: "หนุนสูงกว่าปกติ", color: "#f59e0b", text: "#1f2937", rank: 1, advice: "ช่วงน้ำขึ้น น้ำในคลองและปากแม่น้ำระบายลงทะเลช้าลง ถ้าฝนตกหนักพร้อมกัน ที่ลุ่มริมคลองใกล้ทะเลอาจมีน้ำท่วมขัง" },
  high: { key: "high", label: "หนุนสูง", color: "#ea580c", text: "#ffffff", rank: 2, advice: "น้ำทะเลหนุนสูง ช่วงน้ำขึ้นสูงสุดน้ำจากบกระบายได้น้อย ชุมชนริมคลอง ปากน้ำ และชายฝั่งที่ต่ำควรเฝ้าระวัง โดยเฉพาะถ้ามีฝนหนัก" },
  record: { key: "record", label: "หนุนสูงสุดในรอบ 30 วัน", color: "#dc2626", text: "#ffffff", rank: 3, advice: "ระดับน้ำทะเลสูงที่สุดในรอบ 30 วัน เสี่ยงน้ำท่วมจากน้ำทะเลหนุนในพื้นที่ชายฝั่งและริมคลองที่ต่ำ งดจอดเรือ/ตั้งของริมตลิ่งช่วงน้ำขึ้นสูงสุด" }
};

export const TIDE_PHASES = {
  spring: { key: "spring", label: "ช่วงน้ำเกิด (น้ำขึ้นสูง-ลงต่ำมาก)" },
  neap: { key: "neap", label: "ช่วงน้ำตาย (น้ำขึ้น-ลงน้อย)" },
  mid: { key: "mid", label: "ช่วงระหว่างน้ำเกิด-น้ำตาย" }
};

/** "2026-10-09 04:45:00" (UTC) → ms */
export function parseIocTime(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/.exec(String(value || ""));
  if (!match) return null;
  const [, y, mo, d, h, mi, s] = match.map(Number);
  return Date.UTC(y, mo - 1, d, h, mi, s || 0);
}

/** แถวดิบจาก IOC → [{ t, v }] เรียงเวลา เฉพาะเซนเซอร์ที่เลือก (ตัดค่า missing -999) */
export function parseIocRows(rows = [], sensor = "rad") {
  const points = [];
  for (const row of rows) {
    if (sensor && row?.sensor !== sensor) continue;
    const v = Number(row?.slevel);
    const t = parseIocTime(row?.stime);
    if (t === null || !Number.isFinite(v) || v <= -900) continue;
    points.push({ t, v });
  }
  points.sort((a, b) => a.t - b.t);
  return points.filter((point, index) => index === 0 || point.t !== points[index - 1].t);
}

/** เฉลี่ยเป็นช่วงละ 10 นาที (ลดสัญญาณรบกวน/คลื่น และขนาดข้อมูลที่ส่งไปหน้าเว็บ) */
export function bucketize(points = [], bucketMs = BUCKET_MS) {
  const buckets = new Map();
  for (const { t, v } of points) {
    const key = Math.floor(t / bucketMs) * bucketMs;
    const bucket = buckets.get(key) || { sum: 0, n: 0 };
    bucket.sum += v;
    bucket.n += 1;
    buckets.set(key, bucket);
  }
  return [...buckets.entries()].sort((a, b) => a[0] - b[0]).map(([t, { sum, n }]) => ({ t: t + bucketMs / 2, v: sum / n }));
}

/** หาน้ำขึ้นสูงสุด/ลงต่ำสุดแต่ละรอบ: จุดสูง/ต่ำที่สุดในช่วง ±2 ชม. และห่างกันอย่างน้อย 4 ชม. */
export function findExtrema(series = [], { windowMs = 2 * 60 * 60 * 1000, minGapMs = 4 * 60 * 60 * 1000 } = {}) {
  const highs = [];
  const lows = [];
  let start = 0;
  let end = 0;
  for (let i = 0; i < series.length; i += 1) {
    const { t, v } = series[i];
    while (series[start].t < t - windowMs) start += 1;
    while (end + 1 < series.length && series[end + 1].t <= t + windowMs) end += 1;
    // ต้องมีข้อมูลครบทั้งสองฝั่ง ไม่งั้นจุดที่ขอบข้อมูล/ช่วงข้อมูลขาดจะถูกนับเป็นยอดผิด ๆ
    if (series[start].t > t - windowMs * 0.75 || series[end].t < t + windowMs * 0.75) continue;
    let isMax = true;
    let isMin = true;
    for (let j = start; j <= end; j += 1) {
      if (series[j].v > v) isMax = false;
      if (series[j].v < v) isMin = false;
      if (!isMax && !isMin) break;
    }
    if (isMax) pushExtreme(highs, { t, v }, minGapMs, (a, b) => a.v >= b.v);
    if (isMin) pushExtreme(lows, { t, v }, minGapMs, (a, b) => a.v <= b.v);
  }
  return { highs, lows };
}

function pushExtreme(list, point, minGapMs, better) {
  const last = list[list.length - 1];
  if (last && point.t - last.t < minGapMs) {
    if (better(point, last)) list[list.length - 1] = point;
    return;
  }
  list.push(point);
}

export function percentile(values = [], p) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const index = (sorted.length - 1) * p;
  const low = Math.floor(index);
  const high = Math.ceil(index);
  return sorted[low] + (sorted[high] - sorted[low]) * (index - low);
}

/** ตัดสินระดับการหนุนของน้ำขึ้นรอบหนึ่ง เทียบกับน้ำขึ้นสูงสุดแต่ละรอบในอดีต */
export function classifyHigh(value, thresholds) {
  if (!Number.isFinite(value) || !thresholds) return SEA_STATUS.normal;
  if (Number.isFinite(thresholds.max) && value >= thresholds.max) return SEA_STATUS.record;
  if (Number.isFinite(thresholds.p90) && value >= thresholds.p90) return SEA_STATUS.high;
  if (Number.isFinite(thresholds.p75) && value >= thresholds.p75) return SEA_STATUS.elevated;
  return SEA_STATUS.normal;
}

function distanceKm(a, b) {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLon = (b.lon - a.lon) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(h));
}

const round = (value, digits = 2) => (Number.isFinite(value) ? Math.round(value * 10 ** digits) / 10 ** digits : null);
const iso = (ms) => (Number.isFinite(ms) ? new Date(ms).toISOString() : null);

/**
 * วิเคราะห์ข้อมูล 30 วันของสถานีหนึ่ง
 * points: [{ t, v }] รายนาที (จาก parseIocRows) — now: เวลาปัจจุบัน (ms)
 */
export function analyzeSeaLevel(points = [], { station = SEA_STATIONS[0], now = Date.now(), chartHours = 48 } = {}) {
  if (points.length < 10) return null;
  const series = bucketize(points);
  const mean = series.reduce((sum, point) => sum + point.v, 0) / series.length;
  const { highs, lows } = findExtrema(series);

  // ฐานเปรียบเทียบ: น้ำขึ้นแต่ละรอบ ไม่นับ 36 ชม. ล่าสุด (เพื่อให้รอบปัจจุบันเทียบกับอดีตจริง ๆ)
  const baselineHighs = highs.filter((high) => high.t < now - 36 * 60 * 60 * 1000).map((high) => high.v);
  const thresholds = baselineHighs.length >= 6
    ? { p75: percentile(baselineHighs, 0.75), p90: percentile(baselineHighs, 0.9), max: Math.max(...baselineHighs), count: baselineHighs.length }
    : null;

  const latest = points[points.length - 1];
  // แนวโน้ม: เฉลี่ย 10 นาทีล่าสุด เทียบ 30–40 นาทีก่อน
  const avgBetween = (from, to) => {
    const values = points.filter((point) => point.t > latest.t - from && point.t <= latest.t - to).map((point) => point.v);
    return values.length ? values.reduce((sum, v) => sum + v, 0) / values.length : null;
  };
  const recentAvg = avgBetween(10 * 60 * 1000, 0);
  const earlierAvg = avgBetween(40 * 60 * 1000, 30 * 60 * 1000);
  const ratePerHour = recentAvg !== null && earlierAvg !== null ? (recentAvg - earlierAvg) * 2 : null; // ต่าง 30 นาที → ต่อชั่วโมง
  const trend = ratePerHour === null ? null
    : ratePerHour > 0.05 ? { key: "rising", label: "น้ำกำลังขึ้น", arrow: "↑" }
      : ratePerHour < -0.05 ? { key: "falling", label: "น้ำกำลังลง", arrow: "↓" }
        : { key: "slack", label: "น้ำนิ่ง (ใกล้จุดสูงสุด/ต่ำสุด)", arrow: "→" };

  // รอบน้ำขึ้นล่าสุด (ภายใน 13 ชม.) — ถ้าตอนนี้สูงกว่ายอดที่พบ ใช้ระดับตอนนี้
  const recentHigh = [...highs].reverse().find((high) => high.t >= latest.t - 13 * 60 * 60 * 1000) || null;
  const currentPeak = recentHigh && recentHigh.v >= latest.v ? recentHigh : { t: latest.t, v: latest.v };
  const status = classifyHigh(currentPeak.v, thresholds);

  // ช่วงน้ำเกิด/น้ำตาย: พิสัย 25 ชม. ล่าสุด เทียบพิสัยรายวันใน 30 วัน
  const rangeOf = (from, to) => {
    const values = series.filter((point) => point.t > from && point.t <= to).map((point) => point.v);
    return values.length > 50 ? Math.max(...values) - Math.min(...values) : null;
  };
  const dailyRanges = [];
  for (let end = latest.t; end - 25 * 60 * 60 * 1000 >= series[0].t; end -= 24 * 60 * 60 * 1000) {
    const range = rangeOf(end - 25 * 60 * 60 * 1000, end);
    if (range !== null) dailyRanges.push(range);
  }
  const currentRange = dailyRanges[0] ?? null;
  const phase = currentRange === null || dailyRanges.length < 10 ? null
    : currentRange >= percentile(dailyRanges, 0.7) ? TIDE_PHASES.spring
      : currentRange <= percentile(dailyRanges, 0.3) ? TIDE_PHASES.neap
        : TIDE_PHASES.mid;

  // น้ำขึ้นครั้งถัดไป (ประมาณ): ใช้ช่วงห่างเฉลี่ยของยอดล่าสุด ระดับคาดจากยอดของรอบเดียวกันเมื่อวาน (~24.84 ชม.)
  const lastHigh = highs[highs.length - 1] || null;
  const intervals = highs.slice(-5).map((high, index, list) => (index ? high.t - list[index - 1].t : null)).filter(Boolean);
  const interval = intervals.length
    ? Math.min(13.5 * 3600e3, Math.max(11.5 * 3600e3, intervals.reduce((sum, value) => sum + value, 0) / intervals.length))
    : TIDE_PERIOD_MS;
  const nextHighs = [];
  if (lastHigh) {
    for (let t = lastHigh.t + interval; nextHighs.length < 3 && t < now + 40 * 3600e3; t += interval) {
      if (t <= now) continue;
      const sameTideYesterday = highs.reduce((best, high) => (Math.abs(high.t - (t - LUNAR_DAY_MS)) < Math.abs((best?.t ?? Infinity) - (t - LUNAR_DAY_MS)) ? high : best), null);
      const estimate = sameTideYesterday && Math.abs(sameTideYesterday.t - (t - LUNAR_DAY_MS)) < 3 * 3600e3 ? sameTideYesterday.v : null;
      nextHighs.push({ at: iso(t), est_level: round(estimate !== null ? estimate - mean : null), status: estimate !== null ? classifyHigh(estimate, thresholds).key : null });
    }
  }

  const rel = (value) => round(value - mean);
  const chartFrom = latest.t - chartHours * 3600e3;
  return {
    station: { code: station.code, name: station.name, operator: station.operator, lat: station.lat, lon: station.lon, distance_km: Math.round(distanceKm(SATUN_TOWN, station)) },
    observed_at: iso(latest.t),
    stale: now - latest.t > STALE_AFTER_MS,
    level: rel(latest.v),
    trend: trend ? { ...trend, rate_cm_per_h: Math.round(ratePerHour * 100) } : null,
    status: { key: status.key, label: status.label, color: status.color, text: status.text, advice: status.advice },
    // ยอดน้ำขึ้นของรอบนี้ (ถ้ายังขึ้นไม่สุด = ระดับตอนนี้ และ is_current = true)
    peak: { at: iso(currentPeak.t), level: rel(currentPeak.v), is_current: currentPeak !== recentHigh },
    phase,
    range_24h: round(currentRange),
    thresholds: thresholds ? { elevated: rel(thresholds.p75), high: rel(thresholds.p90), max: rel(thresholds.max), cycles: thresholds.count } : null,
    last_high: lastHigh ? { at: iso(lastHigh.t), level: rel(lastHigh.v) } : null,
    next_highs: nextHighs,
    series: series.filter((point) => point.t >= chartFrom).map((point) => [Math.round(point.t / 60000), rel(point.v)]),
    highs: highs.filter((high) => high.t >= chartFrom).map((high) => ({ at: iso(high.t), level: rel(high.v), status: classifyHigh(high.v, thresholds).key })),
    lows: lows.filter((low) => low.t >= chartFrom).map((low) => ({ at: iso(low.t), level: rel(low.v) })),
    reference: "เทียบกับระดับเฉลี่ย 30 วันของสถานี"
  };
}
