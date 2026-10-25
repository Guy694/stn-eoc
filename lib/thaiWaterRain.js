// ฝนวัดจริงจากสถานีใน ThaiWater (สสน.) — แปลงข้อมูล + สรุปรายอำเภอ (ไม่มีการเรียกเครือข่ายในไฟล์นี้)
import { isStale, thaiDateTimeToIso } from "@/lib/thaiWater";

// เกณฑ์ฝน 24 ชม. ของกรมอุตุนิยมวิทยา
export const RAIN_CATEGORIES = [
  { key: "none", label: "ไม่มีฝน", min: 0, color: "#cbd5e1", text: "#334155" },
  { key: "light", label: "ฝนเล็กน้อย", min: 0.1, color: "#7dd3fc", text: "#0c4a6e" },
  { key: "moderate", label: "ฝนปานกลาง", min: 10.1, color: "#2563eb", text: "#ffffff" },
  { key: "heavy", label: "ฝนหนัก", min: 35.1, color: "#f59e0b", text: "#1f2937" },
  { key: "very_heavy", label: "ฝนหนักมาก", min: 90.1, color: "#dc2626", text: "#ffffff" }
];

// สีและช่วงฝนสะสม 24 ชม. สำหรับแผนที่หน้าแรก
export const RAIN_24H_MAP_CATEGORIES = [
  { key: "none", label: "ไม่มีฝน", range: "0 มม.", min: 0, color: "#22c55e" },
  { key: "light", label: "ฝนเล็กน้อย", range: "0.1–10.0 มม.", min: 0.1, color: "#38bdf8" },
  { key: "moderate", label: "ฝนปานกลาง", range: "10.1–35.0 มม.", min: 10.1, color: "#facc15" },
  { key: "heavy", label: "ฝนหนัก", range: "35.1–90.0 มม.", min: 35.1, color: "#facc15" },
  { key: "very_heavy", label: "ฝนหนักมาก", range: "90.1 มม. ขึ้นไป", min: 90.1, color: "#ef4444" },
];

export function rain24hMapCategory(mm) {
  const value = Number(mm);
  if (!Number.isFinite(value) || value <= 0) return RAIN_24H_MAP_CATEGORIES[0];
  return [...RAIN_24H_MAP_CATEGORIES].reverse().find((item) => value >= item.min) || RAIN_24H_MAP_CATEGORIES[0];
}

// ความแรงของฝนใน 1 ชม. (มม./ชม.) — ใช้กับ "ตอนนี้ฝน…" และสีแผนที่หน้าแรก (ไม่ใช่เกณฑ์ฝน 24 ชม. ด้านบน)
export const HOURLY_RAIN_CATEGORIES = [
  { key: "none", label: "ไม่มีฝน", min: 0, range: "", color: "#6f8fa1" },
  { key: "light", label: "ฝนเล็กน้อย", min: 0.1, range: "ต่ำกว่า 5 มม./ชม.", color: "#7dd3fc" },
  { key: "moderate", label: "ฝนปานกลาง", min: 5, range: "5–19.9 มม./ชม.", color: "#2f74e6" },
  { key: "heavy", label: "ฝนหนัก", min: 20, range: "20 มม./ชม. ขึ้นไป", color: "#f59e0b" }
];

export function hourlyRainCategory(mm) {
  const value = Number(mm);
  if (!Number.isFinite(value) || value <= 0) return HOURLY_RAIN_CATEGORIES[0];
  return [...HOURLY_RAIN_CATEGORIES].reverse().find((item) => value >= item.min) || HOURLY_RAIN_CATEGORIES[0];
}

// ค่าเกินนี้ถือว่าเครื่องวัดผิดปกติ (สถิติฝน 24 ชม. ของภาคใต้สูงสุดราว 400–500 มม.)
const MAX_PLAUSIBLE_MM = 500;
// ฝนสะสม 24 ชม. ที่วัดเมื่อไม่กี่ชั่วโมงก่อนยังใช้ได้ (สถานีกรมทรัพยากรน้ำบางแห่งส่งข้อมูลห่างกันหลายชั่วโมง)
export const RAIN_STALE_HOURS = 6;
export function isRainStale(observedAt, now = Date.now()) {
  return isStale(observedAt, now, RAIN_STALE_HOURS);
}
// อำเภอที่มีสถานีให้ข้อมูลสดน้อยกว่านี้ ใช้ค่าจากโมเดลแทน
// ค่าวัดจริงแม้จุดเดียวก็ใกล้ความจริงกว่าแบบจำลอง (เดิมต้อง 2 สถานี ทำให้ อ.ท่าแพ ใช้ค่าแบบจำลอง)
export const MIN_GAUGES_PER_DISTRICT = 1;

