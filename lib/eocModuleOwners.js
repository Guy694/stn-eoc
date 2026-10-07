// อ่านสิทธิ์รายเมนูที่แอดมินตั้งไว้ (ตาราง eoc_module_permissions) พร้อมแคชสั้น ๆ — ใช้ฝั่งเซิร์ฟเวอร์
import { query } from "@/lib/db";
import { buildOwnerOverrides, resolveOwners } from "@/lib/eocModulePermissions";

const TTL_MS = 30 * 1000;
let cache = { at: 0, overrides: null };

export function invalidateOwnerOverrides() {
  cache = { at: 0, overrides: null };
}

export async function loadOwnerOverrides() {
  if (cache.overrides && Date.now() - cache.at < TTL_MS) return cache.overrides;
  let rows = [];
  try {
    rows = await query("SELECT eoc_type, module_key, team_code FROM eoc_module_permissions");
  } catch (error) {
    // ยังไม่ได้ migrate: ใช้ค่าเริ่มต้นในโค้ด
    if (error.code !== "ER_NO_SUCH_TABLE") throw error;
  }
  cache = { at: Date.now(), overrides: buildOwnerOverrides(rows) };
  return cache.overrides;
}

export async function ownersFor(eocType, moduleKey) {
  return resolveOwners(eocType, moduleKey, await loadOwnerOverrides());
}
