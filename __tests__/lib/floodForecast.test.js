import { assessConditions, expectedExtent, forecastArea, rainAtHighTide, rainPoints, runScenario, susceptibilityFactor } from "@/lib/floodForecast";
import { buildExtents } from "@/lib/floodForecastData";

const coastalRiver = {
  key: "ละงู|ละงู", district: "ละงู", tambon: "ละงู", coastal: true, riverine: true, susceptibility: 34,
  extent: { 1: { rai: 2235, villages: [{ name: "ม.1 บ้านละงู", households: 400 }, { name: "ม.3", households: 200 }] }, 2: { rai: 900, villages: [{ name: "ม.1 บ้านละงู", households: 400 }] }, 3: { rai: 530, villages: [] } }
};
const inland = { key: "มะนัง|ปาล์มพัฒนา", district: "มะนัง", tambon: "ปาล์มพัฒนา", coastal: false, riverine: false, susceptibility: 4, extent: null };

describe("floodForecast", () => {
  it("คะแนนฝนและตัวคูณความเปราะบาง", () => {
    expect([rainPoints(10), rainPoints(40), rainPoints(70), rainPoints(120), rainPoints(160)]).toEqual([0, 4, 8, 12, 16]);
    expect(susceptibilityFactor(0)).toBeCloseTo(0.5);
    expect(susceptibilityFactor(40)).toBeCloseTo(1.5);
  });

  it("ฝนหนัก + คลองล้นตลิ่ง + น้ำทะเลหนุนสูงตรงช่วงฝน → วิกฤต พร้อมพื้นที่/หมู่บ้านที่คาดว่าท่วม", () => {
    const result = assessConditions(coastalRiver, { rain24: 110, rain72: 210, canal: "overflow", sea: "high", compoundTiming: true });
    expect(result.hazard).toBe(12 + 6 + 14 + 7 + 7);
    expect(result.level).toBe("critical");
    expect(expectedExtent(coastalRiver, result.level)).toMatchObject({ min_freq: 1, rai: 2235, households: 600 });
  });

  it("น้ำทะเลหนุนไม่มีผลกับตำบลไม่ติดทะเล และคลองไม่มีผลกับตำบลที่ไม่มีคลอง/ไม่เคยท่วม", () => {
    const result = assessConditions(inland, { rain24: 0, canal: "overflow", sea: "record" });
    expect(result.score).toBe(0);
    expect(result.level).toBe("normal");
  });

  it("จำลองสถานการณ์: ตำบลติดทะเลที่เปราะบางขึ้นอันดับแรก", () => {
    const { results, counts } = runScenario([inland, coastalRiver], { rain24: 70, rain72: 130, canal: "near", sea: "high" });
    expect(results[0].key).toBe(coastalRiver.key);
    expect(results[0].level).not.toBe("normal");
    expect(counts.normal + counts.watch + counts.high + counts.critical).toBe(2);
  });

  it("พยากรณ์รายวันหา 'วันที่เสี่ยงที่สุด'", () => {
    const { days, peak } = forecastArea(coastalRiver, [
      { date: "2026-10-09", rain24: 5, rain72: 10, canal: "normal", sea: "elevated" },
      { date: "2026-10-10", rain24: 95, rain72: 140, canal: "high", sea: "high", compoundTiming: true }
    ]);
    expect(days).toHaveLength(2);
    expect(peak.date).toBe("2026-10-10");
    expect(peak.factors.map((f) => f.label).join(" ")).toMatch(/ตรงกับช่วงน้ำขึ้นสูงสุด/);
  });

  it("ฝนหนักตรงกับน้ำขึ้นที่หนุน", () => {
    const high = { at: "2026-10-10T16:00:00Z", status: "high" };
    expect(rainAtHighTide([{ t: Date.parse("2026-10-10T14:00:00Z"), mm: 15 }], [high])).toBe(true);
    expect(rainAtHighTide([{ t: Date.parse("2026-10-10T08:00:00Z"), mm: 15 }], [high])).toBe(false);
    expect(rainAtHighTide([{ t: Date.parse("2026-10-10T15:00:00Z"), mm: 15 }], [{ ...high, status: "normal" }])).toBe(false);
  });

  it("แปลงน้ำท่วมซ้ำ → หมู่บ้านตามจุดในรูป", () => {
    const square = (x, y, d = 1) => ({ type: "Polygon", coordinates: [[[x, y], [x + d, y], [x + d, y + d], [x, y + d], [x, y]]] });
    const villages = [{ name: "ม.1", key: "ละงู|ละงู", households: 100, geometry: square(0, 0, 10) }];
    const features = [
      { properties: { district: "ละงู", tambon: "ละงู", freq: 4, area_rai: 50 }, geometry: square(1, 1) },
      { properties: { district: "ละงู", tambon: "ละงู", freq: 1, area_rai: 20 }, geometry: square(20, 20) }
    ];
    const extents = buildExtents(features, villages);
    expect(extents["ละงู|ละงู"][1]).toMatchObject({ rai: 70, villages: [{ name: "ม.1", households: 100 }] });
    expect(extents["ละงู|ละงู"][3]).toMatchObject({ rai: 50 });
  });
});
