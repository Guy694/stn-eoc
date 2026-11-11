import { bankDiffSeries, bucketText, districtFill, districtLegend, mergeLevelAndRain, sortRows, timeLabel, waterTone } from "@/components/eoc/hydro/hydroUi";

describe("hydroUi", () => {
  it("สีอำเภอ: ไม่มีข้อมูลเป็นสีเทาแยกจากฝน 0 และใช้เกณฑ์ฝน 24 ชม. กับฝนสูงสุดต่อวัน", () => {
    expect(districtFill("max_day_mm", null).missing).toBe(true);
    expect(districtFill("max_day_mm", 0).color).not.toBe(districtFill("max_day_mm", null).color);
    expect(districtFill("max_day_mm", 40).label).toBe("ฝนหนัก");
    expect(districtFill("heavy_days", 3).label).toBe("2–3");
    expect(districtFill("total_mm", 100, 100).text).toBe("#ffffff");
    expect(districtFill("total_mm", 5, 0).color).toBe(districtFill("total_mm", 0, 100).color);
  });

  it("คำอธิบายสีของฝนสะสมแบ่ง 6 ขั้นจากค่าสูงสุด", () => {
    const legend = districtLegend("total_mm", 120);
    expect(legend).toHaveLength(6);
    expect(legend[0].label).toBe("0–20");
    expect(legend.at(-1).label).toBe("≥ 100");
    expect(districtLegend("total_mm", 0)).toHaveLength(1);
  });

  it("รวมระดับน้ำกับฝนตามเวลาเดียวกัน และเรียงตามเวลา", () => {
    const rows = mergeLevelAndRain(
      [{ t: "2026-11-01 02:00:00", level: 1.2 }, { t: "2026-11-01 01:00:00", level: 1.1 }],
      [{ t: "2026-11-01 01:00:00", mm: 4 }, { t: "2026-11-01 03:00:00", mm: 9 }]
    );
    expect(rows).toEqual([
      { t: "2026-11-01 01:00:00", level: 1.1, rain: 4 },
      { t: "2026-11-01 02:00:00", level: 1.2 },
      { t: "2026-11-01 03:00:00", rain: 9 }
    ]);
  });

  it("ระดับน้ำเทียบตลิ่ง: ข้ามสถานีที่ไม่มีค่าตลิ่ง", () => {
    const rows = bankDiffSeries([
      { code: "A", bank: 2, series: [{ t: "t1", level: 1.5 }, { t: "t2", level: 2.25 }] },
      { code: "B", bank: null, series: [{ t: "t1", level: 9 }] },
      { code: "C", bank: 1, series: [{ t: "t2", level: 0.4 }] }
    ]);
    expect(rows).toEqual([{ t: "t1", A: -0.5 }, { t: "t2", A: 0.25, C: -0.6 }]);
  });

  it("เรียงตาราง: ค่าว่างอยู่ท้ายทั้งสองทิศ", () => {
    const rows = [{ v: 2 }, { v: null }, { v: 5 }];
    expect(sortRows(rows, "v", "desc").map((r) => r.v)).toEqual([5, 2, null]);
    expect(sortRows(rows, "v", "asc").map((r) => r.v)).toEqual([2, 5, null]);
  });

  it("สถานะสถานีและป้ายเวลา", () => {
    expect(waterTone({ hours_over_bank: 2, hours_near_bank: 5 }).key).toBe("over");
    expect(waterTone({ hours_over_bank: 0, hours_near_bank: 1 }).key).toBe("near");
    expect(waterTone({ hours_over_bank: 0, hours_near_bank: 0 }).key).toBe("ok");
    expect(timeLabel("2026-11-05 14:00:00")).toBe("5 พ.ย. 14:00 น.");
    expect(timeLabel("2026-11-05 00:00:00", 24)).toBe("5 พ.ย.");
    expect(bucketText(3)).toBe("ราย 3 ชม.");
  });
});
