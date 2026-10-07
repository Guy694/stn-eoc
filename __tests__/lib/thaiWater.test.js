import { bankDiff, bankLabel, bankText, groupByLocation, isStale, parseWaterLevelResponse, situationFromStorage, summarizeStations, thaiDateTimeToIso, trendOf } from "@/lib/thaiWater";

// ตัวอย่างโครงสร้างจริงของ API ThaiWater (ตัดฟิลด์ที่ไม่ใช้)
const record = (over = {}) => ({
  id: 1,
  waterlevel_datetime: "2026-10-07 10:40",
  waterlevel_msl: "1.26",
  waterlevel_msl_previous: "1.26",
  storage_percent: "77.11",
  situation_level: 4,
  agency: { agency_shortname: { th: "สสน.", en: "HII" } },
  station: { id: 12481, tele_station_name: { th: "ละงู", en: "La-ngu" }, tele_station_lat: 6.885757, tele_station_long: 99.804344, min_bank: 4.22 },
  geocode: { tumbon_name: { th: "ละงู" }, amphoe_name: { th: "ละงู" }, province_name: { th: "สตูล" } },
  diff_wl_bank: "2.96",
  diff_wl_bank_text: "ต่ำกว่าตลิ่ง (ม.)",
  river_name: "คลองละงู",
  ...over
});

describe("thaiWater", () => {
  test("ส่วนต่างตลิ่ง: ต่ำกว่า = ลบ, ล้น = บวก", () => {
    expect(bankDiff(record())).toBe(-2.96);
    expect(bankDiff(record({ diff_wl_bank: "0.97", diff_wl_bank_text: "ล้นตลิ่ง (ม.)" }))).toBe(0.97);
    expect(bankDiff(record({ diff_wl_bank: null }))).toBeNull();
    expect(bankText(-2.96)).toBe("ต่ำกว่าตลิ่ง 2.96 ม.");
    expect(bankText(0.97)).toBe("สูงกว่าตลิ่ง 0.97 ม.");
    expect(bankLabel(0.97)).toBe("ล้นตลิ่ง 0.97 ม.");
    expect(bankLabel(-1.15)).toBe("−1.15 ม.");
  });

  test("สถานการณ์จาก % ความจุ (กรณี API ไม่ส่ง situation_level)", () => {
    expect([5, 23, 33.85, 77.11, 114].map(situationFromStorage)).toEqual([1, 2, 3, 4, 5]);
    expect(parseWaterLevelResponse({ data: [record({ situation_level: null, storage_percent: "114" })] })[0].situationLevel).toBe(5);
  });

  test("แนวโน้ม และเวลาไทย", () => {
    expect(trendOf("5.48", "5.49").value).toBe("falling");
    expect(trendOf("1.26", "1.26").value).toBe("steady");
    expect(trendOf("1.30", "1.26").value).toBe("rising");
    expect(trendOf(null, "1")).toBeNull();
    expect(thaiDateTimeToIso("2026-10-07 10:40")).toBe("2026-10-07T10:40:00+07:00");
    expect(isStale("2026-10-07T10:40:00+07:00", Date.parse("2026-10-07T11:00:00+07:00"))).toBe(false);
    expect(isStale("2026-10-07T06:00:00+07:00", Date.parse("2026-10-07T11:00:00+07:00"))).toBe(true);
  });

  test("รับเฉพาะสถานีในสตูล เรียงจากรุนแรงสุด", () => {
    const stations = parseWaterLevelResponse({
      result: "OK",
      data: [
        record({ situation_level: 3, station: { ...record().station, id: 2 } }),
        record(),
        record({ station: { ...record().station, id: 3 }, geocode: { province_name: { th: "สมุทรปราการ" } } }),
        record({ station: { id: 4, tele_station_name: { th: "ไม่มีพิกัด" } } })
      ]
    });
    expect(stations.map((item) => item.id)).toEqual(["12481", "2"]);
    expect(stations[0]).toMatchObject({ name: "ละงู", river: "คลองละงู", amphoe: "ละงู", bankDiff: -2.96, waterLevelMsl: 1.26, bankLevelMsl: 4.22, agency: "สสน." });
    expect(parseWaterLevelResponse({ waterlevel_data: { data: [record()] } })).toHaveLength(1);
    expect(parseWaterLevelResponse(null)).toEqual([]);
  });

  test("สถานีพิกัดเดียวกันรวมเป็นหมุดเดียว ใช้สถานีที่รุนแรงกว่าเป็นหลัก", () => {
    const stations = parseWaterLevelResponse({ data: [
      record({ situation_level: 3, station: { ...record().station, id: 10 } }),
      record({ situation_level: 5, diff_wl_bank: "0.2", diff_wl_bank_text: "ล้นตลิ่ง (ม.)", station: { ...record().station, id: 11, tele_station_lat: 6.8857571 } })
    ] });
    const groups = groupByLocation(stations);
    expect(groups).toHaveLength(1);
    expect(groups[0].primary.id).toBe("11");
    expect(summarizeStations(stations)).toMatchObject({ total: 2, overflow: 1, nearBank: 1 });
  });
});
