// ดึงระดับน้ำทะเลจาก IOC Sea Level Station Monitoring Facility ฝั่งเซิร์ฟเวอร์
// - ไม่มี IOC_API_KEY: ใช้บริการข้อมูลสาธารณะ (www.ioc-sealevelmonitoring.org/service.php) ซึ่งไม่ต้องใช้ key
// - มี IOC_API_KEY: ใช้ REST API v2 (api.ioc-sealevelmonitoring.org, header X-API-KEY)
// ข้อมูล 30 วันโหลดใหม่ทุก 6 ชม. ระหว่างนั้นดึงเฉพาะ 6 ชม. ล่าสุดทุก 10 นาทีแล้วต่อท้าย (ลดปริมาณข้อมูลจากต้นทาง)
// ข้อมูลภายใต้สัญญาอนุญาต CC-BY 4.0 — ต้องให้เครดิต IOC/VLIZ และผู้ดำเนินการสถานี
import { SEA_STATIONS, analyzeSeaLevel, parseIocRows } from "@/lib/seaLevel";

const PUBLIC_BASE = "https://www.ioc-sealevelmonitoring.org/service.php";
const V2_BASE = "https://api.ioc-sealevelmonitoring.org/v2";
const FULL_DAYS = 30;
const FULL_REFRESH_MS = 6 * 60 * 60 * 1000;
const RECENT_REFRESH_MS = 10 * 60 * 1000;
const STALE_MAX_MS = 12 * 60 * 60 * 1000;
const TIMEOUT_MS = 25 * 1000;

const stores = new Map(); // code → { points, fullAt, recentAt }
let inflight = null;
let lastGood = null;

const fmt = (ms) => new Date(ms).toISOString().slice(0, 16);

async function fetchRows(station, from, to) {
  const key = process.env.IOC_API_KEY || "";
  const url = key
    ? `${V2_BASE}/stations/${station.code}/data?timestart=${fmt(from)}&timestop=${fmt(to)}&includesensors[]=${station.sensor}&limit=150000`
    : `${PUBLIC_BASE}?query=data&code=${station.code}&timestart=${fmt(from)}&timestop=${fmt(to)}&format=json&includesensors[]=${station.sensor}`;
  const response = await fetch(url, {
    headers: { Accept: "application/json", ...(key ? { "X-API-KEY": key } : {}) },
    signal: AbortSignal.timeout(TIMEOUT_MS),
    cache: "no-store"
  });
  if (!response.ok) throw new Error(`IOC ${station.code} HTTP ${response.status}`);
  const json = await response.json();
  if (!Array.isArray(json)) throw new Error(`IOC ${station.code}: รูปแบบข้อมูลไม่ถูกต้อง`);
  return parseIocRows(json, station.sensor);
}

async function loadStation(station, now) {
  const store = stores.get(station.code) || { points: [], fullAt: 0, recentAt: 0 };
  if (now - store.fullAt > FULL_REFRESH_MS || store.points.length === 0) {
    store.points = await fetchRows(station, now - FULL_DAYS * 864e5, now);
    store.fullAt = now;
    store.recentAt = now;
  } else if (now - store.recentAt > RECENT_REFRESH_MS) {
    const lastT = store.points.length ? store.points[store.points.length - 1].t : now - 6 * 3600e3;
    const fresh = await fetchRows(station, Math.max(lastT - 30 * 60e3, now - 6 * 3600e3), now);
    const cutoff = now - FULL_DAYS * 864e5;
    const merged = new Map(store.points.filter((point) => point.t >= cutoff).map((point) => [point.t, point]));
    for (const point of fresh) merged.set(point.t, point);
    store.points = [...merged.values()].sort((a, b) => a.t - b.t);
    store.recentAt = now;
  }
  stores.set(station.code, store);
  return store.points;
}

async function refresh() {
  const now = Date.now();
  const errors = [];
  // ใช้สถานีแรกที่มีข้อมูลสด (ภายใน 3 ชม.) — ลังกาวีวัดรายนาที, ปอร์โตมาไลรายชั่วโมงเป็นสำรอง
  for (const station of SEA_STATIONS) {
    try {
      const points = await loadStation(station, now);
      const analysis = analyzeSeaLevel(points, { station, now });
      if (analysis && !analysis.stale) return analysis;
      if (analysis) errors.push(`${station.code}: ข้อมูลล่าสุดเก่าเกิน 3 ชม.`);
    } catch (error) {
      errors.push(`${station.code}: ${error.message}`);
    }
  }
  throw new Error(errors.join("; ") || "ไม่มีสถานีที่มีข้อมูล");
}

export async function getSeaLevelPayload() {
  if (lastGood && Date.now() - lastGood.at < RECENT_REFRESH_MS) {
    return { ...lastGood.payload, fetched_at: new Date(lastGood.at).toISOString() };
  }
  try {
    inflight = inflight || refresh().finally(() => { inflight = null; });
    const payload = await inflight;
    lastGood = { at: Date.now(), payload };
    return { ...payload, fetched_at: new Date(lastGood.at).toISOString() };
  } catch (error) {
    if (lastGood && Date.now() - lastGood.at < STALE_MAX_MS) {
      console.warn("[sea-level] IOC unavailable, serving cached data:", error?.message);
      return { ...lastGood.payload, stale: true, fetched_at: new Date(lastGood.at).toISOString() };
    }
    throw error;
  }
}
