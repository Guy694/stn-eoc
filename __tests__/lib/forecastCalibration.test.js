import { calibratedTemperature, TMAX_BIAS_C, TMIN_BIAS_C } from "@/lib/forecastCalibration";
import { ensembleRainDays } from "@/lib/forecastSignals";
import { rainOutlook } from "@/components/public/home/ForecastWeek";

describe("ชดเชยอุณหภูมิ ECMWF ที่สตูล", () => {
  test("บวกค่าชดเชยตามจำนวนวันล่วงหน้า แล้วปัดเป็นจำนวนเต็ม", () => {
    expect(calibratedTemperature(30.2, 0, "max")).toBe(33);
    expect(calibratedTemperature(30.2, 6, "max")).toBe(35);
    expect(calibratedTemperature(23.1, 2, "min")).toBe(24);
  });
  test("วันที่เกินตาราง ใช้ค่าสุดท้าย · ไม่มีค่า คืน null", () => {
    expect(calibratedTemperature(30, 20, "max")).toBe(Math.round(30 + TMAX_BIAS_C.at(-1)));
    expect(calibratedTemperature(null, 0)).toBeNull();
    expect(calibratedTemperature("abc", 0)).toBeNull();
    expect(TMIN_BIAS_C).toHaveLength(TMAX_BIAS_C.length);
  });
});

describe("โอกาสฝนรายวันจาก Ensemble", () => {
  test("ensembleRainDays คืนโอกาสมีฝน (≥1 มม.) และฝนปานกลาง (≥10.1 มม.)", () => {
    const members = [0, 0.5, 2, 5, 12, 40, 0, 0, 3, 11];
    const daily = { time: ["2026-11-02"] };
    members.forEach((value, index) => { daily[`precipitation_sum_member${String(index + 1).padStart(2, "0")}`] = [value]; });
    const [day] = ensembleRainDays(daily);
    expect(day.prob_rain).toBe(60);
    expect(day.prob_wet).toBe(40);
    expect(day.prob_moderate).toBe(30);
    expect(day.prob_heavy).toBe(10);
  });

  test.each([
    [{ prob_wet: 80, prob_moderate: 20, prob_heavy: 40 }, "อาจมีฝนหนัก", 80],
    [{ prob_wet: 84, prob_moderate: 63, prob_heavy: 2 }, "มีฝนหลายพื้นที่", 84],
    [{ prob_wet: 33, prob_moderate: 10, prob_heavy: 0 }, "มีฝนบางพื้นที่", 33],
    [{ prob_wet: 15, prob_moderate: 2, prob_heavy: 0 }, "ฝนเล็กน้อย", 15],
    [{ prob_wet: 4, prob_moderate: 0, prob_heavy: 0 }, "ไม่ค่อยมีฝน", 4],
    [{ prob_moderate: 55, prob_heavy: 0 }, "มีฝนบางพื้นที่", 55],
    [{ prob_rain: 100 }, "ไม่มีข้อมูลฝน", null]
  ])("rainOutlook %j → %s (โอกาสฝน = ชุดที่ให้ฝน ≥5 มม.)", (day, label, pct) => {
    expect(rainOutlook(day)).toMatchObject({ label, pct });
  });

  test("วันนี้: สถานีวัดว่ากำลังตก → บอกตามจริง แม้พยากรณ์ให้โอกาสต่ำ", () => {
    expect(rainOutlook({ prob_wet: 2, raining_now: true, rain_now_max1h: 32 })).toMatchObject({ label: "ฝนตกหนักขณะนี้", pct: 100, tone: "heavy" });
    expect(rainOutlook({ prob_wet: 2, raining_now: true, rain_now_max1h: 1.5 })).toMatchObject({ label: "ฝนตกเล็กน้อยขณะนี้", pct: 100 });
    expect(rainOutlook({ prob_wet: 5, raining_now: false, observed_today_mm: 18 })).toMatchObject({ pct: 100 });
  });
});
