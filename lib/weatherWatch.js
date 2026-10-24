import { query } from "@/lib/db";
import { RISK_LEVELS, RISK_META } from "@/lib/weatherRiskConfig";
import { getSatunRainfall, getSatunWaterLevels } from "@/lib/thaiWaterClient";
import { isStale } from "@/lib/thaiWater";
import { rainThresholdsFromEnv } from "@/lib/waterAlerts";
import { isRainStale, normalizeDistrictName, pickDistrictRain, summarizeRainByDistrict } from "@/lib/thaiWaterRain";
import {
  COASTAL_DISTRICTS,
  seaRiskStatus,
  EXTREME_RAIN_MM,
  assessDistrictRisk,
  assessForecastDay,
  dischargeOutlook,
  ensembleRainDays,
  pickHiiMedia,
  rainNow,
  rainNowText,
  satunWarnings,
  waterStatus
} from "@/lib/forecastSignals";
import { getEnsembleRain, getEnsembleRainHourly, getHiiMain, getHiiWarnings, getRiverClimatology, getRiverForecast } from "@/lib/forecastClient";
import { bangkokText, blendTodayHeavyRain, districtRainToday } from "@/lib/rainNowcast";
import { getSeaLevelPayload } from "@/lib/seaLevelClient";

export { RISK_LEVELS, RISK_META };

const OPEN_METEO_URL = "https://api.open-meteo.com/v1/forecast";
const OPEN_METEO_MARINE_URL = "https://marine-api.open-meteo.com/v1/marine";
// จุดตัวแทนทะเลเปิดบนเส้นทางเรือไปเกาะหลีเป๊ะ (จุดใกล้ฝั่งกว่านี้ถูกเกาะบังคลื่น ค่าต่ำกว่าความจริง)
const SATUN_SEA_POINT = { latitude: 6.5, longitude: 99.3, label: "ทะเลบริเวณเกาะหลีเป๊ะ–ตะรุเตา" };
const THUNDER_CODES = new Set([95, 96, 99]);
// แบบจำลองพยากรณ์รายชั่วโมง/รายวัน: ECMWF IFS ความละเอียด ~9 กม. (เดิมให้ Open-Meteo เลือกเอง)
const FORECAST_MODEL = "ecmwf_ifs";

const WEATHER_MAP_LAYERS = [
  { layer_id: "district_boundary", layer_name: "ขอบเขตอำเภอ", layer_type: "polygon", is_visible: true, source: "database:satun_village_polygon" },
  { layer_id: "current_weather", layer_name: "สภาพอากาศปัจจุบัน", layer_type: "marker", is_visible: true, source: "ThaiWater + ECMWF" },
  { layer_id: "current_rain", layer_name: "ฝนปัจจุบัน", layer_type: "circle", is_visible: true, source: "ThaiWater" },
  { layer_id: "rain_24h", layer_name: "ฝนสะสม 24 ชั่วโมง", layer_type: "polygon", is_visible: true, source: "ThaiWater" },
  { layer_id: "rain_forecast_3h", layer_name: "พยากรณ์ฝน 3 ชั่วโมง", layer_type: "circle", is_visible: false, source: "ECMWF (Open-Meteo)" },
  { layer_id: "rain_forecast_24h", layer_name: "พยากรณ์ฝน 24 ชั่วโมง", layer_type: "circle", is_visible: false, source: "ECMWF (Open-Meteo)" },
  { layer_id: "wind_speed", layer_name: "ความเร็วลม", layer_type: "marker", is_visible: false, source: "ECMWF (Open-Meteo)" },
  { layer_id: "wind_direction", layer_name: "ทิศทางลม", layer_type: "marker", is_visible: false, source: "ECMWF (Open-Meteo)" }
];

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, Number(value) || 0));
}

function average(values) {
  const usable = values.filter((value) => typeof value === "number" && Number.isFinite(value));
  if (usable.length === 0) return null;
  return Number((usable.reduce((sum, value) => sum + value, 0) / usable.length).toFixed(1));
}

function max(values) {
  const usable = values.filter((value) => typeof value === "number" && Number.isFinite(value));
  return usable.length ? Math.max(...usable) : null;
}

function toBangkokIso(value) {
  if (!value) return null;
  if (typeof value === "string") return value.includes("+") ? value : `${value}:00+07:00`;
  const shifted = new Date(value.getTime() + 7 * 60 * 60 * 1000);
  return `${shifted.toISOString().slice(0, 19)}+07:00`;
}

function directionText(degrees) {
  if (degrees === null || degrees === undefined) return "-";
  const directions = ["เหนือ", "ตะวันออกเฉียงเหนือ", "ตะวันออก", "ตะวันออกเฉียงใต้", "ใต้", "ตะวันตกเฉียงใต้", "ตะวันตก", "ตะวันตกเฉียงเหนือ"];
  return directions[Math.round((((degrees % 360) + 360) % 360) / 45) % 8];
}

function weatherCondition(code) {
  const map = {
    0: "ท้องฟ้าแจ่มใส",
    1: "มีเมฆบางส่วน",
    2: "มีเมฆเป็นส่วนมาก",
    3: "มีเมฆมาก",
    45: "หมอก",
    48: "หมอกน้ำค้างแข็ง",
    51: "ฝนละอองเล็กน้อย",
    53: "ฝนละออง",
    55: "ฝนละอองหนัก",
    61: "ฝนตกเล็กน้อย",
    63: "ฝนตก",
    65: "ฝนตกหนัก",
    80: "ฝนโปรย",
    81: "ฝนตกเป็นช่วง",
    82: "ฝนตกหนักเป็นช่วง",
    95: "ฝนฟ้าคะนอง",
    96: "ฝนฟ้าคะนองกับลูกเห็บ",
    99: "พายุฝนฟ้าคะนองรุนแรง"
  };
  return map[code] || "ไม่มีรายละเอียดสภาพอากาศ";
}

