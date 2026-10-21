// เสียงแจ้งเตือนบนหน้าเว็บ (ตั้งโดยแอดมิน ใช้ทั้งระบบ) — อ่าน/บันทึกใน system_settings
import { getPool, query } from "@/lib/db";
import { DEFAULT_SOUND_PREFS, SOUND_SETTINGS_KEY, normalizeSoundPrefs } from "@/lib/alertSound";

const TTL_MS = 30 * 1000;
let cache = null;

const parse = (value) => {
  try {
    return typeof value === "string" ? JSON.parse(value) : Buffer.isBuffer(value) ? JSON.parse(value.toString("utf8")) : value;
  } catch {
    return null;
  }
};

export async function getAlertSoundSettings({ fresh = false } = {}) {
  if (!fresh && cache && Date.now() - cache.at < TTL_MS) return cache.value;
  try {
    const [rows] = await getPool().execute("SELECT setting_value FROM system_settings WHERE setting_key = ? LIMIT 1", [SOUND_SETTINGS_KEY]);
    const stored = parse(rows[0]?.setting_value) || {};
    const value = { ...normalizeSoundPrefs(stored), updated_at: stored.updated_at || null, updated_by_name: stored.updated_by_name || null };
    cache = { at: Date.now(), value };
    return value;
  } catch (error) {
    if (error?.code !== "ER_NO_SUCH_TABLE") console.warn("[alert-sounds] cannot read settings:", error?.message);
    return { ...DEFAULT_SOUND_PREFS, updated_at: null, updated_by_name: null };
  }
}

export async function saveAlertSoundSettings(value, user) {
  const stored = {
    ...normalizeSoundPrefs(value),
    updated_at: new Date().toISOString(),
    updated_by_name: [user?.givenName || user?.given_name, user?.familyName || user?.family_name].filter(Boolean).join(" ") || user?.username || null
  };
  await query(
    `INSERT INTO system_settings (setting_key, setting_value, updated_by) VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value), updated_by = VALUES(updated_by)`,
    [SOUND_SETTINGS_KEY, JSON.stringify(stored), user?.id ?? null]
  );
  cache = { at: Date.now(), value: stored };
  return stored;
}
