// เก็บและอ่านประวัติฝน/น้ำทะเลรายชั่วโมง (ฝั่งเซิร์ฟเวอร์) — ระดับน้ำในคลองใช้ dpm_water_readings ที่เก็บอยู่แล้ว
import { query } from "@/lib/db";
import { bangkokHourKey } from "@/lib/dpmWater";
import { thaiWaterCode } from "@/lib/waterReportExtras";
import { getSatunRainfall } from "@/lib/thaiWaterClient";
import { isRainStale } from "@/lib/thaiWaterRain";
import {
  dailyRainByStation, dailyRainSummary, dateList, normalizeDays, seaLevelSeries, waterStationSeries
} from "@/lib/hydroHistory";

const missingTable = (error) => error?.code === "ER_NO_SUCH_TABLE";
const toBangkok = (iso) => {
  const time = Date.parse(iso || "");
  return Number.isFinite(time) ? new Date(time + 7 * 3600e3).toISOString().slice(0, 19).replace("T", " ") : null;
};

/** ฝนรายสถานี: เก็บค่าล่าสุดของแต่ละชั่วโมง (ฝนสะสมเปลี่ยนตลอดชั่วโมง) — ข้ามสถานีที่ข้อมูลเก่า */
export async function saveRainSnapshot(stations, fetchedAt = new Date()) {
  const usable = (stations || []).filter((s) => s?.id && s.rain24h !== null && s.rain24h !== undefined && !isRainStale(s.observedAt, fetchedAt.getTime()));
  if (!usable.length) return 0;
  const hour = bangkokHourKey(fetchedAt);
  const values = usable.map(() => "(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").join(", ");
  const params = usable.flatMap((s) => [
    String(s.id).slice(0, 40), hour, String(s.name || "สถานีวัดฝน").slice(0, 191), s.amphoe || null, s.tambon || null,
    s.lat ?? null, s.lng ?? null, s.rain1h ?? null, s.rain24h, toBangkok(s.observedAt)
  ]);
  await query(
    `INSERT INTO rain_readings (station_id, hour_at, station_name, amphoe, tambon, lat, lng, rain_1h, rain_24h, observed_at) VALUES ${values}
     ON DUPLICATE KEY UPDATE station_name = VALUES(station_name), amphoe = VALUES(amphoe), tambon = VALUES(tambon),
       rain_1h = VALUES(rain_1h), rain_24h = VALUES(rain_24h), observed_at = VALUES(observed_at), fetched_at = CURRENT_TIMESTAMP`,
    params
  );
  return usable.length;
}

/** น้ำทะเลหน้าสตูล: ค่าวัดจริง (IOC) + แบบจำลอง ณ ชั่วโมงนี้ */
export async function saveSeaSnapshot(payload, fetchedAt = new Date()) {
  if (!payload || payload.stale) return 0;
  const observed = payload.observed && !payload.observed.stale ? Number(payload.observed.level) : null;
  const model = Number(payload.level);
  if (!Number.isFinite(observed) && !Number.isFinite(model)) return 0;
  await query(
    `INSERT INTO sea_level_readings (hour_at, observed_level, observed_station, model_level, status_key) VALUES (?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE observed_level = COALESCE(VALUES(observed_level), observed_level), observed_station = COALESCE(VALUES(observed_station), observed_station),
       model_level = COALESCE(VALUES(model_level), model_level), status_key = VALUES(status_key), fetched_at = CURRENT_TIMESTAMP`,
    [bangkokHourKey(fetchedAt), Number.isFinite(observed) ? observed : null, payload.station?.code || payload.station?.name || null, Number.isFinite(model) ? model : null, payload.status?.key || null]
  );
  return 1;
}

/** เรียกจากตัวตั้งเวลา (ทุก 10 นาที) — แต่ละแหล่งล้มเหลวแยกกัน */
export async function recordHydroHistory() {
  const result = { rain: 0, sea: 0 };
  try {
    const rain = await getSatunRainfall();
    result.rain = await saveRainSnapshot(rain.stations);
  } catch (error) {
    if (!missingTable(error)) console.warn("[hydro-history] เก็บข้อมูลฝนไม่สำเร็จ:", error.message);
  }
  try {
    const { getSeaLevelPayload } = await import("@/lib/seaLevelClient");
    result.sea = await saveSeaSnapshot(await getSeaLevelPayload());
  } catch (error) {
    if (!missingTable(error)) console.warn("[hydro-history] เก็บระดับน้ำทะเลไม่สำเร็จ:", error.message);
  }
  return result;
}

function todayBangkok() {
  return new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);
}

async function safe(promise, fallback = []) {
  try {
    return await promise;
  } catch (error) {
    if (missingTable(error)) return fallback;
    throw error;
  }
}

// แคชผลลัพธ์ 5 นาทีต่อ (ช่วงวัน, อำเภอ) — หน้าประชาชนเปิดพร้อมกันได้โดยไม่อ่านฐานข้อมูลซ้ำ (ข้อมูลเก็บรายชั่วโมงอยู่แล้ว)
const TRENDS_TTL_MS = 5 * 60 * 1000;
const trendsCache = new Map();