async function loadDistrictWeatherProfiles() {
  const riskTable = await query(`
    SELECT COUNT(*) AS count
    FROM INFORMATION_SCHEMA.TABLES
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'area_risk_profiles'
  `);
  const hasRiskProfiles = Number(riskTable[0]?.count || 0) > 0;
  const riskJoin = hasRiskProfiles
    ? `LEFT JOIN (
         SELECT profile.district_name, profile.susceptibility_score, profile.model_version
         FROM area_risk_profiles profile
         JOIN (
           SELECT district_name, MAX(source_updated_at) AS source_updated_at
           FROM area_risk_profiles
           WHERE hazard_type = 'weather_flood'
           GROUP BY district_name
         ) latest ON latest.district_name = profile.district_name
                  AND latest.source_updated_at <=> profile.source_updated_at
         WHERE profile.hazard_type = 'weather_flood'
       ) risk ON CONVERT(risk.district_name USING utf8mb4) COLLATE utf8mb4_unicode_ci
                = CONVERT(svp.distname USING utf8mb4) COLLATE utf8mb4_unicode_ci`
    : "";
  return query(`
    SELECT MIN(svp.id) AS district_id, svp.distname AS district_name,
           AVG(CASE
             WHEN ABS(ST_X(ST_Centroid(ST_GeomFromWKB(ST_AsWKB(svp.geom), 0)))) <= 90
             THEN ST_X(ST_Centroid(ST_GeomFromWKB(ST_AsWKB(svp.geom), 0)))
             ELSE ST_Y(ST_Centroid(ST_GeomFromWKB(ST_AsWKB(svp.geom), 0)))
           END) AS latitude,
           AVG(CASE
             WHEN ABS(ST_X(ST_Centroid(ST_GeomFromWKB(ST_AsWKB(svp.geom), 0)))) <= 90
             THEN ST_Y(ST_Centroid(ST_GeomFromWKB(ST_AsWKB(svp.geom), 0)))
             ELSE ST_X(ST_Centroid(ST_GeomFromWKB(ST_AsWKB(svp.geom), 0)))
           END) AS longitude,
           ${hasRiskProfiles ? "MAX(risk.susceptibility_score)" : "NULL"} AS susceptibility_score,
           ${hasRiskProfiles ? "MAX(risk.model_version)" : "NULL"} AS risk_model_version
    FROM satun_village_polygon svp
    ${riskJoin}
    WHERE svp.geom IS NOT NULL
    GROUP BY svp.distname
    ORDER BY svp.distname
  `);
}

function openMeteoUrl(districts) {
  const params = new URLSearchParams({
    latitude: districts.map((district) => district.latitude).join(","),
    longitude: districts.map((district) => district.longitude).join(","),
    models: FORECAST_MODEL,
    timezone: "Asia/Bangkok",
    past_hours: "24",
    forecast_days: "7",
    current: [
      "temperature_2m",
      "relative_humidity_2m",
      "precipitation",
      "rain",
      "weather_code",
      "pressure_msl",
      "wind_speed_10m",
      "wind_direction_10m"
    ].join(","),
    hourly: [
      "temperature_2m",
      "relative_humidity_2m",
      "precipitation",
      "precipitation_probability",
      "weather_code",
      "pressure_msl",
      "wind_speed_10m",
      "wind_direction_10m"
    ].join(","),
    daily: [
      "weather_code",
      "temperature_2m_max",
      "temperature_2m_min",
      "precipitation_sum",
      "precipitation_probability_max",
      "wind_speed_10m_max"
    ].join(",")
  });

  return `${OPEN_METEO_URL}?${params.toString()}`;
}

async function fetchAllDistrictWeather(districts) {
  const response = await fetch(openMeteoUrl(districts), {
    cache: "no-store",
    headers: { accept: "application/json" }
  });

  if (!response.ok) {
    throw new Error(`Open-Meteo ECMWF: ${response.status}`);
  }

  const payload = await response.json();
  const payloads = Array.isArray(payload) ? payload : [payload];
  if (payloads.length === 0 || payloads.some((item) => !item?.current || !item?.hourly || !item?.daily)) {
    throw new Error("Open-Meteo: missing weather payload");
  }

  return districts.map((district, index) => ({
    district,
    payload: payloads[index] || payloads[0]
  }));
}

function hourlyAt(payload, index, field) {
  const values = payload.hourly?.[field] || [];
  return values[index];
}

function currentHourIndex(payload) {
  const currentTime = payload.current?.time;
  const times = payload.hourly?.time || [];
  if (!currentTime || times.length === 0) return -1;
  const exact = times.findIndex((time) => time === currentTime.slice(0, 13) + ":00");
  if (exact >= 0) return exact;

  const currentDate = new Date(`${currentTime}:00+07:00`);
  if (Number.isNaN(currentDate.getTime())) return times.length - 1;
  let nearest = -1;
  for (let index = 0; index < times.length; index += 1) {
    const itemDate = new Date(`${times[index]}:00+07:00`);
    if (!Number.isNaN(itemDate.getTime()) && itemDate <= currentDate) nearest = index;
  }
  return nearest;
}

