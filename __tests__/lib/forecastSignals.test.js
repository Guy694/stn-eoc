import {
  assessDistrictRisk,
  assessForecastDay,
  dischargeClimatology,
  dischargeOutlook,
  ensembleRainDays,
  pickHiiMedia,
  rainNow,
  rainNowText,
  satunWarnings,
  waterStatus
} from "@/lib/forecastSignals";

describe("ensembleRainDays", () => {
  test("นับโอกาสฝนเกินเกณฑ์จากทุกชุด (รวม control)", () => {
    const daily = { time: ["2026-10-07"], precipitation_sum: [10] };
    // 10 ชุด: 4 ชุดเกิน 35, 2 ชุดเกิน 60, 1 ชุดเกิน 90
    [5, 8, 12, 20, 30, 40, 50, 65, 70, 95].forEach((value, index) => {
      daily[`precipitation_sum_member${String(index + 1).padStart(2, "0")}`] = [value];
    });
    const [day] = ensembleRainDays(daily);
    expect(day.members).toBe(11);
    expect(day.prob_heavy).toBe(Math.round((5 / 11) * 100));
    expect(day.prob_very_heavy).toBe(Math.round((3 / 11) * 100));
    expect(day.prob_extreme).toBe(Math.round((1 / 11) * 100));
    expect(day.median_mm).toBe(30);
  });

  test("ไม่มีข้อมูล → members 0", () => {
    expect(ensembleRainDays({ time: ["2026-10-07"] })[0]).toEqual({ date: "2026-10-07", members: 0 });
  });
});

describe("GloFAS", () => {
  const history = Array.from({ length: 1000 }, (_, index) => index / 100); // 0–9.99
  const climatology = dischargeClimatology(history);

  test("สถิติย้อนหลังต้องมีอย่างน้อย 1 ปี", () => {
    expect(dischargeClimatology([1, 2, 3])).toBeNull();
    expect(climatology.p90).toBeCloseTo(9, 0);
    expect(climatology.p99).toBeCloseTo(9.9, 0);
  });

  test("แนวโน้ม 7 วัน: ใช้ค่าสูงสุดของ P75 และจัดระดับเทียบสถิติ", () => {
    const daily = {
      time: ["2026-10-06", "2026-10-07", "2026-10-08", "2026-10-09"],
      river_discharge: [1, 2, 3, 2],
      river_discharge_p75: [1, 2.5, 9.5, 3]
    };
    const outlook = dischargeOutlook(daily, climatology, "2026-10-07");
    expect(outlook.now).toBe(2);
    expect(outlook.peak).toBe(9.5);
    expect(outlook.peak_date).toBe("2026-10-08");
    expect(outlook.level).toBe("high");
    expect(outlook.by_date["2026-10-07"]).toBe("normal");
    expect(dischargeOutlook(daily, climatology, "2027-01-01")).toBeNull();
  });
});

describe("สถานี ThaiWater", () => {
  const now = Date.parse("2026-10-07T08:00:00Z");
  test("ฝนตอนนี้ใช้เฉพาะสถานีที่รายงานภายใน 2 ชม.", () => {
    const summary = rainNow([
      { name: "ก", rain1h: 6, observedAt: "2026-10-07T07:00:00Z" },
      { name: "ข", rain1h: 0, observedAt: "2026-10-07T07:30:00Z" },
      { name: "ค", rain1h: 40, observedAt: "2026-10-07T03:00:00Z" }
    ], now);
    expect(summary).toEqual({ stations: 2, raining: 1, max1h: 6, maxStation: "ก" });
    expect(rainNowText(summary)).toBe("ฝนตกปานกลาง (1/2 สถานี)");
    expect(rainNowText({ stations: 3, raining: 0 })).toBe("ไม่มีฝนตกขณะนี้");
    expect(rainNowText({ stations: 0, raining: 0 })).toBeNull();
  });

  test("สถานะน้ำ: ล้นตลิ่ง / ใกล้ตลิ่ง / ปกติ", () => {
    expect(waterStatus([{ name: "ก", bankDiff: -2 }, { name: "ข", bankDiff: 0.3 }])).toMatchObject({ state: "overflow", station: "ข" });
    expect(waterStatus([{ name: "ก", bankDiff: -0.3 }]).state).toBe("near");
    expect(waterStatus([{ name: "ก", bankDiff: -1.2 }]).state).toBe("normal");
    expect(waterStatus([])).toBeNull();
  });
});

