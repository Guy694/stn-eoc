// รวบรวมข้อมูลทุกแหล่งเป็นรายตำบล แล้วประเมินด้วย lib/areaRisk — ฝั่งเซิร์ฟเวอร์เท่านั้น
// แหล่งไหนล่ม/ยังไม่ได้ migrate: ข้ามแหล่งนั้น และบอกในรายการ sources ว่าไม่มีข้อมูล (ไม่ล้มทั้งการวิเคราะห์)
import { query } from "@/lib/db";
import { areaKey, floodLevelRank, normalizeAreaName, rankAreas } from "@/lib/areaRisk";
import { simplifyGeometry } from "@/lib/floodFreq";
import { getFloodFreqData } from "@/lib/gistdaFloodFreqClient";
import { geometryBounds } from "@/lib/geoSample";
import { COASTAL_DISTRICTS, seaRiskStatus, waterStatus } from "@/lib/forecastSignals";
import { getSeaLevelPayload } from "@/lib/seaLevelClient";
import { getTerrainProfiles } from "@/lib/terrainProfile";
import { getSatunRainfall, getSatunWaterLevels } from "@/lib/thaiWaterClient";
import { isStale } from "@/lib/thaiWater";
import { WATER_LEVELS, waterLevelMeta } from "@/lib/waterReport";
import { getWeatherWatchPayload } from "@/lib/weatherWatch";
import { buildFloodForecast } from "@/lib/floodForecastData";
import { getFloodCalibration } from "@/lib/floodCalibration";

const CACHE_MS = 5 * 60 * 1000;
let cache = null;
let inflight = null;

async function source(name, promise, sources, describe = () => "") {
  const started = Date.now();
  try {
    const value = await promise;
    sources.push({ name, status: "ok", detail: describe(value), ms: Date.now() - started });
    return value;
  } catch (error) {
    sources.push({ name, status: "unavailable", detail: String(error?.message || error).slice(0, 160) });
    return null;
  }
}

const parseJson = (value) => (typeof value === "string" ? JSON.parse(value) : Buffer.isBuffer(value) ? JSON.parse(value.toString("utf8")) : value);
const groupMax = (list, keyOf, valueOf) => {
  const map = new Map();
  for (const item of list) {
    const key = keyOf(item);
    if (!map.has(key) || valueOf(item) > valueOf(map.get(key))) map.set(key, item);
  }
  return map;
};

