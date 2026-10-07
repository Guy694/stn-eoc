import { homeView } from "@/lib/weatherWatchView";

describe("homeView", () => {
  const payload = {
    weather_current: { temperature: 28 },
    weather_warnings: [{ title: "ฝนตกหนัก" }],
    weather_forecast: [{ day: 1 }],
    charts: { rain: [] },
    hii_media: { pre_rain: [] },
    district_weather: [
      { district_name: "ละงู", risk_level: "watch", rain_gauge: { value: 40 }, forecast_daily: [1, 2], forecast_hourly: [1], river_outlook: {} }
    ]
  };

  it("ตัดพยากรณ์รายชั่วโมง/รายวันและข้อมูลกราฟออก แต่เก็บสิ่งที่หน้าแรกใช้", () => {
    const view = homeView(payload);
    expect(view.weather_forecast).toBeUndefined();
    expect(view.charts).toBeUndefined();
    expect(view.hii_media).toBeUndefined();
    expect(view.weather_current).toEqual({ temperature: 28 });
    expect(view.weather_warnings).toHaveLength(1);
    expect(view.district_weather[0]).toEqual({ district_name: "ละงู", risk_level: "watch", rain_gauge: { value: 40 } });
  });

  it("ไม่แก้ไข payload ต้นฉบับที่ cache ไว้", () => {
    homeView(payload);
    expect(payload.weather_forecast).toBeDefined();
    expect(payload.district_weather[0].forecast_daily).toEqual([1, 2]);
  });
});
