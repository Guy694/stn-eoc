import {
  bucketHours, dailyRainByStation, dailyRainSummary, dateList, districtRainSummary, maxRollingSum, mergeWaterStationMeta, normalizeDays,
  rainIntensitySeries, seaLevelSeries, waterStationSeries
} from "@/lib/hydroHistory";

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

test("ส่งพิกัดสถานีสำหรับแผนที่: ฝนจากข้อมูลที่เก็บ, น้ำเฉพาะสถานี ปภ.", () => {
  const rain = dailyRainByStation([{ station_id: "r1", station_name: "[ทดสอบ] สถานีฝน", lat: "6.9", lng: "99.8", hour_at: "2026-10-02 07:00:00", rain_24h: 10, rain_1h: 0 }], ["2026-10-01"]);
  expect(rain[0]).toMatchObject({ lat: 6.9, lng: 99.8 });
  const water = waterStationSeries([
    { station_code: "STN05", station_name: "ท่าแพ", hour_at: "2026-10-01 10:00:00", water_level: 3, bank_level: 6, malfunction: 0 },
    { station_code: "TW123", station_name: "สสน.", hour_at: "2026-10-01 10:00:00", water_level: 1, bank_level: 4, malfunction: 0 }
  ], { days: 7 });
  expect(water.find((s) => s.code === "STN05").lat).toBeGreaterThan(6);
  expect(water.find((s) => s.code === "TW123").lat).toBeNull();
});

describe("ข้อมูลวิเคราะห์เพิ่มเติม", () => {
  const dates = ["2026-10-19", "2026-10-20", "2026-10-21"];
  const rows = [
    rain("A", "2026-10-20 07:00:00", 40, { rain_1h: 1 }),
    rain("A", "2026-10-20 15:00:00", 30, { rain_1h: 22.4 }),
    rain("A", "2026-10-21 07:00:00", 60, { rain_1h: 0 }),
    rain("A", "2026-10-22 07:00:00", 2, { rain_1h: 0 }),
    rain("B", "2026-10-20 07:00:00", 10, { amphoe: "ควนโดน", rain_1h: 0 }),
    rain("B", "2026-10-20 15:00:00", 12, { amphoe: "ควนโดน", rain_1h: 4 }),
    rain("B", "2026-10-21 07:00:00", 0, { amphoe: "ควนโดน", rain_1h: 0 })
  ];
  const stations = dailyRainByStation(rows, dates);

  test("สถานีฝน: ฝนแรงสุด 1 ชม. วันที่มีฝน และฝนสะสม 3 วันสูงสุด", () => {
    expect(maxRollingSum([null, 5, 10, 1, 20], 3)).toBe(31);
    expect(maxRollingSum([null, null])).toBeNull();
    const a = stations.find((s) => s.id === "A");
    expect(a.daily.map((d) => d.mm)).toEqual([40, 60, 2]);
    expect(a).toMatchObject({ max_1h_mm: 22.4, max_1h_at: "2026-10-20 15:00:00", rain_days: 3, max_3d_mm: 102, heavy_days: 2 });
  });

  test("ฝนรายวันของพื้นที่: สะสมเฉลี่ยและจำนวนสถานีฝนหนัก", () => {
    const daily = dailyRainSummary(stations, dates);
    expect(daily.map((d) => d.cum_avg_mm)).toEqual([25, 55, 57]);
    expect(daily.map((d) => d.heavy_stations)).toEqual([1, 1, 0]);
  });

  test("สรุปรายอำเภอ: ใช้ระบายสีแผนที่และตารางอำเภอ × วัน", () => {
    const [khuandon, langu] = districtRainSummary(stations, dates);
    expect(khuandon).toMatchObject({ amphoe: "ควนโดน", stations: 1, total_mm: 10, max_day_mm: 10, heavy_days: 0 });
    expect(langu).toMatchObject({ amphoe: "ละงู", total_mm: 102, max_day_mm: 60, max_day: "2026-10-20", heavy_days: 2, daily_max: [40, 60, 2] });
  });

  test("ความแรงฝนตามช่วงเวลา: สูงสุด/เฉลี่ยข้ามสถานี และค่าเฉลี่ยรายอำเภอ", () => {
    const hourly = rainIntensitySeries(rows, { days: 7 });
    const at15 = hourly.area.find((p) => p.t === "2026-10-20 15:00:00");
    expect(at15).toMatchObject({ max_mm: 22.4, avg_mm: 13.2, raining: 2, stations: 2, max_station: "[ทดสอบ] สถานีA" });
    expect(hourly.by_district["ควนโดน"].find((p) => p.t === "2026-10-20 15:00:00").mm).toBe(4);
    expect(rainIntensitySeries(rows, { days: 7, amphoe: "ควนโดน" }).area.find((p) => p.t === "2026-10-20 15:00:00").max_mm).toBe(4);
    // 90 วัน = รวมเป็นรายวัน
    expect(rainIntensitySeries(rows, { days: 90 }).area.find((p) => p.t === "2026-10-20 00:00:00").max_mm).toBe(23.4);
  });

  test("ระดับน้ำ: น้ำขึ้นเร็วสุด เปลี่ยนแปลง 6 ชม. ต่ำสุด และข้อมูลประกอบสถานี", () => {
    const w = (hour, level) => ({ station_code: "STN05", station_name: "[ทดสอบ] ท่าแพ", hour_at: hour, water_level: level, bank_level: 4, malfunction: 0 });
    const [station] = mergeWaterStationMeta(waterStationSeries([
      w("2026-10-20 01:00:00", 2), w("2026-10-20 02:00:00", 2.6), w("2026-10-20 04:00:00", 3), w("2026-10-20 08:00:00", 4.2), w("2026-10-21 09:00:00", 4.1)
    ], { days: 7 }), { STN05: { thresholds: { watch: 3, warning: 3.5, danger: 4, critical: null } } });
    expect(station.max_rise).toEqual({ t: "2026-10-20 02:00:00", rate: 0.6 });
    expect(station).toMatchObject({ change: 2.1, range: 2.2, lowest: { level: 2 }, days_over_bank: 2, change_6h: null, amphoe: "ท่าแพ", thresholds: { watch: 3 } });
    expect(station.lat).toBeCloseTo(6.8, 1);
    const [six] = waterStationSeries([w("2026-10-20 02:00:00", 2.5), w("2026-10-20 08:00:00", 3.1)], { days: 7 });
    expect(six.change_6h).toBe(0.6);
    const [tw] = mergeWaterStationMeta(waterStationSeries([{ ...w("2026-10-20 01:00:00", 1), station_code: "TW99" }], { days: 7 }), { TW99: { amphoe: "ละงู", lat: 6.9, lng: 99.8 } });
    expect(tw).toMatchObject({ amphoe: "ละงู", lat: 6.9, thresholds: null });
  });

  test("น้ำทะเลรายวัน: สูงสุด พิสัยน้ำ และระดับการหนุน", () => {
    const out = seaLevelSeries([
      { hour_at: "2026-10-19 04:00:00", observed_level: 0.2, model_level: -0.9, status_key: "normal" },
      { hour_at: "2026-10-19 10:00:00", observed_level: 1.2, model_level: 1.1, status_key: "elevated" },
      { hour_at: "2026-10-20 11:00:00", observed_level: null, model_level: 1.6, status_key: "high" }
    ], { days: 7 });
    expect(out.daily).toEqual([
      { date: "2026-10-19", model_max: 1.1, observed_max: 1.2, tidal_range: 2, rank: 1 },
      { date: "2026-10-20", model_max: 1.6, observed_max: null, tidal_range: 0, rank: 2 }
    ]);
  });
});
