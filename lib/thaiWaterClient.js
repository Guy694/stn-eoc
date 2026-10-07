// ดึงระดับน้ำจาก ThaiWater ฝั่งเซิร์ฟเวอร์ แคชไว้ 10 นาที (ต้นทางอัปเดตราวทุก 10–60 นาที)
// ถ้าต้นทางล่ม ใช้ข้อมูลล่าสุดที่เคยดึงได้ (ไม่เกิน 6 ชม.) พร้อมบอกว่าเป็นข้อมูลเก่า
import { parseWaterLevelResponse } from "@/lib/thaiWater";
import { parseRainResponse } from "@/lib/thaiWaterRain";

const DEFAULT_URL = "https://api-v3.thaiwater.net/api/v1/thaiwater30/public/waterlevel?province_code=91";
const FRESH_MS = 10 * 60 * 1000;
const MAX_STALE_MS = 6 * 60 * 60 * 1000;
const TIMEOUT_MS = 8000;

let cache = null; // { stations, fetchedAt }
let inflight = null;

function sourceUrl() {
  return process.env.THAIWATER_WATERLEVEL_URL || DEFAULT_URL;
}

async function fetchFromSource() {
  const response = await fetch(sourceUrl(), {
    headers: { Accept: "application/json", "User-Agent": "Satun-Geo-EOC/1.0 (+public water level map)" },
    signal: AbortSignal.timeout(TIMEOUT_MS),
    cache: "no-store"
  });
  if (!response.ok) throw new Error(`ThaiWater HTTP ${response.status}`);
  const json = await response.json();
  if (json?.result && json.result !== "OK") throw new Error(`ThaiWater result ${json.result}`);
  return parseWaterLevelResponse(json);
}

export async function getSatunWaterLevels({ force = false } = {}) {
  const now = Date.now();
  if (!force && cache && now - cache.fetchedAt < FRESH_MS) return { ...cache, stale: false };
  if (!inflight) {
    inflight = fetchFromSource()
      .then((stations) => {
        cache = { stations, fetchedAt: Date.now() };
        return { ...cache, stale: false };
      })
      .finally(() => { inflight = null; });
  }
  try {
    return await inflight;
  } catch (error) {
    if (cache && now - cache.fetchedAt < MAX_STALE_MS) {
      console.warn("ThaiWater fetch failed, serving cached data:", error.message);
      return { ...cache, stale: true };
    }
    throw error;
  }
}

export function resetThaiWaterCache() {
  cache = null;
  inflight = null;
  rainCache = null;
  rainInflight = null;
}

// ฝนวัดจริงรายสถานี (rain_24h) — แคชแยกจากระดับน้ำ ใช้กติกาเดียวกัน
const RAIN_DEFAULT_URL = "https://api-v3.thaiwater.net/api/v1/thaiwater30/public/rain_24h?province_code=91";
let rainCache = null;
let rainInflight = null;

async function fetchRainFromSource() {
  const response = await fetch(process.env.THAIWATER_RAIN_URL || RAIN_DEFAULT_URL, {
    headers: { Accept: "application/json", "User-Agent": "Satun-Geo-EOC/1.0 (+public rain map)" },
    signal: AbortSignal.timeout(TIMEOUT_MS),
    cache: "no-store"
  });
  if (!response.ok) throw new Error(`ThaiWater rain HTTP ${response.status}`);
  const json = await response.json();
  if (json?.result && json.result !== "OK") throw new Error(`ThaiWater rain result ${json.result}`);
  return parseRainResponse(json);
}

export async function getSatunRainfall({ force = false } = {}) {
  const now = Date.now();
  if (!force && rainCache && now - rainCache.fetchedAt < FRESH_MS) return { ...rainCache, stale: false };
  if (!rainInflight) {
    rainInflight = fetchRainFromSource()
      .then((stations) => {
        rainCache = { stations, fetchedAt: Date.now() };
        return { ...rainCache, stale: false };
      })
      .finally(() => { rainInflight = null; });
  }
  try {
    return await rainInflight;
  } catch (error) {
    if (rainCache && now - rainCache.fetchedAt < MAX_STALE_MS) {
      console.warn("ThaiWater rain fetch failed, serving cached data:", error.message);
      return { ...rainCache, stale: true };
    }
    throw error;
  }
}
