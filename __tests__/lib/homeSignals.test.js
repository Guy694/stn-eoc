import { canalState, canalSummary, citizenWaterReports, roadAlerts, shelterSummary, sortCanals } from "@/lib/homeSignals";

describe("homeSignals", () => {
  test("สถานะคลองและความสูงในเกจ", () => {
    expect(canalState({ bankDiff: 0.2, storagePercent: 140, situationLevel: 5 })).toMatchObject({ key: "overflow", fill: 1 });
    expect(canalState({ bankDiff: -0.3, storagePercent: 60 })).toMatchObject({ key: "near", fill: 0.5 });
    expect(canalState({ bankDiff: -3 }).key).toBe("normal");
    // สีตามระดับ: แดง ใกล้/ล้น · ส้ม ค่อนข้างสูง · เขียว ปกติ · น้ำเงิน เกือบแห้ง
    expect(canalState({ bankDiff: 0.1 }).color).toBe("#dc2626");
    expect(canalState({ bankDiff: -0.3 }).color).toBe("#dc2626");
    expect(canalState({ bankDiff: -0.8, storagePercent: 50 })).toMatchObject({ key: "high", color: "#ea580c" });
    expect(canalState({ bankDiff: -2, storagePercent: 85 })).toMatchObject({ key: "high", color: "#ea580c" });
    expect(canalState({ bankDiff: -2, storagePercent: 40, situationLevel: 1 })).toMatchObject({ key: "normal", color: "#16a34a" });
    expect(canalState({ bankDiff: -3, storagePercent: 6 })).toMatchObject({ key: "low", color: "#2563eb" });
    expect(canalState({ storagePercent: 120 }).key).toBe("overflow");
    expect(canalState({}).key).toBe("unknown");
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

  test("รายงานน้ำจากประชาชน: เฉพาะที่มีระดับน้ำ เรียงล่าสุดก่อน และไม่ซ้ำกับรายการถนน", () => {
    const incidents = [
      { id: 1, problem_category: "flood", water_level: "knee_waist", travel_status: "difficult", title: "น้ำท่วมระดับเข่า–เอว", village: "บ้านควน", district: "ละงู", verified_at: "2026-10-09T03:00:00Z", photo_path: "/stn-eoc/api/x.jpg", confirmations: { still: 3 } },
      { id: 2, problem_category: "flood", water_level: "chest_up", water_trend: "rising", verified_at: "2026-10-09T03:30:00Z" },
      { id: 3, problem_category: "flood", water_level: "ankle_knee", verified_at: "2026-10-08T20:00:00Z" },
      { id: 4, problem_category: "road_cut", title: "สะพานขาด", verified_at: "2026-10-09T01:00:00Z" },
      { id: 5, problem_category: "flood", water_level: "not-a-level" }
    ];
    const cards = citizenWaterReports(incidents);
    expect(cards.map((card) => card.id)).toEqual([2, 1, 3]);
    expect(cards[0]).toMatchObject({ trend: { value: "rising" }, level: { value: "chest_up" }, title: "อกขึ้นไป", photo: null });
    expect(cards[1]).toMatchObject({ title: "น้ำท่วมระดับเข่า–เอว", area: "บ้านควน อ.ละงู", photo: "/stn-eoc/api/x.jpg", stillCount: 3 });
    expect(roadAlerts(incidents).map((row) => row.id)).toEqual([4]);
  });

  test("สรุปศูนย์พักพิง", () => {
    expect(shelterSummary([{ vacancy: 10 }, { vacancy: 0, occupancy_status: "full" }])).toEqual({ open: 2, vacancy: 10, full: 1 });
  });
});