function sumHourlyPrecipitation(payload, currentIndex, hours) {
  const values = payload.hourly?.precipitation || [];
  if (currentIndex < 0) return 0;
  const start = Math.max(0, currentIndex - hours + 1);
  return Number(values.slice(start, currentIndex + 1).reduce((sum, value) => sum + Number(value || 0), 0).toFixed(1));
}

// ฝนรายชั่วโมงเป็นค่าจากแบบจำลอง ใช้บอกช่วงเวลาที่ฝนน่าจะตก (ไม่ใช้คิดระดับความเสี่ยงของอำเภอ)
function hourlyRainLevel(rainfall) {
  if (rainfall >= 20) return "high";
  if (rainfall >= 10) return "watch";
  return "normal";
}

function nextHourlyForecast(payload, currentIndex, stepHours = 3, limit = 8) {
  const times = payload.hourly?.time || [];
  const result = [];
  for (let index = Math.max(currentIndex + 1, 0); index < times.length && result.length < limit; index += stepHours) {
    // รวมฝนทั้งช่วง 3 ชม. (เดิมใช้แค่ชั่วโมงแรกของช่วง)
    const rainfall = Number(times.slice(index, index + stepHours)
      .reduce((sum, _, offset) => sum + Number(hourlyAt(payload, index + offset, "precipitation") || 0), 0)
      .toFixed(1));
    const probability = Number(hourlyAt(payload, index, "precipitation_probability") || 0);
    const wind = Number(hourlyAt(payload, index, "wind_speed_10m") || 0);
    result.push({
      forecast_datetime: toBangkokIso(times[index]),
      period: "hourly",
      weather_condition: weatherCondition(hourlyAt(payload, index, "weather_code")),
      temperature_min: Math.round(Number(hourlyAt(payload, index, "temperature_2m") || 0)),
      temperature_max: Math.round(Number(hourlyAt(payload, index, "temperature_2m") || 0)),
      rain_probability: probability,
      rainfall_forecast: rainfall,
      wind_speed: Math.round(wind),
      risk_level: hourlyRainLevel(rainfall)
    });
  }
  return result;
}

function dailyForecast(payload, { ensembleDays = [], dischargeByDate = {}, susceptibility = 0 } = {}) {
  const daily = payload.daily || {};
  return (daily.time || []).map((time, index) => {
    const rainfall = Number(daily.precipitation_sum?.[index] || 0);
    const probability = Number(daily.precipitation_probability_max?.[index] || 0);
    const wind = Number(daily.wind_speed_10m_max?.[index] || 0);
    const ensembleDay = ensembleDays.find((item) => item.date === time) || null;
    const dischargeLevelOfDay = dischargeByDate[time] || "normal";
    const risk = assessForecastDay({ ensembleDay, dischargeLevelOfDay, windSpeed: wind, susceptibility });

    return {
      forecast_datetime: `${time}T12:00:00+07:00`,
      period: index === 0 ? "24h" : index <= 2 ? "3d" : "7d",
      weather_condition: weatherCondition(daily.weather_code?.[index]),
      temperature_min: Math.round(Number(daily.temperature_2m_min?.[index] || 0)),
      temperature_max: Math.round(Number(daily.temperature_2m_max?.[index] || 0)),
      rain_probability: probability,
      rainfall_forecast: rainfall,
      // จาก ECMWF Ensemble 51 ชุด: ฝนที่น่าจะเป็น (มัธยฐาน) / กรณีฝนมาก (P90) / โอกาสเกินเกณฑ์
      rainfall_median: ensembleDay?.median_mm ?? null,
      rainfall_p90: ensembleDay?.p90_mm ?? null,
      prob_heavy: ensembleDay?.prob_heavy ?? null,
      prob_very_heavy: ensembleDay?.prob_very_heavy ?? null,
      river_level: dischargeLevelOfDay,
      wind_speed: Math.round(wind),
      risk_level: risk.risk_level
    };
  });
}

function buildTimeline(selectedDate) {
  const base = selectedDate ? new Date(`${selectedDate}T00:00:00+07:00`) : new Date();
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(base);
    date.setDate(date.getDate() + index - 3);
    return {
      date: date.toISOString().slice(0, 10),
      label: date.toLocaleDateString("th-TH", { day: "numeric", month: "short" }),
      is_today: date.toISOString().slice(0, 10) === new Date().toISOString().slice(0, 10)
    };
  });
}

function mergeForecasts(districtPayloads) {
  const first = districtPayloads[0]?.payload;
  if (!first) return [];
  const currentIndex = currentHourIndex(first);
  return [
    ...nextHourlyForecast(first, currentIndex),
    ...dailyForecast(first)
  ];
}

function thunderInNextHours(payload, currentIndex, hours = 24) {
  const codes = payload.hourly?.weather_code || [];
  for (let index = Math.max(currentIndex, 0); index < Math.min(codes.length, currentIndex + hours + 1); index += 1) {
    if (THUNDER_CODES.has(Number(codes[index]))) return true;
  }
  return false;
}

// สภาพอากาศ "ตอนนี้": ถ้ามีสถานีวัดฝน เชื่อสถานีเรื่องฝน (แบบจำลองมักบอกฝนฟ้าคะนองทั้งที่ฝนไม่ตก)
function conditionNow(modelCode, now) {
  const modelText = weatherCondition(modelCode);
  if (!now || now.stations === 0) return { text: modelText, source: "model" };
  if (now.raining > 0) {
    const mm = now.max1h;
    return { text: mm >= 20 ? "ฝนตกหนัก" : mm >= 5 ? "ฝนตกปานกลาง" : "ฝนตกเล็กน้อย", source: "gauge" };
  }
  return { text: Number(modelCode) >= 51 ? "มีเมฆมาก" : modelText, source: "gauge" };
}

