import { homeView } from "@/lib/weatherWatchView";

describe("homeView", () => {
  const payload = {
    weather_current: { temperature: 28 },
    weather_warnings: [{ title: "ฝนตกหนัก" }],
    weather_forecast: [{ day: 1 }],
    charts: { rain: [] },
    hii_media: { pre_rain: [] },
    district_weather: [
      { district_name: "ละงู", risk_level: "watch", rain_gauge: { value: 40 }, forecast_daily: [{ forecast_datetime: "2026-11-01T12:00:00+07:00", weather_code: 61, temperature_max: 31, wind_speed: 12, river_level: "normal" }], forecast_hourly: [1], river_outlook: {} }
    ]
  };

  it("ตัดพยากรณ์รายชั่วโมงและข้อมูลกราฟออก แต่เก็บสิ่งที่หน้าแรกใช้ (พยากรณ์ 7 วันแบบย่อ)", () => {
    const view = homeView(payload);
    expect(view.weather_forecast).toBeUndefined();
    expect(view.charts).toBeUndefined();
    expect(view.hii_media).toBeUndefined();
    expect(view.weather_current).toEqual({ temperature: 28 });
    expect(view.weather_warnings).toHaveLength(1);
    expect(view.district_weather[0]).toEqual({
      district_name: "ละงู", risk_level: "watch", rain_gauge: { value: 40 },
      forecast_daily: [{ forecast_datetime: "2026-11-01T12:00:00+07:00", weather_code: 61, temperature_max: 31 }]
    });
  });

  it("ไม่แก้ไข payload ต้นฉบับที่ cache ไว้", () => {
    homeView(payload);
    expect(payload.weather_forecast).toBeDefined();
    expect(payload.district_weather[0].forecast_daily[0].wind_speed).toBe(12);
  });
});
