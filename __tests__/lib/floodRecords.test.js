import {
  buildTambonCoverage, findDayRecord, localDateKey, shiftDateKey, summarizeCoverage, summarizeDay, validateRecordForm, villagesOf
} from "@/lib/floodRecords";

const polygons = [
  { id: 1, distname: "ละงู", subdistnam: "กำแพง", villname: "บ้านA" },
  { id: 2, distname: "ละงู", subdistnam: "กำแพง", villname: "บ้านA" }, // polygon ซ้ำชื่อ
  { id: 3, distname: "ละงู", subdistnam: "กำแพง", villname: "บ้านB" },
  { id: 4, distname: "ละงู", subdistnam: "ละงู", villname: "บ้านC" },
  { id: 5, distname: "ละงู", subdistnam: "ละงู", villname: " " }
];
const districts = [{ name: "ละงู", tambons: [{ name: "กำแพง" }, { name: "ละงู" }, { name: "น้ำผุด" }] }];

describe("floodRecords dates", () => {
  it("อ่านวันที่ทั้งสตริงจาก API และ Date ตามเวลาท้องถิ่น", () => {
    expect(localDateKey("2026-10-07")).toBe("2026-10-07");
    expect(localDateKey(new Date(2026, 9, 7, 0, 0))).toBe("2026-10-07");
    expect(shiftDateKey("2026-10-01", -1)).toBe("2026-09-30");
    expect(shiftDateKey("2026-12-31", 1)).toBe("2027-01-01");
  });
});

describe("buildTambonCoverage", () => {
  const records = [
    { district: "ละงู", tambon: "กำแพง", village: "บ้านA", flood_start_date: "2026-10-07" },
    { district: "ละงู", tambon: "ละงู", village: "บ้านC", flood_start_date: "2026-10-07" },
    { district: "ละงู", tambon: "กำแพง", village: "บ้านB", flood_start_date: "2026-10-06" }
  ];
  it("นับหมู่บ้านไม่ซ้ำ และข้ามตำบลที่ไม่มีขอบเขตหมู่บ้าน", () => {
    expect(villagesOf(polygons, "ละงู", "กำแพง")).toHaveLength(2);
    const rows = buildTambonCoverage({ districts, polygons, records, date: "2026-10-07" });
    expect(rows.map((row) => [row.tambon, row.recorded, row.total, row.status])).toEqual([
      ["กำแพง", 1, 2, "partial"],
      ["ละงู", 1, 1, "complete"]
    ]);
    expect(summarizeCoverage(rows)).toMatchObject({ complete: 1, partial: 1, empty: 0, percent: 67 });
  });
  it("หาข้อมูลเดิมของหมู่บ้านในวันเดียวกัน", () => {
    expect(findDayRecord(records, { date: "2026-10-07", district: "ละงู", tambon: "กำแพง", village: "บ้านA" })).toBeTruthy();
    expect(findDayRecord(records, { date: "2026-10-07", district: "ละงู", tambon: "กำแพง", village: "บ้านB" })).toBeNull();
  });
});

describe("summarizeDay / validateRecordForm", () => {
  it("รวมเฉพาะหมู่บ้านที่มีน้ำท่วม", () => {
    expect(summarizeDay([
      { flood_level: "ไม่มี", affected_people: 50 },
      { flood_level: "สูง", affected_households: 3, affected_people: 10 },
      { flood_level: "ต่ำ", affected_households: "2", affected_people: "5" }
    ])).toEqual({ villages: 2, severe: 1, households: 5, people: 15 });
  });
  it("ตรวจฟอร์ม", () => {
    const base = { district: "ละงู", tambon: "กำแพง", village: "บ้านA", flood_level: "สูง", flood_start_date: "2026-10-07", affected_households: "5", affected_people: "3", water_depth_cm: "", affected_area_sqm: "" };
    expect(validateRecordForm(base).errors.affected_households).toBeDefined();
    expect(validateRecordForm({ ...base, village: "" }).errors.village).toBeDefined();
    const ok = validateRecordForm({ ...base, affected_households: "2", affected_people: "", water_depth_cm: "40" });
    expect(ok.ok).toBe(true);
    expect(ok.value).toMatchObject({ affected_households: 2, affected_people: 0, water_depth_cm: 40, affected_area_sqm: null });
    expect(validateRecordForm({ ...base, village: "", affected_households: "1" }, { tambonMode: true }).ok).toBe(true);
  });
});
