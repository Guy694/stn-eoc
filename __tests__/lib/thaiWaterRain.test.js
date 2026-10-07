import { normalizeDistrictName, parseRainResponse, pickDistrictRain, rainCategory, summarizeRainByDistrict } from "@/lib/thaiWaterRain";
import { detectRainAlerts, formatRainAlertsTelegram, nextRainState, rainThresholdsFromEnv } from "@/lib/waterAlerts";

const NOW = Date.parse("2026-10-07T13:00:00+07:00");
let seq = 0;
const record = (rain, amphoe = "ควนกาหลง", over = {}) => ({
  id: (seq += 1),
  rain_24h: rain,
  rain_1h: 0,
  rainfall_datetime: "2026-10-07 12:00",
  agency: { agency_shortname: { th: "ทน.", en: "DWR" } },
  geocode: { amphoe_name: { th: amphoe }, tumbon_name: { th: "อุใดเจริญ" }, province_code: "91", province_name: { th: "สตูล" } },
  station: { id: 1000 + seq, tele_station_name: { th: `สถานี ${seq}` }, tele_station_lat: 6.9, tele_station_long: 99.98 },
  ...over
});

describe("thaiWaterRain", () => {
  test("เกณฑ์ฝนกรมอุตุฯ", () => {
    expect([0, 0.1, 10, 10.1, 35, 35.1, 90, 90.1, 150].map((mm) => rainCategory(mm).key))
      .toEqual(["none", "light", "light", "moderate", "moderate", "heavy", "heavy", "very_heavy", "very_heavy"]);
  });

  test("รับเฉพาะสตูล ตัดค่าผิดปกติ เรียงฝนมากสุดก่อน", () => {
    const stations = parseRainResponse({ result: "OK", data: [
      record(4),
      record(41.5),
      record(30, "หาดใหญ่", { geocode: { amphoe_name: { th: "หาดใหญ่" }, province_code: "90", province_name: { th: "สงขลา" } } }),
      record(999),
      record(null),
      record(5, "มะนัง", { station: { id: 9, tele_station_name: { th: "ไม่มีพิกัด" } } })
    ] });
    expect(stations.map((item) => item.rain24h)).toEqual([41.5, 4]);
    expect(stations[0]).toMatchObject({ amphoe: "ควนกาหลง", agency: "ทน.", observedAt: "2026-10-07T12:00:00+07:00" });
  });

  test("สรุปรายอำเภอ: ค่าเฉลี่ย สูงสุด และตัดสถานีที่ข้อมูลเก่า", () => {
    const stations = parseRainResponse({ data: [
      record(41.5), record(2.8), record(0),
      record(80, "ควนกาหลง", { rainfall_datetime: "2026-10-07 06:00" }),
      record(38, "ควนกาหลง", { rainfall_datetime: "2026-10-07 09:00" }),
      record(2, "ท่าแพ")
    ] });
    const summary = summarizeRainByDistrict(stations, { now: NOW });
    // 06:00 เก่ากว่า 6 ชม. ตัดทิ้ง / 09:00 (4 ชม.ก่อน) ยังใช้
    expect(summary.get("ควนกาหลง")).toMatchObject({ count: 4, max: 41.5, mean: 20.6 });
    expect(summary.get("ท่าแพ").count).toBe(1);
    expect(normalizeDistrictName("อ.ควน กาหลง")).toBe("ควนกาหลง");
  });

  test("ใช้ค่าวัดจริงเมื่อมีอย่างน้อย 2 สถานี ไม่งั้นใช้โมเดล", () => {
    const model = { modelRain24h: 30.7, modelRain1h: 0.1 };
    expect(pickDistrictRain(model, { count: 3, max: 41.5, mean: 14.8, rain1hMax: 0, maxStation: "บ้านผัง 120" }))
      .toMatchObject({ source: "gauge", rain24h: 41.5 });
    expect(pickDistrictRain(model, { count: 1, max: 2 })).toMatchObject({ source: "gauge", rain24h: 2 });
    expect(pickDistrictRain(model, { count: 0, max: 0 })).toMatchObject({ source: "model", rain24h: 30.7 });
    expect(pickDistrictRain(model, null)).toMatchObject({ source: "model", rain24h: 30.7, gauge: null });
  });
});

describe("แจ้งเตือนฝนหนัก", () => {
  const stations = (values) => parseRainResponse({ data: values.map((value) => record(value)) });

  test("แจ้งเมื่อถึงเกณฑ์ และแจ้งอีกครั้งเมื่อแย่ลงเท่านั้น", () => {
    const [heavy] = stations([65]);
    const first = detectRainAlerts([heavy], new Map(), { now: NOW });
    expect(first.alerts[0]).toMatchObject({ kind: "rain", level: "serious", state: "watch", stationId: `rain:${heavy.id}` });
    const again = detectRainAlerts([heavy], new Map([[`rain:${heavy.id}`, "watch"]]), { now: NOW });
    expect(again.alerts).toHaveLength(0);
    const worse = detectRainAlerts([{ ...heavy, rain24h: 95 }], new Map([[`rain:${heavy.id}`, "watch"]]), { now: NOW });
    expect(worse.alerts[0]).toMatchObject({ level: "critical", state: "severe" });
  });

  test("ฝนลดลงไม่แจ้ง และกันแกว่งที่ 80% ของเกณฑ์", () => {
    expect(nextRainState("watch", 55)).toBe("watch");
    expect(nextRainState("watch", 40)).toBe("normal");
    expect(nextRainState("severe", 80)).toBe("severe");
    expect(nextRainState("severe", 65)).toBe("watch");
    const [station] = stations([20]);
    const result = detectRainAlerts([station], new Map([[`rain:${station.id}`, "severe"]]), { now: NOW });
    expect(result.alerts).toHaveLength(0);
    expect(result.updates[0]).toMatchObject({ state: "normal", changed: true });
  });

  test("รวมหลายสถานีเป็นข้อความ Telegram เดียว", () => {
    const { alerts } = detectRainAlerts(stations([95, 70]), new Map(), { now: NOW });
    const text = formatRainAlertsTelegram(alerts, { link: "https://eoc.example/map" });
    expect(text.split("\n")[0]).toBe("<b>⛈️ ฝนหนักมาก 2 สถานี ในจังหวัดสตูล</b>");
    expect(text).toMatch(/95\.0 มม\.\/24 ชม\.[\s\S]*70\.0 มม\./);
    expect(text).toContain("ThaiWater");
    expect(formatRainAlertsTelegram([])).toBe("");
  });

  test("เกณฑ์จาก env", () => {
    expect(rainThresholdsFromEnv({ RAIN_ALERT_WATCH_MM: "50", RAIN_ALERT_SEVERE_MM: "100" })).toEqual({ watchMm: 50, severeMm: 100 });
    expect(rainThresholdsFromEnv({ RAIN_ALERT_WATCH_MM: "120", RAIN_ALERT_SEVERE_MM: "100" })).toEqual({ watchMm: 60, severeMm: 90.1 });
    expect(rainThresholdsFromEnv({ RAIN_ALERT_WATCH_MM: "100" })).toEqual({ watchMm: 60, severeMm: 90.1 });
    expect(rainThresholdsFromEnv({})).toEqual({ watchMm: 60, severeMm: 90.1 });
  });
});
