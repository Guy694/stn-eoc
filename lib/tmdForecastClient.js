// พยากรณ์อากาศรายวันรายอำเภอ จากกรมอุตุนิยมวิทยา (TMD Weather Forecast API — data.tmd.go.th/nwpapi)
// ใช้ฝั่งเซิร์ฟเวอร์เท่านั้น: token อยู่ใน env TMD_NWP_TOKEN (ห้ามส่งไปหน้าเว็บ)
//
// - เรียกครั้งเดียวได้ทุกอำเภอของสตูล (place?province=สตูล&subarea=1) · แคชในหน่วยความจำ 3 ชม. (แบบจำลอง TMD ออกรอบละ ~6–12 ชม.)
// - ดึงไม่ได้/ไม่มี token → คืน null แล้วหน้าเว็บใช้ ECMWF (Open-Meteo) เหมือนเดิม · ใช้ค่าเก่าได้ไม่เกิน 24 ชม.
// - ไม่มีโอกาสฝน (%) ในข้อมูลรายวันของ TMD → โอกาสฝน/ฝนหนักยังมาจาก ECMWF Ensemble
import { normalizeDistrictName } from "@/lib/thaiWaterRain";

export const TMD_DAILY_URL = "https://data.tmd.go.th/nwpapi/v1/forecast/location/daily/place";
export const TMD_FIELDS = ["tc_min", "tc_max", "rh", "rain", "ws10m", "wd10m", "cond"];
export const TMD_SOURCE = "กรมอุตุนิยมวิทยา";
const FRESH_MS = 3 * 3600e3;
const STALE_MS = 24 * 3600e3;

// รหัส cond ของ TMD → ข้อความ + ชนิดภาพ (lib/weatherIcon.js)
export const TMD_CONDITIONS = {
  1: { text: "ท้องฟ้าแจ่มใส", kind: "sun" },
  2: { text: "มีเมฆบางส่วน", kind: "partly" },
  3: { text: "เมฆเป็นส่วนมาก", kind: "cloud" },
  4: { text: "มีเมฆมาก", kind: "cloud" },
  5: { text: "ฝนตกเล็กน้อย", kind: "drizzle" },
  6: { text: "ฝนปานกลาง", kind: "rain" },
  7: { text: "ฝนตกหนัก", kind: "heavy" },
  8: { text: "ฝนฟ้าคะนอง", kind: "storm" },
  9: { text: "อากาศหนาวจัด", kind: "partly" },
  10: { text: "อากาศหนาว", kind: "partly" },
  11: { text: "อากาศเย็น", kind: "partly" },
  12: { text: "อากาศร้อนจัด", kind: "sun" }
};

const num = (value) => (value === null || value === undefined || value === "" || !Number.isFinite(Number(value)) ? null : Number(value));
const bangkokDate = (iso) => {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : new Date(date.getTime() + 7 * 3600e3).toISOString().slice(0, 10);
};

/** แปลง response ของ TMD → Map(ชื่ออำเภอ normalize → { "YYYY-MM-DD": วัน }) · ไม่สนแถวระดับจังหวัด */
export function parseTmdDaily(json) {
  const result = new Map();
  for (const entry of json?.weather_forecast?.locations || []) {
    const location = entry?.location || {};
    if (location.areatype !== "amphoe" || !location.amphoe) continue;
    const days = {};
    for (const forecast of entry.forecasts || []) {
      const date = bangkokDate(forecast?.time);
      const data = forecast?.data || {};
      if (!date) continue;
      const cond = num(data.cond);
      const meta = TMD_CONDITIONS[Math.round(cond)] || null;
      const ws = num(data.ws10m);
      days[date] = {
        date,
        temperature_max: num(data.tc_max) === null ? null : Math.round(num(data.tc_max)),
        temperature_min: num(data.tc_min) === null ? null : Math.round(num(data.tc_min)),
        humidity: num(data.rh) === null ? null : Math.round(num(data.rh)),
        rain_mm: num(data.rain) === null ? null : Math.round(num(data.rain) * 10) / 10,
        wind_kmh: ws === null ? null : Math.round(ws * 3.6), // m/s → กม./ชม.
        wind_direction_deg: num(data.wd10m),
        cond: meta ? Math.round(cond) : null,
        condition: meta?.text || null,
        kind: meta?.kind || null
      };
    }
    result.set(normalizeDistrictName(location.amphoe), days);
  }
  return result;
}

const cache = globalThis.__stnTmdDaily || (globalThis.__stnTmdDaily = { at: 0, data: null, inflight: null });

async function fetchTmdDaily(token, today) {
  const params = new URLSearchParams({ province: "สตูล", subarea: "1", date: today, duration: "7", fields: TMD_FIELDS.join(",") });
  const response = await fetch(`${TMD_DAILY_URL}?${params}`, {
    headers: { accept: "application/json", authorization: `Bearer ${token}`, "User-Agent": "Satun-Geo-EOC/1.0 (+public health EOC)" },
    cache: "no-store",
    signal: AbortSignal.timeout(20000)
  });
  if (!response.ok) throw new Error(`TMD daily HTTP ${response.status}`);
  const parsed = parseTmdDaily(await response.json());
  if (!parsed.size) throw new Error("TMD daily: ไม่มีข้อมูลรายอำเภอ");
  return parsed;
}

/** Map(อำเภอ → วัน) หรือ null (ไม่มี token / ดึงไม่ได้ และไม่มีค่าเก่าที่ยังใช้ได้) */
export async function getTmdDailyByDistrict({ today, token = process.env.TMD_NWP_TOKEN, now = Date.now() } = {}) {
  if (!token) return null;
  if (cache.data && now - cache.at < FRESH_MS && cache.today === today) return cache.data;
  try {
    if (!cache.inflight) {
      cache.inflight = fetchTmdDaily(token, today).finally(() => { cache.inflight = null; });
    }
    const data = await cache.inflight;
    Object.assign(cache, { at: now, data, today });
    return data;
  } catch (error) {
    console.error("TMD daily forecast error:", error?.message || error);
    return cache.data && now - cache.at < STALE_MS ? cache.data : null;
  }
}

/** สำหรับ unit test */
export function resetTmdCache() {
  Object.assign(cache, { at: 0, data: null, inflight: null, today: null });
}