function groupBy(list, keyOf) {
  const map = new Map();
  for (const item of list || []) {
    const key = keyOf(item);
    if (!key) continue;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(item);
  }
  return map;
}

const DISCHARGE_ORDER = ["normal", "high", "very_high"];
function worstDischarge(list) {
  return (list || []).filter(Boolean).sort((a, b) => DISCHARGE_ORDER.indexOf(b.level) - DISCHARGE_ORDER.indexOf(a.level) || b.peak - a.peak)[0] || null;
}

function mergeDischargeByDate(list) {
  const result = {};
  for (const outlook of list || []) {
    for (const [date, level] of Object.entries(outlook?.by_date || {})) {
      if (!result[date] || DISCHARGE_ORDER.indexOf(level) > DISCHARGE_ORDER.indexOf(result[date])) result[date] = level;
    }
  }
  return result;
}

function buildDistrict(district, payload, context = {}) {
  const key = normalizeDistrictName(district.district_name);
  const currentIndex = currentHourIndex(payload);
  const modelRain1h = Number(payload.current?.precipitation || payload.current?.rain || sumHourlyPrecipitation(payload, currentIndex, 1) || 0);
  const modelRain24h = sumHourlyPrecipitation(payload, currentIndex, 24);
  // ฝนที่ตกไปแล้ว: ใช้ค่าวัดจริงจากสถานี ThaiWater (มีอย่างน้อย 1 สถานีที่ส่งข้อมูล) ไม่งั้นใช้ค่าประมาณจากแบบจำลอง
  const rain = pickDistrictRain({ modelRain24h, modelRain1h }, context.rainByDistrict?.get(key) || null);
  const now = rainNow(context.rainStationsByDistrict?.get(key) || [], context.now);
  const rainfall1h = now.stations > 0 ? now.max1h : Number(rain.rain1h || 0);
  const rainfall24h = Number(rain.rain24h || 0);
  const forecast24h = Number(payload.daily?.precipitation_sum?.[0] || 0);
  const probability24h = Number(payload.daily?.precipitation_probability_max?.[0] || hourlyAt(payload, currentIndex, "precipitation_probability") || 0);
  const windSpeed = Number(payload.current?.wind_speed_10m || 0);
  const forecastDays = context.ensembleByDistrict?.get(key) || [];
  // โอกาสฝนหนักวันนี้: มีสถานีวัดฝนสด → ฝนที่ตกแล้ว + พยากรณ์ชั่วโมงที่เหลือ · ไม่มี → พยากรณ์ทั้งวันเหมือนเดิม
  const rainToday = context.rainTodayByDistrict?.get(key) || null;
  const blendedToday = rainToday && forecastDays[0]?.date === context.today
    ? blendTodayHeavyRain({ observedMm: rainToday.mm, hourly: context.ensembleHourlyByDistrict?.get(key), today: context.today, now: context.now })
    : null;
  const ensembleDays = blendedToday ? [blendedToday, ...forecastDays.slice(1)] : forecastDays;
  const water = waterStatus(context.waterStationsByDistrict?.get(key) || []);
  const outlooks = context.dischargeByDistrict?.get(key) || [];
  const discharge = worstDischarge(outlooks);
  const susceptibility = Number(district.susceptibility_score || 0);
  const sea = COASTAL_DISTRICTS.has(key) ? context.seaRisk || null : null;

  const risk = assessDistrictRisk({
    observedRain24h: rainfall24h,
    observedSource: rain.source,
    maxStation: rain.gauge?.maxStation || null,
    ensembleToday: ensembleDays[0] || null,
    ensembleTomorrow: ensembleDays[1] || null,
    water,
    discharge,
    windSpeed,
    susceptibility,
    sea
  });
  const thunderExpected = thunderInNextHours(payload, currentIndex);
  const condition = conditionNow(payload.current?.weather_code, now);

  return {
    ...district,
    forecast_hourly: nextHourlyForecast(payload, currentIndex, 3, 8),
    forecast_daily: dailyForecast(payload, { ensembleDays, dischargeByDate: mergeDischargeByDate(outlooks), susceptibility }),
    thunder_expected: thunderExpected,
    risk_reasons: risk.reasons,
    temperature: Math.round(Number(payload.current?.temperature_2m || 0)),
    humidity: Math.round(Number(payload.current?.relative_humidity_2m || 0)),
    rainfall_1h: rainfall1h,
    rainfall_24h: rainfall24h,
    rain_source: rain.source,
    rain_now: now,
    rain_now_text: rainNowText(now),
    rainfall_24h_model: modelRain24h,
    rain_gauge: rain.gauge
      ? { count: rain.gauge.count, mean: rain.gauge.mean, max: rain.gauge.max, max_station: rain.gauge.maxStation, observed_at: rain.gauge.observedAt }
      : null,
    rain_probability_24h: probability24h,
    rainfall_forecast_24h: forecast24h,
    rainfall_forecast_3h: sumHourlyPrecipitation(payload, currentIndex + 3, 3),
    heavy_rain_today: ensembleDays[0] ? {
      prob_heavy: ensembleDays[0].prob_heavy, prob_very_heavy: ensembleDays[0].prob_very_heavy, median_mm: ensembleDays[0].median_mm, p90_mm: ensembleDays[0].p90_mm,
      source: blendedToday ? "gauge+forecast" : "forecast",
      observed_mm: blendedToday ? blendedToday.observed_mm : null,
      observed_station: blendedToday ? rainToday.station : null,
      observed_at: blendedToday ? rainToday.observedAt : null,
      remaining_median_mm: blendedToday ? blendedToday.remaining_median_mm : null,
      hours_left: blendedToday ? blendedToday.hours_left : null,
      forecast_prob_heavy: forecastDays[0]?.prob_heavy ?? null
    } : null,
    heavy_rain_tomorrow: ensembleDays[1] ? { prob_heavy: ensembleDays[1].prob_heavy, prob_very_heavy: ensembleDays[1].prob_very_heavy, median_mm: ensembleDays[1].median_mm, p90_mm: ensembleDays[1].p90_mm } : null,
    water_status: water,
    river_outlook: discharge,
    coastal: COASTAL_DISTRICTS.has(key),
    sea_risk: sea,
    wind_speed: Math.round(windSpeed),
    wind_direction: directionText(payload.current?.wind_direction_10m),
    pressure: Math.round(Number(payload.current?.pressure_msl || 0)),
    flood_risk: risk.risk_level,
    landslide_risk: susceptibility >= 2 && ["high", "critical"].includes(risk.risk_level) ? risk.risk_level : "normal",
    weather_condition: condition.text,
    condition_source: condition.source,
    risk_score: risk.score,
    risk_level: risk.risk_level,
    updated_at: toBangkokIso(payload.current?.time)
  };
}

