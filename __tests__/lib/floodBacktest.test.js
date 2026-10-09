import { addDays, calibrate, dateRange, evaluate, eventsFromRecords, mergeEvents, scaledThresholds, scoreSeries } from "@/lib/floodBacktest";
import { DEFAULT_THRESHOLDS, assessConditions, thresholdsOf, runScenario } from "@/lib/floodForecast";
import { areaKey } from "@/lib/areaRisk";

const A = { key: areaKey("ควนโดน", "ควนโดน"), district: "ควนโดน", tambon: "ควนโดน", coastal: false, riverine: true, susceptibility: 30 };
const B = { key: areaKey("ละงู", "กำแพง"), district: "ละงู", tambon: "กำแพง", coastal: true, riverine: false, susceptibility: 10 };

describe("floodBacktest", () => {
  test("date helpers", () => {
    expect(addDays("2024-12-31", 1)).toBe("2025-01-01");
    expect(dateRange("2024-02-27", "2024-03-01")).toEqual(["2024-02-27", "2024-02-28", "2024-02-29", "2024-03-01"]);
  });

  test("eventsFromRecords groups by session and skips 'ไม่มี'", () => {
    const events = eventsFromRecords([
      { session_id: 54, session_number: 3, district: "ควนโดน", tambon: "ควนโดน", flood_level: "สูง", flood_start_date: "2025-11-21" },
      { session_id: 54, district: "ละงู", tambon: "กำแพง", flood_level: "ต่ำ", flood_start_date: "2025-11-20" },
      { session_id: 54, district: "ละงู", tambon: "ละงู", flood_level: "ไม่มี", flood_start_date: "2025-11-20" }
    ]);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ start: "2025-11-20", end: "2025-11-22" });
    expect(events[0].areas.sort()).toEqual([A.key, B.key].sort());
  });

  test("mergeEvents merges overlapping reference events", () => {
    const merged = mergeEvents([{ id: "eoc-1", start: "2024-11-26", end: "2024-11-28", source: "db", areas: [A.key] }], [
      { id: "r", label: "x", start: "2024-11-27", end: "2024-11-29", source: "ref", areas: [["ละงู", "กำแพง"]] },
      { id: "p", label: "y", start: "2023-12-23", end: "2023-12-26", source: "ref2", areas: [], province_level: true }
    ]);
    expect(merged).toHaveLength(2);
    expect(merged[1].areas).toEqual(expect.arrayContaining([A.key, B.key]));
    expect(merged[1].end).toBe("2024-11-29");
    expect(merged[0].province_level).toBe(true);
  });

  const dates = dateRange("2024-11-01", "2024-12-31");
  const rainA = Object.fromEntries(dates.map((d) => [d, 0]));
  rainA["2024-11-27"] = 160; // เหตุการณ์จริง
  rainA["2024-12-15"] = 100; // ฝนหนักแต่ไม่มีบันทึกน้ำท่วม
  const series = scoreSeries([A, B], dates, { rain: { [A.key]: rainA, [B.key]: {} }, canal: {}, sea: {} });
  const events = [{ id: "e", start: "2024-11-27", end: "2024-11-29", areas: [A.key, B.key] }];

  test("evaluate counts hits, misses and false alarm episodes", () => {
    const m = evaluate(series, dates, events, [A, B], DEFAULT_THRESHOLDS);
    expect(m.hits).toBe(1);
    expect(m.misses).toBe(1);
    expect(m.false_alarms).toBe(1);
    expect(m.per_event[0].areas.find((r) => r.key === A.key)).toMatchObject({ hit: true, rain24: 160 });
    expect(m.csi).toBeCloseTo(1 / 3, 2);
  });

  test("calibrate picks the threshold scale with best CSI", () => {
    const result = calibrate([A, B], dates, { rain: { [A.key]: rainA, [B.key]: {} }, canal: {}, sea: {} }, events, { floors: [0.5] });
    // ฝน 160 มม. → 16 × 1.25 = 20; ฝน 100 มม. → 12 × 1.25 = 15 → เกณฑ์เฝ้าระวัง 16–20 ตัดเตือนเกินได้
    expect(result.best.false_alarms).toBe(0);
    expect(result.best.hits).toBe(1);
    expect(result.best.thresholds.watch).toBeGreaterThan(15);
    expect(result.best.thresholds.watch).toBeLessThanOrEqual(20);
    expect(result.confidence).toBe("low");
  });

  test("calibrate can raise the factor floor for tambons without history", () => {
    const C = { ...A, key: "x|y", susceptibility: 0 };
    const rain = Object.fromEntries(dates.map((d) => [d, 0]));
    rain["2024-11-27"] = 110; // 12 คะแนน × 0.5 = 6 (พลาด) แต่ × 1.0 = 12 (เตือนถูก)
    const result = calibrate([C], dates, { rain: { [C.key]: rain }, canal: {}, sea: {} }, [{ id: "e", start: "2024-11-27", end: "2024-11-28", areas: [C.key] }]);
    expect(result.best.hits).toBe(1);
    expect(result.best.false_alarms).toBe(0);
  });

  test("scaledThresholds stays strictly increasing", () => {
    const t = scaledThresholds(0.4);
    expect(t.watch).toBeLessThan(t.high);
    expect(t.high).toBeLessThan(t.critical);
  });
});

describe("calibrated thresholds in floodForecast", () => {
  test("thresholdsOf rejects invalid and accepts valid", () => {
    expect(thresholdsOf(null)).toBe(DEFAULT_THRESHOLDS);
    expect(thresholdsOf({ thresholds: { watch: 20, high: 10, critical: 30 } })).toBe(DEFAULT_THRESHOLDS);
    expect(thresholdsOf({ thresholds: { watch: 8, high: 14, critical: 22 } })).toEqual({ watch: 8, high: 14, critical: 22 });
  });
  test("assessConditions and runScenario use calibration", () => {
    const conditions = { rain24: 60, rain72: 60 };
    expect(assessConditions(A, conditions).level).toBe("normal");
    const cal = { thresholds: { watch: 8, high: 14, critical: 22 } };
    expect(assessConditions(A, conditions, cal).level).toBe("watch");
    expect(runScenario([A], conditions, cal).counts.watch).toBe(1);
  });
});

describe("factor floor", () => {
  test("factorFloorOf validates and susceptibility factor uses it", async () => {
    const { factorFloorOf, susceptibilityFactor } = await import("@/lib/floodForecast");
    expect(factorFloorOf({ factor_floor: 0.8 })).toBe(0.8);
    expect(factorFloorOf({ factor_floor: 5 })).toBe(0.5);
    expect(susceptibilityFactor(0, 0.8)).toBe(0.8);
    expect(susceptibilityFactor(40, 0.8)).toBe(1.5);
  });
});
