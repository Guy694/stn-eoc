// กติกาโหมดปิดปรับปรุงระบบ (ไม่แตะฐานข้อมูล ใช้ได้ทั้ง proxy, API, หน้าเว็บ และ unit test)

export const MAINTENANCE_KEY = "maintenance";
export const DEFAULT_MESSAGE = "ระบบกำลังปิดปรับปรุงชั่วคราว ขออภัยในความไม่สะดวก";
export const DEFAULT_STATE = { enabled: false, message: DEFAULT_MESSAGE, until: null, allow_officers: false };

// เส้นทางที่เปิดได้เสมอแม้ปิดปรับปรุง (ไม่รวม basePath /stn-eoc)
// - หน้าแจ้งปิดปรับปรุงเอง, หน้าเข้าสู่ระบบ + ThaiD (ให้แอดมินเข้ามาเปิดระบบคืนได้)
const ALWAYS_OPEN = [/^\/maintenance(\/|$)/, /^\/login(\/|$)/, /^\/auth\//, /^\/api\/auth\//, /^\/api\/system\/maintenance(\/|$)/];

export function isAlwaysOpen(pathname = "") {
  return ALWAYS_OPEN.some((pattern) => pattern.test(pathname));
}

export function isApiPath(pathname = "") {
  return pathname === "/api" || pathname.startsWith("/api/");
}

/** ผู้ใช้ผ่านได้ไหมระหว่างปิดปรับปรุง: แอดมินผ่านเสมอ เจ้าหน้าที่อื่นผ่านเมื่อเปิดสิทธิ์ allow_officers */
export function canBypass(role, state) {
  if (!role) return false;
  if (role === "admin") return true;
  return Boolean(state?.allow_officers);
}

/** ตัดสินคำขอหนึ่ง: "pass" | "block-page" | "block-api" */
export function maintenanceDecision({ pathname, state, role = null }) {
  if (!state?.enabled) return "pass";
  if (isAlwaysOpen(pathname)) return "pass";
  if (canBypass(role, state)) return "pass";
  return isApiPath(pathname) ? "block-api" : "block-page";
}

/** ตรวจค่าที่แอดมินส่งมา → { value } | { error } */
export function validateMaintenanceInput(input = {}, now = Date.now()) {
  const message = String(input.message ?? "").replace(/\s+\n/g, "\n").trim().slice(0, 500) || DEFAULT_MESSAGE;
  let until = null;
  if (input.until) {
    const time = new Date(input.until).getTime();
    if (!Number.isFinite(time)) return { error: "รูปแบบเวลาที่คาดว่าจะเปิดระบบไม่ถูกต้อง" };
    if (time < now - 60e3) return { error: "เวลาที่คาดว่าจะเปิดระบบต้องเป็นเวลาในอนาคต" };
    until = new Date(time).toISOString();
  }
  return { value: { enabled: Boolean(input.enabled), message, until, allow_officers: Boolean(input.allow_officers) } };
}

/** อ่านค่าจากฐานข้อมูล (JSON) ให้เป็นรูปแบบเดียวกันเสมอ */
export function normalizeState(raw) {
  const value = typeof raw === "string" ? safeJson(raw) : raw;
  if (!value || typeof value !== "object") return { ...DEFAULT_STATE };
  return {
    enabled: Boolean(value.enabled),
    message: String(value.message || DEFAULT_MESSAGE),
    until: value.until || null,
    allow_officers: Boolean(value.allow_officers),
    updated_at: value.updated_at || null,
    updated_by_name: value.updated_by_name || null
  };
}

function safeJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
