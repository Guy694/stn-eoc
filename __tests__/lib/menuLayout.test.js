import { applyMenuLayout, buildMenuLayout, normalizeLayoutInput, ownerLabel } from "@/lib/menuLayout";
import { buildAdminMenu, eventMenuItems } from "@/src/config/navigation/admin-navigation";

const items = [
  { key: "a", name: "A", group: "G1" },
  { key: "b", name: "B", group: "G1" },
  { key: "c", name: "C", group: "G2" },
  { key: "d", name: "D" }
];

test("ไม่ตั้งค่า = เมนูเดิมทุกอย่าง", () => {
  expect(applyMenuLayout("flood", items, {}).map((item) => item.key)).toEqual(["a", "b", "c", "d"]);
});

test("ย้ายเมนูไปกลุ่มใหม่และเรียงใหม่ — เมนูกลุ่มเดียวกันอยู่ติดกัน", () => {
  const layout = buildMenuLayout([
    { eoc_type: "flood", module_key: "d", group_name: "G1", sort_order: 0 },
    { eoc_type: "flood", module_key: "c", group_name: "", sort_order: 1 },
    { eoc_type: "flood", module_key: "a", group_name: "G1", sort_order: 2 },
    { eoc_type: "flood", module_key: "b", group_name: "ใหม่", sort_order: 3 }
  ]);
  const result = applyMenuLayout("flood", items, layout);
  expect(result.map((item) => [item.key, item.group || ""])).toEqual([["d", "G1"], ["a", "G1"], ["c", ""], ["b", "ใหม่"]]);
});

test("ป้ายทีมเจ้าของเมนู", () => {
  expect(ownerLabel("flood", "shelters", {})).toBe("LOGISTICS");
  expect(ownerLabel("flood", "command", {})).toBe("ทุกทีม");
  expect(ownerLabel("flood", "overview", {})).toBeNull();
  expect(ownerLabel("flood", "records", { "flood:records": ["sat", "serht"] })).toBe("SAT · SEhRT");
});

test("ตรวจค่าที่แอดมินส่ง", () => {
  expect(normalizeLayoutInput([{ key: "x" }], ["a"]).ok).toBe(false);
  expect(normalizeLayoutInput([{ key: "a", group: "x".repeat(61) }], ["a"]).ok).toBe(false);
  expect(normalizeLayoutInput([{ key: "b", group: "  กลุ่ม  ใหม่ " }, { key: "a" }], ["a", "b"]).value).toEqual([{ key: "b", group: "กลุ่ม ใหม่", order: 0 }, { key: "a", group: "", order: 1 }]);
});

test("เมนูแอดมินมีป้ายผู้รับผิดชอบหมวด และเมนูเหตุการณ์มีป้ายทีม", () => {
  const menu = buildAdminMenu({ eocStatus: { flood: { is_active: true, session_number: 1 } } });
  expect(menu.find((section) => section.section === "system").audience).toBe("แอดมิน");
  const flood = eventMenuItems("flood", {});
  expect(flood.find((item) => item.key === "supplies").ownerLabel).toBe("LOGISTICS");
});