function buildCharts(districts, districtPayloads) {
  const first = districtPayloads[0]?.payload?.daily;
  const rainfall7d = (first?.time || []).map((time, index) => {
    const rainfallValues = districts.map((district) => Number(district.forecast_daily?.[index]?.rainfall_median ?? district.forecast_daily?.[index]?.rainfall_forecast ?? 0));
    return {
      label: new Date(`${time}T00:00:00+07:00`).toLocaleDateString("th-TH", { day: "numeric", month: "short" }),
      rainfall: average(rainfallValues) || 0
    };
  });

  return {
    rainfall_7d: rainfall7d,
    district_rainfall: districts.map((district) => ({
      label: district.district_name,
      rainfall: district.rainfall_24h,
      risk_level: district.risk_level
    })),
    // ความเสี่ยงรายวันของจังหวัด = อำเภอที่เสี่ยงที่สุดในวันนั้น
    risk_trend: rainfall7d.map((day, index) => {
      const level = districts.reduce((worst, district) => {
        const value = district.forecast_daily?.[index]?.risk_level || "normal";
        return RISK_LEVELS.indexOf(value) > RISK_LEVELS.indexOf(worst) ? value : worst;
      }, "normal");
      return { label: day.label, score: RISK_LEVELS.indexOf(level) + 1, risk_level: level };
    })
  };
}

function buildMapPoints(districts) {
  const top3h = [...districts].sort((a, b) => b.rainfall_forecast_3h - a.rainfall_forecast_3h)[0];
  const top24h = [...districts].sort((a, b) => b.rainfall_forecast_24h - a.rainfall_forecast_24h)[0];

  return {
    rain_gauges: districts.map((district) => ({
      id: `rain-${district.district_id}`,
      name: `ข้อมูลฝน ${district.district_name}`,
      latitude: district.latitude,
      longitude: district.longitude,
      rainfall_1h: district.rainfall_1h,
      rainfall_24h: district.rainfall_24h,
      risk_level: district.risk_level
    })),
    forecast_3h: top3h ? {
      center: [top3h.latitude, top3h.longitude],
      radius: clamp(top3h.rainfall_forecast_3h, 10, 80) * 450,
      rainfall: top3h.rainfall_forecast_3h,
      district_name: top3h.district_name,
      risk_level: top3h.risk_level
    } : null,
    forecast_24h: top24h ? {
      center: [top24h.latitude, top24h.longitude],
      radius: clamp(top24h.rainfall_forecast_24h, 20, 120) * 450,
      rainfall: top24h.rainfall_forecast_24h,
      district_name: top24h.district_name,
      risk_level: top24h.risk_level
    } : null
  };
}

function safetyAdvice(worstRisk) {
  if (["high", "critical"].includes(worstRisk)) {
    return [
      "หลีกเลี่ยงพื้นที่อุทกภัยน้ำท่วมและทางน้ำไหล",
      "ไม่ขับรถผ่านถนนที่มีอุทกภัยน้ำท่วมสูง",
      "เตรียมเอกสารสำคัญ ยาประจำตัว และอุปกรณ์จำเป็น",
      "ติดตามประกาศจากหน่วยงานราชการอย่างใกล้ชิด",
      "หากพบเหตุฉุกเฉิน โทร 1669, 1784 หรือ 191"
    ];
  }

  if (worstRisk === "watch") {
    return [
      "ติดตามพยากรณ์อากาศและประกาศเตือนภัย",
      "ตรวจสอบเส้นทางก่อนเดินทางในพื้นที่ฝนตก",
      "เก็บสิ่งของสำคัญให้พ้นจากพื้นที่น้ำขัง"
    ];
  }

  return ["สภาพอากาศอยู่ในเกณฑ์ปกติ โปรดติดตามข้อมูลล่าสุดเป็นระยะ"];
}

export function waveRiskLevel(waveHeight) {
  const height = Number(waveHeight || 0);
  if (height >= 3) return "critical";
  if (height >= 2) return "high";
  if (height >= 1.5) return "watch";
  return "normal";
}

