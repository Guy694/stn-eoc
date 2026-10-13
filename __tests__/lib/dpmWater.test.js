import { bangkokHourKey, bankLevel, buildWaterReport, direction, parseDpmDashboard, shiftHourKey, thaiHourLabel } from "@/lib/dpmWater";

const raw = (code, name, level, bank, trend = "equal", diff = 0, status = 1) => ({
  code, name, latitude: 6.9, longitude: 99.9, currentWaterLevel: level, riverBankLevel: bank,
  waterLevelStatus: status, waterLevelTrend: trend, waterLevelTrendDiff: diff, waterLevelTrendCurrentHourKey: "2026-10-12 13"
});

const fixture = {
  stationAvailable: {
    data: [
      raw("YLA02", "แม่น้ำปัตตานี", 43.17, 49.223),
      raw("STN10", "สะพานข้ามคลองตาลีไกล", 1, 4.175, "down", -0.02),
      raw("STN01", "สะพานร้อยเมตร", 0, 3.803),
      raw("STN07", "ฝายชลประทาน  ดุสน", 28.35, 32.27),
      raw("STN05", "สะพานข้ามคลองท่าแพ หมู่ 3", 1.51, 6.131, "up", 0.1),
      raw("STN08", "สะพานเคียน", null, 5.071, "equal", 0, "MALFUNCTION")
    ]
  }
};

describe("dpmWater", () => {
  test("parse keeps Satun stations, sorted, with below-bank distance", () => {
    const stations = parseDpmDashboard(fixture);
    expect(stations.map((s) => s.code)).toEqual(["STN01", "STN05", "STN07", "STN08", "STN10"]);
    const s1 = stations[0];
    expect(s1.level).toBe(0);
    expect(s1.bank).toBe(3.8);
    expect(s1.belowBank).toBe(3.8);
    expect(stations[2].name).toBe("ฝายชลประทาน ดุสน");
    expect(stations[3].malfunction).toBe(true);
    expect(stations[3].belowBank).toBeNull();
    expect(stations[0].observedAt).toBe("2026-10-12T13:00:00.000Z");
    expect(() => parseDpmDashboard({})).toThrow();
  });

  test("bank levels and direction", () => {
    expect(bankLevel(-0.2).key).toBe("overflow");
    expect(bankLevel(0).key).toBe("near");
    expect(bankLevel(0.99).key).toBe("near");
    expect(bankLevel(1.5).key).toBe("watch");
    expect(bankLevel(3).key).toBe("normal");
    expect(bankLevel(null)).toBeNull();
    expect(direction(0.02)).toBe("up");
    expect(direction(-0.01)).toBe("down");
    expect(direction(0.004)).toBe("steady");
    expect(direction(null)).toBeNull();
  });

  test("hour keys are Bangkok local", () => {
    expect(bangkokHourKey(new Date("2026-10-12T13:05:00Z"))).toBe("2026-10-12 20:00:00");
    expect(bangkokHourKey(new Date("2026-10-12T18:30:00Z"))).toBe("2026-10-13 01:00:00");
    expect(shiftHourKey("2026-10-12 20:00:00", -4)).toBe("2026-10-12 16:00:00");
    expect(shiftHourKey("2026-10-13 01:00:00", -4)).toBe("2026-10-12 21:00:00");
    expect(thaiHourLabel("2026-10-12 20:00:00")).toEqual({ date: "12 ตุลาคม 2569", time: "20.00 น." });
  });

  test("report compares with stored baseline", () => {
    const stations = parseDpmDashboard(fixture);
    const report = buildWaterReport(stations, {
      baseline: { STN01: 0, STN05: 1.52, STN07: 28.33, STN10: 1.34 },
      compareLabel: "16.00 น.",
      dataHour: "2026-10-12 20:00:00"
    });
    expect(report.comparedWithBaseline).toBe(true);
    expect(report.compareLabel).toBe("16.00 น.");
    const byCode = Object.fromEntries(report.rows.map((r) => [r.code, r]));
    expect(byCode.STN07.diff).toBe(0.02);
    expect(byCode.STN07.direction).toBe("up");
    expect(byCode.STN10.diff).toBe(-0.34);
    expect(byCode.STN01.direction).toBe("steady");
    expect(byCode.STN08.direction).toBeNull();
    expect(report.counts).toEqual({ up: 1, down: 2, steady: 1, unknown: 1 });
    expect(report.highlights.rise.code).toBe("STN07");
    expect(report.highlights.drop.code).toBe("STN10");
    expect(report.highlights.next.map((r) => r.code)).toEqual(["STN05"]);
    expect(report.headline).toBe("สถานีที่มีข้อมูลทั้ง 4 แห่งยังมีระดับน้ำต่ำกว่าตลิ่ง");
    expect(report.watch).toContain("ระดับน้ำที่เพิ่มขึ้นมีเพียง STN07 เพิ่มขึ้น 0.02 ม.");
    expect(report.watch).toContain("STN10 มีระยะห่างจากตลิ่งน้อยที่สุด 3.18 ม.");
    expect(report.watch.some((w) => w.includes("STN08"))).toBe(true);
    expect(report.overall.key).toBe("normal");
    expect(report.dataLabel.time).toBe("20.00 น.");
  });

  test("falls back to source hourly trend without baseline", () => {
    const report = buildWaterReport(parseDpmDashboard(fixture), { baseline: {}, dataHour: "2026-10-12 20:00:00" });
    expect(report.comparedWithBaseline).toBe(false);
    expect(report.compareLabel).toBe("ชั่วโมงก่อนหน้า");
    const stn05 = report.rows.find((r) => r.code === "STN05");
    expect(stn05.diff).toBe(0.1);
    expect(stn05.direction).toBe("up");
  });

  test("near-bank and overflow raise the overall level and recommendations", () => {
    const stations = parseDpmDashboard({ stationAvailable: { data: [raw("STN02", "ละงู", 3.2, 3.75, "up", 0.2), raw("STN03", "ละงู 2", 6.5, 6.23, "up", 0.1)] } });
    const report = buildWaterReport(stations, {});
    expect(report.overall.key).toBe("overflow");
    expect(report.headline).toBe("ระดับน้ำล้นตลิ่ง 1 สถานี: STN03");
    expect(report.watch[0]).toContain("STN03");
    expect(report.watch[0]).toContain("สูงกว่าตลิ่ง 0.27 ม.");
    expect(report.watch[1]).toContain("ต่ำกว่าตลิ่งเพียง 0.55 ม.");
    expect(report.suggestedFlag.key).toBe("red");
    expect(report.suggestedFlag.reason).toContain("STN03");
    expect(report.recommendations[0]).toContain("เคลื่อนย้ายทันที");
    const custom = buildWaterReport(stations, { recommendations: ["ก", "ข"] });
    expect(custom.recommendations).toEqual(["ก", "ข"]);
  });
});

