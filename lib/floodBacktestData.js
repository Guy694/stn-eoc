// เตรียมข้อมูลทดสอบย้อนหลังพยากรณ์จุดเสี่ยงน้ำท่วม — ฝั่งเซิร์ฟเวอร์
//  - เหตุการณ์จริง: flood_records (EOC) + เหตุการณ์อ้างอิงจากรายงานทางการ
//  - ฝนรายวันย้อนหลังรายตำบล: แบบจำลอง ECMWF IFS ย้อนหลัง (Open-Meteo Historical Forecast) — แหล่งเดียวกับที่ใช้พยากรณ์จริง
//    วันที่ไม่มีค่า ใช้ ERA5 (Open-Meteo Archive) แทน
//  - น้ำในคลอง: GloFAS ปริมาณน้ำรายวันย้อนหลังที่สถานีวัดระดับน้ำ เทียบสถิติ 20 ปี (เกณฑ์เดียวกับพยากรณ์จริง)
//  - น้ำทะเล: Open-Meteo Marine ระดับน้ำทะเลรายชั่วโมงย้อนหลังหน้าเมืองสตูล → สูงสุดรายวัน เทียบทั้งช่วง
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { query } from "@/lib/db";
import { susceptibilityOf } from "@/lib/areaRisk";
import { getAreaRiskPayload } from "@/lib/areaRiskData";
import { addDays, calibrate, dateRange, evaluate, eventsFromRecords, mergeEvents, REFERENCE_EVENTS, scoreSeries } from "@/lib/floodBacktest";
import { getFloodCalibration } from "@/lib/floodCalibration";
import { getRiverClimatology } from "@/lib/forecastClient";
import { dischargeLevel } from "@/lib/forecastSignals";
import { percentile } from "@/lib/seaLevel";
import { getSatunWaterLevels } from "@/lib/thaiWaterClient";
import { MODEL_POINTS } from "@/lib/tideModel";
import { worseCanal } from "@/lib/floodForecast";

const HEADERS = { Accept: "application/json", "User-Agent": "Satun-Geo-EOC/1.0 (+flood backtest)" };
const CACHE_FILE = path.join(tmpdir(), "stn-eoc-flood-backtest-inputs-v1.json");
const INPUT_CACHE_MS = 12 * 3600e3;
const RESULT_CACHE_MS = 30 * 60e3;
const EARLIEST = "2022-01-01";
const RIVER_RADIUS_KM = 10;
let resultCache = null;
let inflight = null;

const bangkokToday = () => new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);
async function getJson(url, timeoutMs = 60000) {
  const response = await fetch(url, { headers: HEADERS, cache: "no-store", signal: AbortSignal.timeout(timeoutMs) });
  if (!response.ok) throw new Error(`${new URL(url).host} HTTP ${response.status}`);
  return response.json();
}
const asList = (json) => (Array.isArray(json) ? json : [json]);
function distanceKm(a, b) {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLon = (b.lng - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(h));
}

async function loadRain(points, start, end) {
  const base = {
    latitude: points.map((p) => p.lat.toFixed(4)).join(","),
    longitude: points.map((p) => p.lng.toFixed(4)).join(","),
    daily: "precipitation_sum",
    timezone: "Asia/Bangkok",
    start_date: start,
    end_date: end
  };
  const ifs = asList(await getJson(`https://historical-forecast-api.open-meteo.com/v1/forecast?${new URLSearchParams({ ...base, models: "ecmwf_ifs" })}`));
  const out = ifs.map((item) => Object.fromEntries((item?.daily?.time || []).map((d, i) => [d, item.daily.precipitation_sum?.[i]])));
  const missing = out.reduce((sum, row) => sum + Object.values(row).filter((v) => v == null).length, 0);
  let filled = 0;
  if (missing > 0) {
    const era = asList(await getJson(`https://archive-api.open-meteo.com/v1/archive?${new URLSearchParams(base)}`));
    era.forEach((item, i) => (item?.daily?.time || []).forEach((d, k) => {
      if (out[i][d] == null && item.daily.precipitation_sum?.[k] != null) {
        out[i][d] = item.daily.precipitation_sum[k];
        filled += 1;
      }
    }));
  }
  return { rain: out.map((row) => Object.fromEntries(Object.entries(row).map(([d, v]) => [d, Number(v) || 0]))), filled_from_era5: filled, missing_ifs: missing };
}

async function loadDischarge(stations, start, end) {
  if (!stations.length) return [];
  const params = new URLSearchParams({
    latitude: stations.map((s) => s.lat).join(","),
    longitude: stations.map((s) => s.lng).join(","),
    daily: "river_discharge",
    start_date: start,
    end_date: end
  });
  const list = asList(await getJson(`https://flood-api.open-meteo.com/v1/flood?${params}`));
  const clim = await getRiverClimatology(stations.map((s) => ({ latitude: s.lat, longitude: s.lng })));
  return stations.map((s, i) => {
    const daily = list[i]?.daily || {};
    return Object.fromEntries((daily.time || []).map((d, k) => [d, dischargeLevel(Number(daily.river_discharge?.[k]), clim[i])]));
  });
}

