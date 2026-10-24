import { hourlyRainCategory, HOURLY_RAIN_CATEGORIES } from "@/lib/thaiWaterRain";
import { districtRain1h } from "@/components/public/home/SatunRiskMap";

describe("สีแผนที่หน้าแรก = ฝนใน 1 ชม.", () => {
  test("แบ่งระดับฝนรายชั่วโมงเหมือนป้าย ตอนนี้ฝน… บนหน้าแรก", () => {
    expect([0, 0.2, 4.9, 5, 19.9, 20, 60].map((mm) => hourlyRainCategory(mm).key)).toEqual(["none", "light", "light", "moderate", "moderate", "heavy", "heavy"]);
    expect(HOURLY_RAIN_CATEGORIES.map((item) => item.color)).not.toContain("#dc2626"); // ไม่ใช้สีแดงวิกฤต
  });

  test("ใช้ค่าจากสถานีถ้ามี ไม่มีสถานีบอกว่าเป็นค่าประมาณ", () => {
    expect(districtRain1h({ rainfall_1h: 3.2, rain_now: { stations: 2 } })).toEqual({ mm: 3.2, estimated: false });
    expect(districtRain1h({ rainfall_1h: 1, rain_now: { stations: 0 } })).toEqual({ mm: 1, estimated: true });
    expect(districtRain1h({ rainfall_1h: null, rainfall_24h: 130 }).mm).toBe(0);
  });
});
