// แนวโน้มน้ำและฝน: รวมค่ารายชั่วโมงที่เก็บไว้ (ฝน ระดับน้ำในคลอง น้ำทะเลหนุน) เป็นข้อมูลสำหรับกราฟ
// ไฟล์นี้ไม่แตะฐานข้อมูล/เครือข่าย — รับแถวจากฐานข้อมูล (ชั่วโมงเป็นเวลาไทยแบบ "YYYY-MM-DD HH:00:00")
import { DDPM_CCTV_STATIONS } from "./ddpmCctv.js";
export const RANGE_DAYS = [7, 30, 90];
export const HEAVY_RAIN_MM = 35.1; // ฝนหนัก (เกณฑ์กรมอุตุนิยมวิทยา 24 ชม.)
export const VERY_HEAVY_RAIN_MM = 90.1;
export const HEAVY_RAIN_1H_MM = 20; // ฝนหนักใน 1 ชม. (เกณฑ์เดียวกับ lib/thaiWaterRain.js)
export const RAIN_DAY_MM = 1; // นับเป็น "วันที่มีฝน"

const num = (value) => (value === null || value === undefined || value === "" || !Number.isFinite(Number(value)) ? null : Number(value));
const round = (value, digits = 1) => (value === null ? null : Math.round(value * 10 ** digits) / 10 ** digits);
const hourText = (value) => String(value instanceof Date ? value.toISOString().replace("T", " ") : value || "").slice(0, 19);

export function normalizeDays(value) {
  const days = Number.parseInt(value, 10);
  return RANGE_DAYS.includes(days) ? days : 7;
}

/** ช่วงเวลาที่จุดบนกราฟรวมกัน: 7 วัน = รายชั่วโมง, 30 วัน = ราย 3 ชม., 90 วัน = รายวัน */
export function bucketHours(days) {
  return days <= 7 ? 1 : days <= 30 ? 3 : 24;
}

function bucketKey(hour, size) {
  const text = hourText(hour);
  if (size >= 24) return `${text.slice(0, 10)} 00:00:00`;
  const h = Number(text.slice(11, 13));
  return `${text.slice(0, 11)}${String(h - (h % size)).padStart(2, "0")}:00:00`;
}

const hourMs = (hour) => Date.parse(`${String(hour).slice(0, 10)}T${String(hour).slice(11, 19)}Z`);

/** ผลรวมเคลื่อนที่ n ค่าที่มากที่สุด (null นับเป็น 0 · ไม่มีค่าเลย = null) */
export function maxRollingSum(values = [], n = 3) {
  if (!values.some((v) => v !== null && v !== undefined)) return null;
  let best = 0;
  for (let i = 0; i < values.length; i += 1) {
    let sum = 0;
    for (let j = Math.max(0, i - n + 1); j <= i; j += 1) sum += values[j] || 0;
    if (sum > best) best = sum;
  }
  return round(best);
}

