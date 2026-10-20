import { distanceKm, needsOf, parseCapabilities, suggestShelters, suggestionReason } from "@/lib/shelterSuitability";

const shelters = [
  { id: 1, name: "โรงเรียน ก", lat: 6.62, lon: 100.07, capacity: 100, occupancy: 20, active: 1 },
  { id: 2, name: "รพ.สนาม", lat: 6.70, lon: 100.10, capacity: 30, occupancy: 10, active: 1, shelter_type: "medical", capabilities: "medical_beds,power_backup,health_staff" },
  { id: 3, name: "วัด ค", lat: 6.621, lon: 100.071, capacity: 50, occupancy: 50, active: 1 },
  { id: 4, name: "ปิดอยู่", lat: 6.62, lon: 100.07, capacity: 50, occupancy: 0, active: 0, shelter_type: "medical" }
];
const home = { lat: 6.621, lng: 100.07 };

describe("shelterSuitability", () => {
  test("parse and needs", () => {
    expect(parseCapabilities("oxygen, unknown,wheelchair,oxygen")).toEqual(["oxygen", "wheelchair"]);
    expect(needsOf({ vulnerable_type: "elderly", needs: "ใช้ออกซิเจนที่บ้าน" }).caps).toContain("oxygen");
    expect(distanceKm({ lat: 6.62, lng: 100.07 }, { lat: 6.62, lng: 100.07 })).toBe(0);
  });

  test("bedridden goes to medical shelter first even if farther; full and inactive last/excluded", () => {
    const list = suggestShelters({ vulnerable_type: "bedridden", location: home }, shelters);
    expect(list.map((item) => item.id)).toEqual([2, 1, 3]);
    expect(list[0]).toMatchObject({ suitable: true, matched: ["medical_beds", "power_backup", "health_staff"] });
    expect(list[2].full).toBe(true);
    expect(suggestionReason(list[0])).toMatch(/^Medical · มีเตียงผู้ป่วย/);
  });

  test("without typed shelters, nearest with space first", () => {
    const list = suggestShelters({ vulnerable_type: "children", location: home }, shelters.filter((s) => !s.shelter_type));
    expect(list.map((item) => item.id)).toEqual([1, 3]);
    expect(suggestionReason(list[0])).toMatch(/ห่าง 0\.\d กม\. · ว่าง 80 ที่/);
  });
});

describe("quick filters for vulnerable persons", () => {
  const { filterPersons, matchesQuickFilter, validateStatusChange } = require("@/lib/vulnerablePersons");
  const people = [
    { id: 1, vulnerable_type: "bedridden", status: "waiting", location: { lat: 1, lng: 1 }, in_flood_area: true },
    { id: 2, vulnerable_type: "elderly", care_group: "yellow", status: "waiting", location: { lat: 1, lng: 1 }, in_flood_area: true },
    { id: 3, vulnerable_type: "dialysis_hd", status: "assisted", location: null },
    { id: 4, vulnerable_type: "pregnant", status: "waiting", due_date: "2026-10-20", location: null },
    { id: 5, vulnerable_type: "children", care_group: "yellow", status: "waiting", due_date: "2026-10-20", location: null }
  ];
  test("priority = pending high-priority types", () => {
    expect(filterPersons(people, { quick: "priority", today: "2026-10-12" }).map((p) => p.id)).toEqual([1, 4]);
  });
  test("flood_pending and unmapped", () => {
    expect(people.filter((p) => matchesQuickFilter(p, "flood_pending")).map((p) => p.id)).toEqual([1, 2]);
    expect(people.filter((p) => matchesQuickFilter(p, "unmapped")).map((p) => p.id)).toEqual([3, 4, 5]);
  });
  test("moved needs a shelter or a destination", () => {
    expect(validateStatusChange({ status: "moved" }).error).toMatch("ศูนย์พักพิง");
    expect(validateStatusChange({ status: "moved", moved_shelter_id: "7" }).value).toMatchObject({ moved_shelter_id: 7, moved_to: null });
    expect(validateStatusChange({ status: "assisted", moved_shelter_id: "7" }).value.moved_shelter_id).toBeNull();
  });
});