describe("withKnownStations", () => {
  test("adds stations missing from this round as no-data rows", () => {
    const { withKnownStations: merge, parseDpmDashboard: parse, buildWaterReport: build } = require("@/lib/dpmWater");
    const stations = parse({ stationAvailable: { data: [raw("STN10", "ตาลีไกล", 1, 4.175), raw("STN01", "ร้อยเมตร", 0, 3.803)] } });
    const merged = merge(stations, [{ code: "STN08", name: "สะพานเคียน", bank: "5.07" }, { code: "STN01", name: "ร้อยเมตร", bank: 3.8 }]);
    expect(merged.map((s) => s.code)).toEqual(["STN01", "STN08", "STN10"]);
    expect(merged[1]).toMatchObject({ malfunction: true, level: null, bank: 5.07 });
    const report = build(merged, {});
    expect(report.rows).toHaveLength(3);
    expect(report.stationsWithData).toBe(2);
    expect(report.watch.at(-1)).toBe("ไม่มีข้อมูลหรืออุปกรณ์ขัดข้อง: STN08");
  });
});

describe("suggestFlag (SAT 3 flags)", () => {
  const { suggestFlag } = require("@/lib/dpmWater");
  const row = (code, belowBank, diff, extra = {}) => ({ code, level: 1, belowBank, diff, direction: diff > 0.005 ? "up" : diff < -0.005 ? "down" : "steady", malfunction: false, ...extra });
  test("green when far from bank", () => {
    expect(suggestFlag([row("STN01", 3.8, 0.02), row("STN02", 2.5, 0.3)]).key).toBe("green");
  });
  test("yellow when near bank, or within 2 m and rising >= 10 cm", () => {
    expect(suggestFlag([row("STN01", 0.8, -0.1)]).key).toBe("yellow");
    expect(suggestFlag([row("STN01", 1.6, 0.12)]).key).toBe("yellow");
    expect(suggestFlag([row("STN01", 1.6, 0.05)]).key).toBe("green");
  });
  test("red when overflowing or near bank and still rising", () => {
    expect(suggestFlag([row("STN01", -0.1, 0)]).key).toBe("red");
    expect(suggestFlag([row("STN01", 0.5, 0.03)]).key).toBe("red");
  });
  test("ignores stations without data", () => {
    expect(suggestFlag([row("STN08", null, null, { level: null, malfunction: true })]).key).toBe("green");
  });
});

import { stationsFromReadings } from "@/lib/dpmWater";

describe("stationsFromReadings (ใช้ค่าที่เก็บไว้เมื่อ ปภ. ไม่ตอบ)", () => {
  test("แปลงแถวในฐานข้อมูลเป็นสถานี คำนวณระยะต่ำกว่าตลิ่ง และเวลาไทย → UTC", () => {
    const [a, b] = stationsFromReadings([
      { station_code: "stn08", station_name: "สะพานเคียน", hour_at: "2026-10-13 19:00:00", water_level: "4.20", bank_level: "5.07", malfunction: 0 },
      { station_code: "STN01", station_name: "สะพานร้อยเมตร", hour_at: "2026-10-13 19:00:00", water_level: null, bank_level: 3.8, malfunction: 0 }
    ]);
    expect(a).toMatchObject({ code: "STN01", level: null, malfunction: true });
    expect(b).toMatchObject({ code: "STN08", level: 4.2, bank: 5.07, belowBank: 0.87, malfunction: false, observedAt: "2026-10-13T12:00:00.000Z" });
  });
});