export async function loadHydroTrends({ days, amphoe = null } = {}) {
  const key = `${normalizeDays(days)}|${amphoe || ""}`;
  const hit = trendsCache.get(key);
  if (hit && Date.now() - hit.at < TRENDS_TTL_MS) return hit.value;
  const value = await buildHydroTrends({ days, amphoe });
  if (trendsCache.size > 40) trendsCache.clear();
  trendsCache.set(key, { at: Date.now(), value });
  return value;
}

/** ข้อมูลหน้าแนวโน้ม: ฝนรายวัน ระดับน้ำรายสถานี น้ำทะเลหนุน ในช่วง 7/30/90 วัน */
async function buildHydroTrends({ days: rawDays, amphoe = null } = {}) {
  const days = normalizeDays(rawDays);
  const to = todayBangkok();
  const fromDate = new Date(`${to}T00:00:00Z`);
  fromDate.setUTCDate(fromDate.getUTCDate() - (days - 1));
  const from = fromDate.toISOString().slice(0, 10);
  const dates = dateList(from, to);
  const fromHour = `${from} 00:00:00`;
  // ฝนวันสุดท้ายใช้ค่าตอน 07:00 ของวันถัดไป จึงอ่านเกินไปอีก 1 วัน
  const [rainRows, waterRows, seaRows, coverage] = await Promise.all([
    safe(query(
      `SELECT station_id, station_name, amphoe, tambon, lat, lng, DATE_FORMAT(hour_at, '%Y-%m-%d %H:00:00') AS hour_at, rain_1h, rain_24h
         FROM rain_readings WHERE hour_at >= ? ORDER BY hour_at`, [`${from} 07:00:00`]
    )),
    safe(query(
      `SELECT station_code, station_name, DATE_FORMAT(hour_at, '%Y-%m-%d %H:00:00') AS hour_at, water_level, bank_level, malfunction
         FROM dpm_water_readings WHERE hour_at >= ? ORDER BY hour_at`, [fromHour]
    )),
    safe(query(
      `SELECT DATE_FORMAT(hour_at, '%Y-%m-%d %H:00:00') AS hour_at, observed_level, model_level, status_key
         FROM sea_level_readings WHERE hour_at >= ? ORDER BY hour_at`, [fromHour]
    )),
    safe(query(
      `SELECT (SELECT DATE_FORMAT(MIN(hour_at), '%Y-%m-%d %H:00:00') FROM rain_readings) AS rain,
              (SELECT DATE_FORMAT(MIN(hour_at), '%Y-%m-%d %H:00:00') FROM dpm_water_readings) AS water,
              (SELECT DATE_FORMAT(MIN(hour_at), '%Y-%m-%d %H:00:00') FROM sea_level_readings) AS sea`, []
    ), [{}])
  ]);
  const rainStations = dailyRainByStation(rainRows, dates);
  const districts = [...new Set(rainStations.map((s) => s.amphoe).filter(Boolean))].sort((a, b) => a.localeCompare(b, "th"));
  const area = amphoe && districts.includes(amphoe) ? amphoe : null;
  let seaThresholds = null;
  try {
    const { getSeaLevelPayload } = await import("@/lib/seaLevelClient");
    seaThresholds = (await getSeaLevelPayload())?.thresholds || null;
  } catch { /* ไม่มีเกณฑ์ก็แสดงกราฟได้ */ }
  return {
    range: { days, from, to },
    coverage: coverage[0] || {},
    rain: {
      amphoe: area,
      districts,
      daily: dailyRainSummary(rainStations, dates, area),
      stations: (area ? rainStations.filter((s) => s.amphoe === area) : rainStations).map(({ daily: _daily, ...s }) => s)
    },
    water: { stations: waterStationSeries(waterRows, { days }) },
    sea: { ...seaLevelSeries(seaRows, { days }), thresholds: seaThresholds }
  };
}

// ระดับน้ำย้อนหลังของสถานี ThaiWater (กราฟเล็กในการ์ด "น้ำในคลองตอนนี้" หน้าแรก) — แคช 10 นาที
const SPARK_TTL_MS = 10 * 60 * 1000;
let sparkCache = null;

/** คืน { [station.id]: [{ t: "YYYY-MM-DD HH:00:00", level }] } ของ hours ชม.ล่าสุด */
export async function loadWaterSparklines(stations = [], hours = 24) {
  const codes = new Map(stations.filter((s) => s?.id).map((s) => [thaiWaterCode(s.id), String(s.id)]));
  if (!codes.size) return {};
  if (!sparkCache || Date.now() - sparkCache.at > SPARK_TTL_MS || sparkCache.hours !== hours) {
    const rows = await safe(query(
      `SELECT station_code, DATE_FORMAT(hour_at, '%Y-%m-%d %H:00:00') AS hour_at, water_level
         FROM dpm_water_readings
        WHERE station_code LIKE 'TW%' AND hour_at >= DATE_SUB(?, INTERVAL ? HOUR) AND water_level IS NOT NULL AND malfunction = 0
        ORDER BY hour_at`,
      [bangkokHourKey(new Date()), hours]
    ));
    sparkCache = { at: Date.now(), hours, rows };
  }
  const out = {};
  for (const row of sparkCache.rows) {
    const id = codes.get(row.station_code);
    if (!id) continue;
    (out[id] = out[id] || []).push({ t: row.hour_at, level: Math.round(Number(row.water_level) * 100) / 100 });
  }
  return out;
}
