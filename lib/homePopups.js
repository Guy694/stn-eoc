// popup ตอนเข้าหน้าแรก: เตือนด่วน (อัตโนมัติ) และประกาศที่เจ้าหน้าที่เลือกให้เด้ง
// ไม่มีการเรียกเครือข่ายในไฟล์นี้

const SEEN_KEY = "stn-eoc:seen-popups";
const SEEN_MAX = 60;

function hash(text) {
  let value = 5381;
  for (let index = 0; index < text.length; index += 1) value = ((value << 5) + value + text.charCodeAt(index)) | 0;
  return (value >>> 0).toString(36);
}

/**
 * เตือนด่วน = ประกาศระดับรุนแรงเท่านั้น (น้ำล้นตลิ่ง ฝนหนักมาก 24 ชม. ≥ 90.1 มม. ประกาศ "หนักมาก/น้ำท่วมฉับพลัน" ของ สสน.)
 * ระดับเฝ้าระวังแสดงที่แถบด้านบนอย่างเดียว เพื่อไม่ให้เด้งบ่อยจนคนไม่อ่าน
 */
export function urgentAlerts(warnings = []) {
  return warnings
    .filter((item) => item?.level === "high" && item.message)
    .map((item) => ({ ...item, id: `urgent:${hash(`${item.message}`)}` }));
}

/** หัวข้อสั้นของเตือนด่วนแต่ละรายการ (จากข้อความประกาศ) */
export function alertHeadline(item) {
  const text = String(item?.message || "");
  if (/ฉับพลัน|น้ำป่า/.test(text)) return "เสี่ยงน้ำท่วมฉับพลัน";
  if (/ล้นตลิ่ง|เกินตลิ่ง|ล้นคลอง/.test(text) && !/ใกล้/.test(text)) return "น้ำล้นตลิ่ง";
  if (/ใกล้ตลิ่ง|ใกล้ล้น|ใกล้เต็มตลิ่ง/.test(text)) return "น้ำใกล้ล้นตลิ่ง";
  if (/ระดับน้ำ|น้ำท่วม|น้ำหลาก/.test(text)) return /อันตราย|วิกฤต|เตือนภัย/.test(text) ? "ระดับน้ำอันตราย" : "ระดับน้ำสูง";
  if (/ฝน.*หนักมาก|หนักมาก/.test(text)) return "ฝนตกหนักมาก";
  if (/ฝน/.test(text)) return "ฝนตกหนัก";
  return "แจ้งเตือนภัย";
}

/** ข้อความรายละเอียด: ตัดหัวข้อที่ซ้ำกับต้นประโยคออก (เหลือสถานี/ค่าที่วัดได้) */
export function alertDetail(item) {
  const text = String(item?.message || "").trim();
  const head = alertHeadline(item);
  const rest = text.startsWith(head) ? text.slice(head.length).replace(/^[\s:·,-]+/, "") : text;
  return rest || text;
}

/** ชนิดภัยของรายการ: flood = น้ำล้น/ใกล้ล้นตลิ่งเท่านั้น (ภาพ flood + คำว่า "ระวังน้ำท่วม"),
 *  water = เตือนระดับน้ำอื่น ๆ ที่ยังไม่ถึงตลิ่ง, rain = ฝนตกหนัก */
export function alertHazard(item) {
  const headline = alertHeadline(item);
  if (headline === "น้ำล้นตลิ่ง" || headline === "น้ำใกล้ล้นตลิ่ง") return "flood";
  return headline.startsWith("ฝน") ? "rain" : "water";
}

/** ชนิดภัยของ popup: flood มาก่อน แล้วเป็น water และ rain */
export function popupHazard(items = []) {
  const kinds = new Set(items.map(alertHazard));
  return kinds.has("flood") ? "flood" : kinds.has("water") ? "water" : "rain";
}

export function announcementPopupId(announcement) {
  if (!announcement?.id) return null;
  return `ann:${announcement.id}:${announcement.start_date || ""}`;
}

/** เลือก popup เดียวที่จะแสดง: เตือนด่วนที่ยังไม่เคยเห็นมาก่อน แล้วค่อยเป็นประกาศ */
export function choosePopup({ urgent = [], announcement = null, seen = [] }) {
  const seenSet = new Set(seen);
  const freshUrgent = urgent.filter((item) => !seenSet.has(item.id));
  if (freshUrgent.length > 0) {
    return { kind: "urgent", items: urgent, ids: urgent.map((item) => item.id) };
  }
  const annId = announcementPopupId(announcement);
  if (annId && !seenSet.has(annId)) return { kind: "announcement", announcement, ids: [annId] };
  return null;
}

export function loadSeenPopups() {
  try {
    const value = JSON.parse(window.localStorage.getItem(SEEN_KEY) || "[]");
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

export function markPopupsSeen(ids = []) {
  try {
    const next = [...new Set([...ids, ...loadSeenPopups()])].slice(0, SEEN_MAX);
    window.localStorage.setItem(SEEN_KEY, JSON.stringify(next));
  } catch {
    // ไม่จำก็ได้ แค่อาจเด้งซ้ำ
  }
}