const addDays = (date, n) => {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

/** รายการวันที่ (YYYY-MM-DD) ตั้งแต่ from ถึง to */
export function dateList(from, to) {
  const out = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}

/**
 * ฝนรายวันต่อสถานี (วันฝนแบบกรมอุตุฯ 07:00 ถึง 07:00 วันถัดไป)
 * 1) ค่า "ฝน 24 ชม." ที่วัดใกล้ 07:00 ของวันถัดไปที่สุด (06–09 น.)
 * 2) ถ้าไม่มี (เช่น วันนี้ยังไม่ครบ) รวมฝนรายชั่วโมงหลัง 07:00
 * 3) ถ้าไม่มีฝนรายชั่วโมง ใช้ค่า 24 ชม. สูงสุดหลัง 07:00 ของวันนั้น (ค่าประมาณ อาจรวมฝนเมื่อวาน) — ทำเครื่องหมาย approx
 */
export function dailyRainByStation(rows = [], dates = []) {
  const byStation = new Map();
  for (const row of rows) {
    const id = String(row.station_id);
    if (!byStation.has(id)) byStation.set(id, { id, name: row.station_name, amphoe: row.amphoe || null, tambon: row.tambon || null, lat: num(row.lat), lng: num(row.lng), readings: [] });
    byStation.get(id).readings.push({ hour: hourText(row.hour_at), rain24: num(row.rain_24h), rain1: num(row.rain_1h) });
  }
  const stations = [];
  for (const station of byStation.values()) {
    const daily = dates.map((date) => {
      const next = addDays(date, 1);
      const anchor = station.readings
        .filter((r) => r.rain24 !== null && r.hour.slice(0, 10) === next && Number(r.hour.slice(11, 13)) >= 6 && Number(r.hour.slice(11, 13)) <= 9)
        .sort((a, b) => Math.abs(Number(a.hour.slice(11, 13)) - 7) - Math.abs(Number(b.hour.slice(11, 13)) - 7))[0];
      if (anchor) return { date, mm: anchor.rain24 };
      const within = station.readings.filter((r) => `${date} 07:00:00` < r.hour && r.hour < `${next} 07:00:00`);
      const hourly = within.filter((r) => r.rain1 !== null);
      if (hourly.length) return { date, mm: round(hourly.reduce((sum, r) => sum + r.rain1, 0)), approx: true };
      const rolling = within.filter((r) => r.rain24 !== null);
      return { date, mm: rolling.length ? Math.max(...rolling.map((r) => r.rain24)) : null, approx: rolling.length > 0 };
    });
    const values = daily.map((d) => d.mm).filter((v) => v !== null);
    const top1h = station.readings.reduce((best, r) => (r.rain1 !== null && (!best || r.rain1 > best.rain1) ? r : best), null);
    stations.push({
      id: station.id,
      name: station.name,
      amphoe: station.amphoe,
      tambon: station.tambon,
      lat: station.lat,
      lng: station.lng,
      daily,
      total_mm: round(values.reduce((s, v) => s + v, 0)),
      max_day_mm: values.length ? round(Math.max(...values)) : null,
      heavy_days: values.filter((v) => v >= HEAVY_RAIN_MM).length,
      rain_days: values.filter((v) => v >= RAIN_DAY_MM).length,
      max_3d_mm: maxRollingSum(daily.map((d) => d.mm), 3),
      max_1h_mm: top1h && top1h.rain1 > 0 ? round(top1h.rain1) : top1h ? 0 : null,
      max_1h_at: top1h && top1h.rain1 > 0 ? top1h.hour : null
    });
  }
  return stations.sort((a, b) => (b.total_mm || 0) - (a.total_mm || 0));
}

/** ฝนรายวันระดับจังหวัด/อำเภอ: ค่าเฉลี่ยและค่าสูงสุดของสถานีที่มีข้อมูล */
export function dailyRainSummary(stations = [], dates = [], amphoe = null) {
  const list = amphoe ? stations.filter((s) => s.amphoe === amphoe) : stations;
  let cumulative = 0;
  return dates.map((date, index) => {
    const values = list.map((s) => ({ mm: s.daily[index]?.mm, s })).filter((v) => v.mm !== null && v.mm !== undefined);
    if (!values.length) return { date, avg_mm: null, max_mm: null, max_station: null, stations: 0, heavy_stations: 0, rain_stations: 0, cum_avg_mm: round(cumulative) };
    const top = values.reduce((best, v) => (v.mm > best.mm ? v : best));
    const avg = values.reduce((s, v) => s + v.mm, 0) / values.length;
    cumulative += avg;
    return {
      date, avg_mm: round(avg), max_mm: round(top.mm), max_station: top.s.name, stations: values.length,
      heavy_stations: values.filter((v) => v.mm >= HEAVY_RAIN_MM).length,
      rain_stations: values.filter((v) => v.mm >= RAIN_DAY_MM).length,
      cum_avg_mm: round(cumulative) // ฝนสะสมเฉลี่ยทั้งพื้นที่ตั้งแต่ต้นช่วง
    };
  });
}

/** สรุปฝนรายอำเภอ (ระบายสีแผนที่ + ตารางความร้อนอำเภอ × วัน): ค่าเฉลี่ย/สูงสุดของสถานีในอำเภอ */
export function districtRainSummary(stations = [], dates = []) {
  const names = [...new Set(stations.map((s) => s.amphoe).filter(Boolean))].sort((a, b) => a.localeCompare(b, "th"));
  return names.map((amphoe) => {
    const daily = dailyRainSummary(stations, dates, amphoe);
    const avg = daily.map((d) => d.avg_mm);
    const max = daily.map((d) => d.max_mm);
    const known = max.filter((v) => v !== null);
    const topIndex = known.length ? max.indexOf(Math.max(...known)) : -1;
    return {
      amphoe,
      stations: stations.filter((s) => s.amphoe === amphoe).length,
      total_mm: known.length ? round(avg.reduce((s, v) => s + (v || 0), 0)) : null,
      max_day_mm: topIndex >= 0 ? max[topIndex] : null,
      max_day: topIndex >= 0 ? dates[topIndex] : null,
      max_station: topIndex >= 0 ? daily[topIndex].max_station : null,
      heavy_days: known.filter((v) => v >= HEAVY_RAIN_MM).length,
      rain_days: avg.filter((v) => v !== null && v >= RAIN_DAY_MM).length,
      max_3d_mm: maxRollingSum(avg, 3),
      daily_avg: avg,
      daily_max: max
    };
  });
}

/**
 * ความแรงฝนตามช่วงเวลา (ใช้ฝน 1 ชม. ที่เก็บรายชั่วโมง): รวมฝนของแต่ละสถานีในช่วง แล้วหาค่าสูงสุด/ค่าเฉลี่ยข้ามสถานี
 * คืน { area: [{ t, max_mm, avg_mm, raining, max_station }], by_district: { อำเภอ: [{ t, mm }] } } — by_district = ค่าเฉลี่ยสถานีในอำเภอ (ใช้ซ้อนกับกราฟระดับน้ำ)
 */
export function rainIntensitySeries(rows = [], { days = 7, amphoe = null } = {}) {
  const size = bucketHours(days);
  const buckets = new Map(); // t → Map(stationId → { mm, name, amphoe })
  for (const row of rows) {
    const mm = num(row.rain_1h);
    if (mm === null) continue;
    const t = bucketKey(row.hour_at, size);
    if (!buckets.has(t)) buckets.set(t, new Map());
    const stationsAt = buckets.get(t);
    const id = String(row.station_id);
    const prev = stationsAt.get(id);
    stationsAt.set(id, { mm: (prev?.mm || 0) + Math.max(0, mm), name: row.station_name, amphoe: row.amphoe || null });
  }
  const area = [];
  const byDistrict = {};
  for (const t of [...buckets.keys()].sort()) {
    const all = [...buckets.get(t).values()];
    const inArea = amphoe ? all.filter((s) => s.amphoe === amphoe) : all;
    if (inArea.length) {
      const top = inArea.reduce((best, s) => (s.mm > best.mm ? s : best));
      area.push({
        t, max_mm: round(top.mm), avg_mm: round(inArea.reduce((s, v) => s + v.mm, 0) / inArea.length),
        raining: inArea.filter((s) => s.mm > 0).length, stations: inArea.length, max_station: top.mm > 0 ? top.name : null
      });
    }
    const groups = new Map();
    for (const s of all) {
      if (!s.amphoe) continue;
      if (!groups.has(s.amphoe)) groups.set(s.amphoe, []);
      groups.get(s.amphoe).push(s.mm);
    }
    for (const [name, list] of groups) (byDistrict[name] = byDistrict[name] || []).push({ t, mm: round(list.reduce((s, v) => s + v, 0) / list.length) });
  }
  return { bucket_hours: size, area, by_district: byDistrict };
}

/** ระดับน้ำรายสถานี: จุดกราฟตามช่วงเวลา (ใช้ค่าสูงสุดของช่วง) + สรุป */
export function waterStationSeries(rows = [], { days = 7 } = {}) {
  const size = bucketHours(days);
  const byStation = new Map();
  for (const row of rows) {
    const code = String(row.station_code);
    const level = num(row.water_level);
    if (!byStation.has(code)) byStation.set(code, { code, name: row.station_name, bank: null, points: new Map(), raw: [] });
    const station = byStation.get(code);
    const bank = num(row.bank_level);
    if (bank !== null) station.bank = bank;
    if (level === null || Number(row.malfunction) === 1) continue;
    const hour = hourText(row.hour_at);
    station.raw.push({ hour, level });
    const key = bucketKey(hour, size);
    const prev = station.points.get(key);
    if (prev === undefined || level > prev) station.points.set(key, level);
  }
  return [...byStation.values()].map((station) => {
    const raw = station.raw.sort((a, b) => a.hour.localeCompare(b.hour));
    const latest = raw.at(-1) || null;
    const peak = raw.reduce((best, r) => (!best || r.level > best.level ? r : best), null);
    const bank = station.bank;
    const hoursOver = bank === null ? 0 : raw.filter((r) => r.level > bank).length;
    const hoursNear = bank === null ? 0 : raw.filter((r) => r.level <= bank && r.level >= bank - 0.5).length;
    const lowest = raw.reduce((best, r) => (!best || r.level < best.level ? r : best), null);
    // อัตราน้ำขึ้นเร็วสุด (ม./ชม.) จากค่าที่วัดห่างกันไม่เกิน 3 ชม.
    let rise = null;
    for (let i = 1; i < raw.length; i += 1) {
      const gap = (hourMs(raw[i].hour) - hourMs(raw[i - 1].hour)) / 3600e3;
      if (!(gap > 0 && gap <= 3)) continue;
      const rate = (raw[i].level - raw[i - 1].level) / gap;
      if (rate > 0 && (!rise || rate > rise.rate)) rise = { t: raw[i].hour, rate };
    }
    // เปลี่ยนแปลงใน 6 ชม.ล่าสุด (เทียบค่าที่ใกล้ 6 ชม.ก่อนที่สุด ภายในช่วง 4–9 ชม.)
    let change6h = null;
    if (latest) {
      const target = hourMs(latest.hour) - 6 * 3600e3;
      const past = raw.filter((r) => { const gap = (hourMs(latest.hour) - hourMs(r.hour)) / 3600e3; return gap >= 4 && gap <= 9; })
        .sort((a, b) => Math.abs(hourMs(a.hour) - target) - Math.abs(hourMs(b.hour) - target))[0];
      if (past) change6h = round(latest.level - past.level, 2);
    }
    return {
      code: station.code,
      name: station.name,
      source: station.code.startsWith("TW") ? "ThaiWater" : "ปภ.",
      lat: DDPM_CCTV_STATIONS.find((s) => s.code === station.code)?.lat ?? null, // พิกัดมีเฉพาะสถานี ปภ.
      lng: DDPM_CCTV_STATIONS.find((s) => s.code === station.code)?.lng ?? null,
      bank,
      series: [...station.points.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([t, level]) => ({ t, level: round(level, 2) })),
      latest: latest ? { t: latest.hour, level: round(latest.level, 2), diff: bank === null ? null : round(latest.level - bank, 2) } : null,
      peak: peak ? { t: peak.hour, level: round(peak.level, 2), diff: bank === null ? null : round(peak.level - bank, 2) } : null,
      hours_over_bank: hoursOver,
      hours_near_bank: hoursNear,
      days_over_bank: bank === null ? 0 : new Set(raw.filter((r) => r.level > bank).map((r) => r.hour.slice(0, 10))).size,
      lowest: lowest ? { t: lowest.hour, level: round(lowest.level, 2) } : null,
      range: peak && lowest ? round(peak.level - lowest.level, 2) : null,
      change: raw.length > 1 ? round(raw.at(-1).level - raw[0].level, 2) : null,
      change_6h: change6h,
      max_rise: rise ? { t: rise.t, rate: round(rise.rate, 2) } : null,
      readings: raw.length
    };
  }).filter((s) => s.readings > 0)
    .sort((a, b) => (b.peak?.diff ?? -99) - (a.peak?.diff ?? -99));
}

/** น้ำทะเลหนุน: จุดกราฟ (ค่าสูงสุดของช่วง) และวันที่น้ำขึ้นสูงสุด */
export function seaLevelSeries(rows = [], { days = 7 } = {}) {
  const size = bucketHours(days);
  const buckets = new Map();
  let peak = null;
  const statusDays = new Map();
  for (const row of rows) {
    const hour = hourText(row.hour_at);
    const observed = num(row.observed_level);
    const model = num(row.model_level);
    const key = bucketKey(hour, size);
    const b = buckets.get(key) || { t: key, observed: null, model: null };
    if (observed !== null && (b.observed === null || observed > b.observed)) b.observed = observed;
    if (model !== null && (b.model === null || model > b.model)) b.model = model;
    buckets.set(key, b);
    if (model !== null && (!peak || model > peak.level)) peak = { t: hour, level: model };
    if (row.status_key && row.status_key !== "normal") {
      const day = hour.slice(0, 10);
      const rank = { elevated: 1, high: 2, record: 3 }[row.status_key] || 0;
      if (rank > (statusDays.get(day) || 0)) statusDays.set(day, rank);
    }
  }
  const dailyMap = new Map();
  for (const row of rows) {
    const day = hourText(row.hour_at).slice(0, 10);
    const d = dailyMap.get(day) || { date: day, model_max: null, model_min: null, observed_max: null };
    const model = num(row.model_level);
    const observed = num(row.observed_level);
    if (model !== null) {
      if (d.model_max === null || model > d.model_max) d.model_max = model;
      if (d.model_min === null || model < d.model_min) d.model_min = model;
    }
    if (observed !== null && (d.observed_max === null || observed > d.observed_max)) d.observed_max = observed;
    dailyMap.set(day, d);
  }
  return {
    // รายวัน: น้ำขึ้นสูงสุด และพิสัยน้ำขึ้น–ลง (มาก = ช่วงน้ำเกิด) · rank: 0 ปกติ 1 หนุนสูงกว่าปกติ 2 หนุนสูง 3 สูงสุดในรอบ 30 วัน
    daily: [...dailyMap.values()].sort((a, b) => a.date.localeCompare(b.date)).map((d) => ({
      date: d.date, model_max: round(d.model_max, 2), observed_max: round(d.observed_max, 2),
      tidal_range: d.model_max !== null && d.model_min !== null ? round(d.model_max - d.model_min, 2) : null,
      rank: statusDays.get(d.date) || 0
    })),
    series: [...buckets.values()].sort((a, b) => a.t.localeCompare(b.t)).map((b) => ({ t: b.t, observed: round(b.observed, 2), model: round(b.model, 2) })),
    peak: peak ? { t: peak.t, level: round(peak.level, 2) } : null,
    elevated_days: [...statusDays.values()].filter((r) => r >= 1).length,
    high_days: [...statusDays.values()].filter((r) => r >= 2).length
  };
}

/** เติมข้อมูลประกอบของสถานีวัดระดับน้ำ (อำเภอ พิกัด เกณฑ์ ปภ.) — metaByCode: { STN01: { amphoe, tambon, river, lat, lng, thresholds } } */
export function mergeWaterStationMeta(stations = [], metaByCode = {}) {
  return stations.map((station) => {
    const known = DDPM_CCTV_STATIONS.find((s) => s.code === station.code);
    const place = String(known?.place || "").match(/^ต\.(.*?)\s+อ\.(.*)$/);
    const meta = metaByCode[station.code] || {};
    const thresholds = meta.thresholds && Object.values(meta.thresholds).some((v) => v !== null && v !== undefined) ? meta.thresholds : null;
    return {
      ...station,
      lat: station.lat ?? num(meta.lat),
      lng: station.lng ?? num(meta.lng),
      amphoe: meta.amphoe || place?.[2] || null,
      tambon: meta.tambon || place?.[1] || null,
      river: meta.river || null,
      thresholds
    };
  });
}