function waveAdvice(level) {
  if (level === "critical") return "คลื่นสูงมาก งดเดินเรือทุกชนิดและงดกิจกรรมทางทะเล";
  if (level === "high") return "คลื่นสูง เรือเล็กควรงดออกจากฝั่ง ผู้เดินทางไปเกาะควรตรวจสอบประกาศก่อนออกเดินทาง";
  if (level === "watch") return "คลื่นค่อนข้างแรง เรือเล็กควรเพิ่มความระมัดระวัง";
  return "คลื่นลมทะเลอยู่ในเกณฑ์ปกติ";
}

/** ความสูงคลื่นทะเลหน้าจังหวัดสตูล (Open-Meteo Marine) — คืน null ถ้า provider ไม่ตอบ */
async function fetchMarineConditions() {
  const params = new URLSearchParams({
    latitude: String(SATUN_SEA_POINT.latitude),
    longitude: String(SATUN_SEA_POINT.longitude),
    timezone: "Asia/Bangkok",
    forecast_days: "7",
    current: "wave_height,wave_direction,wave_period",
    daily: "wave_height_max"
  });
  try {
    const response = await fetch(`${OPEN_METEO_MARINE_URL}?${params.toString()}`, {
      cache: "no-store",
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(8000)
    });
    if (!response.ok) return null;
    const payload = await response.json();
    const daily = (payload.daily?.time || []).map((time, index) => {
      const height = Number(payload.daily?.wave_height_max?.[index] ?? NaN);
      return Number.isFinite(height)
        ? { date: time, wave_height_max: Number(height.toFixed(1)), risk_level: waveRiskLevel(height) }
        : null;
    }).filter(Boolean);
    const now = Number(payload.current?.wave_height ?? NaN);
    const todayMax = daily[0]?.wave_height_max ?? (Number.isFinite(now) ? now : null);
    if (todayMax === null) return null;
    const level = waveRiskLevel(Math.max(todayMax, Number.isFinite(now) ? now : 0));
    return {
      location: SATUN_SEA_POINT.label,
      wave_height: Number.isFinite(now) ? Number(now.toFixed(1)) : null,
      wave_height_max_today: todayMax,
      wave_direction: directionText(payload.current?.wave_direction),
      risk_level: level,
      advice: waveAdvice(level),
      daily,
      observed_at: toBangkokIso(payload.current?.time),
      source: "Open-Meteo Marine"
    };
  } catch (error) {
    console.error("Open-Meteo Marine error:", error?.message || error);
    return null;
  }
}

// ภายนอกล่มได้ทุกตัว — ตัวที่ไม่ตอบให้เป็น null แล้วหน้าเว็บบอกว่าไม่มีข้อมูลส่วนนั้น
async function optional(label, promise) {
  try {
    return await promise;
  } catch (error) {
    console.error(`${label} error:`, error?.message || error);
    return null;
  }
}

/** ฝนรายชั่วโมงที่เก็บไว้ตั้งแต่ 23:00 เมื่อวาน (ตาราง rain_readings) — ยังไม่ได้รัน migration → [] */
async function loadTodayRainReadings(today) {
  const from = new Date(Date.parse(`${today}T00:00:00Z`) - 3600e3).toISOString().slice(0, 19).replace("T", " ");
  try {
    return await query(
      `SELECT station_id, DATE_FORMAT(observed_at, '%Y-%m-%d %H:%i:%s') AS observed_at, rain_1h, rain_24h
         FROM rain_readings WHERE hour_at >= ? AND observed_at IS NOT NULL ORDER BY observed_at`, [from]);
  } catch (error) {
    if (error?.code === "ER_NO_SUCH_TABLE") return [];
    throw error;
  }
}

/** ฝนที่ตกแล้ววันนี้รายอำเภอ (เฉพาะสถานีที่ค่าล่าสุดยังสด) → Map(อำเภอ → { mm, station, stations, observedAt }) */
function rainTodayByDistrict(stations, history, today, now) {
  const byStation = new Map();
  for (const row of history) {
    const id = String(row.station_id);
    if (!byStation.has(id)) byStation.set(id, []);
    byStation.get(id).push({ observedAt: row.observed_at, rain1: row.rain_1h, rain24: row.rain_24h });
  }
  const groups = new Map();
  for (const station of stations) {
    if (isRainStale(station.observedAt, now)) continue;
    const key = normalizeDistrictName(station.amphoe);
    const current = { observedAt: bangkokText(station.observedAt), rain1: station.rain1h, rain24: station.rain24h };
    const readings = [...(byStation.get(String(station.id)) || []), ...(current.observedAt ? [current] : [])];
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push({ name: station.name, readings });
  }
  const result = new Map();
  for (const [key, list] of groups) {
    const value = districtRainToday(list, { today });
    if (value) result.set(key, value);
  }
  return result;
}

function todayInBangkok() {
  return new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10);
}

/** แนวโน้มน้ำในคลองรายสถานีวัดระดับน้ำ (GloFAS ที่ตำแหน่งสถานี เทียบสถิติ 20 ปีของจุดเดียวกัน) */
async function loadRiverOutlook(waterStations, today) {
  const points = (waterStations || []).map((station) => ({ latitude: station.lat, longitude: station.lng }));
  if (points.length === 0) return [];
  const [forecasts, climatology] = await Promise.all([getRiverForecast(points), getRiverClimatology(points)]);
  return waterStations.map((station, index) => {
    const outlook = dischargeOutlook(forecasts[index], climatology[index], today);
    return outlook ? { station: station.name, river: station.river || "", amphoe: station.amphoe, ...outlook } : null;
  }).filter(Boolean);
}

