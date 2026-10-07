// ดึงข้อมูลพยากรณ์จากภายนอกฝั่งเซิร์ฟเวอร์ พร้อมแคช (ถ้าต้นทางล่ม ใช้ของเดิมได้ถึงช่วงเวลาที่กำหนด)
//  - ECMWF Ensemble และ GloFAS ผ่าน Open-Meteo (ไม่ต้องใช้คีย์)
//  - ภาพพยากรณ์ฝน/คลื่น เรดาร์ และประกาศเตือนจาก ThaiWater (สสน.)
import { dischargeClimatology } from "@/lib/forecastSignals";

const ENSEMBLE_URL = "https://ensemble-api.open-meteo.com/v1/ensemble";
const FLOOD_URL = "https://flood-api.open-meteo.com/v1/flood";
const HII_MAIN_URL = "https://api-v3.thaiwater.net/api/v1/thaiwater30/public/thailand_main";
const HII_WARNING_URL = "https://api-v3.thaiwater.net/api/v1/thaiwater30/public/warning";
const HEADERS = { Accept: "application/json", "User-Agent": "Satun-Geo-EOC/1.0 (+weather risk)" };

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const caches = new Map(); // key → { value, at }
const inflight = new Map();

/** แคชแบบมีอายุ: สดภายใน freshMs, ถ้าดึงใหม่ไม่ได้ใช้ค่าเดิมได้ภายใน staleMs */
async function cached(key, freshMs, staleMs, load) {
  const now = Date.now();
  const hit = caches.get(key);
  if (hit && now - hit.at < freshMs) return hit.value;
  if (!inflight.has(key)) {
    inflight.set(key, load()
      .then((value) => {
        caches.set(key, { value, at: Date.now() });
        return value;
      })
      .finally(() => inflight.delete(key)));
  }
  try {
    return await inflight.get(key);
  } catch (error) {
    if (hit && now - hit.at < staleMs) {
      console.warn(`forecast cache: ${key} ใช้ข้อมูลเดิม (${error.message})`);
      return hit.value;
    }
    throw error;
  }
}

export function resetForecastCache() {
  caches.clear();
  inflight.clear();
}

async function getJson(url, timeoutMs = 12000) {
  const response = await fetch(url, { headers: HEADERS, cache: "no-store", signal: AbortSignal.timeout(timeoutMs) });
  if (!response.ok) throw new Error(`${new URL(url).host} HTTP ${response.status}`);
  return response.json();
}

const asList = (json) => (Array.isArray(json) ? json : [json]);
const pointKey = (points) => points.map((p) => `${Number(p.latitude).toFixed(3)},${Number(p.longitude).toFixed(3)}`).join(";");

/** ECMWF Ensemble (51 ชุด) ฝนรายวัน 7 วัน → daily ต่อจุด เรียงตาม points */
export function getEnsembleRain(points) {
  return cached(`ens:${pointKey(points)}`, HOUR, 12 * HOUR, async () => {
    const params = new URLSearchParams({
      latitude: points.map((p) => p.latitude).join(","),
      longitude: points.map((p) => p.longitude).join(","),
      models: "ecmwf_ifs025",
      daily: "precipitation_sum",
      forecast_days: "7",
      timezone: "Asia/Bangkok"
    });
    const list = asList(await getJson(`${ENSEMBLE_URL}?${params}`));
    return points.map((_, index) => list[index]?.daily || null);
  });
}

/** GloFAS: ปริมาณน้ำย้อนหลัง 7 วัน + พยากรณ์ 14 วัน (ค่ากลางและ P75 ของชุดพยากรณ์) */
export function getRiverForecast(points) {
  return cached(`flood:${pointKey(points)}`, 3 * HOUR, 24 * HOUR, async () => {
    const params = new URLSearchParams({
      latitude: points.map((p) => p.latitude).join(","),
      longitude: points.map((p) => p.longitude).join(","),
      daily: "river_discharge,river_discharge_p75",
      past_days: "7",
      forecast_days: "14"
    });
    const list = asList(await getJson(`${FLOOD_URL}?${params}`));
    return points.map((_, index) => list[index]?.daily || null);
  });
}

/** GloFAS: สถิติปริมาณน้ำ 20 ปี (คำนวณครั้งเดียวต่อสัปดาห์) */
export function getRiverClimatology(points) {
  return cached(`clim:${pointKey(points)}`, 7 * 24 * HOUR, 30 * 24 * HOUR, async () => {
    const lastYear = new Date().getFullYear() - 1;
    const params = new URLSearchParams({
      latitude: points.map((p) => p.latitude).join(","),
      longitude: points.map((p) => p.longitude).join(","),
      daily: "river_discharge",
      start_date: `${lastYear - 19}-01-01`,
      end_date: `${lastYear}-12-31`
    });
    const list = asList(await getJson(`${FLOOD_URL}?${params}`, 20000));
    return points.map((_, index) => dischargeClimatology(list[index]?.daily?.river_discharge));
  });
}

/** หน้าหลัก ThaiWater (ใหญ่ ~9 MB) — เก็บเฉพาะส่วนภาพที่ใช้ แคช 1 ชม. */
export function getHiiMain() {
  return cached("hii:main", HOUR, 12 * HOUR, async () => {
    const json = await getJson(HII_MAIN_URL, 20000);
    return { pre_rain: json.pre_rain, wave: json.wave, radar: json.radar };
  });
}

export function getHiiWarnings() {
  return cached("hii:warning", 10 * MINUTE, 6 * HOUR, () => getJson(HII_WARNING_URL));
}
