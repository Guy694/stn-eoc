// แนวโน้มน้ำและฝน: รวมค่ารายชั่วโมงที่เก็บไว้ (ฝน ระดับน้ำในคลอง น้ำทะเลหนุน) เป็นข้อมูลสำหรับกราฟ
// ไฟล์นี้ไม่แตะฐานข้อมูล/เครือข่าย — รับแถวจากฐานข้อมูล (ชั่วโมงเป็นเวลาไทยแบบ "YYYY-MM-DD HH:00:00")
import { DDPM_CCTV_STATIONS } from "./ddpmCctv.js";
export const RANGE_DAYS = [7, 30, 90];
export const HEAVY_RAIN_MM = 35.1; // ฝนหนัก (เกณฑ์กรมอุตุนิยมวิทยา 24 ชม.)
export const VERY_HEAVY_RAIN_MM = 90.1;

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
      heavy_days: values.filter((v) => v >= HEAVY_RAIN_MM).length
    });
  }
  return stations.sort((a, b) => (b.total_mm || 0) - (a.total_mm || 0));
}

/** ฝนรายวันระดับจังหวัด/อำเภอ: ค่าเฉลี่ยและค่าสูงสุดของสถานีที่มีข้อมูล */
export function dailyRainSummary(stations = [], dates = [], amphoe = null) {
  const list = amphoe ? stations.filter((s) => s.amphoe === amphoe) : stations;
  return dates.map((date, index) => {
    const values = list.map((s) => ({ mm: s.daily[index]?.mm, s })).filter((v) => v.mm !== null && v.mm !== undefined);
    if (!values.length) return { date, avg_mm: null, max_mm: null, max_station: null, stations: 0 };
    const top = values.reduce((best, v) => (v.mm > best.mm ? v : best));
    return { date, avg_mm: round(values.reduce((s, v) => s + v.mm, 0) / values.length), max_mm: round(top.mm), max_station: top.s.name, stations: values.length };
  });
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
  return {
    series: [...buckets.values()].sort((a, b) => a.t.localeCompare(b.t)).map((b) => ({ t: b.t, observed: round(b.observed, 2), model: round(b.model, 2) })),
    peak: peak ? { t: peak.t, level: round(peak.level, 2) } : null,
    elevated_days: [...statusDays.values()].filter((r) => r >= 1).length,
    high_days: [...statusDays.values()].filter((r) => r >= 2).length
  };
}
