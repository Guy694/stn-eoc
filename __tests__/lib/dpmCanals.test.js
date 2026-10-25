import { thresholdBar, DPM_STATUS, dpmSummary, dpmTrend, gaugeScale, nextThreshold, normalizeDpmStation, sortDpmStations, statusFromThresholds } from "@/lib/dpmCanals";

// ตัวอย่างจาก /api/v1/stations/STN02 (ตัดเหลือฟิลด์ที่ใช้)
const raw = {
  name: "สะพานข้ามคลองละงู ถนน404", basin: "คลองละงู", amphoeName: "ละงู", telephone: "0800000000",
  currentWaterLevel: 3.02, riverBankLevel: 3.75, waterLevelStatus: 4,
  waterThreshold: { mediumLevelThreshold: 0.75, highLevelThreshold: 2.5, dangerLevelThreshold: 3, criticalLevelThreshold: 3.5 },
  histories: [{ timeStamp: "2026-10-25T02:20:00.000", level: 3.02 }]
};

describe("สถานีวัดระดับน้ำ ปภ.", () => {
  test("แปลงข้อมูล ใช้สถานะตามเกณฑ์ของ ปภ.", () => {
    const station = normalizeDpmStation(raw, "STN02");
    expect(station).toMatchObject({ code: "STN02", name: "สะพานข้ามคลองละงู ถนน 404", river: "คลองละงู", amphoe: "ละงู", level: 3.02, bank: 3.75, belowBank: 0.73, statusCode: 4, observedAt: "2026-10-25T02:20:00.000Z" });
    expect(station.telephone).toBe("0800000000"); // เบอร์หน่วยงานที่ ปภ. เผยแพร่ในหน้าสถานี
    expect(DPM_STATUS[station.statusCode].label).toBe("อันตราย");
    expect(nextThreshold(station)).toEqual({ label: "วิกฤต", level: 3.5, gap: 0.48 });
  });

  test("ไม่มีค่าระดับน้ำ → ไม่มีข้อมูล", () => {
    const station = normalizeDpmStation({ ...raw, currentWaterLevel: null, waterLevelStatus: 0 }, "STN08");
    expect(station).toMatchObject({ level: null, statusCode: 0, observedAt: null });
    expect(nextThreshold(station)).toBeNull();
  });

  test("เกณฑ์ ปภ.: ปกติ/เฝ้าระวัง/เตือนภัย/อันตราย/วิกฤต", () => {
    const t = { watch: 1.5, warning: 3, danger: 3.5, critical: 4 };
    expect([1, 1.5, 3.2, 3.6, 4.1].map((level) => statusFromThresholds(level, t))).toEqual([1, 2, 3, 4, 5]);
    // ปภ. ไม่ส่งรหัสสถานะ → คิดเองจากเกณฑ์
    expect(normalizeDpmStation({ ...raw, waterLevelStatus: null }, "STN02").statusCode).toBe(4);
  });

  test("เรียงที่น่าห่วงก่อน สรุปเป็นประโยค", () => {
    const list = [
      { code: "STN03", statusCode: 2 }, { code: "STN01", statusCode: 5 }, { code: "STN08", statusCode: 0 }, { code: "STN02", statusCode: 4 }
    ];
    expect(sortDpmStations(list).map((s) => s.code)).toEqual(["STN01", "STN02", "STN03", "STN08"]);
    expect(dpmSummary(list)).toBe("วิกฤต 1 สถานี • อันตราย 1 สถานี • เฝ้าระวัง 1 สถานี");
    expect(dpmSummary([{ code: "STN07", statusCode: 1 }])).toBe("ทุกสถานีอยู่ในเกณฑ์ปกติ (1 สถานี)");
    expect(dpmSummary([])).toBe("ยังไม่มีข้อมูลจากสถานีวัดระดับน้ำ");
  });

  test("เกจอ่านได้แม้สถานีอ้างอิงระดับทะเล (28–32 ม.)", () => {
    const g = gaugeScale({ level: 28.72, thresholds: { watch: 29, warning: 30, danger: 30.1, critical: 30.2 } });
    expect(g.fill).toBeGreaterThan(0.2);
    expect(g.fill).toBeLessThan(0.6);
    expect(g.danger).toBeGreaterThan(g.fill);
  });

  test("แนวโน้มจากค่ารายชั่วโมง", () => {
    const h = [{ level: 2.8 }, { level: 2.9 }, { level: 2.95 }];
    expect(dpmTrend(h, { level: 3.02 }).value).toBe("rising");
    expect(dpmTrend(h, { level: 2.7 }).value).toBe("falling");
    expect(dpmTrend([], { level: 3 })).toBeNull();
  });
});

test("แถบเกณฑ์แบบเดียวกับหน้าสถานี ปภ.", () => {
  const bar = thresholdBar({ level: 3.06, thresholds: { watch: 0.75, warning: 2.5, danger: 3, critical: 3.5 } });
  expect(bar.segments.map((s) => s.code)).toEqual([1, 2, 3, 4, 5]);
  expect(bar.segments.reduce((sum, s) => sum + s.width, 0)).toBeCloseTo(100, 5);
  // 3.06 อยู่ช่วงอันตราย (3.0–3.5) ของแถบที่ยาวถึง 3.5 × 1.15
  expect(bar.marker).toBeCloseTo((3.06 / (3.5 * 1.15)) * 100, 3);
  expect(bar.ticks.map((t) => t.label)).toEqual(["0", "เฝ้าระวัง 0.8", "เตือนภัย 2.5", "อันตราย 3.0", "วิกฤต 3.5"]);
  expect(thresholdBar({ level: 1, thresholds: { watch: null } })).toBeNull();
});