// เตือนจากข้อมูลวัดจริงในจังหวัด (นอกเหนือจากประกาศของ สสน.)
export function measuredWarnings(waterStations, rainStations, now) {
  const warnings = [];
  for (const station of waterStations || []) {
    const diff = Number(station.bankDiff);
    if (!Number.isFinite(diff) || diff < -0.5) continue;
    warnings.push({
      issued_at: station.observedAt,
      level: diff >= 0 ? "high" : "watch",
      message: diff >= 0
        ? `น้ำล้นตลิ่ง สถานี${station.name} อ.${station.amphoe} สูงกว่าตลิ่ง ${diff.toFixed(2)} ม.`
        : `น้ำใกล้ตลิ่ง สถานี${station.name} อ.${station.amphoe} ต่ำกว่าตลิ่ง ${Math.abs(diff).toFixed(2)} ม.`,
      source: "ThaiWater (สสน.) สถานีวัดระดับน้ำ"
    });
  }
  // ฝนหนักใช้เกณฑ์เดียวกับแจ้งเตือนเจ้าหน้าที่ (RAIN_ALERT_WATCH_MM ค่าเริ่มต้น 60 มม./24 ชม.) — เดิมเว็บประชาชนเตือนเฉพาะ ≥ 90 มม.
  const { watchMm } = rainThresholdsFromEnv();
  for (const station of rainStations || []) {
    const fresh = now - new Date(station.observedAt || 0).getTime() <= 3 * 3600 * 1000;
    if (!fresh) continue;
    if (Number(station.rain24h) >= EXTREME_RAIN_MM || Number(station.rain24h) >= watchMm || Number(station.rain1h) >= 35) {
      warnings.push({
        issued_at: station.observedAt,
        level: Number(station.rain24h) >= EXTREME_RAIN_MM ? "high" : "watch",
        message: `ฝนตกหนัก สถานี${station.name} อ.${station.amphoe} ฝน 24 ชม. ${station.rain24h} มม.${Number(station.rain1h) > 0 ? ` (1 ชม.ล่าสุด ${station.rain1h} มม.)` : ""}`,
        source: "ThaiWater (สสน.) สถานีวัดฝน"
      });
    }
  }
  return warnings;
}

// แคชผลลัพธ์ 5 นาที (หน้าแรก หน้าพยากรณ์ และน้องสจ๊วต เรียกพร้อมกันได้โดยไม่ยิงผู้ให้บริการภายนอกซ้ำ)
const PAYLOAD_CACHE_MS = 5 * 60 * 1000;
let payloadCache = null;
let payloadInflight = null;

export async function getWeatherWatchPayload({ date } = {}) {
  const today = todayInBangkok();
  if (date && date !== today) return buildWeatherWatchPayload({ date });
  if (payloadCache && Date.now() - payloadCache.at < PAYLOAD_CACHE_MS) return payloadCache.value;
  if (!payloadInflight) {
    payloadInflight = buildWeatherWatchPayload({ date })
      .then((value) => {
        payloadCache = { value, at: Date.now() };
        return value;
      })
      .finally(() => { payloadInflight = null; });
  }
  return payloadInflight;
}

