import { summarizeRecovery, tambonRecovery } from "@/lib/tambonRecovery";

describe("tambonRecovery", () => {
  const rows = [
    // ต.ก: หมู่ 1 น้ำลดจนหมด → ปกติ
    { district: "อ.ละงู", tambon: "ก", village: "1", date: "2026-10-09", level: "สูง" },
    { district: "ละงู", tambon: "ก", village: "1", date: "2026-10-11", level: "ไม่มี" },
    // ต.ข: หมู่ 1 ลดจากสูงเป็นต่ำ → คลี่คลาย
    { district: "ละงู", tambon: "ข", village: "1", date: "2026-10-10", level: "สูง" },
    { district: "ละงู", tambon: "ข", village: "1", date: "2026-10-11", level: "ต่ำ" },
    // ต.ค: หมู่ 1 ลดลง แต่หมู่ 2 เพิ่มขึ้น → ยังไม่คลี่คลาย
    { district: "มะนัง", tambon: "ค", village: "1", date: "2026-10-10", level: "สูง" },
    { district: "มะนัง", tambon: "ค", village: "1", date: "2026-10-11", level: "ต่ำ" },
    { district: "มะนัง", tambon: "ค", village: "2", date: "2026-10-10", level: "ต่ำ" },
    { district: "มะนัง", tambon: "ค", village: "2", date: "2026-10-11", level: "สูง" },
    // ต.ง: ไม่เคยท่วม → ไม่นับ
    { district: "มะนัง", tambon: "ง", village: "1", date: "2026-10-11", level: "ไม่มี" },
    // ต.จ: รายงานครั้งเดียวและยังท่วม → ยังไม่คลี่คลาย
    { district: "มะนัง", tambon: "จ", village: "3", date: "2026-10-11", level: "ปานกลาง" }
  ];

  test("status per tambon", () => {
    const result = Object.fromEntries(tambonRecovery(rows).map((row) => [row.tambon, row.status]));
    expect(result).toEqual({ ก: "normal", ข: "easing", ค: "ongoing", จ: "ongoing" });
  });

  test("summary by district", () => {
    const summary = summarizeRecovery(tambonRecovery(rows));
    expect(summary).toMatchObject({ normal: 1, easing: 1, ongoing: 2, count: 4 });
    expect(summary.districts.find((row) => row.district === "มะนัง")).toMatchObject({ ongoing: 2, ongoingTambons: ["ค", "จ"] });
  });
});
