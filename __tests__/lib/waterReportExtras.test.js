import { buildBasinCard, buildForecastDays, buildRainTable, normalizeReportConfig, pickBasinStation, thaiShortDate, thaiWaterCode } from "@/lib/waterReportExtras";

const station = (over) => ({ id: "1", name: "สถานี", river: "", amphoe: "", waterLevelMsl: 10, bankLevelMsl: 12, bankDiff: -2, situationLevel: 3, trend: null, observedAt: "2026-10-14T23:00:00Z", ...over });

describe("normalizeReportConfig", () => {
  it("เติมค่าเริ่มต้นและแปลงตัวเลข", () => {
    const config = normalizeReportConfig({ basins: [{ key: "langu", warning: "11.5", bank: "" }], areas: [{ key: "lowland", text: "ลุ่มคลองละงู ต.กำแพง" }] });
    expect(config.basins).toHaveLength(3);
    expect(config.basins[1]).toMatchObject({ key: "langu", label: "คลองละงู", warning: 11.5, bank: null });
    expect(config.basins[0].warning).toBeNull();
    expect(config.areas[2].text).toBe("ลุ่มคลองละงู ต.กำแพง");
    expect(config.areas[0].text).toContain("ควนโพธิ์");
  });
  it("ค่าว่าง/ผิดรูปแบบใช้ค่าเริ่มต้น", () => {
    expect(normalizeReportConfig("x").issuer.position).toBe("นายแพทย์สาธารณสุขจังหวัดสตูล");
  });
});

describe("pickBasinStation", () => {
  const list = [
    station({ id: "a", name: "ละงู 1", river: "คลองละงู", situationLevel: 3 }),
    station({ id: "b", name: "ละงู 2", river: "คลองละงู", situationLevel: 4 }),
    station({ id: "c", name: "ท่าแพ", river: "คลองท่าแพ" })
  ];
  it("ใช้สถานีที่ตั้งไว้ก่อน", () => {
    expect(pickBasinStation(list, { station_id: "a", match: "ละงู" }).id).toBe("a");
  });
  it("ค้นจากชื่อและเลือกสถานการณ์รุนแรงสุด", () => {
    expect(pickBasinStation(list, { station_id: "", match: "ละงู" }).id).toBe("b");
    expect(pickBasinStation(list, { station_id: "", match: "ดุสน" })).toBeNull();
  });
});

describe("buildBasinCard", () => {
  const basin = { key: "langu", label: "คลองละงู", warning: 11.5, bank: null };
  it("เทียบกับเมื่อวานและคำนวณระยะต่ำกว่าตลิ่ง", () => {
    const card = buildBasinCard(basin, station({ waterLevelMsl: 7.53, bankLevelMsl: 12.8 }), { previous: 6.6 });
    expect(card).toMatchObject({ level: 7.53, bank: 12.8, belowBank: 5.27, previous: 6.6, previousSource: "yesterday", diff: 0.93, direction: "up", status: "normal" });
  });
  it("ไม่มีค่าเมื่อวาน ใช้ค่าครั้งก่อนจากต้นทาง และเตือนเมื่อถึงระดับเฝ้าระวัง", () => {
    const card = buildBasinCard(basin, station({ waterLevelMsl: 12, bankLevelMsl: 12.8, trend: { change: 0.2 } }));
    expect(card).toMatchObject({ previous: 11.8, previousSource: "previous", diff: 0.2, status: "warning" });
  });
  it("ไม่มีสถานี", () => {
    expect(buildBasinCard(basin, null)).toMatchObject({ station: null, level: null, status: "unknown" });
  });
});

describe("buildRainTable / buildForecastDays", () => {
  const now = Date.parse("2026-10-14T13:00:00Z");
  it("เลือกเฉพาะสถานีที่มีฝนและไม่เก่า เรียงมากไปน้อย", () => {
    const table = buildRainTable([
      { id: "1", name: "ก", rain24h: 63.5, observedAt: "2026-10-14T07:00:00Z" },
      { id: "2", name: "ข", rain24h: 11, observedAt: "2026-10-14T11:00:00Z" },
      { id: "3", name: "ค", rain24h: 0, observedAt: "2026-10-14T11:00:00Z" },
      { id: "4", name: "ง", rain24h: 80, observedAt: "2026-10-13T11:00:00Z" }
    ], { now });
    expect(table.rows.map((row) => row.id)).toEqual(["1", "2"]);
    expect(table.rows[0]).toMatchObject({ label: "หนัก", time: "14.00 น." });
    expect(table.rows[1].label).toBe("ปานกลาง");
    expect(table.timeRange).toBe("14.00 – 18.00 น.");
  });
  it("ใช้เฉพาะพยากรณ์รายวัน", () => {
    const days = buildForecastDays([
      { period: "hourly", forecast_datetime: "2026-10-14T15:00:00+07:00", rainfall_forecast: 3 },
      { period: "24h", forecast_datetime: "2026-10-14T12:00:00+07:00", rainfall_forecast: 25, rain_probability: 30 },
      { period: "3d", forecast_datetime: "2026-10-15T12:00:00+07:00", rainfall_forecast: 0, rain_probability: 60 }
    ]);
    expect(days).toEqual([
      expect.objectContaining({ date: "2026-10-14", label: "ปานกลาง", probability: 30 }),
      expect.objectContaining({ date: "2026-10-15", label: "ไม่มีฝน", probability: 60 })
    ]);
  });
});

it("thaiShortDate / thaiWaterCode", () => {
  expect(thaiShortDate("2026-10-14 07:00")).toBe("14 ต.ค. 2569");
  expect(thaiWaterCode("12345")).toBe("TW12345");
});
