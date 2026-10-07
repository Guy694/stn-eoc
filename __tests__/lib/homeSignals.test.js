import { canalState, canalSummary, roadAlerts, shelterSummary, sortCanals } from "@/lib/homeSignals";

describe("homeSignals", () => {
  test("สถานะคลองและความสูงในเกจ", () => {
    expect(canalState({ bankDiff: 0.2, storagePercent: 140, situationLevel: 5 })).toMatchObject({ key: "overflow", fill: 1 });
    expect(canalState({ bankDiff: -0.3, storagePercent: 60 })).toMatchObject({ key: "near", fill: 0.5 });
    expect(canalState({ bankDiff: -3 }).key).toBe("normal");
    expect(canalState({}).key).toBe("unknown");
  });

  test("เรียงคลองที่น่าห่วงก่อน และสรุปเป็นประโยค", () => {
    const stations = [{ name: "ก", bankDiff: -3 }, { name: "ข", bankDiff: 0.1 }, { name: "ค", bankDiff: -0.2 }];
    expect(sortCanals(stations).map((item) => item.name)).toEqual(["ข", "ค", "ก"]);
    expect(canalSummary(stations)).toBe("น้ำล้นตลิ่ง 1 สถานี และใกล้ตลิ่งอีก 1 สถานี");
    expect(canalSummary([{ bankDiff: -2 }])).toBe("ทุกสถานีต่ำกว่าตลิ่ง (1 สถานี)");
    expect(canalSummary([])).toMatch(/ยังไม่มีข้อมูล/);
  });

  test("ถนนที่ควรเลี่ยง: เฉพาะจุดถนน เรียงผ่านไม่ได้ก่อน", () => {
    const rows = roadAlerts([
      { id: 1, problem_category: "flood", travel_status: "passable" },
      { id: 2, problem_category: "flood", travel_status: "difficult", published_at: "2026-10-07T10:00:00Z" },
      { id: 3, problem_category: "road_cut", public_title: "สะพานขาด", district: "ละงู", published_at: "2026-10-07T08:00:00Z" }
    ]);
    expect(rows.map((row) => row.id)).toEqual([3, 2]);
    expect(rows[0]).toMatchObject({ title: "สะพานขาด", blocked: true, area: "อ.ละงู" });
  });

  test("สรุปศูนย์พักพิง", () => {
    expect(shelterSummary([{ vacancy: 10 }, { vacancy: 0, occupancy_status: "full" }])).toEqual({ open: 2, vacancy: 10, full: 1 });
  });
});
