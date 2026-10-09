// ดึงระดับน้ำทะเลจาก IOC Sea Level Station Monitoring Facility ฝั่งเซิร์ฟเวอร์
// - ไม่มี IOC_API_KEY: ใช้บริการข้อมูลสาธารณะ (www.ioc-sealevelmonitoring.org/service.php) ซึ่งไม่ต้องใช้ key
// - มี IOC_API_KEY: ใช้ REST API v2 (api.ioc-sealevelmonitoring.org, header X-API-KEY)
// ข้อมูล 30 วันโหลดใหม่ทุก 6 ชม. ระหว่างนั้นดึงเฉพาะ 6 ชม. ล่าสุดทุก 10 นาทีแล้วต่อท้าย (ลดปริมาณข้อมูลจากต้นทาง)
// ข้อมูลภายใต้สัญญาอนุญาต CC-BY 4.0 — ต้องให้เครดิต IOC/VLIZ และผู้ดำเนินการสถานี
import { SEA_STATIONS, analyzeSeaLevel, parseIocRows } from "@/lib/seaLevel";
import { MODEL_POINTS, analyzeTideModel, combinedStatus, compareObserved, parseModelHourly } from "@/lib/tideModel";

const PUBLIC_BASE = "https://www.ioc-sealevelmonitoring.org/service.php";
const V2_BASE = "https://api.ioc-sealevelmonitoring.org/v2";
const FULL_DAYS = 30;
const FULL_REFRESH_MS = 6 * 60 * 60 * 1000;
const RECENT_REFRESH_MS = 10 * 60 * 1000;
const STALE_MAX_MS = 12 * 60 * 60 * 1000;
const TIMEOUT_MS = 25 * 1000;

const MARINE_URL = "https://marine-api.open-meteo.com/v1/marine";
const MODEL_REFRESH_MS = 60 * 60 * 1000;
const stores = new Map(); // code → { points, fullAt, recentAt }
let modelStore = null; // { at, satun: [{t,v}], langkawi: [{t,v}] }
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

// พยากรณ์ระดับน้ำทะเล (Open-Meteo Marine) ที่หน้าเมืองสตูลและลังกาวี: ย้อนหลัง 92 วัน + ล่วงหน้า 7 วัน (รีเฟรชทุก 1 ชม.)
async function loadModel(now) {
  if (modelStore && now - modelStore.at < MODEL_REFRESH_MS) return modelStore;
  const points = [MODEL_POINTS.satun, MODEL_POINTS.langkawi];
  const url = `${MARINE_URL}?latitude=${points.map((p) => p.lat).join(",")}&longitude=${points.map((p) => p.lon).join(",")}`
    + "&hourly=sea_level_height_msl&timezone=GMT&past_days=92&forecast_days=7&cell_selection=sea";
  const response = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS), cache: "no-store" });
  if (!response.ok) throw new Error(`Open-Meteo Marine HTTP ${response.status}`);
  const json = await response.json();
  const list = Array.isArray(json) ? json : [json];
  modelStore = { at: now, satun: parseModelHourly(list[0]?.hourly), langkawi: parseModelHourly(list[1]?.hourly) };
  if (modelStore.satun.length < 48) throw new Error("Open-Meteo Marine: ไม่มีข้อมูลระดับน้ำทะเล");
  return modelStore;
}

async function refreshObserved(now) {
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

/**
 * รวมพยากรณ์ (หลัก — จุดหน้าสตูล เทียบ รทก. ปานกลาง) กับค่าวัดจริง (ตรวจสอบ — ลังกาวี)
 * รูปแบบผลลัพธ์คงฟิลด์เดิม (status, level, peak, next_highs, thresholds, series, highs, phase) ให้ส่วนอื่นใช้ต่อได้
 */
async function refresh() {
  const now = Date.now();
  const [model, observed] = await Promise.allSettled([loadModel(now), refreshObserved(now)]);
  const obs = observed.status === "fulfilled" ? observed.value : null;
  if (model.status !== "fulfilled") {
    if (obs) return { ...obs, source_mode: "observed_only", model: null };
    throw new Error(`${model.reason?.message || "model"}; ${observed.reason?.message || ""}`);
  }
  const satun = analyzeTideModel(model.value.satun, { now });
  if (!satun) {
    if (obs) return { ...obs, source_mode: "observed_only", model: null };
    throw new Error("วิเคราะห์พยากรณ์ระดับน้ำทะเลไม่ได้");
  }
  const obsStation = obs ? SEA_STATIONS.find((station) => station.code === obs.station?.code) : null;
  const obsPoints = obsStation ? stores.get(obsStation.code)?.points || [] : [];
  // เทียบค่าจริงกับพยากรณ์ที่จุดเดียวกัน (ลังกาวี) เท่านั้น — สถานีสำรองปอร์โตมาไลอยู่ห่างจุดแบบจำลองไม่มาก ใช้ได้เช่นกัน
  const comparison = obsPoints.length ? compareObserved(obsPoints, model.value.langkawi, { now }) : null;
  const status = combinedStatus(satun, comparison, now);
  const nextHighs = satun.upcoming_highs.filter((h) => Date.parse(h.at) > now);
  return {
    source_mode: "model+observed",
    point: { name: MODEL_POINTS.satun.name, lat: MODEL_POINTS.satun.lat, lon: MODEL_POINTS.satun.lon },
    station: obs?.station || null,
    observed: obs ? { observed_at: obs.observed_at, level: obs.level, trend: obs.trend, status: obs.status, stale: obs.stale } : null,
    comparison,
    observed_at: obs?.observed_at || new Date(now).toISOString(),
    stale: false,
    level: satun.level_now,
    trend: satun.trend,
    status: { key: status.key, label: status.label, color: status.color, text: status.text, advice: status.advice, reasons: status.reasons },
    peak: status.peak ? { at: status.peak.at, level: status.peak.level, is_current: false } : null,
    phase: satun.phase,
    range_24h: satun.range_24h,
    thresholds: satun.thresholds,
    next_highs: nextHighs.map((h) => ({ at: h.at, est_level: h.level, status: h.status })),
    week_peak: satun.week_peak,
    highs: [...satun.recent_highs, ...satun.upcoming_highs],
    lows: satun.lows,
    series: satun.series,
    now_minute: Math.round(now / 60000),
    reference: "เทียบระดับทะเลปานกลาง (แบบจำลอง Météo-France SMOC ผ่าน Open-Meteo)"
  };
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

/** พยากรณ์น้ำขึ้น 7 วันข้างหน้าที่หน้าเมืองสตูล (ใช้ในพยากรณ์จุดเสี่ยงน้ำท่วม) */
export async function getSatunTideWeek() {
  const now = Date.now();
  const model = await loadModel(now);
  return analyzeTideModel(model.satun, { now, pastHours: 72, futureHours: 7 * 24 });
}
