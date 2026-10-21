// "บ้านฉันเสี่ยงไหม": รวมความเสี่ยงอำเภอกับสิ่งที่อยู่รอบตำแหน่งบ้าน (ไม่มีการเรียกเครือข่ายในไฟล์นี้)
import { RISK_LEVELS } from "@/lib/weatherRiskConfig";
import { distanceKm } from "@/lib/healthFacilityStatus";
import { waterLevelMeta } from "@/lib/waterReport";

export const NEAR_STATION_KM = 3;
export const NEAR_REPORT_KM = 1;
export const REPORT_FRESH_HOURS = 12;
export const LOW_LYING_M = 5;

const SERIOUS_WATER = new Set(["knee_waist", "waist_chest", "chest_up", "over_head"]);

export function atLeast(level, minimum) {
  return RISK_LEVELS.indexOf(level) >= RISK_LEVELS.indexOf(minimum) ? level : minimum;
}

/** สิ่งที่ใกล้ที่สุด n รายการภายในระยะ (item ต้องมี lat กับ lng/lon) */
export function nearest(lat, lng, items = [], { limit = 3, maxKm = Infinity } = {}) {
  return items
    .map((item) => {
      const itemLat = Number(item.lat ?? item.latitude);
      const itemLng = Number(item.lng ?? item.lon ?? item.longitude);
      if (!Number.isFinite(itemLat) || !Number.isFinite(itemLng)) return null;
      return { item, km: distanceKm(lat, lng, itemLat, itemLng) };
    })
    .filter((row) => row && row.km <= maxKm)
    .sort((a, b) => a.km - b.km)
    .slice(0, limit);
}

/**
 * ระดับความเสี่ยงของบ้าน = ระดับของอำเภอ แล้วปรับขึ้นตามสิ่งที่เกิดใกล้บ้าน
 * (ไม่ปรับลง: ถ้าอำเภอเสี่ยง บ้านที่ยังไม่มีน้ำก็ยังต้องเตรียมตัว)
 */
export function assessHomeRisk({ districtLevel = "normal", elevation = null, floodArea = null, station = null, reports = [], now = Date.now() }) {
  let level = RISK_LEVELS.includes(districtLevel) ? districtLevel : "normal";
  const reasons = [];

  if (floodArea) {
    level = atLeast(level, "high");
    reasons.push(`หมู่บ้านนี้อยู่ในพื้นที่น้ำท่วมที่เจ้าหน้าที่บันทึกไว้${floodArea.label ? ` (${floodArea.label})` : ""}`);
  }

  if (station && station.km <= NEAR_STATION_KM && Number.isFinite(Number(station.item.bankDiff))) {
    const diff = Number(station.item.bankDiff);
    if (diff >= 0) {
      level = atLeast(level, "high");
      reasons.push(`คลองใกล้บ้าน (สถานี${station.item.name}) น้ำล้นตลิ่งแล้ว`);
    } else if (diff > -0.5) {
      level = atLeast(level, "watch");
      reasons.push(`คลองใกล้บ้าน (สถานี${station.item.name}) น้ำใกล้ตลิ่ง ต่ำกว่าตลิ่ง ${Math.abs(diff).toFixed(2)} ม.`);
    }
  }

  const freshSerious = reports.filter(({ item, km }) => {
    const time = new Date(item.reported_at || item.occurred_at || 0).getTime();
    return km <= NEAR_REPORT_KM && now - time <= REPORT_FRESH_HOURS * 3600 * 1000 && SERIOUS_WATER.has(item.water_level);
  });
  if (freshSerious.length > 0) {
    level = atLeast(level, "watch");
    const meta = waterLevelMeta(freshSerious[0].item.water_level);
    reasons.push(`มีรายงานน้ำท่วมระดับ${meta?.label || "สูง"} ห่างไป ${Math.round(freshSerious[0].km * 1000)} ม. ใน ${REPORT_FRESH_HOURS} ชม.ที่ผ่านมา`);
  }

  const lowLying = Number.isFinite(elevation) && elevation > 0 && elevation < LOW_LYING_M;
  if (lowLying && level !== "normal") {
    level = atLeast(level, RISK_LEVELS[Math.min(RISK_LEVELS.indexOf(level) + 1, RISK_LEVELS.length - 1)]);
    reasons.push(`บ้านอยู่ที่ต่ำ (${elevation.toFixed(1)} ม. จากระดับทะเล) น้ำมักไหลมารวม`);
  }

  return { level, reasons, lowLying };
}

/** สิ่งที่ควรทำ ตามระดับและสภาพที่ตั้ง */
export function homeAdvice(level, { lowLying = false, nearCanal = false, sheltersOpen = false } = {}) {
  const items = [];
  if (level === "critical" || level === "high") {
    items.push("ขนย้ายของมีค่า เอกสาร และยาประจำตัวขึ้นที่สูง");
    items.push("ดูแลผู้สูงอายุ เด็ก ผู้ป่วยติดเตียง ให้พร้อมออกจากบ้านก่อนน้ำมา");
    if (sheltersOpen) items.push("ดูเส้นทางไปศูนย์พักพิงที่ใกล้ที่สุดไว้ล่วงหน้า (รายการด้านล่าง)");
    items.push("ไม่ขับรถหรือเดินลุยน้ำไหลผ่าน แม้น้ำดูไม่ลึก");
  }
  if (level === "watch") {
    items.push("เก็บของสำคัญให้พ้นจุดที่น้ำเคยขัง และชาร์จโทรศัพท์ให้เต็ม");
    items.push("ติดตามระดับน้ำในคลองและประกาศจากอำเภอเป็นระยะ");
  }
  if (nearCanal && level !== "normal") items.push("บ้านใกล้คลอง: สังเกตระดับน้ำในคลองทุก 1–2 ชม. ช่วงฝนตกหนัก");
  if (lowLying) items.push("บ้านอยู่ที่ต่ำ: เตรียมกระสอบทราย และจุดวางของที่สูงไว้ล่วงหน้า");
  if (items.length === 0) items.push("ตอนนี้ยังไม่มีสัญญาณน่ากังวล บันทึกหน้านี้ไว้แล้วกลับมาดูเมื่อฝนตกหนัก");
  return items;
}

/** ข้อความที่อ่านออกเสียง: ระดับ → ที่ไหน → เหตุผลหลัก → สิ่งที่ควรทำ */
export function riskSpeechText({ label, place, reasons = [], advice = [] }) {
  const sentence = (text) => String(text || "").trim().replace(/[.。]+$/, "");
  return [
    `ความเสี่ยงน้ำท่วมที่บ้านคุณตอนนี้ ระดับ${label}.`,
    place ? `ตำแหน่ง ${place}.` : "",
    ...reasons.slice(0, 3).map((reason) => `${sentence(reason)}.`),
    advice.length ? "สิ่งที่ควรทำ." : "",
    ...advice.slice(0, 4).map((item) => `${sentence(item)}.`)
  ].filter(Boolean).join(" ");
}
