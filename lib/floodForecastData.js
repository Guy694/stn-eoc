// เตรียมข้อมูลพยากรณ์จุดเสี่ยงน้ำท่วมรายตำบล 7 วัน — ฝั่งเซิร์ฟเวอร์
//  - ฝนรายชั่วโมงที่จุดกลางแต่ละตำบล: ECMWF IFS (Open-Meteo) ย้อนหลัง 3 วัน + ล่วงหน้า 7 วัน
//  - ฝนวัดจริงวันนี้: ThaiWater (ใช้ค่าที่มากกว่าระหว่างวัด/แบบจำลอง)
//  - น้ำในคลอง: สถานี ThaiWater ในรัศมี 10 กม. (ตอนนี้) + GloFAS รายวัน (ล่วงหน้า)
//  - น้ำทะเล: พยากรณ์น้ำขึ้นรายชั่วโมงหน้าสตูล + ปรับจากค่าวัดจริงวันนี้
//  - จุดที่คาดว่าท่วม: แปลงน้ำท่วมซ้ำ GISTDA → หมู่บ้าน (satun_village_polygon)
import { query } from "@/lib/db";
import { areaKey } from "@/lib/areaRisk";
import { forecastArea, rainAtHighTide, worseCanal, worseSea, FORECAST_LEVELS } from "@/lib/floodForecast";
import { pointInGeometry } from "@/lib/geoSample";
import { getSatunTideWeek } from "@/lib/seaLevelClient";

const RAIN_URL = "https://api.open-meteo.com/v1/forecast";
const RAIN_CACHE_MS = 30 * 60 * 1000;
const VILLAGE_CACHE_MS = 24 * 3600 * 1000;
const RIVER_RADIUS_KM = 10;
let rainCache = null;
let villageCache = null;

const bangkokDate = (ms) => new Date(ms + 7 * 3600e3).toISOString().slice(0, 10);
function distanceKm(a, b) {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLon = (b.lng - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(h));
}

async function loadTambonRain(centroids) {
  const signature = centroids.map((c) => `${c.lat.toFixed(3)},${c.lng.toFixed(3)}`).join("|");
  if (rainCache && rainCache.signature === signature && Date.now() - rainCache.at < RAIN_CACHE_MS) return rainCache.value;
  const params = new URLSearchParams({
    latitude: centroids.map((c) => c.lat.toFixed(4)).join(","),
    longitude: centroids.map((c) => c.lng.toFixed(4)).join(","),
    hourly: "precipitation",
    models: "ecmwf_ifs",
    timezone: "GMT",
    past_days: "3",
    forecast_days: "7"
  });
  const response = await fetch(`${RAIN_URL}?${params}`, { cache: "no-store", signal: AbortSignal.timeout(25000) });
  if (!response.ok) throw new Error(`Open-Meteo ECMWF (รายตำบล) HTTP ${response.status}`);
  const json = await response.json();
  const list = Array.isArray(json) ? json : [json];
  const value = list.map((item) => (item?.hourly?.time || []).map((time, i) => ({ t: Date.parse(`${time}Z`), mm: Number(item.hourly.precipitation?.[i]) || 0 })));
  rainCache = { at: Date.now(), signature, value };
  return value;
}

async function loadVillages() {
  if (villageCache && Date.now() - villageCache.at < VILLAGE_CACHE_MS) return villageCache.value;
  const rows = await query(
    `SELECT villname, moo, subdistnam, distname, num_hh, ST_AsGeoJSON(geom) AS geometry FROM satun_village_polygon`
  );
  const value = rows.map((row) => ({
    name: [row.moo ? `ม.${row.moo}` : null, row.villname].filter(Boolean).join(" ") || "-",
    key: areaKey(row.distname, row.subdistnam),
    households: Number(row.num_hh || 0),
    geometry: typeof row.geometry === "string" ? JSON.parse(row.geometry) : row.geometry
  }));
  villageCache = { at: Date.now(), value };
  return value;
}

