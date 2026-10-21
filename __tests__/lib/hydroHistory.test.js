import { bucketHours, dailyRainByStation, dailyRainSummary, dateList, normalizeDays, seaLevelSeries, waterStationSeries } from "@/lib/hydroHistory";

const rain = (id, hour, mm, extra = {}) => ({ station_id: id, station_name: `[ทดสอบ] สถานี${id}`, amphoe: "ละงู", hour_at: hour, rain_24h: mm, ...extra });

describe("hydroHistory", () => {
  test("ช่วงเวลาและขนาดจุดกราฟ", () => {
    expect(normalizeDays("30")).toBe(30);
    expect(normalizeDays("5")).toBe(7);
    expect([7, 30, 90].map(bucketHours)).toEqual([1, 3, 24]);
    expect(dateList("2026-10-30", "2026-11-02")).toEqual(["2026-10-30", "2026-10-31", "2026-11-01", "2026-11-02"]);
  });

  test("ฝนรายวันใช้ค่า 24 ชม. ตอน 07:00 ของวันถัดไป ถ้าไม่มีใช้ค่าสูงสุดในวัน", () => {
    const dates = ["2026-10-19", "2026-10-20"];
    const stations = dailyRainByStation([
      rain("A", "2026-10-19 15:00:00", 20),
      rain("A", "2026-10-20 07:00:00", 42.5), // ฝนวันที่ 19
      rain("A", "2026-10-20 18:00:00", 12),   // วันที่ 20 ยังไม่ครบ ใช้ค่าสูงสุด
      rain("B", "2026-10-20 08:00:00", 5, { amphoe: "ควนโดน" })
    ], dates);
    const a = stations.find((s) => s.id === "A");
    expect(a.daily.map((d) => d.mm)).toEqual([42.5, 12]);
    expect(a).toMatchObject({ total_mm: 54.5, max_day_mm: 42.5, heavy_days: 1 });
    const province = dailyRainSummary(stations, dates);
    expect(province[0]).toMatchObject({ max_mm: 42.5, max_station: "[ทดสอบ] สถานีA", stations: 2 });
    expect(dailyRainSummary(stations, dates, "ควนโดน")[0]).toMatchObject({ max_mm: 5, stations: 1 });
  });

  test("ระดับน้ำ: จุดกราฟใช้ค่าสูงสุดของช่วง นับชั่วโมงล้นตลิ่ง ข้ามค่าที่เครื่องขัดข้อง", () => {
    const rows = [
      { station_code: "STN01", station_name: "[ทดสอบ] สะพาน", hour_at: "2026-10-20 01:00:00", water_level: 3.5, bank_level: 3.8, malfunction: 0 },
      { station_code: "STN01", station_name: "[ทดสอบ] สะพาน", hour_at: "2026-10-20 02:00:00", water_level: 3.95, bank_level: 3.8, malfunction: 0 },
      { station_code: "STN01", station_name: "[ทดสอบ] สะพาน", hour_at: "2026-10-20 03:00:00", water_level: 9.9, bank_level: 3.8, malfunction: 1 },
      { station_code: "TW123", station_name: "[ทดสอบ] คลอง", hour_at: "2026-10-20 01:00:00", water_level: 1, bank_level: 4, malfunction: 0 }
    ];
    const [first, second] = waterStationSeries(rows, { days: 30 });
    expect(first).toMatchObject({ code: "STN01", source: "ปภ.", hours_over_bank: 1, peak: { level: 3.95, diff: 0.15 } });
    expect(first.series).toEqual([{ t: "2026-10-20 00:00:00", level: 3.95 }]);
    expect(second.source).toBe("ThaiWater");
  });

  test("น้ำทะเล: จุดสูงสุดและจำนวนวันหนุนสูง", () => {
    const out = seaLevelSeries([
      { hour_at: "2026-10-19 10:00:00", observed_level: 1.2, model_level: 1.1, status_key: "elevated" },
      { hour_at: "2026-10-20 11:00:00", observed_level: null, model_level: 1.6, status_key: "high" }
    ], { days: 7 });
    expect(out.peak).toEqual({ t: "2026-10-20 11:00:00", level: 1.6 });
    expect(out).toMatchObject({ elevated_days: 2, high_days: 1 });
    expect(out.series).toHaveLength(2);
  });
});

test("วันที่ยังไม่ครบ: รวมฝนรายชั่วโมงหลัง 07:00 ไม่นับฝนเมื่อวาน", () => {
  const [s] = dailyRainByStation([
    { station_id: "C", station_name: "[ทดสอบ] C", hour_at: "2026-10-20 07:00:00", rain_24h: 40, rain_1h: 0 },
    { station_id: "C", station_name: "[ทดสอบ] C", hour_at: "2026-10-20 09:00:00", rain_24h: 45, rain_1h: 3 },
    { station_id: "C", station_name: "[ทดสอบ] C", hour_at: "2026-10-20 10:00:00", rain_24h: 47, rain_1h: 2 }
  ], ["2026-10-20"]);
  expect(s.daily[0]).toEqual({ date: "2026-10-20", mm: 5, approx: true });
});
