/** @jest-environment node */
import { getTmdDailyByDistrict, parseTmdDaily, resetTmdCache, TMD_CONDITIONS } from "@/lib/tmdForecastClient";
import { weatherKind } from "@/lib/weatherIcon";

const sample = {
  weather_forecast: {
    locations: [
      { location: { province: "สตูล", areatype: "province", amphoe: null }, forecasts: [{ time: "2026-11-03T00:00:00+07:00", data: { tc_max: 33 } }] },
      {
        location: { province: "สตูล", areatype: "amphoe", amphoe: "เมืองสตูล", lat: 6.62, lon: 100.07 },
        forecasts: [
          { time: "2026-11-03T00:00:00+07:00", data: { tc_max: 33.6, tc_min: 24.2, rh: 78.4, rain: 12.34, ws10m: 3.2, wd10m: 210, cond: 8 } },
          { time: "2026-11-04T00:00:00+07:00", data: { tc_max: 32.1, tc_min: 24.9, rh: 80, rain: 0, ws10m: 2, wd10m: 90, cond: 2 } }
        ]
      },
      { location: { province: "สตูล", areatype: "amphoe", amphoe: "ละงู" }, forecasts: [{ time: "2026-11-03T00:00:00+07:00", data: { tc_max: 32, tc_min: 24, cond: 99 } }] }
    ]
  }
};

describe("parseTmdDaily", () => {
  test("รายอำเภอ รายวัน (เวลาไทย) · แปลงหน่วยลม · ข้ามแถวจังหวัด", () => {
    const map = parseTmdDaily(sample);
    expect([...map.keys()]).toEqual(["เมืองสตูล", "ละงู"]);
    expect(map.get("เมืองสตูล")["2026-11-03"]).toMatchObject({
      temperature_max: 34, temperature_min: 24, humidity: 78, rain_mm: 12.3, wind_kmh: 12, cond: 8, condition: "ฝนฟ้าคะนอง", kind: "storm"
    });
    expect(map.get("เมืองสตูล")["2026-11-04"].kind).toBe("partly");
  });
  test("รหัสสภาพอากาศที่ไม่รู้จัก = ไม่มีข้อความ/ภาพ (ใช้ของ ECMWF แทน)", () => {
    expect(parseTmdDaily(sample).get("ละงู")["2026-11-03"]).toMatchObject({ cond: null, condition: null, kind: null });
  });
  test("ทุกรหัสของ TMD แปลงเป็นภาพที่มีอยู่จริง", () => {
    for (const meta of Object.values(TMD_CONDITIONS)) expect(weatherKind(null, "", meta.kind)).toBe(meta.kind);
  });
});

describe("getTmdDailyByDistrict", () => {
  const realFetch = global.fetch;
  afterEach(() => { global.fetch = realFetch; resetTmdCache(); });

  test("ไม่มี token = ไม่เรียก API คืน null", async () => {
    global.fetch = jest.fn();
    expect(await getTmdDailyByDistrict({ today: "2026-11-03", token: "" })).toBeNull();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test("ส่ง Bearer token · แคช 3 ชม. · ดึงไม่ได้ใช้ค่าเก่า (ไม่เกิน 24 ชม.)", async () => {
    global.fetch = jest.fn(async () => ({ ok: true, json: async () => sample }));
    const now = Date.parse("2026-11-03T08:00:00+07:00");
    const first = await getTmdDailyByDistrict({ today: "2026-11-03", token: "abc", now });
    expect(first.get("เมืองสตูล")).toBeTruthy();
    const [url, options] = global.fetch.mock.calls[0];
    expect(url).toContain("province=%E0%B8%AA%E0%B8%95%E0%B8%B9%E0%B8%A5");
    expect(url).toContain("subarea=1");
    expect(options.headers.authorization).toBe("Bearer abc");
    await getTmdDailyByDistrict({ today: "2026-11-03", token: "abc", now: now + 3600e3 });
    expect(global.fetch).toHaveBeenCalledTimes(1);

    global.fetch = jest.fn(async () => ({ ok: false, status: 429 }));
    const spy = jest.spyOn(console, "error").mockImplementation(() => {});
    expect((await getTmdDailyByDistrict({ today: "2026-11-03", token: "abc", now: now + 4 * 3600e3 })).get("เมืองสตูล")).toBeTruthy();
    expect(await getTmdDailyByDistrict({ today: "2026-11-03", token: "abc", now: now + 30 * 3600e3 })).toBeNull();
    spy.mockRestore();
  });
});
