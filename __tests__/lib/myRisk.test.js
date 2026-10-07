import { assessHomeRisk, atLeast, homeAdvice, nearest } from "@/lib/myRisk";

describe("myRisk", () => {
  const now = Date.parse("2026-10-07T12:00:00Z");

  test("ใช้ระดับอำเภอเมื่อไม่มีอะไรใกล้บ้าน", () => {
    expect(assessHomeRisk({ districtLevel: "normal", elevation: 12 })).toMatchObject({ level: "normal", reasons: [] });
    expect(assessHomeRisk({ districtLevel: "watch", elevation: 12 }).level).toBe("watch");
  });

  test("ในพื้นที่น้ำท่วม หรือคลองใกล้บ้านล้นตลิ่ง → อย่างน้อยเสี่ยงสูง", () => {
    expect(assessHomeRisk({ floodArea: { label: "เข่า–เอว" } }).level).toBe("high");
    const station = { km: 1.2, item: { name: "บ้านปันจอร์", bankDiff: 0.3 } };
    expect(assessHomeRisk({ station }).level).toBe("high");
    expect(assessHomeRisk({ station: { km: 8, item: { name: "ไกล", bankDiff: 0.3 } } }).level).toBe("normal");
    expect(assessHomeRisk({ station: { km: 1, item: { name: "ก", bankDiff: -0.2 } } }).level).toBe("watch");
  });

  test("รายงานน้ำสูงจากประชาชนใกล้บ้านในช่วง 12 ชม.", () => {
    const reports = [{ km: 0.4, item: { water_level: "knee_waist", reported_at: "2026-10-07T10:00:00Z" } }];
    expect(assessHomeRisk({ reports, now }).level).toBe("watch");
    const old = [{ km: 0.4, item: { water_level: "knee_waist", reported_at: "2026-10-06T10:00:00Z" } }];
    expect(assessHomeRisk({ reports: old, now }).level).toBe("normal");
  });

  test("ที่ต่ำเพิ่มระดับเฉพาะเมื่อมีความเสี่ยงอยู่แล้ว", () => {
    expect(assessHomeRisk({ districtLevel: "normal", elevation: 2 }).level).toBe("normal");
    expect(assessHomeRisk({ districtLevel: "watch", elevation: 2 }).level).toBe("high");
    expect(atLeast("critical", "watch")).toBe("critical");
  });

  test("รายการใกล้สุดและคำแนะนำ", () => {
    const rows = nearest(6.6, 100, [{ id: 1, lat: 6.7, lon: 100 }, { id: 2, lat: 6.601, lng: 100 }, { id: 3 }], { limit: 1 });
    expect(rows.map((row) => row.item.id)).toEqual([2]);
    expect(homeAdvice("normal")).toHaveLength(1);
    expect(homeAdvice("high", { sheltersOpen: true }).join(" ")).toMatch(/ศูนย์พักพิง/);
  });
});
