import {
  OPEN_HELP_STATUSES,
  countBy,
  defaultStaffMapFilters,
  filterHelpRequests,
  filterPeople,
  summarizeStaffMap,
  toggleValue
} from "@/lib/staffSituationMap";

const people = [
  { id: 1, vulnerable_type: "bedridden", care_group: "red", status: "waiting", district: "ละงู", location: { lat: 6.8, lng: 99.8 } },
  { id: 2, vulnerable_type: "elderly", care_group: "yellow", status: "assisted", district: "เมืองสตูล", location: { lat: 6.6, lng: 100.1 } },
  { id: 3, vulnerable_type: "pregnant", care_group: "green", status: "en_route", district: "ละงู", location: null },
  { id: 4, vulnerable_type: "dialysis_hd", care_group: null, status: undefined, district: "อ.ควนโดน", location: { lat: 6.8, lng: 100.1 } }
];
const help = [
  { id: 10, status: "pending", district: "ละงู", latitude: "6.85", longitude: "99.8" },
  { id: 11, status: "resolved", district: "ละงู", latitude: "6.85", longitude: "99.8" },
  { id: 12, status: "reviewing", district: "ทุ่งหว้า", latitude: null, longitude: null }
];

describe("staffSituationMap", () => {
  test("ค่าเริ่มต้น: เห็นกลุ่มเปราะบางทุกคน และเฉพาะคำขอที่ยังต้องทำ", () => {
    const filters = defaultStaffMapFilters();
    expect(filterPeople(people, filters).map((p) => p.id)).toEqual([1, 2, 3, 4]);
    expect(filterHelpRequests(help, filters).map((r) => r.id)).toEqual([10, 12]);
    expect(OPEN_HELP_STATUSES).not.toContain("resolved");
  });

  test("กรองตามประเภท กลุ่มสี สถานะ และอำเภอ (ชื่อมี อ. นำหน้าได้)", () => {
    const base = defaultStaffMapFilters();
    expect(filterPeople(people, { ...base, types: ["bedridden", "pregnant"] }).map((p) => p.id)).toEqual([1, 3]);
    expect(filterPeople(people, { ...base, careGroups: ["red"] }).map((p) => p.id)).toEqual([1, 4]);
    expect(filterPeople(people, { ...base, statuses: ["waiting"] }).map((p) => p.id)).toEqual([1, 4]);
    expect(filterPeople(people, { ...base, district: "ควนโดน" }).map((p) => p.id)).toEqual([4]);
    expect(filterHelpRequests(help, { ...base, district: "ละงู", helpStatuses: ["pending", "resolved"] }).map((r) => r.id)).toEqual([10, 11]);
  });

  test("ปิดชั้นข้อมูล = ไม่มีรายการ · requireLocation ตัดรายการที่ไม่มีพิกัด", () => {
    const base = defaultStaffMapFilters();
    expect(filterPeople(people, { ...base, showPeople: false })).toEqual([]);
    expect(filterHelpRequests(help, { ...base, showHelp: false })).toEqual([]);
    expect(filterPeople(people, base, { requireLocation: true }).map((p) => p.id)).toEqual([1, 2, 4]);
    expect(filterHelpRequests(help, base, { requireLocation: true }).map((r) => r.id)).toEqual([10]);
  });

  test("สรุปตามกลุ่มสถานะ", () => {
    expect(summarizeStaffMap(people, help.slice(0, 2))).toEqual({
      people: 4, people_pending: 2, people_progress: 1, people_done: 1, people_no_location: 1, help: 2, help_pending: 1
    });
  });

  test("countBy และ toggleValue", () => {
    expect(countBy(people, (p) => p.district)).toEqual({ "ละงู": 2, "เมืองสตูล": 1, "อ.ควนโดน": 1 });
    expect(toggleValue(["a", "b"], "a")).toEqual(["b"]);
    expect(toggleValue(["b"], "a")).toEqual(["b", "a"]);
  });
});