async function buildWeatherWatchPayload({ date } = {}) {
  const selectedDate = date || new Date().toISOString().slice(0, 10);
  const today = todayInBangkok();
  const now = Date.now();
  const districtProfiles = await loadDistrictWeatherProfiles();
  if (!districtProfiles.length) throw new Error("No district geography in database");
  const points = districtProfiles.map((district) => ({ latitude: district.latitude, longitude: district.longitude }));

  const isToday = selectedDate === today;
  const [districtPayloads, marine, rainfall, waterLevels, ensemble, hiiMain, hiiWarnings, seaLevel, ensembleHourly, rainHistory] = await Promise.all([
    fetchAllDistrictWeather(districtProfiles),
    fetchMarineConditions(),
    optional("ThaiWater rainfall", getSatunRainfall()),
    optional("ThaiWater water level", getSatunWaterLevels()),
    optional("ECMWF ensemble", getEnsembleRain(points)),
    optional("ThaiWater media", getHiiMain()),
    optional("ThaiWater warning", getHiiWarnings()),
    optional("IOC sea level", getSeaLevelPayload()),
    isToday ? optional("ECMWF ensemble hourly", getEnsembleRainHourly(points)) : null,
    isToday ? optional("rain history", loadTodayRainReadings(today)) : null
  ]);
  const waterStations = waterLevels?.stations || [];
  // ระดับน้ำที่ไม่อัปเดตเกิน 3 ชม. ไม่ใช้คิดความเสี่ยง/เตือน (กันสถานีค้างค่าเก่า)
  const freshWaterStations = waterStations.filter((station) => !isStale(station.observedAt, now));
  const rainStations = rainfall?.stations || [];
  const riverOutlook = await optional("GloFAS", loadRiverOutlook(waterStations, today)) || [];

  const byDistrictName = (item) => normalizeDistrictName(item.amphoe);
  const context = {
    now,
    seaRisk: seaRiskStatus(seaLevel, now),
    rainByDistrict: rainfall ? summarizeRainByDistrict(rainStations) : null,
    rainStationsByDistrict: groupBy(rainStations, byDistrictName),
    waterStationsByDistrict: groupBy(freshWaterStations, byDistrictName),
    dischargeByDistrict: groupBy(riverOutlook, byDistrictName),
    today,
    rainTodayByDistrict: isToday && rainfall ? rainTodayByDistrict(rainStations, rainHistory || [], today, now) : null,
    ensembleHourlyByDistrict: new Map(districtProfiles.map((district, index) => [normalizeDistrictName(district.district_name), ensembleHourly?.[index] || null])),
    ensembleByDistrict: new Map(districtProfiles.map((district, index) => [
      normalizeDistrictName(district.district_name),
      ensemble?.[index] ? ensembleRainDays(ensemble[index]) : []
    ]))
  };

  const districts = districtPayloads
    .map(({ district, payload }) => buildDistrict(district, payload, context))
    .sort((a, b) => b.risk_score - a.risk_score || b.rainfall_24h - a.rainfall_24h);

  if (districts.length === 0) {
    throw new Error("No live weather data returned");
  }

  const worstRisk = districts.reduce((worst, item) => (
    RISK_LEVELS.indexOf(item.risk_level) > RISK_LEVELS.indexOf(worst) ? item.risk_level : worst
  ), "normal");

  const gaugeDistricts = districts.filter((item) => item.rain_now?.stations > 0);
  const rainingDistricts = gaugeDistricts.filter((item) => item.rain_now.raining > 0);
  const provinceCondition = gaugeDistricts.length === 0
    ? districts[0].weather_condition
    : rainingDistricts.length === 0
      ? (districts.find((item) => item.condition_source === "gauge")?.weather_condition || "ไม่มีฝน")
      : rainingDistricts.length >= Math.ceil(gaugeDistricts.length / 2) ? "ฝนตกหลายพื้นที่" : "ฝนตกบางพื้นที่";

  const current = {
    province: "สตูล",
    observed_at: districts[0].updated_at,
    temperature: Math.round(average(districts.map((item) => item.temperature)) || 0),
    humidity: Math.round(average(districts.map((item) => item.humidity)) || 0),
    rainfall_1h: max(districts.map((item) => item.rainfall_1h)) || 0,
    rainfall_24h: Number((average(districts.map((item) => item.rainfall_24h)) || 0).toFixed(1)),
    rain_probability_24h: max(districts.map((item) => item.rain_probability_24h)) || 0,
    heavy_rain_prob_today: max(districts.map((item) => item.heavy_rain_today?.prob_heavy ?? null)),
    raining_districts: rainingDistricts.length,
    wind_speed: max(districts.map((item) => item.wind_speed)) || 0,
    wind_direction: districts[0].wind_direction,
    pressure: Math.round(average(districts.map((item) => item.pressure)) || 0),
    weather_condition: provinceCondition,
    risk_level: worstRisk,
    source: gaugeDistricts.length > 0 ? "ThaiWater + ECMWF" : "ECMWF (Open-Meteo)"
  };

  const warnings = [
    ...satunWarnings(hiiWarnings),
    ...measuredWarnings(freshWaterStations, rainStations, now)
  ];
  const media = hiiMain ? pickHiiMedia(hiiMain) : { rain_forecast: [], wave_forecast: [], radar: [] };

  return {
    data_mode: "external_live",
    provider: "ThaiWater + ECMWF",
    provider_observed_at: current.observed_at,
    fetched_at: toBangkokIso(new Date()),
    geography_source: "database:satun_village_polygon",
    risk_model_version: "2026-10-observed-first",
    selected_date: selectedDate,
    generated_at: toBangkokIso(new Date()),
    weather_current: current,
    district_weather: districts,
    weather_forecast: mergeForecasts(districtPayloads),
    weather_warnings: warnings,
    weather_map_layers: WEATHER_MAP_LAYERS,
    map_points: buildMapPoints(districts),
    timeline: buildTimeline(selectedDate),
    charts: buildCharts(districts, districtPayloads),
    safety_advice: safetyAdvice(worstRisk),
    marine,
    river_outlook: riverOutlook,
    hii_media: media,
    integration_sources: [
      { name: "ThaiWater (สสน.)", status: rainfall ? (rainfall.stale ? "stale" : "live") : "unavailable", use: "ฝนที่วัดได้จริง ฝนตอนนี้ ระดับน้ำเทียบตลิ่ง และประกาศเตือนฝนหนัก" },
      { name: "ECMWF IFS (Open-Meteo)", status: "live", use: "พยากรณ์รายชั่วโมงและ 7 วัน อุณหภูมิ ความชื้น ลม" },
      { name: "ECMWF Ensemble 51 ชุด (Open-Meteo)", status: ensemble ? "live" : "unavailable", use: "โอกาสฝนหนัก (เกิน 35 มม.) และหนักมาก (เกิน 60 มม.) รายวัน — วันนี้รวมกับฝนที่สถานีวัดได้แล้ว" },
      { name: "GloFAS (Open-Meteo Flood)", status: riverOutlook.length ? "live" : "unavailable", use: "แนวโน้มปริมาณน้ำในคลองเทียบสถิติ 20 ปี" },
      { name: "แบบจำลอง WRF-ROMS ของ สสน.", status: media.rain_forecast.length ? "live" : "unavailable", use: "แผนที่พยากรณ์ฝน 3 วัน และคลื่น 7 วัน" },
      { name: "Open-Meteo Marine", status: marine ? "live" : "unavailable", use: "ความสูงคลื่นทะเลหน้าจังหวัดสตูล" },
      { name: "ระดับน้ำทะเล (Open-Meteo Marine/SMOC + IOC ลังกาวี)", status: seaLevel ? (seaLevel.stale ? "stale" : "live") : "unavailable", use: "น้ำทะเลหนุน: พยากรณ์รายชั่วโมงหน้าสตูล ตรวจกับค่าวัดจริง เพิ่มความเสี่ยงอำเภอติดทะเลเมื่อหนุนสูงหรือหนุนพร้อมฝน/น้ำในคลองสูง" }
    ]
  };
}
