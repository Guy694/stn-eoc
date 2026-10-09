// เกณฑ์พยากรณ์จุดเสี่ยงน้ำท่วมที่ปรับเทียบแล้ว (เก็บใน system_settings) — ฝั่งเซิร์ฟเวอร์
import { getPool, query } from "@/lib/db";
import { DEFAULT_FACTOR_FLOOR, DEFAULT_THRESHOLDS, factorFloorOf, thresholdsOf } from "@/lib/floodForecast";

export const FLOOD_CALIBRATION_KEY = "flood_forecast_calibration";
const TTL_MS = 60 * 1000;
let cache = null;

const parse = (value) => {
  if (!value) return null;
  try {
    return typeof value === "string" ? JSON.parse(value) : Buffer.isBuffer(value) ? JSON.parse(value.toString("utf8")) : value;
  } catch {
    return null;
  }
};

/** { source: 'default'|'backtest', thresholds, factor_floor, calibrated_at?, by?, metrics? } */
export async function getFloodCalibration({ fresh = false } = {}) {
  if (!fresh && cache && Date.now() - cache.at < TTL_MS) return cache.value;
  let value = { source: "default", thresholds: { ...DEFAULT_THRESHOLDS }, factor_floor: DEFAULT_FACTOR_FLOOR };
  try {
    const [rows] = await getPool().execute("SELECT setting_value FROM system_settings WHERE setting_key = ? LIMIT 1", [FLOOD_CALIBRATION_KEY]);
    const stored = parse(rows[0]?.setting_value);
    if (stored?.thresholds) value = { ...stored, source: "backtest", thresholds: thresholdsOf(stored), factor_floor: factorFloorOf(stored) };
  } catch (error) {
    if (error?.code !== "ER_NO_SUCH_TABLE") console.warn("[flood-calibration] cannot read:", error?.message);
  }
  cache = { at: Date.now(), value };
  return value;
}

export async function saveFloodCalibration(value, user) {
  const stored = {
    thresholds: thresholdsOf(value),
    factor_floor: factorFloorOf(value),
    metrics: value.metrics || null,
    period: value.period || null,
    calibrated_at: new Date().toISOString(),
    by: [user?.givenName || user?.given_name, user?.familyName || user?.family_name].filter(Boolean).join(" ") || user?.username || null
  };
  await query(
    `INSERT INTO system_settings (setting_key, setting_value, updated_by) VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value), updated_by = VALUES(updated_by)`,
    [FLOOD_CALIBRATION_KEY, JSON.stringify(stored), user?.id ?? null]
  );
  cache = null;
  return getFloodCalibration({ fresh: true });
}

export async function resetFloodCalibration() {
  await query("DELETE FROM system_settings WHERE setting_key = ?", [FLOOD_CALIBRATION_KEY]);
  cache = null;
  return getFloodCalibration({ fresh: true });
}