async function build() {
  const sources = [];
  const now = Date.now();

  const tambonRows = await query(
    `SELECT tam_name, dis_name, ST_AsGeoJSON(geometry) AS geometry FROM tambons_polygon WHERE pro_name LIKE '%สตูล%' ORDER BY dis_name, tam_name`
  );
  const tambons = tambonRows.map((row) => {
    const geometry = parseJson(row.geometry);
    const bounds = geometryBounds(geometry);
    return {
      key: areaKey(row.dis_name, row.tam_name),
      district: normalizeAreaName(row.dis_name),
      tambon: normalizeAreaName(row.tam_name),
      geometry,
      centroid: bounds ? { lat: (bounds.minY + bounds.maxY) / 2, lng: (bounds.minX + bounds.maxX) / 2 } : null
    };
  });
  if (!tambons.length) throw new Error("ไม่มีขอบเขตตำบลในฐานข้อมูล (tambons_polygon)");

  const [weather, floodFreq, sea, rainfall, waterLevels, terrain, households, history, active, vulnerable, registry, shelters, reports] = await Promise.all([
    source("ความเสี่ยงรายอำเภอ (ThaiWater + ECMWF + GloFAS)", getWeatherWatchPayload(), sources, (v) => `${v?.district_weather?.length || 0} อำเภอ`),
    source("สถิติน้ำท่วมจากดาวเทียม (GISTDA 2554–2567)", getFloodFreqData(), sources, (v) => `${v?.tambon_summary?.length || 0} ตำบลที่เคยท่วม`),
    source("ระดับน้ำทะเล (IOC ลังกาวี)", getSeaLevelPayload(), sources, (v) => v?.status?.label || ""),
    source("ฝนวัดจริง (ThaiWater)", getSatunRainfall(), sources, (v) => `${v?.stations?.length || 0} สถานี`),
    source("ระดับน้ำในคลอง (ThaiWater)", getSatunWaterLevels(), sources, (v) => `${v?.stations?.length || 0} สถานี`),
    source("ความสูงพื้นที่ (SRTM / AWS Terrain)", getTerrainProfiles(tambons.map(({ key, geometry }) => ({ key, geometry }))), sources, (v) => `${Object.keys(v || {}).length} ตำบล`),
    source("ครัวเรือนรายหมู่บ้าน (satun_village_polygon)", query(
      `SELECT distname, subdistnam, COUNT(*) AS villages, COALESCE(SUM(num_hh), 0) AS households, COALESCE(SUM(num_build), 0) AS buildings
       FROM satun_village_polygon GROUP BY distname, subdistnam`
    ), sources, (v) => `${v?.length || 0} ตำบล`),
    source("บันทึกน้ำท่วมย้อนหลังของ EOC", query(
      `SELECT district, tambon, COUNT(DISTINCT year) AS years, COUNT(*) AS records, GROUP_CONCAT(DISTINCT flood_level) AS levels
       FROM flood_records WHERE flood_level IS NULL OR flood_level <> 'ไม่มี' GROUP BY district, tambon`
    ), sources, (v) => `${v?.length || 0} ตำบล`),
    source("น้ำท่วมในเหตุการณ์ที่เปิดอยู่", query(
      `SELECT r.district, r.tambon, COUNT(*) AS records, GROUP_CONCAT(DISTINCT r.flood_level) AS levels
       FROM flood_records r JOIN eoc_sessions s ON s.id = r.session_id
       WHERE s.status = 'active' AND (r.flood_level IS NULL OR r.flood_level <> 'ไม่มี') GROUP BY r.district, r.tambon`
    ), sources, (v) => `${v?.length || 0} ตำบล`),
    source("ทะเบียนกลุ่มเปราะบาง (ยอดรายหมู่บ้าน)", query(
      `SELECT district, tambon,
              SUM(COALESCE(elderly,0) + COALESCE(children,0) + COALESCE(disabled,0) + COALESCE(bedridden,0) + COALESCE(pregnant,0) + COALESCE(chronic_illness,0)) AS total,
              SUM(COALESCE(bedridden,0) + COALESCE(disabled,0) + COALESCE(pregnant,0)) AS priority
       FROM vulnerable_group_baselines GROUP BY district, tambon`
    ), sources, (v) => `${v?.length || 0} พื้นที่`),
    source("ทะเบียนกลุ่มเปราะบางรายบุคคล", query(
      `SELECT district, tambon, COUNT(*) AS persons, SUM(vulnerable_type IN ('bedridden','disabled','pregnant')) AS priority
       FROM vulnerable_persons WHERE is_active = 1 GROUP BY district, tambon`
    ), sources, (v) => `${v?.reduce((sum, row) => sum + Number(row.persons || 0), 0) || 0} คน`),
    source("ศูนย์พักพิง (อุทกภัย)", query(
      `SELECT sheltername, tambon, district_name, shelter_capacity, current_occupancy_total FROM shelter_centers WHERE is_active = 1 AND eoc_type = 'flood'`
    ), sources, (v) => `${v?.length || 0} แห่ง`),
    source("รายงานน้ำจากประชาชน (เผยแพร่แล้ว)", query(
      `SELECT district, sub_district, water_level FROM public_incident_reports
       WHERE publish_status = 'published' AND merged_into_id IS NULL AND (expires_at IS NULL OR expires_at > NOW())
         AND report_type IN ('traffic_report','problem_point') AND (problem_category = 'flood' OR water_level IS NOT NULL)`
    ), sources, (v) => `${v?.length || 0} จุด`)
  ]);

  // --- จัดกลุ่มรายตำบล ---
  const byKey = (district, tambon) => areaKey(district, tambon);
  const hhMap = new Map((households || []).map((row) => [byKey(row.distname, row.subdistnam), row]));
  const gistdaMap = new Map((floodFreq?.tambon_summary || []).map((row) => [byKey(row.district, row.tambon), row]));
  const historyMap = new Map((history || []).map((row) => [byKey(row.district, row.tambon), row]));
  const activeMap = new Map((active || []).map((row) => [byKey(row.district, row.tambon), row]));
  const vulnMap = new Map();
  for (const row of vulnerable || []) {
    const key = byKey(row.district, row.tambon);
    const current = vulnMap.get(key) || { total: 0, priority: 0 };
    current.total += Number(row.total || 0);
    current.priority += Number(row.priority || 0);
    vulnMap.set(key, current);
  }
  const registryMap = new Map((registry || []).map((row) => [byKey(row.district, row.tambon), { persons: Number(row.persons || 0), priority: Number(row.priority || 0) }]));
  const shelterMap = new Map();
  for (const row of shelters || []) {
    const key = byKey(row.district_name, row.tambon);
    const list = shelterMap.get(key) || [];
    list.push({ name: row.sheltername, capacity: Number(row.shelter_capacity || 0), vacancy: Math.max(0, Number(row.shelter_capacity || 0) - Number(row.current_occupancy_total || 0)) });
    shelterMap.set(key, list);
  }
  const reportMap = new Map();
  for (const row of reports || []) {
    const key = byKey(row.district, row.sub_district);
    const rank = WATER_LEVELS.findIndex((level) => level.value === row.water_level);
    const current = reportMap.get(key) || { count: 0, max_rank: -1, max_label: null };
    current.count += 1;
    if (rank > current.max_rank) {
      current.max_rank = rank;
      current.max_label = waterLevelMeta(row.water_level)?.short || null;
    }
    reportMap.set(key, current);
  }
  const freshRain = (rainfall?.stations || []).filter((station) => station.tambon && !isStale(station.observedAt, now));
  const rainMap = groupMax(freshRain, (station) => byKey(station.amphoe, station.tambon), (station) => Number(station.rain24h || 0));
  const freshWater = (waterLevels?.stations || []).filter((station) => station.tambon && !isStale(station.observedAt, now));
  const waterGroups = new Map();
  for (const station of freshWater) {
    const key = byKey(station.amphoe, station.tambon);
    waterGroups.set(key, [...(waterGroups.get(key) || []), station]);
  }
  const districtWeather = new Map((weather?.district_weather || []).map((row) => [normalizeAreaName(row.district_name), row]));
  const seaRisk = seaRiskStatus(sea, now);

  const areas = tambons.map((t) => {
    const hh = hhMap.get(t.key);
    const g = gistdaMap.get(t.key);
    const h = historyMap.get(t.key);
    const a = activeMap.get(t.key);
    const dw = districtWeather.get(t.district);
    const rain = rainMap.get(t.key);
    const water = waterStatus(waterGroups.get(t.key) || []);
    const terrainProfile = terrain?.[t.key] || null;
    const vuln = vulnMap.get(t.key) || null;
    const reg = registryMap.get(t.key) || null;
    const maxLevel = (levels) => String(levels || "").split(",").sort((x, y) => floodLevelRank(y) - floodLevelRank(x))[0] || null;
    // ติดทะเล: จาก DEM ถ้ามี ไม่งั้นใช้รายชื่ออำเภอติดทะเล
    const coastal = terrainProfile ? terrainProfile.coastal : COASTAL_DISTRICTS.has(t.district);
    return {
      key: t.key,
      district: t.district,
      tambon: t.tambon,
      centroid: t.centroid,
      households: hh ? Number(hh.households) : 0,
      villages: hh ? Number(hh.villages) : 0,
      terrain: terrainProfile,
      gistda: g ? { total_rai: g.total_rai, repeated_rai: g.repeated_rai, max_freq: g.max_freq } : (floodFreq ? { total_rai: 0, repeated_rai: 0, max_freq: 0 } : null),
      eoc_history: h ? { years: Number(h.years || 0), records: Number(h.records || 0), max_level: maxLevel(h.levels) } : (history ? { years: 0 } : null),
      active_flood: a ? { records: Number(a.records || 0), max_level: maxLevel(a.levels) } : null,
      // ใช้ยอดจากทะเบียนกลาง ถ้าทะเบียนรายบุคคลมีจำนวนมากกว่า ใช้ตัวที่มากกว่า
      vulnerable: vuln || reg ? { total: Math.max(vuln?.total || 0, reg?.persons || 0), priority: Math.max(vuln?.priority || 0, reg?.priority || 0), registry_persons: reg?.persons || 0 } : null,
      district_weather: dw ? { risk_level: dw.risk_level, risk_score: dw.risk_score, top_reason: (dw.risk_reasons || [])[0] || null } : null,
      rain_gauge: rain ? { station: rain.name, rain24h: Math.round(Number(rain.rain24h || 0)) } : null,
      water_station: water && water.state !== "normal" ? water : null,
      sea: coastal && seaRisk && seaRisk.key !== "normal" ? seaRisk : null,
      citizen_reports: reportMap.get(t.key) || null,
      shelters: shelterMap.get(t.key) || []
    };
  });

  const ranked = rankAreas(areas);

  // พยากรณ์จุดเสี่ยง 7 วัน (ใช้ความเปราะบางจากการวิเคราะห์ด้านบน)
  let forecast = null;
  try {
    forecast = await buildFloodForecast({
      tambons,
      assessed: new Map(ranked.areas.map((area) => [area.key, area])),
      waterStations: waterLevels?.stations || [],
      riverOutlook: weather?.river_outlook || [],
      rainByTambon: new Map([...rainMap.entries()].map(([key, station]) => [key, Number(station.rain24h || 0)])),
      floodFreq,
      seaStatusKey: sea?.status?.key || "normal",
      calibration: await getFloodCalibration().catch(() => null),
      now
    }, sources);
  } catch (error) {
    sources.push({ name: "พยากรณ์จุดเสี่ยง 7 วัน", status: "unavailable", detail: error.message });
  }
  const geometry = {
    type: "FeatureCollection",
    features: tambons.map((t) => ({ type: "Feature", properties: { key: t.key }, geometry: simplifyGeometry(t.geometry, { tolerance: 0.0006, digits: 5 }) })).filter((f) => f.geometry)
  };
  return {
    generated_at: new Date(now).toISOString(),
    model_version: "area-risk-2026-10",
    sea: sea ? { status: sea.status, level: sea.level, observed_at: sea.observed_at, risk: seaRisk } : null,
    ...ranked,
    forecast,
    sources,
    geometry
  };
}

export async function getAreaRiskPayload() {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.value;
  if (!inflight) {
    inflight = build()
      .then((value) => {
        cache = { at: Date.now(), value };
        return value;
      })
      .finally(() => { inflight = null; });
  }
  return inflight;
}

/** ล้างแคช (หลังเปลี่ยนเกณฑ์ที่ปรับเทียบแล้ว ให้พยากรณ์ใช้เกณฑ์ใหม่ทันที) */
export function clearAreaRiskCache() {
  cache = null;
}