async function loadSea(start, end) {
  const point = MODEL_POINTS.satun;
  const params = new URLSearchParams({ latitude: point.lat, longitude: point.lon, hourly: "sea_level_height_msl", timezone: "Asia/Bangkok", start_date: start, end_date: end, cell_selection: "sea" });
  const json = await getJson(`https://marine-api.open-meteo.com/v1/marine?${params}`);
  const daily = {};
  (json?.hourly?.time || []).forEach((t, i) => {
    const v = json.hourly.sea_level_height_msl?.[i];
    if (v == null) return;
    const d = t.slice(0, 10);
    daily[d] = Math.max(daily[d] ?? -Infinity, Number(v));
  });
  const values = Object.values(daily);
  if (values.length < 60) return { sea: {}, thresholds: null };
  // เกณฑ์เดียวกับหน้าน้ำทะเล: เทียบกับน้ำขึ้นสูงสุดรายวันทั้งช่วง
  const thresholds = { p75: percentile(values, 0.75), p90: percentile(values, 0.9), p98: percentile(values, 0.98) };
  const sea = Object.fromEntries(Object.entries(daily).map(([d, v]) => [d, v >= thresholds.p98 ? "record" : v >= thresholds.p90 ? "high" : v >= thresholds.p75 ? "elevated" : "normal"]));
  return { sea, thresholds: Object.fromEntries(Object.entries(thresholds).map(([k, v]) => [k, Math.round(v * 100) / 100])) };
}

async function loadInputs({ tambons, stations, start, end, sources }) {
  const signature = `${start}|${end}|${tambons.map((t) => t.key).join(",")}|${stations.map((s) => s.name).join(",")}`;
  try {
    const cached = JSON.parse(await readFile(CACHE_FILE, "utf8"));
    if (cached.signature === signature && Date.now() - cached.at < INPUT_CACHE_MS) {
      sources.push(...cached.sources.map((s) => ({ ...s, detail: `${s.detail} (แคช)` })));
      return cached.inputs;
    }
  } catch {
    // ยังไม่มีแคช
  }
  const local = [];
  const note = (name, status, detail) => local.push({ name, status, detail });
  const [rainResult, discharge, seaResult] = await Promise.allSettled([
    loadRain(tambons.map((t) => t.centroid), start, end),
    loadDischarge(stations, start, end),
    loadSea(start, end)
  ]);
  if (rainResult.status !== "fulfilled") throw new Error(`ฝนย้อนหลังไม่สำเร็จ: ${rainResult.reason?.message}`);
  note("ฝนรายวันย้อนหลังรายตำบล (ECMWF IFS ย้อนหลัง)", "ok", `${tambons.length} ตำบล${rainResult.value.filled_from_era5 ? ` • เติมจาก ERA5 ${rainResult.value.filled_from_era5} ค่า` : ""}`);
  if (discharge.status === "fulfilled") note("GloFAS ปริมาณน้ำในคลองย้อนหลัง", "ok", `${stations.length} สถานี`);
  else note("GloFAS ปริมาณน้ำในคลองย้อนหลัง", "unavailable", discharge.reason?.message);
  if (seaResult.status === "fulfilled" && seaResult.value.thresholds) note("ระดับน้ำทะเลย้อนหลังหน้าเมืองสตูล (Open-Meteo Marine)", "ok", `หนุนสูง ≥ ${seaResult.value.thresholds.p90} ม.`);
  else note("ระดับน้ำทะเลย้อนหลังหน้าเมืองสตูล (Open-Meteo Marine)", "unavailable", seaResult.reason?.message || "ข้อมูลไม่พอ");

  const rain = {};
  const canal = {};
  tambons.forEach((t, i) => {
    rain[t.key] = rainResult.value.rain[i] || {};
    if (discharge.status !== "fulfilled" || !t.riverine) return;
    const near = stations.map((s, k) => ({ s, k })).filter(({ s }) => distanceKm(t.centroid, s) <= RIVER_RADIUS_KM);
    const byDate = {};
    for (const { k } of near) {
      for (const [d, level] of Object.entries(discharge.value[k] || {})) {
        if (level === "normal") continue;
        byDate[d] = worseCanal(byDate[d] || "normal", level);
      }
    }
    canal[t.key] = byDate;
  });
  const inputs = { rain, canal, sea: seaResult.status === "fulfilled" ? seaResult.value.sea : {}, sea_thresholds: seaResult.status === "fulfilled" ? seaResult.value.thresholds : null };
  sources.push(...local);
  try {
    await mkdir(path.dirname(CACHE_FILE), { recursive: true });
    await writeFile(CACHE_FILE, JSON.stringify({ signature, at: Date.now(), inputs, sources: local }));
  } catch (error) {
    console.warn("[backtest] cannot write cache:", error?.message);
  }
  return inputs;
}

