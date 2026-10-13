// ดึงระดับน้ำสถานี ปภ. ฝั่งเซิร์ฟเวอร์ แคช 5 นาที และเก็บค่ารายชั่วโมงลงฐานข้อมูล (ไว้เทียบย้อนหลัง)
import { query } from "@/lib/db";
import { DPM_STATION_PREFIX, bangkokHourKey, parseDpmDashboard, stationsFromReadings } from "@/lib/dpmWater";

const DEFAULT_URL = "https://cctv.disaster.go.th/api/v1/dashboard?page=1&limit=500";
const FRESH_MS = 5 * 60 * 1000;
const MAX_STALE_MS = 3 * 60 * 60 * 1000;
// ต้นทางตอบช้าและไม่สม่ำเสมอ (วัดได้ 6–12 วินาทีสำหรับ 500 สถานี) จึงรอได้ถึง 25 วินาที
const TIMEOUT_MS = 25000;
// ข้อมูลที่เก็บในฐานข้อมูลเก่าได้ไม่เกินนี้จึงใช้แทนได้
const MAX_SNAPSHOT_HOURS = 6;

let cache = null; // { stations, fetchedAt }
let inflight = null;

async function fetchFromSource() {
  const response = await fetch(process.env.DPM_WATER_URL || DEFAULT_URL, {
    headers: { Accept: "application/json", "User-Agent": "Satun-Geo-EOC/1.0 (+flood situation report)" },
    signal: AbortSignal.timeout(TIMEOUT_MS),
    cache: "no-store"
  });
  if (!response.ok) throw new Error(`ปภ. HTTP ${response.status}`);
  return parseDpmDashboard(await response.json(), process.env.DPM_WATER_PREFIX || DPM_STATION_PREFIX);
}

export async function saveDpmSnapshot(stations, fetchedAt = new Date()) {
  if (!stations?.length) return 0;
  const hour = bangkokHourKey(fetchedAt);
  const values = stations.map(() => "(?, ?, ?, ?, ?, ?)").join(", ");
  const params = stations.flatMap((station) => [station.code, hour, station.name.slice(0, 191), station.level, station.bank, station.malfunction ? 1 : 0]);
  // เก็บค่าแรกของชั่วโมง (ใกล้ต้นชั่วโมงที่สุด) — ถ้าค่าแรกไม่มีข้อมูล ให้ค่าถัดมาเติมแทน
  await query(
    `INSERT INTO dpm_water_readings (station_code, hour_at, station_name, water_level, bank_level, malfunction) VALUES ${values}
     ON DUPLICATE KEY UPDATE water_level = COALESCE(water_level, VALUES(water_level)), bank_level = COALESCE(bank_level, VALUES(bank_level))`,
    params
  );
  return stations.length;
}

// ค่าล่าสุดที่เก็บไว้ในฐานข้อมูล (ไม่เกิน 6 ชม.) — null ถ้าไม่มี
export async function loadLatestDpmSnapshot(maxHours = MAX_SNAPSHOT_HOURS) {
  const latest = await query(
    `SELECT DATE_FORMAT(MAX(hour_at), '%Y-%m-%d %H:00:00') AS hour_at FROM dpm_water_readings
      WHERE hour_at >= DATE_SUB(?, INTERVAL ? HOUR)`,
    [bangkokHourKey(new Date()), maxHours]
  );
  const hour = latest[0]?.hour_at;
  if (!hour) return null;
  const rows = await query(
    `SELECT station_code, station_name, DATE_FORMAT(hour_at, '%Y-%m-%d %H:00:00') AS hour_at, water_level, bank_level, malfunction
       FROM dpm_water_readings WHERE hour_at = ?`,
    [hour]
  );
  const stations = stationsFromReadings(rows);
  if (!stations.length) return null;
  const fetchedAt = new Date(stations.find((s) => s.observedAt)?.observedAt || Date.now()).getTime();
  return { stations, fetchedAt };
}

export async function getDpmWaterLevels({ force = false, save = true } = {}) {
  const now = Date.now();
  if (!force && cache && now - cache.fetchedAt < FRESH_MS) return { ...cache, stale: false };
  if (!inflight) {
    inflight = fetchFromSource()
      .then(async (stations) => {
        cache = { stations, fetchedAt: Date.now() };
        if (save) {
          try {
            await saveDpmSnapshot(stations, new Date(cache.fetchedAt));
          } catch (error) {
            if (error?.code !== "ER_NO_SUCH_TABLE") console.warn("[dpm-water] บันทึกค่ารายชั่วโมงไม่สำเร็จ:", error.message);
          }
        }
        return { ...cache, stale: false };
      })
      .finally(() => { inflight = null; });
  }
  try {
    return await inflight;
  } catch (error) {
    if (cache && now - cache.fetchedAt < MAX_STALE_MS) {
      console.warn("[dpm-water] ดึงข้อมูลไม่ได้ ใช้ข้อมูลล่าสุดที่มี:", error.message);
      return { ...cache, stale: true };
    }
    // ไม่มีในหน่วยความจำ (เช่น เพิ่งเริ่มเซิร์ฟเวอร์) → ใช้ค่ารายชั่วโมงล่าสุดที่เก็บไว้
    const snapshot = await loadLatestDpmSnapshot().catch(() => null);
    if (snapshot) {
      console.warn("[dpm-water] ดึงข้อมูลไม่ได้ ใช้ค่าที่เก็บไว้ในฐานข้อมูล:", error.message);
      return { ...snapshot, stale: true, fromDatabase: true };
    }
    throw error;
  }
}

