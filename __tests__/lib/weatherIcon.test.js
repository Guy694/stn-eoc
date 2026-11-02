import { weatherKind } from "@/lib/weatherIcon";
import { HOURLY_RAIN_CATEGORIES, hourlyRainCategory } from "@/lib/thaiWaterRain";

describe("weatherKind (ภาพพยากรณ์ 7 วันหน้าแรก)", () => {
  test.each([
    [0, "sun"], [1, "partly"], [2, "partly"], [3, "cloud"], [45, "fog"], [53, "drizzle"],
    [61, "rain"], [63, "rain"], [80, "showers"], [81, "showers"], [65, "heavy"], [82, "heavy"], [95, "storm"], [99, "storm"]
  ])("รหัส WMO %s → %s", (code, kind) => {
    expect(weatherKind(code)).toBe(kind);
  });

  test("ไม่มีรหัส (ข้อมูล cache เก่า): ใช้ข้อความสภาพอากาศแทน", () => {
    expect(weatherKind(null, "ฝนฟ้าคะนอง")).toBe("storm");
    expect(weatherKind(undefined, "ฝนตกหนักเป็นช่วง")).toBe("heavy");
    expect(weatherKind(null, "มีเมฆบางส่วน")).toBe("partly");
    expect(weatherKind(null, "ท้องฟ้าแจ่มใส")).toBe("sun");
    expect(weatherKind(null, "ฝนโปรย")).toBe("showers");
  });
});

describe("ฝนตอนนี้ (ฝน 1 ชม.) บนแผนที่หน้าแรก", () => {
  test("ไม่มีฝนเป็นสีเขียว ต่างจากสีเทาของอำเภอที่ไม่มีสถานีรายงาน", () => {
    expect(hourlyRainCategory(0).color).toBe("#22c55e");
    expect(HOURLY_RAIN_CATEGORIES.map((item) => item.color)).not.toContain("#5b7a8c");
  });
  test.each([[0.2, "ฝนเล็กน้อย"], [5, "ฝนปานกลาง"], [20, "ฝนหนัก"]])("%s มม./ชม. → %s", (mm, label) => {
    expect(hourlyRainCategory(mm).label).toBe(label);
  });
});