async function build() {
  const sources = [];
  const payload = await getAreaRiskPayload();
  const forecastAreas = new Map((payload.forecast?.areas || []).map((a) => [a.key, a]));
  const stations = ((await getSatunWaterLevels().catch(() => null))?.stations || []).filter((s) => Number.isFinite(s.lat) && Number.isFinite(s.lng));

  // ความเปราะบางแบบ "ไม่รู้คำตอบ": ตัดประวัติ EOC ออก (เพราะประวัติ EOC มาจากเหตุการณ์ที่กำลังทดสอบ)
  const tambons = (payload.areas || []).filter((a) => a.centroid).map((a) => {
    const blind = susceptibilityOf({ ...a, eoc_history: null });
    const nearStation = stations.some((s) => distanceKm(a.centroid, s) <= RIVER_RADIUS_KM);
    return {
      key: a.key,
      district: a.district,
      tambon: a.tambon,
      centroid: a.centroid,
      coastal: Boolean(forecastAreas.get(a.key)?.coastal ?? a.terrain?.coastal),
      riverine: nearStation || Number(a.gistda?.max_freq || 0) >= 2,
      susceptibility: blind.score
    };
  });

  const rows = await query(
    `SELECT r.session_id, s.session_number, r.district, r.tambon, r.flood_level, r.flood_start_date
       FROM flood_records r LEFT JOIN eoc_sessions s ON s.id = r.session_id
      WHERE r.flood_start_date IS NOT NULL AND (r.flood_level IS NULL OR r.flood_level <> 'ไม่มี')`
  ).catch((error) => {
    sources.push({ name: "บันทึกน้ำท่วม EOC", status: "unavailable", detail: error.message });
    return [];
  });
  const known = new Set(tambons.map((t) => t.key));
  const end = addDays(bangkokToday(), -1);
  const events = mergeEvents(eventsFromRecords(rows), REFERENCE_EVENTS)
    .filter((e) => e.start >= EARLIEST && e.start <= end)
    .map((e) => ({ ...e, unmatched: e.areas.filter((k) => !known.has(k)), areas: e.areas.filter((k) => known.has(k)) }));
  sources.unshift({ name: "เหตุการณ์น้ำท่วมจริง", status: events.length ? "ok" : "unavailable", detail: `${events.length} เหตุการณ์ • บันทึก EOC ${rows.length} รายการ` });
  const firstEvent = events[0]?.start || "2023-11-01";
  const candidate = [addDays(firstEvent, -60), "2023-10-01"].sort()[0];
  const start = candidate < EARLIEST ? EARLIEST : candidate;
  const dates = dateRange(start, end);

  const inputs = await loadInputs({ tambons, stations, start, end, sources });
  const calibration = calibrate(tambons, dates, inputs, events);
  const active = await getFloodCalibration({ fresh: true });
  const defaults = evaluate(scoreSeries(tambons, dates, inputs), dates, events, tambons);
  const current = active.source === "backtest" ? evaluate(scoreSeries(tambons, dates, inputs, active), dates, events, tambons, active.thresholds) : defaults;
  const bestCalibration = { thresholds: calibration.best.thresholds, factor_floor: calibration.best.factor_floor };
  const best = { ...evaluate(scoreSeries(tambons, dates, inputs, bestCalibration), dates, events, tambons, bestCalibration.thresholds), factor_floor: bestCalibration.factor_floor };
  return {
    generated_at: new Date().toISOString(),
    period: { start, end, days: dates.length },
    events: events.map(({ id, label, start: s, end: e, sources: src, areas, unmatched, province_level: p }) => ({ id, label, start: s, end: e, sources: src, tambons: areas.length, unmatched, province_level: Boolean(p) })),
    active,
    defaults,
    current,
    best,
    curve: calibration.curve,
    observed_tambon_events: calibration.observed_tambon_events,
    confidence: calibration.confidence,
    sea_thresholds: inputs.sea_thresholds,
    sources,
    notes: [
      "ใช้ฝน/น้ำในคลอง/น้ำทะเลที่เกิดขึ้นจริงย้อนหลัง (จากแบบจำลองวิเคราะห์ย้อนหลัง) — วัดความถูกต้องของ \"กฎ\" ถ้าพยากรณ์อากาศแม่น 100% ความแม่นจริงล่วงหน้า 3–7 วันจะต่ำกว่านี้",
      "ไม่ใช้ประวัติน้ำท่วมจาก EOC ในการคำนวณ เพื่อไม่ให้รู้คำตอบล่วงหน้า",
      "ระดับน้ำในคลองจากสถานีวัดจริง (ใกล้ตลิ่ง/ล้นตลิ่ง) ไม่มีย้อนหลัง จึงใช้เฉพาะ GloFAS",
      "บันทึกน้ำท่วมไม่ครบทุกตำบล: ช่วง ±3 วันรอบเหตุการณ์ ไม่นับตำบลที่ไม่มีบันทึกว่าเตือนเกิน"
    ]
  };
}

export async function getFloodBacktest({ fresh = false } = {}) {
  if (!fresh && resultCache && Date.now() - resultCache.at < RESULT_CACHE_MS) return resultCache.value;
  if (!inflight) {
    inflight = build()
      .then((value) => {
        resultCache = { at: Date.now(), value };
        return value;
      })
      .finally(() => { inflight = null; });
  }
  return inflight;
}

export function clearFloodBacktestCache() {
  resultCache = null;
}
