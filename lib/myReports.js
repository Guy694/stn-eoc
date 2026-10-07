// ข้อมูลสำหรับติดตามเรื่องที่แจ้งจากเครื่องนี้ (เก็บในเบราว์เซอร์ของผู้แจ้งเท่านั้น เพื่อกดติดตามได้โดยไม่ต้องพิมพ์ใหม่)
const KEY = "stn-eoc:tracking-identity";

export function loadTrackingIdentity() {
  try {
    const value = JSON.parse(window.localStorage.getItem(KEY) || "null");
    return value?.firstName && value?.lastName && value?.phone4 ? value : null;
  } catch {
    return null;
  }
}

export function saveTrackingIdentity({ firstName, lastName, phone4 }) {
  if (!firstName || !lastName || !phone4) return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify({ firstName, lastName, phone4 }));
  } catch {
    // โหมดส่วนตัว/ปิดที่เก็บข้อมูล: ใช้งานต่อได้ แค่ไม่จำ
  }
}

export function forgetTrackingIdentity() {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}
