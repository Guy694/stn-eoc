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
 * ภาพรวมพื้นที่ใกล้บ้านเริ่มจากระดับของอำเภอ และปรับตามหลักฐานเฉพาะจุด
 * สถานีที่ใกล้ที่สุดและระดับความสูงเป็นข้อมูลประกอบเท่านั้น เพราะระยะเส้นตรง/ความสูง
 * อย่างเดียวไม่ยืนยันว่าจุดนั้นอยู่ในลำน้ำเดียวกันหรือมีน้ำท่วมถึงบ้าน
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
      reasons.push(`สถานี${station.item.name} ซึ่งอยู่ห่างประมาณ ${Math.round(station.km * 10) / 10} กม. รายงานระดับน้ำสูงกว่าตลิ่ง ${diff.toFixed(2)} ม. (เป็นข้อมูลจากสถานี ไม่ใช่การวัดหน้าบ้าน)`);
    } else if (diff > -0.5) {
      reasons.push(`สถานี${station.item.name} ซึ่งอยู่ห่างประมาณ ${Math.round(station.km * 10) / 10} กม. รายงานระดับน้ำต่ำกว่าตลิ่ง ${Math.abs(diff).toFixed(2)} ม. (เป็นข้อมูลจากสถานี ไม่ใช่การวัดหน้าบ้าน)`);
    }
  }

  const freshSerious = reports.filter(({ item, km }) => {
    const time = new Date(item.reported_at || item.occurred_at || 0).getTime();
    return km <= NEAR_REPORT_KM && now - time <= REPORT_FRESH_HOURS * 3600 * 1000 && SERIOUS_WATER.has(item.water_level);
  });
  if (freshSerious.length > 0) {
    level = atLeast(level, "watch");
    const meta = waterLevelMeta(freshSerious[0].item.water_level);
    reasons.push(`มีรายงานจากประชาชนที่เจ้าหน้าที่ตรวจสอบแล้ว ระบุระดับน้ำ${meta?.label || "สูง"} ห่างประมาณ ${Math.round(freshSerious[0].km * 1000)} ม. ภายใน ${REPORT_FRESH_HOURS} ชม.ที่ผ่านมา`);
  }

  // ใช้ระดับความสูงเป็นบริบทประกอบเท่านั้น: elevation model ไม่พอจะสรุปความเสี่ยงน้ำท่วมรายบ้าน
  const lowLying = Number.isFinite(elevation) && elevation > 0 && elevation < LOW_LYING_M;

  return { level, reasons, lowLying };
}

/**
 * ระดับเสี่ยง/เสี่ยงสูง: ย้ำว่าผลนี้ยังไม่ใช่คำสั่งอพยพ (เคยมีผู้อ่านแล้วเข้าใจว่าต้องอพยพทันทีจนตื่นตระหนก)
 * แต่ไม่ให้ผู้ที่อยู่ในอันตรายตรงหน้ารอประกาศ
 */
export const OFFICIAL_ORDER_NOTICE = {
  title: "ยังไม่ใช่คำสั่งอพยพ",
  body: "ผลนี้ระบบประเมินอัตโนมัติเพื่อให้เตรียมตัวล่วงหน้า การอพยพหรือเคลื่อนย้ายให้รอประกาศแจ้งเตือนอย่างเป็นทางการจากกรมป้องกันและบรรเทาสาธารณภัย (ปภ.) อำเภอ หรือผู้นำชุมชนในพื้นที่",
  urgent: "ถ้าน้ำกำลังเข้าบ้านหรือรู้สึกไม่ปลอดภัย ให้ขึ้นที่สูงทันที แล้วโทร 1784 (ปภ.) หรือ 1669"
};

export function officialNotice(level) {
  return level === "high" || level === "critical" ? OFFICIAL_ORDER_NOTICE : null;
}

/** สิ่งที่ควรทำ ตามระดับและสภาพที่ตั้ง */
export function homeAdvice(level, { lowLying = false, nearCanal = false, sheltersOpen = false } = {}) {
  const items = [];
  // เสี่ยงสูงใช้คำแนะนำชุดเดียวกับเสี่ยง (เตรียมตัว) และให้รอคำสั่งจาก ปภ. — ไม่แนะนำให้อพยพเอง
  if (level === "critical" || level === "high") {
    items.push("รอคำสั่งอพยพหรือเคลื่อนย้ายจาก ปภ. หรืออำเภอ ไม่ต้องออกจากบ้านเองถ้ายังปลอดภัย");
    items.push("ขนย้ายของมีค่า เอกสาร และยาประจำตัวขึ้นที่สูง");
    items.push("เตรียมผู้สูงอายุ เด็ก ผู้ป่วยติดเตียง ให้พร้อมเคลื่อนย้ายเมื่อมีประกาศจาก ปภ. หรืออำเภอ");
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
export function riskSpeechText({ label, place, reasons = [], advice = [], notice = null }) {
  const sentence = (text) => String(text || "").trim().replace(/[.。]+$/, "");
  return [
    `ภาพรวมสถานการณ์น้ำท่วมใกล้ตำแหน่งที่เลือกอยู่ในระดับ${label}.`,
    place ? `ตำแหน่ง ${place}.` : "",
    notice ? `${sentence(notice.title)}. ${sentence(notice.body)}.` : "",
    ...reasons.slice(0, 3).map((reason) => `${sentence(reason)}.`),
    advice.length ? "สิ่งที่ควรทำ." : "",
    ...advice.slice(0, 4).map((item) => `${sentence(item)}.`)
  ].filter(Boolean).join(" ");
}
