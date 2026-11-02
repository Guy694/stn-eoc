import { heatLevel, uvLevel } from "@/lib/weatherHealth";
import { calibratedCurrentTemperature, currentTempBias } from "@/lib/forecastCalibration";

describe("ระดับ UV (WHO)", () => {
  test.each([[0, "ต่ำ"], [2, "ต่ำ"], [3, "ปานกลาง"], [6, "สูง"], [8, "สูงมาก"], [11, "อันตราย"]])("UV %s → %s", (value, label) => {
    expect(uvLevel(value).label).toBe(label);
  });
  test("ไม่มีค่า = null · ระดับสูงมากขึ้นไปมีคำแนะนำ", () => {
    expect(uvLevel(null)).toBeNull();
    expect(uvLevel("")).toBeNull();
    expect(uvLevel(9).advice).toMatch(/10–15/);
    expect(uvLevel(5).advice).toBeUndefined();
  });
});

describe("ระดับความร้อน (อุณหภูมิที่รู้สึก)", () => {
  test.each([[26, "ปกติ"], [30, "เฝ้าระวัง"], [38, "เตือนภัย"], [45, "อันตราย"], [56, "อันตรายมาก"]])("%s°C → %s", (value, label) => {
    expect(heatLevel(value).label).toBe(label);
  });
  test("ไม่มีค่า = null", () => expect(heatLevel(undefined)).toBeNull());
});

describe("ชดเชยอุณหภูมิตอนนี้ตามช่วงเวลา", () => {
  test("ตรงจุดที่วัด และประมาณเชิงเส้นระหว่างจุด รวมช่วงข้ามเที่ยงคืน", () => {
    expect(currentTempBias(13)).toBe(1.8);
    expect(currentTempBias(7)).toBe(0);
    expect(currentTempBias(14.5)).toBeCloseTo(1.75, 2);
    expect(currentTempBias(23)).toBeCloseTo(0.3, 2);
    expect(currentTempBias(0)).toBeCloseTo(0.3, 2);
  });
  test("ใช้ชั่วโมงจากเวลา Open-Meteo · ไม่มีเวลา = ไม่ชดเชย", () => {
    expect(calibratedCurrentTemperature(31.4, "2026-11-02T13:00")).toBe(33);
    expect(calibratedCurrentTemperature(31.4, null)).toBe(31);
    expect(calibratedCurrentTemperature(null, "2026-11-02T13:00")).toBeNull();
  });
});
