// อ่าน/บันทึกโหมดปิดปรับปรุงระบบ (ฝั่งเซิร์ฟเวอร์) — proxy เรียกทุกคำขอ จึงแคชในหน่วยความจำ 10 วินาที
import { getPool, query } from "@/lib/db";
import { hashSessionToken } from "@/lib/auth";
import { DEFAULT_STATE, MAINTENANCE_KEY, normalizeState } from "@/lib/maintenanceRules";

const STATE_TTL_MS = 10 * 1000;
const ROLE_TTL_MS = 30 * 1000;
let stateCache = null;
const roleCache = new Map();

export async function getMaintenanceState({ fresh = false } = {}) {
  if (!fresh && stateCache && Date.now() - stateCache.at < STATE_TTL_MS) return stateCache.value;
  try {
    // ใช้ pool ตรง (ไม่ผ่าน query()) เพื่อไม่ให้ log error ทุกคำขอเมื่อยังไม่ได้รัน migration
    const [rows] = await getPool().execute("SELECT setting_value FROM system_settings WHERE setting_key = ? LIMIT 1", [MAINTENANCE_KEY]);
    const value = normalizeState(rows[0]?.setting_value);
    stateCache = { at: Date.now(), value };
    return value;
  } catch (error) {
    // ยังไม่ได้รัน migration / ฐานข้อมูลล่ม: ไม่ปิดเว็บเอง (ใช้ค่าล่าสุดที่รู้ ถ้ามี) และพักการอ่านไว้ตามรอบแคช
    if (error?.code !== "ER_NO_SUCH_TABLE") console.warn("[maintenance] cannot read state:", error?.message);
    const value = stateCache?.value || { ...DEFAULT_STATE };
    stateCache = { at: Date.now(), value };
    return value;
  }
}

export async function saveMaintenanceState(value, user) {
  const stored = {
    ...value,
    updated_at: new Date().toISOString(),
    updated_by_name: [user?.givenName || user?.given_name, user?.familyName || user?.family_name].filter(Boolean).join(" ") || user?.username || null
  };
  await query(
    `INSERT INTO system_settings (setting_key, setting_value, updated_by) VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value), updated_by = VALUES(updated_by)`,
    [MAINTENANCE_KEY, JSON.stringify(stored), user?.id ?? null]
  );
  stateCache = { at: Date.now(), value: normalizeState(stored) };
  return stateCache.value;
}

/** role ของเจ้าหน้าที่จาก cookie (ตรวจแบบเบา ไม่ต่ออายุ session) — ใช้เฉพาะตอนปิดปรับปรุง */
export async function sessionRole(token) {
  if (!token) return null;
  const tokenHash = hashSessionToken(token);
  const cached = roleCache.get(tokenHash);
  if (cached && Date.now() - cached.at < ROLE_TTL_MS) return cached.role;
  try {
    const rows = await query(
      `SELECT o.role FROM user_sessions s JOIN officer o ON o.id = s.user_id
       WHERE s.session_token = ? AND s.is_active = 1 AND s.expires_at > NOW() AND o.is_approved = 1 LIMIT 1`,
      [tokenHash]
    );
    const role = rows[0]?.role || null;
    if (roleCache.size > 500) roleCache.clear();
    roleCache.set(tokenHash, { at: Date.now(), role });
    return role;
  } catch {
    return null;
  }
}
