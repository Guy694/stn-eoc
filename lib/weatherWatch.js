import { query } from "@/lib/db";
import { RISK_LEVELS, RISK_META } from "@/lib/weatherRiskConfig";

export { RISK_LEVELS, RISK_META };

const OPEN_METEO_URL = "https://api.open-meteo.com/v1/forecast";

const WEATHER_MAP_LAYERS = [
  { layer_id: "district_boundary", layer_name: "ขอบเขตอำเภอ", layer_type: "polygon", is_visible: true, source: "database:satun_village_polygon" },
  { layer_id: "current_weather", layer_name: "สภาพอากาศปัจจุบัน", layer_type: "marker", is_visible: true, source: "Open-Meteo" },
  { layer_id: "current_rain", layer_name: "ฝนปัจจุบัน", layer_type: "circle", is_visible: true, source: "Open-Meteo" },
  { layer_id: "rain_24h", layer_name: "ฝนสะสม 24 ชั่วโมง", layer_type: "polygon", is_visible: true, source: "Open-Meteo" },
  { layer_id: "rain_forecast_3h", layer_name: "พยากรณ์ฝน 3 ชั่วโมง", layer_type: "circle", is_visible: false, source: "Open-Meteo" },
  { layer_id: "rain_forecast_24h", layer_name: "พยากรณ์ฝน 24 ชั่วโมง", layer_type: "circle", is_visible: false, source: "Open-Meteo" },
  { layer_id: "wind_speed", layer_name: "ความเร็วลม", layer_type: "marker", is_visible: false, source: "Open-Meteo" },
  { layer_id: "wind_direction", layer_name: "ทิศทางลม", layer_type: "marker", is_visible: false, source: "Open-Meteo" }
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

function rainfallScore(rainfall24h) {
  if (rainfall24h > 90) return 3;
  if (rainfall24h >= 61) return 2;
  if (rainfall24h >= 31) return 1;
  return 0;
}

function forecastRainScore(probability, rainfallForecast) {
  if (probability >= 85 || rainfallForecast >= 70) return 2;
  if (probability >= 65 || rainfallForecast >= 35) return 1;
  return 0;
}

function windScore(windSpeed) {
  if (windSpeed >= 32) return 2;
  if (windSpeed >= 22) return 1;
  return 0;
}

function levelFromScore(score) {
  if (score >= 8) return "critical";
  if (score >= 5) return "high";
  if (score >= 2) return "watch";
  return "normal";
}

export function calculateWeatherRisk({
  rainfall_24h,
  rain_probability_24h,
  rainfall_forecast = rainfall_24h,
  wind_speed,
  susceptibility_score = 0,
  warning_active = false
}) {
  const score = rainfallScore(rainfall_24h)
    + forecastRainScore(rain_probability_24h, rainfall_forecast)
    + windScore(wind_speed)
    + Number(susceptibility_score || 0)
    + (warning_active ? 1 : 0);
  return {
    score,
    risk_level: levelFromScore(score)
  };
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
           AVG(ST_X(ST_Centroid(ST_GeomFromWKB(ST_AsWKB(svp.geom), 0)))) AS latitude,
           AVG(ST_Y(ST_Centroid(ST_GeomFromWKB(ST_AsWKB(svp.geom), 0)))) AS longitude,
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
    throw new Error(`Open-Meteo: ${response.status}`);
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

function nextHourlyForecast(payload, currentIndex, stepHours = 3, limit = 8) {
  const times = payload.hourly?.time || [];
  const result = [];
  for (let index = Math.max(currentIndex + 1, 0); index < times.length && result.length < limit; index += stepHours) {
    const rainfall = Number(hourlyAt(payload, index, "precipitation") || 0);
    const probability = Number(hourlyAt(payload, index, "precipitation_probability") || 0);
    const wind = Number(hourlyAt(payload, index, "wind_speed_10m") || 0);
    const risk = calculateWeatherRisk({
      rainfall_24h: rainfall,
      rainfall_forecast: rainfall,
      rain_probability_24h: probability,
      wind_speed: wind
    });
    result.push({
      forecast_datetime: toBangkokIso(times[index]),
      period: "hourly",
      weather_condition: weatherCondition(hourlyAt(payload, index, "weather_code")),
      temperature_min: Math.round(Number(hourlyAt(payload, index, "temperature_2m") || 0)),
      temperature_max: Math.round(Number(hourlyAt(payload, index, "temperature_2m") || 0)),
      rain_probability: probability,
      rainfall_forecast: rainfall,
      wind_speed: Math.round(wind),
      risk_level: risk.risk_level
    });
  }
  return result;
}

function dailyForecast(payload) {
  const daily = payload.daily || {};
  return (daily.time || []).map((time, index) => {
    const rainfall = Number(daily.precipitation_sum?.[index] || 0);
    const probability = Number(daily.precipitation_probability_max?.[index] || 0);
    const wind = Number(daily.wind_speed_10m_max?.[index] || 0);
    const risk = calculateWeatherRisk({
      rainfall_24h: rainfall,
      rainfall_forecast: rainfall,
      rain_probability_24h: probability,
      wind_speed: wind,
      warning_active: rainfall >= 70
    });

    return {
      forecast_datetime: `${time}T12:00:00+07:00`,
      period: index === 0 ? "24h" : index <= 2 ? "3d" : "7d",
      weather_condition: weatherCondition(daily.weather_code?.[index]),
      temperature_min: Math.round(Number(daily.temperature_2m_min?.[index] || 0)),
      temperature_max: Math.round(Number(daily.temperature_2m_max?.[index] || 0)),
      rain_probability: probability,
      rainfall_forecast: rainfall,
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

function buildDistrict(district, payload) {
  const currentIndex = currentHourIndex(payload);
  const rainfall1h = Number(payload.current?.precipitation || payload.current?.rain || sumHourlyPrecipitation(payload, currentIndex, 1) || 0);
  const rainfall24h = sumHourlyPrecipitation(payload, currentIndex, 24);
  const forecast24h = Number(payload.daily?.precipitation_sum?.[0] || rainfall24h || 0);
  const probability24h = Number(payload.daily?.precipitation_probability_max?.[0] || hourlyAt(payload, currentIndex, "precipitation_probability") || 0);
  const windSpeed = Number(payload.current?.wind_speed_10m || 0);
  const risk = calculateWeatherRisk({
    rainfall_24h: rainfall24h,
    rainfall_forecast: forecast24h,
    rain_probability_24h: probability24h,
    wind_speed: windSpeed,
    susceptibility_score: district.susceptibility_score
  });

  return {
    ...district,
    temperature: Math.round(Number(payload.current?.temperature_2m || 0)),
    humidity: Math.round(Number(payload.current?.relative_humidity_2m || 0)),
    rainfall_1h: rainfall1h,
    rainfall_24h: rainfall24h,
    rain_probability_24h: probability24h,
    rainfall_forecast_24h: forecast24h,
    rainfall_forecast_3h: sumHourlyPrecipitation(payload, currentIndex + 3, 3),
    wind_speed: Math.round(windSpeed),
    wind_direction: directionText(payload.current?.wind_direction_10m),
    pressure: Math.round(Number(payload.current?.pressure_msl || 0)),
    flood_risk: risk.risk_level,
    landslide_risk: district.susceptibility_score >= 2 && ["high", "critical"].includes(risk.risk_level) ? risk.risk_level : "normal",
    weather_condition: weatherCondition(payload.current?.weather_code),
    risk_score: risk.score,
    risk_level: risk.risk_level,
    updated_at: toBangkokIso(payload.current?.time)
  };
}

function buildCharts(districts, districtPayloads) {
  const first = districtPayloads[0]?.payload?.daily;
  const rainfall7d = (first?.time || []).map((time, index) => {
    const rainfallValues = districtPayloads.map(({ payload }) => Number(payload.daily?.precipitation_sum?.[index] || 0));
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
    risk_trend: rainfall7d.map((day, index) => {
      const probabilityValues = districtPayloads.map(({ payload }) => Number(payload.daily?.precipitation_probability_max?.[index] || 0));
      const windValues = districtPayloads.map(({ payload }) => Number(payload.daily?.wind_speed_10m_max?.[index] || 0));
      const risk = calculateWeatherRisk({
        rainfall_24h: day.rainfall,
        rainfall_forecast: day.rainfall,
        rain_probability_24h: average(probabilityValues) || 0,
        wind_speed: average(windValues) || 0
      });
      return {
        label: day.label,
        score: RISK_LEVELS.indexOf(risk.risk_level) + 1,
        risk_level: risk.risk_level
      };
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

export async function getWeatherWatchPayload({ date } = {}) {
  const selectedDate = date || new Date().toISOString().slice(0, 10);
  const districtProfiles = await loadDistrictWeatherProfiles();
  if (!districtProfiles.length) throw new Error("No district geography in database");
  const districtPayloads = await fetchAllDistrictWeather(districtProfiles);

  const districts = districtPayloads
    .map(({ district, payload }) => buildDistrict(district, payload))
    .sort((a, b) => b.risk_score - a.risk_score || b.rainfall_24h - a.rainfall_24h);

  if (districts.length === 0) {
    throw new Error("No live weather data returned");
  }

  const worstRisk = districts.reduce((worst, item) => (
    RISK_LEVELS.indexOf(item.risk_level) > RISK_LEVELS.indexOf(worst) ? item.risk_level : worst
  ), "normal");

  const current = {
    province: "สตูล",
    observed_at: districts[0].updated_at,
    temperature: Math.round(average(districts.map((item) => item.temperature)) || 0),
    humidity: Math.round(average(districts.map((item) => item.humidity)) || 0),
    rainfall_1h: max(districts.map((item) => item.rainfall_1h)) || 0,
    rainfall_24h: Number((average(districts.map((item) => item.rainfall_24h)) || 0).toFixed(1)),
    rain_probability_24h: max(districts.map((item) => item.rain_probability_24h)) || 0,
    wind_speed: max(districts.map((item) => item.wind_speed)) || 0,
    wind_direction: districts[0].wind_direction,
    pressure: Math.round(average(districts.map((item) => item.pressure)) || 0),
    weather_condition: districts[0].weather_condition,
    risk_level: worstRisk,
    source: "Open-Meteo"
  };

  return {
    data_mode: "external_live",
    provider: "Open-Meteo",
    provider_observed_at: current.observed_at,
    fetched_at: toBangkokIso(new Date()),
    geography_source: "database:satun_village_polygon",
    risk_model_version: districtProfiles.find((item) => item.risk_model_version)?.risk_model_version || null,
    selected_date: selectedDate,
    generated_at: toBangkokIso(new Date()),
    weather_current: current,
    district_weather: districts,
    weather_forecast: mergeForecasts(districtPayloads),
    weather_warnings: [],
    weather_map_layers: WEATHER_MAP_LAYERS,
    map_points: buildMapPoints(districts),
    timeline: buildTimeline(selectedDate),
    charts: buildCharts(districts, districtPayloads),
    safety_advice: safetyAdvice(worstRisk),
    integration_sources: [
      { name: "Open-Meteo", status: "live", use: "ข้อมูลสภาพอากาศปัจจุบัน พยากรณ์ฝน ลม อุณหภูมิ และความชื้น" }
    ]
  };
}
