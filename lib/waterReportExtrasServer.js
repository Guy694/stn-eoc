// ส่วนเสริมของรายงานระดับน้ำแบบ 4 หัวข้อ ฝั่งเซิร์ฟเวอร์: ค่าตั้งค่า ค่าย้อนหลังของสถานี ThaiWater และรวมข้อมูลฝน/พยากรณ์
import { query } from "@/lib/db";
import { bangkokHourKey, shiftHourKey } from "@/lib/dpmWater";
import { loadDpmBaseline } from "@/lib/dpmWaterServer";
import { getSatunRainfall, getSatunWaterLevels } from "@/lib/thaiWaterClient";
import { getHiiMain } from "@/lib/forecastClient";
import { HII_IMAGE_BASE, pickHiiMedia } from "@/lib/forecastSignals";
import { THAIWATER_SOURCE } from "@/lib/thaiWater";
import {
  REPORT_CONFIG_KEY,
  buildBasinCard,
  buildForecastDays,
  buildRainTable,
  normalizeReportConfig,
  pickBasinStation,
  thaiWaterCode
} from "@/lib/waterReportExtras";

const parse = (value) => {
  if (!value) return null;
  if (typeof value === "object") return value;
  try { return JSON.parse(value); } catch { return null; }
};

export async function getReportConfig() {
  try {
    const rows = await query("SELECT setting_value FROM system_settings WHERE setting_key = ? LIMIT 1", [REPORT_CONFIG_KEY]);
    return normalizeReportConfig(parse(rows[0]?.setting_value));
  } catch {
    return normalizeReportConfig(null);
  }
}

export async function saveReportConfig(value, user) {
  const config = normalizeReportConfig(value);
  await query(
    `INSERT INTO system_settings (setting_key, setting_value, updated_by) VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value), updated_by = VALUES(updated_by)`,
    [REPORT_CONFIG_KEY, JSON.stringify(config), user?.id ?? null]
  );
  return config;
}

/** เก็บระดับน้ำสถานี ThaiWater รายชั่วโมง (ใช้ตารางเดียวกับ ปภ. รหัสขึ้นต้น TW) ไว้เทียบ "เมื่อวาน" */
export async function saveThaiWaterSnapshot(stations, fetchedAt = new Date()) {
  const usable = (stations || []).filter((station) => station?.id && station.waterLevelMsl !== null);
  if (!usable.length) return 0;
  const hour = bangkokHourKey(fetchedAt);
  const values = usable.map(() => "(?, ?, ?, ?, ?, 0)").join(", ");
  const params = usable.flatMap((station) => [thaiWaterCode(station.id), hour, String(station.name || "").slice(0, 191), station.waterLevelMsl, station.bankLevelMsl]);
  await query(
    `INSERT INTO dpm_water_readings (station_code, hour_at, station_name, water_level, bank_level, malfunction) VALUES ${values}
     ON DUPLICATE KEY UPDATE water_level = COALESCE(water_level, VALUES(water_level)), bank_level = COALESCE(bank_level, VALUES(bank_level))`,
    params
  );
  return usable.length;
}

/** เรียกจากตัวตั้งเวลาของ ปภ. (ทุก 10 นาที) */
export async function recordThaiWaterHistory() {
  const water = await getSatunWaterLevels();
  try {
    return await saveThaiWaterSnapshot(water.stations);
  } catch (error) {
    if (error?.code === "ER_NO_SUCH_TABLE") return 0;
    throw error;
  }
}

async function optional(label, promise, timeoutMs = 20000) {
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => { timer = setTimeout(() => reject(new Error("timeout")), timeoutMs); })
    ]);
  } catch (error) {
    console.warn(`[water-report] ${label}:`, error.message);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** ภาพ สสน. ผ่านเส้นทางของระบบเอง (บันทึกเป็นรูป/PDF ได้ ไม่ติด CORS) */
export function proxiedMediaUrl(url) {
  if (!url || !url.startsWith(HII_IMAGE_BASE)) return null;
  return `/stn-eoc/api/eoc/water-report/media/?image=${encodeURIComponent(url.slice(HII_IMAGE_BASE.length))}`;
}

export async function loadWaterReportExtras({ refresh = false } = {}) {
  const { getWeatherWatchPayload } = await import("@/lib/weatherWatch");
  const [config, water, rain, hii, weather] = await Promise.all([
    getReportConfig(),
    optional("ThaiWater ระดับน้ำ", getSatunWaterLevels({ force: refresh })),
    optional("ThaiWater ฝน", getSatunRainfall({ force: refresh })),
    optional("ภาพพยากรณ์ฝน สสน.", getHiiMain()),
    optional("พยากรณ์อากาศ 7 วัน", getWeatherWatchPayload(), 25000)
  ]);
  const stations = water?.stations || [];
  if (stations.length) {
    await saveThaiWaterSnapshot(stations).catch((error) => {
      if (error?.code !== "ER_NO_SUCH_TABLE") console.warn("[water-report] เก็บค่า ThaiWater ไม่สำเร็จ:", error.message);
    });
  }

  const picked = config.basins.map((basin) => ({ basin, station: pickBasinStation(stations, basin) }));
  const hours = [...new Set(picked.filter((item) => item.station?.observedAt).map((item) => shiftHourKey(bangkokHourKey(item.station.observedAt), -24)))];
  const baselines = {};
  for (const hour of hours) baselines[hour] = await loadDpmBaseline(hour).catch(() => ({}));
  const basins = picked.map(({ basin, station }) => {
    const hour = station?.observedAt ? shiftHourKey(bangkokHourKey(station.observedAt), -24) : null;
    const previous = station && hour ? baselines[hour]?.[thaiWaterCode(station.id)] ?? null : null;
    const card = buildBasinCard(basin, station, { previous });
    return { ...card, compareHour: previous !== null && !card.manual ? hour : null };
  });

  const media = hii ? pickHiiMedia(hii).rain_forecast.slice(0, 2) : [];
  return {
    config,
    basins,
    basin_stations: stations.map((station) => ({ id: station.id, name: station.name, river: station.river, amphoe: station.amphoe, bank: station.bankLevelMsl })),
    rain: buildRainTable(rain?.stations || []),
    rain_media: media.map((item) => ({ url: proxiedMediaUrl(item.url), datetime: item.datetime })).filter((item) => item.url),
    forecast: buildForecastDays(weather?.weather_forecast || []),
    sources: {
      water: water ? (water.stale ? "stale" : "live") : "unavailable",
      rain: rain ? (rain.stale ? "stale" : "live") : "unavailable",
      media: media.length ? "live" : "unavailable",
      forecast: weather ? "live" : "unavailable",
      water_source: THAIWATER_SOURCE
    },
    fetched_at: new Date().toISOString()
  };
}
