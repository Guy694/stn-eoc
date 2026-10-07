import { isNight, rainLevelFromMm, sceneLabel, weatherScene } from "@/lib/weatherFx";

describe("weatherFx", () => {
  const noon = Date.parse("2026-10-07T05:00:00Z"); // 12:00 น.
  const night = Date.parse("2026-10-07T14:00:00Z"); // 21:00 น.

  test("กลางวัน/กลางคืนตามเวลาไทย", () => {
    expect(isNight(noon)).toBe(false);
    expect(isNight(night)).toBe(true);
  });

  test("ระดับฝนจาก มม./ชม.", () => {
    expect([0, 1, 6, 25].map(rainLevelFromMm)).toEqual([0, 1, 2, 3]);
  });

  test("ใช้ฝนที่สถานีวัดได้ และฟ้าคะนองเฉพาะเมื่อฝนอย่างน้อยปานกลาง", () => {
    const districts = [
      { rain_now: { stations: 3, raining: 1, max1h: 8 }, thunder_expected: true },
      { rain_now: { stations: 2, raining: 0, max1h: 0 } }
    ];
    const scene = weatherScene({ current: { weather_condition: "ฝนตกบางพื้นที่", wind_speed: 18 }, districts, now: noon });
    expect(scene).toMatchObject({ rain: 2, thunder: true, cloud: 2, night: false });
    expect(scene.label).toBe("ฝนตกปานกลาง • มีฟ้าคะนอง • ลม 18 กม./ชม.");
  });

  test("สถานีไม่มีฝน = ไม่มีเม็ดฝน แม้แบบจำลองบอกฝน", () => {
    const districts = [{ rain_now: { stations: 3, raining: 0 } }];
    expect(weatherScene({ current: { weather_condition: "มีเมฆมาก" }, districts, now: night })).toMatchObject({ rain: 0, cloud: 2, night: true });
  });

  test("ดูตัวอย่างฉากได้ด้วย preset", () => {
    expect(weatherScene({ preset: "storm", now: noon })).toMatchObject({ rain: 3, thunder: true, preview: true });
    expect(sceneLabel({ rain: 0, wind: 5, thunder: false, cloud: 0, night: true })).toBe("ท้องฟ้าโปร่ง");
  });
});