export function rainCategory(mm) {
  const value = Number(mm);
  if (!Number.isFinite(value) || value <= 0) return RAIN_CATEGORIES[0];
  return [...RAIN_CATEGORIES].reverse().find((item) => value >= item.min) || RAIN_CATEGORIES[0];
}

function num(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function thName(value) {
  if (!value) return "";
  if (typeof value === "string") return value.trim();
  return String(value.th || value.en || "").trim();
}

export function normalizeDistrictName(value) {
  return String(value || "").replace(/^อ(\.|ำเภอ)\s*/, "").replace(/\s+/g, "").trim();
}

export function normalizeRainStation(record) {
  const station = record?.station || {};
  const lat = num(station.tele_station_lat);
  const lng = num(station.tele_station_long);
  const rain24 = num(record?.rain_24h);
  if (lat === null || lng === null || rain24 === null || rain24 < 0 || rain24 > MAX_PLAUSIBLE_MM) return null;
  const geocode = record.geocode || {};
  return {
    id: String(station.id ?? record.id),
    name: thName(station.tele_station_name) || "สถานีวัดฝน",
    tambon: thName(geocode.tumbon_name),
    amphoe: thName(geocode.amphoe_name),
    province: thName(geocode.province_name),
    provinceCode: String(geocode.province_code || ""),
    lat,
    lng,
    rain24h: rain24,
    rain1h: num(record.rain_1h),
    observedAt: thaiDateTimeToIso(record.rainfall_datetime),
    agency: thName(record.agency?.agency_shortname)
  };
}

export function parseRainResponse(json) {
  const rows = Array.isArray(json?.data) ? json.data : Array.isArray(json) ? json : [];
  return rows
    .map(normalizeRainStation)
    .filter(Boolean)
    .filter((item) => (item.provinceCode ? item.provinceCode === "91" : item.province.includes("สตูล")))
    .sort((a, b) => b.rain24h - a.rain24h);
}

/**
 * สรุปฝนวัดจริงรายอำเภอ (เฉพาะสถานีที่ข้อมูลไม่เก่ากว่า 6 ชม.)
 * คืน Map(ชื่ออำเภอแบบ normalize → { count, mean, max, maxStation, rain1hMax, observedAt })
 */
export function summarizeRainByDistrict(stations, { now = Date.now() } = {}) {
  const groups = new Map();
  for (const station of stations || []) {
    if (!station.amphoe || isRainStale(station.observedAt, now)) continue;
    const key = normalizeDistrictName(station.amphoe);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(station);
  }
  const result = new Map();
  for (const [key, list] of groups) {
    const sorted = [...list].sort((a, b) => b.rain24h - a.rain24h);
    const total = sorted.reduce((sum, item) => sum + item.rain24h, 0);
    result.set(key, {
      count: sorted.length,
      mean: Number((total / sorted.length).toFixed(1)),
      max: sorted[0].rain24h,
      maxStation: sorted[0].name,
      rain1hMax: Math.max(0, ...sorted.map((item) => item.rain1h || 0)),
      observedAt: sorted.map((item) => item.observedAt).filter(Boolean).sort().pop() || null
    });
  }
  return result;
}

/**
 * ฝนที่ใช้คำนวณความเสี่ยงของอำเภอ: ถ้ามีสถานีสดอย่างน้อย 1 สถานี ใช้ "ค่าสูงสุดที่วัดได้" (เตือนตามจุดที่ฝนหนักสุดในอำเภอ)
 * ไม่พอ → ใช้ค่าจากโมเดล และบอกว่าเป็นค่าประมาณ
 */
export function pickDistrictRain({ modelRain24h, modelRain1h }, gauge) {
  if (gauge && gauge.count >= MIN_GAUGES_PER_DISTRICT) {
    return { source: "gauge", rain24h: gauge.max, rain1h: gauge.rain1hMax, gauge };
  }
  return { source: "model", rain24h: modelRain24h, rain1h: modelRain1h, gauge: gauge || null };
}
