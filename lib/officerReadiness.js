import { TEAM_ROLE_OPTIONS } from "./eocRoles.js";

// สถานะความพร้อมปฏิบัติหน้าที่ของเจ้าหน้าที่ — ส่วนที่ไม่แตะฐานข้อมูล (ใช้ทั้ง API หน้าเว็บ และเทสต์)

export const READINESS_STATUSES = [
  { value: "ready", label: "พร้อมปฏิบัติงาน", short: "พร้อม", tone: "green", color: "#15803d", bg: "#dcfce7" },
  { value: "delayed", label: "มาได้แต่ล่าช้า", short: "ล่าช้า", tone: "amber", color: "#b45309", bg: "#fef3c7" },
  { value: "unavailable", label: "มาปฏิบัติงานไม่ได้", short: "ไม่พร้อม", tone: "red", color: "#b91c1c", bg: "#fee2e2" },
  { value: "need_help", label: "ต้องการความช่วยเหลือ", short: "ขอช่วยเหลือ", tone: "red", color: "#7f1d1d", bg: "#fecaca" }
];
export const UNREPORTED = { value: "unreported", label: "ยังไม่รายงาน", short: "ยังไม่รายงาน", tone: "gray", color: "#475569", bg: "#e2e8f0" };

// สถานะที่เก่ากว่านี้ถือว่าอาจไม่เป็นปัจจุบัน (แจ้งให้รายงานใหม่ ไม่ซ่อน)
export const READINESS_STALE_HOURS = 24;
export const MAX_NOTE_LENGTH = 255;

export function readinessMeta(value) {
  return READINESS_STATUSES.find((item) => item.value === value) || UNREPORTED;
}

export function isReadinessStatus(value) {
  return READINESS_STATUSES.some((item) => item.value === value);
}

export function isStale(updatedAt, now = Date.now(), hours = READINESS_STALE_HOURS) {
  if (!updatedAt) return false;
  const time = new Date(updatedAt).getTime();
  return Number.isFinite(time) && now - time > hours * 3600 * 1000;
}

/** ตรวจค่าที่ส่งมา: { status, note } */
export function normalizeReadinessInput(body = {}) {
  const status = String(body.status || "");
  if (!isReadinessStatus(status)) return { ok: false, error: "เลือกสถานะความพร้อม" };
  const note = String(body.note ?? "").replace(/\s+/g, " ").trim();
  if (note.length > MAX_NOTE_LENGTH) return { ok: false, error: `หมายเหตุยาวเกิน ${MAX_NOTE_LENGTH} ตัวอักษร` };
  if (status === "need_help" && note.length < 3) return { ok: false, error: "บอกสั้น ๆ ว่าต้องการความช่วยเหลือเรื่องอะไร" };
  return { ok: true, value: { status, note: note || null } };
}

/** สถานะที่ใช้แสดง: ไม่มีรายงาน = unreported */
export function effectiveStatus(row) {
  return isReadinessStatus(row?.status) ? row.status : UNREPORTED.value;
}

/** ตัวเลขสรุป: นับตามสถานะ + เก่ากว่า 24 ชม. */
export function summarizeReadiness(rows = [], now = Date.now()) {
  const counts = Object.fromEntries([...READINESS_STATUSES, UNREPORTED].map((item) => [item.value, 0]));
  let stale = 0;
  for (const row of rows) {
    counts[effectiveStatus(row)] += 1;
    if (isReadinessStatus(row?.status) && isStale(row.updated_at, now)) stale += 1;
  }
  const total = rows.length;
  const reported = total - counts.unreported;
  return { total, reported, stale, counts, readyPercent: total ? Math.round((counts.ready / total) * 100) : 0 };
}

/** สรุปรายกลุ่ม (บทบาท/หน่วยงาน) — เรียงกลุ่มที่พร้อมน้อยก่อน */
export function summarizeBy(rows = [], key = "role", labelOf = (value) => value || "ไม่ระบุ") {
  const groups = new Map();
  for (const row of rows) {
    const name = labelOf(row?.[key]);
    const group = groups.get(name) || { name, total: 0, ready: 0, delayed: 0, unavailable: 0, need_help: 0, unreported: 0 };
    group.total += 1;
    group[effectiveStatus(row)] += 1;
    groups.set(name, group);
  }
  return [...groups.values()].sort((a, b) => a.ready / a.total - b.ready / b.total || b.total - a.total);
}

/** ตัวกรองหน้าแดชบอร์ด */
export function filterReadiness(rows = [], { search = "", status = "", role = "", department = "", staleOnly = false } = {}, now = Date.now()) {
  const text = String(search).trim().toLowerCase();
  return rows.filter((row) => {
    if (status && effectiveStatus(row) !== status) return false;
    if (role && row.role !== role) return false;
    if (department && (row.department || "") !== department) return false;
    if (staleOnly && !(isReadinessStatus(row.status) && isStale(row.updated_at, now))) return false;
    if (!text) return true;
    return [row.username, row.given_name, row.family_name, row.department, row.position, row.note]
      .some((value) => String(value || "").toLowerCase().includes(text));
  });
}

// ลำดับความเร่งด่วนในตาราง: ขอความช่วยเหลือ → ไม่พร้อม → ล่าช้า → ยังไม่รายงาน → พร้อม
const URGENCY = { need_help: 0, unavailable: 1, delayed: 2, unreported: 3, ready: 4 };
export function sortByUrgency(rows = []) {
  return [...rows].sort((a, b) => URGENCY[effectiveStatus(a)] - URGENCY[effectiveStatus(b)]
    || String(a.given_name || a.username || "").localeCompare(String(b.given_name || b.username || ""), "th"));
}

const BASE_ROLE_NAMES = { admin: "ผู้ดูแลระบบ", commander: "ผู้บัญชาการเหตุการณ์", staff: "เจ้าหน้าที่" };
/** ชื่อบทบาทสำหรับแสดง (ใช้ฝั่งหน้าเว็บได้ ไม่ต้องดึง lib/auth) */
export function roleLabel(role) {
  if (!role) return "ไม่ระบุ";
  if (BASE_ROLE_NAMES[role]) return BASE_ROLE_NAMES[role];
  const team = TEAM_ROLE_OPTIONS.find((item) => item.value === role);
  return team ? `ทีม ${team.value === "EOC_COMMANDER" ? "COMMANDER" : team.value}` : role;
}