describe("ความเสี่ยงรายอำเภอ", () => {
  test("ฝนเล็กน้อยแม้แบบจำลองบอกโอกาสฝนสูง → ปกติ", () => {
    const result = assessDistrictRisk({
      observedRain24h: 2.4,
      ensembleToday: { members: 51, prob_heavy: 4, prob_very_heavy: 0, prob_extreme: 0 },
      water: { state: "normal" },
      windSpeed: 8,
      susceptibility: 1
    });
    expect(result.risk_level).toBe("normal");
    expect(result.score).toBe(0);
  });

  test("ฝนวัดได้หนักมาก + น้ำล้นตลิ่ง → วิกฤต พร้อมเหตุผล", () => {
    const result = assessDistrictRisk({
      observedRain24h: 120,
      maxStation: "บ้านปันจอร์",
      ensembleToday: { members: 51, prob_heavy: 80, prob_very_heavy: 55, prob_extreme: 10 },
      water: { state: "overflow", station: "บ้านปันจอร์", bank_diff: 0.4 },
      discharge: { level: "high", level_label: "สูงกว่าปกติ" }
    });
    expect(result.score).toBe(3 + 2 + 3 + 1);
    expect(result.risk_level).toBe("critical");
    expect(result.reasons.join(" ")).toMatch(/ล้นตลิ่ง/);
  });

  test("พยากรณ์ฝนหนักพรุ่งนี้อย่างเดียว → เฝ้าระวัง", () => {
    const result = assessDistrictRisk({
      observedRain24h: 0,
      ensembleTomorrow: { members: 51, prob_heavy: 60, prob_very_heavy: 10, prob_extreme: 0 }
    });
    expect(result.score).toBe(1);
    expect(result.risk_level).toBe("normal");
    const withTerrain = assessDistrictRisk({
      observedRain24h: 0,
      ensembleTomorrow: { members: 51, prob_heavy: 60, prob_very_heavy: 10, prob_extreme: 0 },
      susceptibility: 1
    });
    expect(withTerrain.risk_level).toBe("watch");
    expect(withTerrain.reasons[0]).toMatch(/พรุ่งนี้/);
  });

  test("ความเสี่ยงวันในอนาคต", () => {
    expect(assessForecastDay({ ensembleDay: { members: 51, prob_heavy: 90, prob_very_heavy: 60, prob_extreme: 35 } }).risk_level).toBe("watch");
    expect(assessForecastDay({ ensembleDay: { members: 51, prob_heavy: 90, prob_very_heavy: 60, prob_extreme: 35 }, dischargeLevelOfDay: "very_high", windSpeed: 45 }).risk_level).toBe("critical");
    expect(assessForecastDay({}).risk_level).toBe("normal");
  });
});

describe("ประกาศและภาพจาก สสน.", () => {
  test("แยกข้อความหลายรายการ เหลือเฉพาะ จ.สตูล", () => {
    const json = { data: [
      { datetime: "2026-10-07 15:00", message: "ฝนตกหนัก สถานีทม.สะเดา จ.สงขลา 36.6 มม.\n\n[เสี่ยงเกิดน้ำท่วมฉับพลัน] ฝนตกหนักมาก สถานีบ้านควน อ.เมืองสตูล จ.สตูล 60 มม." },
      { datetime: "2026-10-07 11:00", message: "เขื่อนคลองสียัด น้ำมาก" }
    ] };
    const result = satunWarnings(json);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ issued_at: "2026-10-07 15:00", level: "high" });
    expect(satunWarnings(null)).toEqual([]);
  });

  test("เลือกภาพพยากรณ์ฝน คลื่น และเรดาร์ภาคใต้", () => {
    const media = pickHiiMedia({
      pre_rain: { data: { data: [{ media_path: "A", filename: "d03_day01.jpg", media_datetime: "2026-10-07 19:00" }] } },
      wave: { data: [{ media_path: "W", media_datetime: "2026-10-07 07:00" }] },
      radar: { data: { data: [
        { radar_type: "stp240", radar_name: "เรดาร์สงขลา", media_path: "R", media_datetime: "2026-10-07 08:00" },
        { radar_type: "cri240", radar_name: "เรดาร์เชียงราย", media_path: "X", media_datetime: "2026-10-07 08:00" }
      ] } }
    });
    expect(media.rain_forecast[0].url).toMatch(/image=A$/);
    expect(media.wave_forecast).toHaveLength(1);
    expect(media.radar.map((item) => item.name)).toEqual(["เรดาร์สงขลา"]);
  });
});

describe("น้ำทะเลหนุนในความเสี่ยงอำเภอติดทะเล", () => {
  const { assessDistrictRisk: assess, seaRiskStatus } = require("@/lib/forecastSignals");

  it("หนุนสูงกว่าปกติอย่างเดียวไม่เพิ่มคะแนน แต่ถ้ามีฝนหนักร่วมด้วยเพิ่ม 1", () => {
    const sea = { key: "elevated", label: "หนุนสูงกว่าปกติ", level: 1.35 };
    expect(assess({ observedRain24h: 0, sea }).score).toBe(0);
    const withRain = assess({ observedRain24h: 50, sea });
    expect(withRain.score).toBe(assess({ observedRain24h: 50 }).score + 1);
    expect(withRain.reasons.join(" ")).toMatch(/น้ำทะเลหนุนสูงกว่าปกติ.*ระบายลงทะเลช้า/);
  });

  it("หนุนสูงสุดในรอบ 30 วัน เพิ่ม 2 แม้ไม่มีฝน", () => {
    expect(assess({ sea: { key: "record", label: "หนุนสูงสุดในรอบ 30 วัน", level: 1.6 } }).score).toBe(2);
  });

  it("ใช้รอบน้ำขึ้นถัดไปใน 24 ชม. ถ้าคาดว่าสูงกว่า และไม่ใช้ข้อมูลเก่า", () => {
    const now = Date.UTC(2026, 9, 9, 6);
    const sea = {
      status: { key: "normal" }, peak: { at: "2026-10-09T03:00:00Z", level: 1.2 }, observed_at: "2026-10-09T05:50:00Z",
      next_highs: [{ at: "2026-10-09T15:00:00Z", est_level: 1.45, status: "high" }, { at: "2026-10-10T12:00:00Z", est_level: 1.7, status: "record" }]
    };
    expect(seaRiskStatus(sea, now)).toMatchObject({ key: "high", level: 1.45, forecast: true });
    expect(seaRiskStatus({ ...sea, stale: true }, now)).toBeNull();
  });
});
