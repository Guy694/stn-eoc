import { PROTECTED_MENU_KEYS, applyMenuVisibility, buildMenuCatalog, catalogKeys, menuItemKey } from "@/lib/menuVisibility";
import { buildAdminMenu } from "@/src/config/navigation/admin-navigation";

const status = { flood: { is_active: true, session_id: 1 } };
const pathsOf = (sections) => sections.flatMap((section) => section.items.map((item) => item.path));

describe("เปิด/ปิดเมนูหลังบ้าน", () => {
  test("ไม่มีเมนูที่ปิด = เมนูเหมือนเดิมทุกอย่าง", () => {
    const menu = buildAdminMenu({ eocStatus: status });
    expect(applyMenuVisibility(menu, [])).toBe(menu);
  });

  test("ซ่อนเมนูของเหตุการณ์ตามรหัส <ประเภท>:<key> ไม่กระทบเหตุการณ์อื่น", () => {
    const menu = buildAdminMenu({ eocStatus: { ...status, disease: { is_active: true, session_id: 2 } } });
    const shown = applyMenuVisibility(menu, ["flood:records"]);
    expect(pathsOf(shown)).not.toContain("/eoc/flood/records");
    expect(pathsOf(shown)).toContain("/eoc/disease/records"); // key เดียวกันแต่คนละเหตุการณ์
  });

  test("ซ่อนเมนูทั่วไปตาม path และหมวดที่ว่างแล้วหายไปด้วย", () => {
    const menu = buildAdminMenu({ eocStatus: status });
    const pending = menu.find((section) => section.section === "pending");
    const keys = pending.items.map((item) => menuItemKey(pending, item));
    const shown = applyMenuVisibility(menu, keys);
    expect(shown.find((section) => section.section === "pending")).toBeUndefined();
    expect(shown.find((section) => section.section === "overview")).toBeDefined();
  });

  test("ตั้งค่าระบบปิดไม่ได้ แม้ส่งมาในรายการ", () => {
    const shown = applyMenuVisibility(buildAdminMenu({}), PROTECTED_MENU_KEYS);
    expect(pathsOf(shown)).toContain("/admin/settings");
  });

  test("รายการเมนูให้เลือกครบทุกเมนูของแอดมินและของทุกเหตุการณ์ ไม่ซ้ำ", () => {
    const keys = catalogKeys(buildMenuCatalog());
    const all = buildAdminMenu({ eocStatus: { flood: { is_active: true }, disease: { is_active: true }, "festival-accidents": { is_active: true } } });
    for (const section of all) {
      if (section.section === "events-heading") continue;
      for (const item of section.items) expect(keys.has(menuItemKey(section, item))).toBe(true);
    }
    const total = buildMenuCatalog().reduce((sum, group) => sum + group.items.length, 0);
    expect(total).toBe(keys.size);
  });
});
