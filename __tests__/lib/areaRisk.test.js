import { areaKey, assessArea, normalizeAreaName, rankAreas } from "@/lib/areaRisk";
import { geometryBounds, gridPoints, pointInGeometry } from "@/lib/geoSample";
import { profileFromSamples } from "@/lib/terrainProfile";

const base = {
  key: "ละงู|กำแพง", district: "ละงู", tambon: "กำแพง", households: 4700,
  terrain: { low10_pct: 45, coastal: true },
  gistda: { total_rai: 3000, repeated_rai: 2500, max_freq: 5 },
  eoc_history: { years: 3, max_level: "สูง" },
  vulnerable: { total: 600, priority: 60 },
  shelters: [{ name: "โรงเรียนบ้านกำแพง", capacity: 300, vacancy: 250 }]
};

describe("areaRisk", () => {
  it("ชื่อพื้นที่จากหลายแหล่งตรงกัน", () => {
    expect(normalizeAreaName("ต. กำแพง")).toBe("กำแพง");
    expect(areaKey("อ.ละงู", "ตำบลกำแพง")).toBe("ละงู|กำแพง");
  });

  it("ไม่มีภัยตอนนี้ → ความเสี่ยงตอนนี้ปกติ แต่ความเปราะบางพื้นฐานสูง", () => {
    const result = assessArea(base);
    expect(result.now_level).toBe("normal");
    expect(result.susceptibility.score).toBe(40); // 15+10+10+10 = 45 → เพดาน 40
    expect(result.exposure.score).toBe(20);
    expect(result.baseline_level).toBe("high");
    expect(result.actions).toEqual([]);
  });

  it("อำเภอเสี่ยงสูง + น้ำใกล้ตลิ่ง + น้ำทะเลหนุนสูง → วิกฤต พร้อมงานที่ต้องทำ", () => {
    const result = assessArea({
      ...base,
      district_weather: { risk_level: "high", top_reason: "ฝนวัดได้ 80 มม." },
      water_station: { state: "near", station: "คลองละงู", bank_diff: -0.3 },
      sea: { key: "high", label: "หนุนสูง", at: "2026-10-09T15:00:00Z" }
    });
    expect(result.hazard.score).toBe(25);
    expect(result.now_score).toBe(50); // 25 × (1 + 60/60)
    expect(result.now_level).toBe("critical");
    expect(result.actions.join(" ")).toMatch(/ผู้ติดเตียง\/พิการ\/ตั้งครรภ์ 60 คน/);
    expect(result.actions.join(" ")).toMatch(/โรงเรียนบ้านกำแพง/);
    expect(result.actions.join(" ")).toMatch(/น้ำทะเลขึ้นสูงสุด/);
  });

  it("ภัยเท่ากัน ตำบลที่เปราะบางกว่าขึ้นอันดับก่อน และนับจำนวนรายระดับ", () => {
    const hazard = { district_weather: { risk_level: "watch" } };
    const { areas, counts } = rankAreas([
      { key: "a", district: "ก", tambon: "ก", households: 100, ...hazard },
      { ...base, ...hazard }
    ]);
    expect(areas[0].key).toBe(base.key);
    expect(counts.watch + counts.high + counts.normal + counts.critical).toBe(2);
  });

  it("ตำบลไม่ติดทะเลไม่นับน้ำทะเลหนุน", () => {
    const inland = assessArea({ ...base, terrain: { low10_pct: 0, coastal: false }, sea: { key: "record", label: "หนุนสูงสุด" } });
    expect(inland.hazard.score).toBe(0);
  });

  it("เรขาคณิต: จุดในรูปที่มีรู และโปรไฟล์ความสูง", () => {
    const geometry = { type: "Polygon", coordinates: [[[0, 0], [4, 0], [4, 4], [0, 4], [0, 0]], [[1, 1], [2, 1], [2, 2], [1, 2], [1, 1]]] };
    expect(pointInGeometry([3, 3], geometry)).toBe(true);
    expect(pointInGeometry([1.5, 1.5], geometry)).toBe(false);
    expect(gridPoints(geometryBounds(geometry), 1).length).toBe(16);
    const profile = profileFromSamples([1, 3, 8, 20, -1], [-2, -3, 5]);
    expect(profile).toMatchObject({ samples: 4, low2_pct: 25, low5_pct: 50, low10_pct: 75, coastal: true });
  });
});
