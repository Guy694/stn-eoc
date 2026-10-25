// ดึงสถานีวัดระดับน้ำของ ปภ. ในสตูลทีละสถานี (เร็วกว่า dashboard ทั้งประเทศ และมีเกณฑ์ของแต่ละสถานี) แคช 5 นาที
import { query } from "@/lib/db";
import { DDPM_CCTV_ORIGIN, DDPM_CCTV_STATIONS } from "@/lib/ddpmCctv";
import { normalizeDpmStation } from "@/lib/dpmCanals";

const FRESH_MS = 5 * 60 * 1000;
const STALE_MS = 3 * 60 * 60 * 1000;
let cache = null; // { stations, fetchedAt }
let inflight = null;

async function fetchStation(code) {
  const response = await fetch(`${DDPM_CCTV_ORIGIN}/api/v1/stations/${code}`, {
    headers: { Accept: "application/json", "User-Agent": "Satun-Geo-EOC/1.0 (+flood monitoring)" },
    cache: "no-store",
    signal: AbortSignal.timeout(15000)
  });
  if (!response.ok) throw new Error(`ปภ. ${code} HTTP ${response.status}`);
  return normalizeDpmStation(await response.json(), code);
}

async function fetchAll() {
  const results = await Promise.allSettled(DDPM_CCTV_STATIONS.map((station) => fetchStation(station.code)));
  const stations = results.filter((item) => item.status === "fulfilled").map((item) => item.value);
  if (!stations.length) throw new Error(results.find((item) => item.status === "rejected")?.reason?.message || "ปภ. ไม่ตอบ");
  // สถานีที่ดึงไม่ได้รอบนี้: ใช้ค่ารอบก่อน (ถ้ามี) ไม่ให้หายจากหน้าเว็บ
  const previous = new Map((cache?.stations || []).map((station) => [station.code, station]));
  for (const { code } of DDPM_CCTV_STATIONS) {
    if (!stations.some((station) => station.code === code) && previous.has(code)) stations.push(previous.get(code));
  }
  return stations;
}

export async function getDpmCanalStations() {
  const now = Date.now();
  if (cache && now - cache.fetchedAt < FRESH_MS) return { ...cache, stale: false };
  if (!inflight) {
    inflight = fetchAll()
      .then((stations) => { cache = { stations, fetchedAt: Date.now() }; return cache; })
      .finally(() => { inflight = null; });
  }
  try {
    return { ...(await inflight), stale: false };
  } catch (error) {
    if (cache && now - cache.fetchedAt < STALE_MS) return { ...cache, stale: true };
    throw error;
  }
}

/** ระดับน้ำรายชั่วโมงที่เก็บไว้ (ตาราง dpm_water_readings ซึ่งตัวเก็บข้อมูล ปภ. บันทึกทุกชั่วโมง) → { STN02: [{ t, level }] } */
export async function loadDpmSparklines(hours = 24) {
  try {
    const rows = await query(
      `SELECT station_code, DATE_FORMAT(hour_at, '%Y-%m-%d %H:00:00') AS t, water_level
         FROM dpm_water_readings
        WHERE station_code LIKE 'STN%' AND water_level IS NOT NULL AND malfunction = 0 AND hour_at >= NOW() - INTERVAL ? HOUR
        ORDER BY hour_at`,
      [hours]
    );
    const out = {};
    for (const row of rows) (out[row.station_code] = out[row.station_code] || []).push({ t: row.t, level: Number(row.water_level) });
    return out;
  } catch (error) {
    if (error?.code === "ER_NO_SUCH_TABLE") return {};
    throw error;
  }
}
