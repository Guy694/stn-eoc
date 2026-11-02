// ชนิดภาพสภาพอากาศจากรหัส WMO ของ Open-Meteo (หรือข้อความสภาพอากาศเมื่อไม่มีรหัส)
// ใช้กับการ์ดพยากรณ์ 7 วันหน้าแรก (components/common/WeatherIcon.jsx)
export const WEATHER_KINDS = {
  sun: "แดดจัด",
  partly: "มีเมฆบางส่วน",
  cloud: "มีเมฆมาก",
  fog: "หมอก",
  drizzle: "ฝนละออง",
  showers: "ฝนเป็นช่วง มีแดดสลับ",
  rain: "ฝนตก",
  heavy: "ฝนตกหนัก",
  storm: "ฝนฟ้าคะนอง"
};

export function weatherKind(code, text = "") {
  const value = Number(code);
  if (code !== null && code !== undefined && code !== "" && Number.isFinite(value)) {
    if (value === 0) return "sun";
    if (value === 1 || value === 2) return "partly";
    if (value === 3) return "cloud";
    if (value === 45 || value === 48) return "fog";
    if (value >= 51 && value <= 57) return "drizzle";
    if (value === 65 || value === 67 || value === 82) return "heavy";
    if (value === 80 || value === 81) return "showers";
    if (value >= 61 && value <= 67) return "rain";
    if (value >= 95) return "storm";
    return "cloud";
  }
  const label = String(text || "");
  if (/ฟ้าคะนอง|พายุ/.test(label)) return "storm";
  if (/ฝน.*หนัก/.test(label)) return "heavy";
  if (/ละออง/.test(label)) return "drizzle";
  if (/โปรย|เป็นช่วง/.test(label)) return "showers";
  if (/ฝน/.test(label)) return "rain";
  if (/หมอก/.test(label)) return "fog";
  if (/บางส่วน/.test(label)) return "partly";
  if (/เมฆ/.test(label)) return "cloud";
  if (/แจ่มใส|แดด/.test(label)) return "sun";
  return "cloud";
}
