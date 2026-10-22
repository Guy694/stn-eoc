// การจัดกลุ่ม/ลำดับเมนูของเหตุการณ์ที่แอดมินตั้งเอง (ตาราง eoc_menu_layout) และป้ายบอก "เมนูนี้ใครบันทึก"
// ไฟล์นี้ไม่แตะฐานข้อมูล ใช้ได้ทั้ง API เมนูข้าง และ unit test
import { CONFIGURABLE_MODULES, resolveOwners } from "./eocModulePermissions.js";
import { getTeam } from "../src/features/eoc/registries/team.registry.js";

export const MAX_GROUP_LENGTH = 60;

/** แถวในตาราง → { "flood:records": { group: "ข้อมูลพื้นที่" | "", order: 2 } } */
export function buildMenuLayout(rows = []) {
  const map = {};
  for (const row of rows) {
    if (!row?.eoc_type || !row?.module_key) continue;
    map[`${row.eoc_type}:${row.module_key}`] = {
      group: row.group_name === null || row.group_name === undefined ? null : String(row.group_name),
      order: Number.isFinite(Number(row.sort_order)) ? Number(row.sort_order) : null
    };
  }
  return map;
}

/**
 * จัดเมนูของเหตุการณ์ตามที่แอดมินตั้ง: เปลี่ยนชื่อกลุ่ม (ว่าง = ไม่มีกลุ่ม) และเรียงลำดับใหม่
 * เมนูที่ไม่ได้ตั้งค่า ใช้กลุ่ม/ลำดับเดิม · เมนูในกลุ่มเดียวกันอยู่ติดกันเสมอ (กลุ่มเรียงตามเมนูแรกของกลุ่ม)
 */
export function applyMenuLayout(eocType, items = [], layout = {}) {
  const placed = items.map((item, index) => {
    const custom = layout?.[`${eocType}:${item.key}`];
    const group = custom && custom.group !== null ? custom.group : (item.group || "");
    const order = custom && custom.order !== null ? custom.order : index;
    return { item: { ...item, group: group || undefined }, order, index };
  });
  placed.sort((a, b) => a.order - b.order || a.index - b.index);
  const groupRank = new Map();
  placed.forEach((entry, position) => {
    const key = entry.item.group || "";
    if (!groupRank.has(key)) groupRank.set(key, position);
  });
  placed.sort((a, b) => groupRank.get(a.item.group || "") - groupRank.get(b.item.group || "") || a.order - b.order || a.index - b.index);
  return placed.map((entry) => entry.item);
}

/** ชื่อย่อทีมที่บันทึกเมนูนี้ได้ เช่น "SAT · LOGISTICS" / "ทุกทีม" / null (เมนูดูข้อมูลอย่างเดียว ไม่มีเจ้าของ) */
export function ownerLabel(eocType, moduleKey, overrides = {}) {
  const configurable = (CONFIGURABLE_MODULES[eocType] || []).some((item) => item.key === moduleKey);
  if (!configurable) return null;
  const owners = resolveOwners(eocType, moduleKey, overrides);
  if (owners === null) return "ทุกทีม";
  return owners.map((code) => getTeam(code)?.shortName || code).join(" · ");
}

/** ตรวจข้อมูลที่แอดมินส่งมา: [{ key, group, order }] */
export function normalizeLayoutInput(items, allowedKeys = []) {
  if (!Array.isArray(items) || !items.length) return { ok: false, error: "ไม่มีรายการเมนู" };
  const allowed = new Set(allowedKeys);
  const seen = new Set();
  const value = [];
  for (const [index, item] of items.entries()) {
    const key = String(item?.key || "");
    if (!allowed.has(key)) return { ok: false, error: `ไม่รู้จักเมนู ${key}` };
    if (seen.has(key)) continue;
    seen.add(key);
    const group = String(item?.group ?? "").replace(/\s+/g, " ").trim();
    if (group.length > MAX_GROUP_LENGTH) return { ok: false, error: `ชื่อกลุ่มยาวเกิน ${MAX_GROUP_LENGTH} ตัวอักษร` };
    value.push({ key, group, order: index });
  }
  return { ok: true, value };
}
