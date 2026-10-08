import { SATUN_PROVINCE_ID, buildPm25Payload } from "@/lib/pm25";

// ดึงฝุ่น PM2.5 จาก GISTDA ฝั่งเซิร์ฟเวอร์ (ข้อมูลออกทุกชั่วโมง) แล้วเก็บไว้ 15 นาที
// ถ้า GISTDA ล่ม ใช้ค่าล่าสุดที่เคยได้ต่อไปได้ไม่เกิน 6 ชม. พร้อมบอกว่าเป็นข้อมูลเก่า
const BASE = "https://pm25.gistda.or.th/rest";
const CACHE_MS = 15 * 60 * 1000;
const STALE_MAX_MS = 6 * 60 * 60 * 1000;
const TIMEOUT_MS = 10 * 1000;

let cache = null;
let inflight = null;

async function getJson(path) {
  const response = await fetch(`${BASE}/${path}`, {
    signal: AbortSignal.timeout(TIMEOUT_MS),
    headers: { Accept: "application/json" },
    cache: "no-store"
  });
  if (!response.ok) throw new Error(`GISTDA ${path} HTTP ${response.status}`);
  const json = await response.json();
  // GISTDA ตอบ HTTP 200 เสมอ สถานะจริงอยู่ใน body
  if (Number(json?.status) !== 200 || !Array.isArray(json?.data)) {
    throw new Error(`GISTDA ${path} status ${json?.status}`);
  }
  return json.data;
}

async function refresh() {
  const [provinces, amphoes] = await Promise.all([
    getJson("getPm25byProvince"),
    getJson(`getPm25byAmphoe?pv_idn=${SATUN_PROVINCE_ID}`).catch(() => [])
  ]);
  const payload = buildPm25Payload({ provinces, amphoes });
  if (!payload.province) throw new Error("GISTDA ไม่มีข้อมูลจังหวัดสตูล");
  cache = { at: Date.now(), payload };
  return payload;
}

export async function getPm25Payload() {
  if (cache && Date.now() - cache.at < CACHE_MS) {
    return { ...cache.payload, fetched_at: new Date(cache.at).toISOString(), stale: false };
  }
  try {
    inflight = inflight || refresh().finally(() => { inflight = null; });
    await inflight;
    return { ...cache.payload, fetched_at: new Date(cache.at).toISOString(), stale: false };
  } catch (error) {
    if (cache && Date.now() - cache.at < STALE_MAX_MS) {
      console.warn("[pm25] GISTDA unavailable, serving cached data:", error?.message);
      return { ...cache.payload, fetched_at: new Date(cache.at).toISOString(), stale: true };
    }
    throw error;
  }
}
