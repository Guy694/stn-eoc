// ตัวช่วยเรียก API หลังบ้าน: คืนค่า JSON หรือโยน Error พร้อมข้อความภาษาไทยจากเซิร์ฟเวอร์
// ระบบตั้ง trailingSlash: true — เรียก /api/x?y โดยไม่มี "/" ท้าย จะโดน redirect หนึ่งรอบทุกครั้ง
// เติม "/" ให้เองเพื่อตัดรอบ redirect (และไม่ให้ redirect ถูกบังคับเป็น https ตอนทดสอบบน http://localhost)
export function withTrailingSlash(url) {
  const value = String(url);
  const cut = value.search(/[?#]/);
  const path = cut === -1 ? value : value.slice(0, cut);
  const rest = cut === -1 ? "" : value.slice(cut);
  if (!path.startsWith("/") || path.endsWith("/") || /\.[a-z0-9]+$/i.test(path)) return value;
  return `${path}/${rest}`;
}

export async function apiRequest(url, { method = "GET", body, signal } = {}) {
  const response = await fetch(withTrailingSlash(url), {
    method,
    signal,
    cache: "no-store",
    headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined
  });
  let json = null;
  try {
    json = await response.json();
  } catch {
    json = null;
  }
  if (!response.ok || json?.success === false) {
    // 502/503/504 ที่ไม่มี JSON มาจาก nginx = แอปไม่ตอบ (กำลังรีสตาร์ต ล่ม หรือใช้เวลานานเกิน)
    const gateway = !json && [502, 503, 504].includes(response.status)
      ? `เซิร์ฟเวอร์ของระบบไม่ตอบสนอง (รหัส ${response.status}) อาจกำลังเริ่มระบบใหม่ ลองอีกครั้งในอีกสักครู่ ถ้ายังไม่ได้แจ้งผู้ดูแลระบบ`
      : null;
    const error = new Error(json?.message || json?.error || gateway || `ดำเนินการไม่สำเร็จ (รหัส ${response.status})`);
    error.status = response.status;
    error.payload = json;
    throw error;
  }
  return json ?? {};
}

const RELATIVE = new Intl.RelativeTimeFormat("th", { numeric: "auto" });

export function parseDateValue(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(String(value).replace(" ", "T"));
  return Number.isNaN(date.getTime()) ? null : date;
}

// "5 นาทีที่แล้ว" / "เมื่อวาน" — ใช้บอกความสดของข้อมูลในห้องประชุม
export function formatRelative(value, now = Date.now()) {
  const date = parseDateValue(value);
  if (!date) return "-";
  const seconds = Math.round((date.getTime() - now) / 1000);
  const abs = Math.abs(seconds);
  if (abs < 60) return "เมื่อสักครู่";
  if (abs < 3600) return RELATIVE.format(Math.round(seconds / 60), "minute");
  if (abs < 86400) return RELATIVE.format(Math.round(seconds / 3600), "hour");
  if (abs < 86400 * 30) return RELATIVE.format(Math.round(seconds / 86400), "day");
  return date.toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "2-digit" });
}

export function formatDateTime(value) {
  const date = parseDateValue(value);
  if (!date) return "-";
  return date.toLocaleString("th-TH", { day: "numeric", month: "short", year: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export function formatNumber(value) {
  return Number(value || 0).toLocaleString("th-TH");
}
