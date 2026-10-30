// เปิด/ปิดเมนูหลังบ้าน (แอดมินตั้งที่ ตั้งค่าระบบ › เปิด/ปิดเมนู) — ซ่อนจากเมนูข้างของทุกคน
// ไม่แตะฐานข้อมูล ใช้ได้ทั้ง API เมนูข้าง และ unit test
// หมายเหตุ: เป็นการซ่อนเมนู ไม่ใช่ล็อกหน้า — สิทธิ์เข้าหน้ายังตามบทบาทเดิม
import { EVENT_MODULES, buildAdminMenu } from "../src/config/navigation/admin-navigation.js";

// เมนูที่ปิดไม่ได้ เพื่อไม่ให้แอดมินล็อกตัวเองออกจากหน้าที่ใช้เปิดเมนูกลับ
export const PROTECTED_MENU_KEYS = ["path:/admin/settings"];

/** รหัสเมนู: เมนูของเหตุการณ์ใช้ "<ประเภท>:<key>" ส่วนเมนูอื่นใช้ "path:<ทางเข้า>" */
export function menuItemKey(section, item) {
  if (section?.eocType && item?.key) return `${section.eocType}:${item.key}`;
  return `path:${item?.path || ""}`;
}

/** กรองเมนูที่ถูกซ่อนออก — หมวดที่เมนูถูกซ่อนหมดจะหายไปด้วย */
export function applyMenuVisibility(sections = [], hidden = []) {
  const set = new Set((hidden || []).filter((key) => !PROTECTED_MENU_KEYS.includes(key)));
  if (!set.size) return sections;
  const result = [];
  for (const section of sections) {
    if (!section.items?.length) { result.push(section); continue; }
    const items = section.items.filter((item) => !set.has(menuItemKey(section, item)));
    if (items.length) result.push(items.length === section.items.length ? section : { ...section, items });
  }
  return result;
}

/** รายการเมนูทั้งหมดที่ปิดได้ จัดเป็นหมวด: [{ id, title, items: [{ key, name, description, protected }] }] */
export function buildMenuCatalog() {
  const groups = [];
  const seen = new Set();
  const add = (id, title, entries) => {
    const items = [];
    for (const { key, item } of entries) {
      if (seen.has(key)) continue;
      seen.add(key);
      items.push({ key, name: item.name, description: item.description || "", protected: PROTECTED_MENU_KEYS.includes(key) });
    }
    if (items.length) groups.push({ id, title, items });
  };
  for (const section of buildAdminMenu({})) {
    if (section.section === "events-heading" || section.eocType) continue;
    add(section.section, section.title, (section.items || []).map((item) => ({ key: menuItemKey(section, item), item })));
  }
  for (const [type, definition] of Object.entries(EVENT_MODULES)) {
    add(`event-${type}`, `เหตุการณ์: ${definition.label}`, definition.items({}).map((item) => ({ key: `${type}:${item.key}`, item })));
  }
  return groups;
}

export const catalogKeys = (catalog = buildMenuCatalog()) => new Set(catalog.flatMap((group) => group.items.map((item) => item.key)));
