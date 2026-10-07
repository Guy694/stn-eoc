// หน้าแรกใช้แค่สรุปรายอำเภอ + คำเตือน: ตัดพยากรณ์รายชั่วโมง/รายวัน กราฟ และภาพ HII ออก (~56 KB → ~12 KB)
// เพื่อให้มือถือที่สัญญาณแย่ช่วงเกิดภัยเปิดหน้าแรกได้เร็ว
const HOME_DROP_TOP = ["weather_forecast", "weather_map_layers", "map_points", "timeline", "charts", "marine", "river_outlook", "hii_media", "integration_sources"];
const HOME_DROP_DISTRICT = ["forecast_daily", "forecast_hourly", "river_outlook"];

export function homeView(payload) {
  const view = { ...payload };
  HOME_DROP_TOP.forEach((key) => { delete view[key]; });
  view.district_weather = (payload.district_weather || []).map((district) => {
    const slim = { ...district };
    HOME_DROP_DISTRICT.forEach((key) => { delete slim[key]; });
    return slim;
  });
  return view;
}
