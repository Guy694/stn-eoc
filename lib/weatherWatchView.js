// หน้าแรกใช้แค่สรุปรายอำเภอ + คำเตือน + พยากรณ์ 7 วันแบบย่อ: ตัดพยากรณ์รายชั่วโมง กราฟ และภาพ HII ออก
// เพื่อให้มือถือที่สัญญาณแย่ช่วงเกิดภัยเปิดหน้าแรกได้เร็ว
const HOME_DROP_TOP = ["weather_forecast", "weather_map_layers", "map_points", "timeline", "charts", "marine", "river_outlook", "hii_media", "integration_sources"];
const HOME_DROP_DISTRICT = ["forecast_hourly", "river_outlook"];
// พยากรณ์รายวันบนหน้าแรก (การ์ด 7 วัน): เก็บเฉพาะช่องที่การ์ดใช้ (~7 อำเภอ × 7 วัน)
const HOME_DAILY_FIELDS = ["forecast_datetime", "weather_code", "weather_condition", "temperature_min", "temperature_max", "prob_moderate", "prob_heavy", "uv_index_max", "forecast_source", "weather_kind"];

function slimDay(day) {
  const slim = {};
  HOME_DAILY_FIELDS.forEach((key) => { if (day?.[key] !== undefined) slim[key] = day[key]; });
  return slim;
}

export function homeView(payload) {
  const view = { ...payload };
  HOME_DROP_TOP.forEach((key) => { delete view[key]; });
  view.district_weather = (payload.district_weather || []).map((district) => {
    const slim = { ...district };
    HOME_DROP_DISTRICT.forEach((key) => { delete slim[key]; });
    if (Array.isArray(district.forecast_daily)) slim.forecast_daily = district.forecast_daily.slice(0, 7).map(slimDay);
    else delete slim.forecast_daily;
    return slim;
  });
  return view;
}
