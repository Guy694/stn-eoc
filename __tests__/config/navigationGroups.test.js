import { EVENT_MODULES, groupMenuItems, isMenuItemActive } from "@/src/config/navigation/admin-navigation";

describe("grouped event menus", () => {
  const items = EVENT_MODULES.flood.items({ sessionId: 1 });
  test("flood menu grouped in 5 groups in order", () => {
    expect(groupMenuItems(items).map((group) => group.title)).toEqual(["ประเมินสถานการณ์", "สั่งการ", "พื้นที่และประชาชน", "การแพทย์และทีม", "ทรัพยากร"]);
    expect(groupMenuItems(items)[0].items.map((item) => item.key)).toEqual(["overview", "water-report", "risk-map", "area-risk"]);
    expect(groupMenuItems(items)[1].items.map((item) => item.key)).toEqual(["triggers", "command", "brief"]);
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
});