function representativePoint(geometry) {
  const ring = geometry?.type === "Polygon" ? geometry.coordinates[0] : geometry?.type === "MultiPolygon" ? geometry.coordinates[0]?.[0] : null;
  if (!ring?.length) return null;
  const sum = ring.reduce((acc, [x, y]) => [acc[0] + x, acc[1] + y], [0, 0]);
  return [sum[0] / ring.length, sum[1] / ring.length];
}

/** แปลงน้ำท่วมซ้ำ → { tambonKey: { 1: {rai, villages}, 2: ..., 3: ... } } */
export function buildExtents(features = [], villages = []) {
  const villagesByTambon = new Map();
  for (const village of villages) villagesByTambon.set(village.key, [...(villagesByTambon.get(village.key) || []), village]);
  const extents = {};
  for (const feature of features) {
    const props = feature.properties || {};
    const key = areaKey(props.district, props.tambon);
    const point = representativePoint(feature.geometry);
    const village = point ? (villagesByTambon.get(key) || []).find((v) => pointInGeometry(point, v.geometry)) : null;
    const target = extents[key] || (extents[key] = { 1: { rai: 0, villages: new Map() }, 2: { rai: 0, villages: new Map() }, 3: { rai: 0, villages: new Map() } });
    for (const minFreq of [1, 2, 3]) {
      if (props.freq < minFreq) continue;
      target[minFreq].rai += Number(props.area_rai || 0);
      if (village) target[minFreq].villages.set(village.name, { name: village.name, households: village.households });
    }
  }
  for (const key of Object.keys(extents)) {
    for (const minFreq of [1, 2, 3]) {
      const bucket = extents[key][minFreq];
      extents[key][minFreq] = { rai: Math.round(bucket.rai), villages: [...bucket.villages.values()].sort((a, b) => b.households - a.households) };
    }
  }
  return extents;
}

/**
 * สร้างพยากรณ์ 7 วัน
 * ctx: { tambons:[{key,district,tambon,centroid}], assessed: Map(key→assessArea result), waterStations, riverOutlook, rainStations, floodFreq, seaStatusKey, now }
 */
