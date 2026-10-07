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
 * เตือนด่วน = ประกาศระดับรุนแรงเท่านั้น (น้ำล้นตลิ่ง ฝน 24 ชม. ≥ 90 มม. ประกาศ "หนักมาก/น้ำท่วมฉับพลัน" ของ สสน.)
 * ระดับเฝ้าระวังแสดงที่แถบด้านบนอย่างเดียว เพื่อไม่ให้เด้งบ่อยจนคนไม่อ่าน
 */
export function urgentAlerts(warnings = []) {
  return warnings
    .filter((item) => item?.level === "high" && item.message)
    .map((item) => ({ ...item, id: `urgent:${hash(`${item.message}`)}` }));
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
