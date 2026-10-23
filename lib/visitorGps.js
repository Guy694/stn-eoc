// ส่งตำแหน่ง GPS ที่ผู้ใช้อนุญาตไว้ เข้าบันทึกผู้เข้าชม (ฝั่งเบราว์เซอร์) — เซิร์ฟเวอร์ปัดพิกัดเหลือ ≈ 1 กม.
// ส่งไม่เกิน 1 ครั้งต่อ 30 นาทีต่อเรื่อง (context) · ส่งไม่ได้ไม่กระทบการใช้งาน

const REPEAT_MS = 30 * 60 * 1000;
const STAFF_CONSENT_KEY = "stn-staff-geo-consent";

function recentlySent(context) {
  try {
    const last = Number(sessionStorage.getItem(`stn-gps-sent:${context}`) || 0);
    return Date.now() - last < REPEAT_MS;
  } catch {
    return false;
  }
}

function markSent(context) {
  try {
    sessionStorage.setItem(`stn-gps-sent:${context}`, String(Date.now()));
  } catch {
    // เก็บไม่ได้ ไม่เป็นไร
  }
}

/** coords: { latitude, longitude, accuracy } หรือ { lat, lng/lon, accuracy } */
export function shareVisitGps(coords, context) {
  if (typeof window === "undefined" || !coords || recentlySent(context)) return;
  const lat = coords.latitude ?? coords.lat;
  const lon = coords.longitude ?? coords.lon ?? coords.lng;
  if (!Number.isFinite(Number(lat)) || !Number.isFinite(Number(lon))) return;
  markSent(context);
  try {
    fetch("/stn-eoc/api/public/visit", {
      method: "POST",
      keepalive: true,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: window.location.pathname, referrer: "", gps: { lat, lon, accuracy: coords.accuracy, context } })
    }).catch(() => {});
  } catch {
    // ไม่กระทบการใช้งาน
  }
}

/** คำตอบของเจ้าหน้าที่ต่อแถบขอตำแหน่ง: "granted" | "denied" | null (ยังไม่ตอบ) — แยกตามผู้ใช้ */
export function readStaffConsent(userId) {
  try {
    const value = JSON.parse(localStorage.getItem(STAFF_CONSENT_KEY) || "{}")[String(userId)];
    return value === "granted" || value === "denied" ? value : null;
  } catch {
    return null;
  }
}

export function saveStaffConsent(userId, value) {
  try {
    const all = JSON.parse(localStorage.getItem(STAFF_CONSENT_KEY) || "{}");
    all[String(userId)] = value;
    localStorage.setItem(STAFF_CONSENT_KEY, JSON.stringify(all));
  } catch {
    // เก็บไม่ได้: จะถามอีกครั้งในครั้งหน้า
  }
}
