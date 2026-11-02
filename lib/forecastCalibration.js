// ชดเชยความคลาดเคลื่อนอุณหภูมิของ ECMWF IFS (Open-Meteo) ที่สตูล
// ที่มา: ทดสอบย้อนหลัง 19 ส.ค.–2 พ.ย. 2569 (74–75 วัน) เทียบสถานีตรวจอากาศสตูล WMO 48580 (กรมอุตุนิยมวิทยา, ข่าว SYNOP)
//   กับพยากรณ์ที่ออกล่วงหน้า 0–7 วัน (Open-Meteo Previous Runs) ณ 6.62N 100.07E
//   อุณหภูมิสูงสุด: แบบจำลองต่ำกว่าจริงเฉลี่ย 3.0 (วันนี้) → 4.6°C (6 วันล่วงหน้า)
//   อุณหภูมิต่ำสุด: ต่ำกว่าจริงเฉลี่ย 0.3 → 1.1°C
// ค่า index = จำนวนวันล่วงหน้า (0 = วันนี้) · ใช้สถานีเดียวกับทุกอำเภอ (อำเภอในแผ่นดินอาจต่างไปเล็กน้อย) · ควรทดสอบซ้ำทุกฤดู
export const TMAX_BIAS_C = [3.0, 3.6, 3.9, 4.0, 4.4, 4.2, 4.6, 4.5];
export const TMIN_BIAS_C = [0.3, 0.8, 1.1, 1.0, 1.1, 1.1, 0.9, 0.9];
// อุณหภูมิ ณ ตอนนี้ (รายชั่วโมง) ต่ำกว่าจริงตามช่วงเวลาของวัน — เทียบข่าว SYNOP ทุก 3 ชม. ของสถานี 48580 (35 วัน, 265 ค่า)
// key = ชั่วโมงเวลาไทย · ระหว่างจุดใช้การประมาณเชิงเส้น
export const CURRENT_TEMP_BIAS_BY_HOUR = { 1: 0.3, 4: 0.6, 7: 0, 10: 1.1, 13: 1.8, 16: 1.7, 19: 0.2, 22: 0.3 };
export const TEMPERATURE_CALIBRATION = "ECMWF IFS เทียบสถานีอุตุฯ สตูล 48580 (ส.ค.–พ.ย. 2569)";

const pick = (list, lead) => list[Math.min(Math.max(0, lead), list.length - 1)];

/** อุณหภูมิหลังชดเชย (ปัดเป็นจำนวนเต็ม) · คืน null เมื่อไม่มีค่า */
export function calibratedTemperature(value, lead, kind = "max") {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  return Math.round(number + pick(kind === "min" ? TMIN_BIAS_C : TMAX_BIAS_C, lead));
}

/** ค่าชดเชยอุณหภูมิตอนนี้ ตามชั่วโมงเวลาไทย (0–23) */
export function currentTempBias(hour) {
  const points = Object.entries(CURRENT_TEMP_BIAS_BY_HOUR).map(([h, bias]) => [Number(h), bias]).sort((a, b) => a[0] - b[0]);
  const h = ((Number(hour) % 24) + 24) % 24;
  if (!Number.isFinite(h)) return 0;
  // วนรอบเที่ยงคืน: ต่อจุดสุดท้ายกับจุดแรก (+24 ชม.)
  const ring = [...points, [points[0][0] + 24, points[0][1]]];
  const x = h < points[0][0] ? h + 24 : h;
  for (let index = 0; index < ring.length - 1; index += 1) {
    const [x0, y0] = ring[index];
    const [x1, y1] = ring[index + 1];
    if (x >= x0 && x <= x1) return Number((y0 + ((y1 - y0) * (x - x0)) / (x1 - x0)).toFixed(2));
  }
  return 0;
}

/** อุณหภูมิตอนนี้หลังชดเชย (ใช้กับอุณหภูมิที่รู้สึกด้วย — ประมาณว่าเลื่อนเท่ากัน) · time = "YYYY-MM-DDTHH:mm" เวลาไทยจาก Open-Meteo */
export function calibratedCurrentTemperature(value, time) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  const hour = Number(String(time || "").slice(11, 13));
  return Math.round(number + (Number.isFinite(hour) && String(time || "").length >= 13 ? currentTempBias(hour) : 0));
}
