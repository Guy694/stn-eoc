// ฉากพื้นหลังของหน้าแรกตามสภาพอากาศตอนนี้ (ไม่มีการเรียกเครือข่ายในไฟล์นี้)
// rain: 0 ไม่มี / 1 เล็กน้อย / 2 ปานกลาง / 3 หนัก — ใช้ฝนที่สถานีวัดได้ก่อน แบบจำลองเป็นตัวสำรอง

const PRESETS = {
  clear: { rain: 0, wind: 6, thunder: false, cloud: 0 },
  cloudy: { rain: 0, wind: 10, thunder: false, cloud: 2 },
  rain: { rain: 1, wind: 12, thunder: false, cloud: 2 },
  heavy: { rain: 3, wind: 28, thunder: false, cloud: 2 },
  storm: { rain: 3, wind: 40, thunder: true, cloud: 2 },
  wind: { rain: 0, wind: 45, thunder: false, cloud: 1 }
};

function bangkokHour(now) {
  const date = new Date(now + 7 * 3600 * 1000);
  return date.getUTCHours() + date.getUTCMinutes() / 60;
}

export function isNight(now = Date.now()) {
  const hour = bangkokHour(now);
  return hour < 6 || hour >= 18.5;
}

export function rainLevelFromMm(mmPerHour) {
  const mm = Number(mmPerHour) || 0;
  if (mm >= 20) return 3;
  if (mm >= 5) return 2;
  if (mm > 0) return 1;
  return 0;
}

const RAIN_TEXT = ["", "ฝนตกเล็กน้อย", "ฝนตกปานกลาง", "ฝนตกหนัก"];

/** สรุปฉาก: { rain, wind, thunder, cloud, night, label } — preset ใช้ดูตัวอย่าง (?fx=storm) */
export function weatherScene({ current = null, districts = [], now = Date.now(), preset = null } = {}) {
  const night = preset === "night" ? true : isNight(now);
  if (preset && PRESETS[preset]) {
    const scene = { ...PRESETS[preset], night };
    return { ...scene, label: sceneLabel(scene), preview: true };
  }
  if (preset === "night") {
    const scene = { ...PRESETS.clear, night: true };
    return { ...scene, label: sceneLabel(scene), preview: true };
  }

  const gaugeMax = Math.max(0, ...districts.map((item) => (item.rain_now?.raining ? Number(item.rain_now.max1h) || 0 : 0)));
  const condition = String(current?.weather_condition || "");
  let rain = rainLevelFromMm(gaugeMax);
  // ไม่มีสถานีรายงานฝน แต่ภาพรวมบอกว่าฝนตก → อย่างน้อยฝนเล็กน้อย
  if (rain === 0 && /ฝนตก/.test(condition) && !districts.some((item) => item.rain_now?.stations > 0)) rain = 1;
  const thunder = rain >= 2 && (/ฟ้าคะนอง/.test(condition) || districts.some((item) => item.thunder_expected && item.rain_now?.raining > 0));
  const cloud = rain > 0 || /เมฆมาก|ฝน/.test(condition) ? 2 : /เมฆ/.test(condition) ? 1 : 0;
  const wind = Number(current?.wind_speed) || 0;
  const scene = { rain, wind, thunder, cloud, night };
  return { ...scene, label: sceneLabel(scene), preview: false };
}

export function sceneLabel({ rain, wind, thunder, cloud, night }) {
  const parts = [];
  if (rain) parts.push(RAIN_TEXT[rain]);
  else if (cloud >= 2) parts.push("มีเมฆมาก");
  else if (cloud === 1) parts.push("มีเมฆบางส่วน");
  else parts.push(night ? "ท้องฟ้าโปร่ง" : "ท้องฟ้าแจ่มใส");
  if (thunder) parts.push("มีฟ้าคะนอง");
  if (wind >= 30) parts.push(`ลมแรง ${Math.round(wind)} กม./ชม.`);
  else if (wind >= 15) parts.push(`ลม ${Math.round(wind)} กม./ชม.`);
  return parts.join(" • ");
}