// ค่าระดับน้ำ ณ ชั่วโมงที่ต้องการ (ใช้ชั่วโมงนั้น ถ้าไม่มีใช้ชั่วโมงใกล้สุดในช่วง ±1 ชม.)
export async function loadDpmBaseline(hourKey) {
  const rows = await query(
    `SELECT station_code, DATE_FORMAT(hour_at, '%Y-%m-%d %H:00:00') AS hour_at, water_level
       FROM dpm_water_readings
      WHERE hour_at BETWEEN DATE_SUB(?, INTERVAL 1 HOUR) AND DATE_ADD(?, INTERVAL 1 HOUR) AND water_level IS NOT NULL AND malfunction = 0`,
    [hourKey, hourKey]
  );
  const target = new Date(`${hourKey.replace(" ", "T")}Z`).getTime();
  const best = {};
  for (const row of rows) {
    const distance = Math.abs(new Date(`${row.hour_at.replace(" ", "T")}Z`).getTime() - target);
    if (!best[row.station_code] || distance < best[row.station_code].distance) best[row.station_code] = { distance, level: Number(row.water_level) };
  }
  return Object.fromEntries(Object.entries(best).map(([code, item]) => [code, item.level]));
}

// ชั่วโมงที่มีข้อมูลเก็บไว้ (48 ชม.ล่าสุด) สำหรับตัวเลือก "เทียบกับเวลา"
export async function listDpmHours(beforeHour) {
  const rows = await query(
    `SELECT DATE_FORMAT(hour_at, '%Y-%m-%d %H:00:00') AS hour_at, COUNT(*) AS stations
       FROM dpm_water_readings
      WHERE hour_at < ? AND hour_at >= DATE_SUB(?, INTERVAL 48 HOUR) AND water_level IS NOT NULL
      GROUP BY hour_at ORDER BY hour_at DESC`,
    [beforeHour, beforeHour]
  );
  return rows.map((row) => ({ hour: row.hour_at, stations: Number(row.stations) }));
}

// เก็บค่ารายชั่วโมงอัตโนมัติ (เรียกจาก instrumentation.js) ทุก 10 นาที เฉพาะ production
// ปิดด้วย DPM_WATER_INTERVAL_MIN=off · บังคับเปิดตอน dev ด้วย DPM_WATER_SCHEDULER=on
export function startDpmWaterScheduler() {
  const setting = String(process.env.DPM_WATER_INTERVAL_MIN || "10").trim().toLowerCase();
  const forced = String(process.env.DPM_WATER_SCHEDULER || "").trim().toLowerCase() === "on";
  if (["off", "0", "false", "no"].includes(setting)) return false;
  if (process.env.NODE_ENV !== "production" && !forced) return false;
  if (globalThis.__dpmWaterTimer) return true;
  const minutes = Math.min(30, Math.max(5, Number(setting) || 10));
  const tick = () => getDpmWaterLevels({ force: true }).catch((error) => console.warn("[dpm-water] ดึงข้อมูลไม่สำเร็จ:", error.message));
  globalThis.__dpmWaterTimer = setInterval(tick, minutes * 60 * 1000);
  setTimeout(tick, 20 * 1000);
  console.info(`[dpm-water] เก็บระดับน้ำสถานี ปภ. ทุก ${minutes} นาที`);
  return true;
}

// สถานีที่เคยเก็บได้ใน 7 วันล่าสุด (รหัส ชื่อ ตลิ่ง)
export async function listKnownDpmStations() {
  const rows = await query(
    `SELECT r.station_code AS code, r.station_name AS name, r.bank_level AS bank
       FROM dpm_water_readings r
       JOIN (SELECT station_code, MAX(hour_at) AS hour_at FROM dpm_water_readings WHERE hour_at >= DATE_SUB(NOW(), INTERVAL 7 DAY) GROUP BY station_code) latest
         ON latest.station_code = r.station_code AND latest.hour_at = r.hour_at`,
    []
  );
  return rows;
}
