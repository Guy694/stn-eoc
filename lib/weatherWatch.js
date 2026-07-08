import weatherMock from "@/data/weather-watch.json";

export const RISK_LEVELS = ["normal", "watch", "high", "critical"];

export const RISK_META = {
  normal: { label: "ปกติ", color: "#16a34a", bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200" },
  watch: { label: "เฝ้าระวัง", color: "#eab308", bg: "bg-yellow-50", text: "text-yellow-700", border: "border-yellow-200" },
  high: { label: "เสี่ยงสูง", color: "#f97316", bg: "bg-orange-50", text: "text-orange-700", border: "border-orange-200" },
  critical: { label: "วิกฤต", color: "#dc2626", bg: "bg-red-50", text: "text-red-700", border: "border-red-200" }
};

const DAY_OFFSETS = [-22, -8, 6, 14, 0, -16, 10];

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function addDays(date, amount) {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

function toBangkokIso(date) {
  const shifted = new Date(date.getTime() + 7 * 60 * 60 * 1000);
  return `${shifted.toISOString().slice(0, 19)}+07:00`;
}

function getDateIndex(dateValue) {
  const selected = dateValue ? new Date(`${dateValue}T00:00:00+07:00`) : new Date(weatherMock.weather_current.observed_at);
  if (Number.isNaN(selected.getTime())) return 4;
  const base = new Date(weatherMock.weather_current.observed_at);
  const diff = Math.round((selected - base) / 86400000);
  return ((diff % DAY_OFFSETS.length) + DAY_OFFSETS.length) % DAY_OFFSETS.length;
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

function liftRisk(level, steps = 1) {
  const currentIndex = RISK_LEVELS.indexOf(level);
  return RISK_LEVELS[clamp(currentIndex + steps, 0, RISK_LEVELS.length - 1)] || level;
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
  const baseLevel = levelFromScore(score);
  return {
    score,
    risk_level: warning_active && baseLevel === "normal" ? liftRisk(baseLevel) : baseLevel
  };
}

function shiftDateTime(value, dayDelta, hourDelta = 0) {
  const date = new Date(value);
  date.setDate(date.getDate() + dayDelta);
  date.setHours(date.getHours() + hourDelta);
  return toBangkokIso(date);
}

function dateLabel(date) {
  return date.toISOString().slice(0, 10);
}

function buildDistricts(dateIndex, dayDelta) {
  const offset = DAY_OFFSETS[dateIndex] || 0;
  return weatherMock.district_weather.map((district, index) => {
    const districtOffset = offset + ((index % 3) - 1) * 4;
    const rainfall24 = clamp(district.rainfall_24h + districtOffset, 8, 130);
    const rain1h = clamp(Math.round(district.rainfall_1h + districtOffset / 5), 0, 45);
    const windSpeed = clamp(district.wind_speed + Math.round(offset / 12), 6, 42);
    const probability = clamp(district.rain_probability_24h + Math.round(offset / 4), 25, 98);
    const risk = calculateWeatherRisk({
      ...district,
      rainfall_24h: rainfall24,
      rainfall_forecast: rainfall24,
      rainfall_1h: rain1h,
      wind_speed: windSpeed,
      rain_probability_24h: probability
    });

    return {
      ...district,
      rainfall_1h: rain1h,
      rainfall_24h: rainfall24,
      rain_probability_24h: probability,
      wind_speed: windSpeed,
      temperature: clamp(district.temperature + (offset > 0 ? -1 : 1), 24, 34),
      risk_score: risk.score,
      risk_level: risk.risk_level,
      updated_at: shiftDateTime(district.updated_at, dayDelta)
    };
  });
}

function buildForecast(dayDelta, districts) {
  const provinceRain = Math.round(districts.reduce((sum, item) => sum + item.rainfall_24h, 0) / districts.length);
  return weatherMock.weather_forecast.map((item, index) => {
    const forecastRain = clamp(item.rainfall_forecast + Math.round((provinceRain - 70) / 3) + (index % 3) * 4, 8, 120);
    const risk = calculateWeatherRisk({
      rainfall_24h: forecastRain,
      rainfall_forecast: forecastRain,
      rain_probability_24h: item.rain_probability,
      wind_speed: item.wind_speed,
      susceptibility_score: index < 3 ? 1 : 0,
      warning_active: forecastRain >= 70
    });
    return {
      ...item,
      rainfall_forecast: forecastRain,
      risk_level: risk.risk_level,
      forecast_datetime: shiftDateTime(item.forecast_datetime, dayDelta, index > 0 ? 0 : 0)
    };
  });
}

function buildTimeline(selectedDate) {
  const base = selectedDate ? new Date(`${selectedDate}T00:00:00+07:00`) : new Date(weatherMock.weather_current.observed_at);
  return Array.from({ length: 7 }, (_, index) => {
    const date = addDays(base, index - 4);
    return {
      date: dateLabel(date),
      label: date.toLocaleDateString("th-TH", { day: "numeric", month: "short" }),
      is_today: index === 4
    };
  });
}

function buildCharts(districts, selectedDate) {
  const timeline = buildTimeline(selectedDate);
  const averageRain = Math.round(districts.reduce((sum, item) => sum + item.rainfall_24h, 0) / districts.length);
  return {
    rainfall_7d: timeline.map((day, index) => ({
      label: day.label,
      rainfall: clamp(averageRain + DAY_OFFSETS[index] + 10, 5, 130)
    })),
    district_rainfall: districts.map((district) => ({
      label: district.district_name,
      rainfall: district.rainfall_24h,
      risk_level: district.risk_level
    })),
    risk_trend: timeline.map((day, index) => {
      const rainfall = clamp(averageRain + DAY_OFFSETS[index], 0, 130);
      const risk = calculateWeatherRisk({
        rainfall_24h: rainfall,
        rainfall_forecast: rainfall,
        rain_probability_24h: clamp(55 + index * 6, 35, 95),
        wind_speed: 16 + index,
        susceptibility_score: index > 3 ? 2 : 1,
        warning_active: rainfall >= 70
      });
      return {
        label: day.label,
        score: RISK_LEVELS.indexOf(risk.risk_level) + 1,
        risk_level: risk.risk_level
      };
    })
  };
}

function buildWarningList(dayDelta, districts) {
  const highDistricts = districts.filter((item) => ["high", "critical"].includes(item.risk_level)).map((item) => item.district_name);
  return weatherMock.weather_warnings.map((warning, index) => ({
    ...warning,
    affected_districts: index === 0 && highDistricts.length ? highDistricts : warning.affected_districts,
    start_datetime: shiftDateTime(warning.start_datetime, dayDelta),
    end_datetime: shiftDateTime(warning.end_datetime, dayDelta),
    published_at: shiftDateTime(warning.published_at, dayDelta)
  }));
}

function buildMapPoints(districts) {
  return {
    rain_gauges: districts.map((district, index) => ({
      id: `rain-${district.district_id}`,
      name: `สถานีวัดฝน ${district.district_name}`,
      latitude: district.latitude + (index % 2 ? 0.025 : -0.018),
      longitude: district.longitude + (index % 2 ? -0.018 : 0.022),
      rainfall_1h: district.rainfall_1h,
      rainfall_24h: district.rainfall_24h,
      risk_level: district.risk_level
    })),
    water_levels: districts.slice(0, 5).map((district, index) => ({
      id: `water-${district.district_id}`,
      name: `จุดวัดระดับน้ำ ${district.district_name}`,
      latitude: district.latitude - 0.028,
      longitude: district.longitude - 0.016,
      level_m: Number((1.4 + index * 0.28 + district.rainfall_24h / 120).toFixed(2)),
      status: district.flood_risk
    })),
    shelters: [
      { id: "shelter-1", name: "ศูนย์พักพิงเทศบาลเมืองสตูล", latitude: 6.62, longitude: 100.07 },
      { id: "shelter-2", name: "ศูนย์พักพิงอำเภอละงู", latitude: 6.88, longitude: 99.79 },
      { id: "shelter-3", name: "ศูนย์พักพิงอำเภอมะนัง", latitude: 6.99, longitude: 100.05 }
    ],
    health_facilities: [
      { id: "health-1", name: "โรงพยาบาลสตูล", latitude: 6.62, longitude: 100.06 },
      { id: "health-2", name: "โรงพยาบาลละงู", latitude: 6.89, longitude: 99.79 },
      { id: "health-3", name: "โรงพยาบาลทุ่งหว้า", latitude: 7.09, longitude: 99.78 }
    ],
    safe_routes: [
      {
        id: "route-1",
        name: "เส้นทางหลัก เมืองสตูล-ละงู",
        coordinates: [[6.62, 100.07], [6.72, 99.96], [6.88, 99.79]]
      },
      {
        id: "route-2",
        name: "เส้นทางสำรอง ควนกาหลง-มะนัง",
        coordinates: [[6.84, 100.18], [6.94, 100.12], [6.99, 100.05]]
      }
    ]
  };
}

export function getWeatherWatchPayload({ date } = {}) {
  const baseDate = new Date(weatherMock.weather_current.observed_at);
  const selectedDate = date || baseDate.toISOString().slice(0, 10);
  const selected = new Date(`${selectedDate}T00:00:00+07:00`);
  const dayDelta = Number.isNaN(selected.getTime()) ? 0 : Math.round((selected - baseDate) / 86400000);
  const dateIndex = getDateIndex(selectedDate);
  const districts = buildDistricts(dateIndex, dayDelta);
  const worstRisk = districts.reduce((worst, item) => (
    RISK_LEVELS.indexOf(item.risk_level) > RISK_LEVELS.indexOf(worst) ? item.risk_level : worst
  ), "normal");
  const averageRain = Math.round(districts.reduce((sum, item) => sum + item.rainfall_24h, 0) / districts.length);
  const maxRain1h = Math.max(...districts.map((item) => item.rainfall_1h));
  const maxWind = Math.max(...districts.map((item) => item.wind_speed));
  const averageTemp = Math.round(districts.reduce((sum, item) => sum + item.temperature, 0) / districts.length);
  const warnings = buildWarningList(dayDelta, districts);

  return {
    data_mode: "mock",
    selected_date: selectedDate,
    generated_at: toBangkokIso(new Date()),
    weather_current: {
      ...weatherMock.weather_current,
      observed_at: shiftDateTime(weatherMock.weather_current.observed_at, dayDelta),
      temperature: averageTemp,
      rainfall_1h: maxRain1h,
      rainfall_24h: averageRain,
      wind_speed: maxWind,
      rain_probability_24h: Math.max(...districts.map((item) => item.rain_probability_24h)),
      risk_level: worstRisk,
      weather_condition: worstRisk === "critical" ? "ฝนหนักมาก" : worstRisk === "high" ? "ฝนฟ้าคะนอง" : "ฝนตกกระจาย"
    },
    district_weather: districts.sort((a, b) => b.risk_score - a.risk_score || b.rainfall_24h - a.rainfall_24h),
    weather_forecast: buildForecast(dayDelta, districts),
    weather_warnings: warnings,
    weather_map_layers: weatherMock.weather_map_layers,
    map_points: buildMapPoints(districts),
    timeline: buildTimeline(selectedDate),
    charts: buildCharts(districts, selectedDate),
    safety_advice: [
      "หลีกเลี่ยงพื้นที่น้ำท่วมและทางน้ำไหล",
      "ไม่ขับรถผ่านถนนที่มีน้ำท่วมสูง",
      "เตรียมเอกสารสำคัญ ยาประจำตัว และอุปกรณ์จำเป็น",
      "ผู้ป่วยติดเตียง ผู้สูงอายุ และหญิงตั้งครรภ์ควรแจ้งผู้นำชุมชน",
      "ชาวเรือควรตรวจสอบประกาศคลื่นลมก่อนออกจากฝั่ง",
      "หากพบเหตุฉุกเฉิน โทร 1669, 1784 หรือ 191"
    ],
    integration_sources: [
      { name: "TMD", status: "prepared_proxy", use: "พยากรณ์อากาศ ประกาศเตือนภัย เรดาร์ฝน" },
      { name: "GISTDA", status: "prepared_proxy", use: "ดาวเทียม พื้นที่น้ำท่วมและพื้นที่เสี่ยงภัย" },
      { name: "OpenWeather", status: "prepared_proxy", use: "current weather, forecast และ map layer" },
      { name: "Windy", status: "prepared_proxy", use: "visual layer ลม ฝน เมฆ คลื่นทะเล" },
      { name: "Provincial field data", status: "prepared_proxy", use: "รายงานจากอำเภอ อปท. รพ.สต. ปภ. และ EOC" }
    ]
  };
}
