import { EVENT_MODULES, groupMenuItems, isMenuItemActive } from "@/src/config/navigation/admin-navigation";

describe("grouped event menus", () => {
  const items = EVENT_MODULES.flood.items({ sessionId: 1 });
  test("flood menu grouped in 5 groups in order", () => {
    expect(groupMenuItems(items).map((group) => group.title)).toEqual(["ประเมินสถานการณ์", "สั่งการ", "พื้นที่และประชาชน", "การแพทย์และทีม", "ทรัพยากร"]);
    // แนวโน้มน้ำและฝนอยู่ข้างรายงานระดับน้ำ · แผนที่อยู่ที่ /analytics · สรุปห้องประชุมเป็นแท็บของภารกิจและข้อสั่งการ
    expect(groupMenuItems(items)[0].items.map((item) => item.key)).toEqual(["overview", "water-report", "hydro-trends", "area-risk"]);
    expect(groupMenuItems(items)[1].items.map((item) => item.key)).toEqual(["triggers", "command"]);
    expect(items.some((item) => item.key === "vulnerable-map")).toBe(false);
  });
  test("vulnerable menu stays active on persons map", () => {
    const vulnerable = items.find((item) => item.key === "vulnerable");
    expect(isMenuItemActive(vulnerable, "/eoc/flood/vulnerable-persons/", "")).toBe(true);
    expect(isMenuItemActive(vulnerable, "/eoc/flood/vulnerable-groups", "")).toBe(true);
    expect(isMenuItemActive(vulnerable, "/eoc/flood/records", "")).toBe(false);
  });
  test("ungrouped menus form one untitled group", () => {
    expect(groupMenuItems(EVENT_MODULES.disease.items({}))).toHaveLength(1);
  });
  test("เมนูรวมหลายแท็บ: active ทุกแท็บ ยกเว้นแท็บที่มีเมนูลัดของตัวเอง", () => {
    const command = items.find((item) => item.key === "command");
    expect(isMenuItemActive(command, "/eoc/flood/meeting-brief/", "")).toBe(true);
    expect(isMenuItemActive(command, "/eoc/flood/management/missions", "")).toBe(true);
    const records = EVENT_MODULES.disease.items({}).find((item) => item.key === "records");
    expect(isMenuItemActive(records, "/eoc/disease/records", "?tab=facility")).toBe(true);
    const users = { path: "/admin/officers", anyTab: true, exceptTabs: ["requests"], alsoActive: ["/admin/citizens"] };
    expect(isMenuItemActive(users, "/admin/officers", "")).toBe(true);
    expect(isMenuItemActive(users, "/admin/officers", "?tab=requests")).toBe(false);
    expect(isMenuItemActive(users, "/admin/citizens/", "")).toBe(true);
  });
});