export async function buildFloodForecast(ctx, sources) {
  const { tambons, assessed, now } = ctx;
  const note = (name, status, detail) => sources.push({ name, status, detail });

  let hourly = null;
  try {
    hourly = await loadTambonRain(tambons.map((t) => t.centroid));
    note("ฝนพยากรณ์รายตำบล 7 วัน (ECMWF)", "ok", `${tambons.length} ตำบล`);
  } catch (error) {
    note("ฝนพยากรณ์รายตำบล 7 วัน (ECMWF)", "unavailable", error.message);
  }
  let tide = null;
  try {
    tide = await getSatunTideWeek();
    note("พยากรณ์น้ำขึ้น 7 วัน (Open-Meteo Marine)", tide ? "ok" : "unavailable", tide ? `${tide.upcoming_highs.length} รอบ` : "");
  } catch (error) {
    note("พยากรณ์น้ำขึ้น 7 วัน (Open-Meteo Marine)", "unavailable", error.message);
  }
  let extents = {};
  try {
    const villages = await loadVillages();
    extents = buildExtents(ctx.floodFreq?.geojson?.features || [], villages);
    note("แปลงน้ำท่วมซ้ำ → หมู่บ้าน", "ok", `${Object.keys(extents).length} ตำบล`);
  } catch (error) {
    note("แปลงน้ำท่วมซ้ำ → หมู่บ้าน", "unavailable", error.message);
  }

  const today = bangkokDate(now);
  const dates = Array.from({ length: 7 }, (_, i) => bangkokDate(now + i * 864e5));
  // น้ำทะเลรายวัน: สถานะสูงสุดของรอบน้ำขึ้นในวันนั้น
  const seaByDate = {};
  const highsByDate = {};
  for (const high of tide?.upcoming_highs || []) {
    const date = bangkokDate(Date.parse(high.at));
    seaByDate[date] = worseSea(seaByDate[date] || "normal", high.status);
    highsByDate[date] = [...(highsByDate[date] || []), high];
  }
  seaByDate[today] = worseSea(seaByDate[today] || "normal", ctx.seaStatusKey || "normal");

  const stations = (ctx.waterStations || []).filter((s) => Number.isFinite(s.lat) && Number.isFinite(s.lng));
  const outlookByStation = new Map((ctx.riverOutlook || []).map((o) => [o.station, o]));

  const areas = tambons.map((t, index) => {
    const base = assessed.get(t.key);
    const nearStations = stations.filter((s) => t.centroid && distanceKm(t.centroid, { lat: s.lat, lng: s.lng }) <= RIVER_RADIUS_KM);
    // ริมคลอง/ที่ราบน้ำท่วมถึง: มีสถานีวัดระดับน้ำในรัศมี 10 กม. หรือดาวเทียมพบน้ำท่วม ≥ 2 ปี หรือ EOC เคยบันทึกน้ำท่วม
    const history = base?.flood_history || {};
    const riverine = nearStations.length > 0 || history.max_freq >= 2 || history.eoc_years >= 1;
    const coastal = Boolean(base?.coastal);
    // ฝนรายวันจากแบบจำลอง
    const rainHours = hourly?.[index] || [];
    const daily = {};
    for (const h of rainHours) {
      const d = bangkokDate(h.t);
      daily[d] = (daily[d] || 0) + h.mm;
    }
    const gauge = ctx.rainByTambon?.get(t.key) || 0;
    const nowState = nearStations.reduce((worst, s) => {
      const diff = Number(s.bankDiff);
      const state = !Number.isFinite(diff) ? "normal" : diff >= 0 ? "overflow" : diff > -0.5 ? "near" : "normal";
      return worseCanal(worst, state);
    }, "normal");
    const days = dates.map((date, i) => {
      const prev = (k) => daily[bangkokDate(Date.parse(`${date}T12:00:00+07:00`) - k * 864e5)] || 0;
      const rain24 = i === 0 ? Math.max(daily[date] || 0, gauge) : daily[date] || 0;
      const rain72 = rain24 + prev(1) + prev(2);
      let canal = i <= 1 ? nowState : "normal";
      for (const s of nearStations) {
        const level = outlookByStation.get(s.name)?.by_date?.[date];
        if (level === "very_high") canal = worseCanal(canal, "very_high");
        else if (level === "high") canal = worseCanal(canal, "high");
      }
      const dayStart = Date.parse(`${date}T00:00:00+07:00`);
      const dayRain = rainHours.filter((h) => h.t >= dayStart && h.t < dayStart + 864e5);
      return { date, rain24, rain72, canal, sea: seaByDate[date] || "normal", compoundTiming: rainAtHighTide(dayRain, highsByDate[date] || []) };
    });
    const area = {
      key: t.key,
      district: t.district,
      tambon: t.tambon,
      coastal,
      riverine,
      susceptibility: base?.susceptibility?.score || 0,
      extent: extents[t.key] || null
    };
    return { ...area, forecast: forecastArea(area, days, ctx.calibration) };
  });

  const counts = dates.map((date, i) => Object.fromEntries(FORECAST_LEVELS.map((level) => [level, areas.filter((a) => a.forecast.days[i]?.level === level).length])));
  const seaHighs = (tide?.upcoming_highs || []).map((h) => ({ ...h, date: bangkokDate(Date.parse(h.at)) }));
  return {
    dates,
    counts,
    calibration: ctx.calibration || null,
    sea_by_date: seaByDate,
    sea_highs: seaHighs,
    rain_by_date: Object.fromEntries(dates.map((date, i) => [date, Math.round(Math.max(...areas.map((a) => a.forecast.days[i]?.rain24 || 0)))])),
    areas
  };
}

