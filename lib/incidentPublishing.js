// กติกากลางของการ "รับแจ้ง → ตรวจสอบ → เผยแพร่" รายงานจากประชาชน
// แยก 2 การตัดสินใจ: status = เกิดขึ้นจริงไหม / publish_status = ควรให้ประชาชนเห็นไหม
// ไฟล์นี้ไม่แตะฐานข้อมูล ใช้ได้ทั้ง API, หน้าเว็บ และ unit test

import { coarsenCoordinate } from "./privacy.js";
import { waterLevelMeta, waterReportTitle, waterTrendMeta } from "@/lib/waterReport";

export const PROBLEM_CATEGORIES = [
  { value: "flood", label: "น้ำท่วม", expiryHours: 12, templates: ["ถนนน้ำท่วม รถเล็กผ่านไม่ได้", "น้ำท่วมขัง รถผ่านได้ช้า", "น้ำท่วมบ้านเรือน"] },
  { value: "road_cut", label: "ถนนขาด/สะพานชำรุด", expiryHours: 24, templates: ["ถนนขาด ผ่านไม่ได้", "สะพานชำรุด ห้ามผ่าน", "ถนนทรุด ผ่านได้ช่องทางเดียว"] },
  { value: "power_out", label: "ไฟฟ้าดับ", expiryHours: 12, templates: ["ไฟฟ้าดับ", "เสาไฟล้ม/สายไฟขาด อันตราย"] },
  { value: "tree_down", label: "ต้นไม้ล้ม", expiryHours: 12, templates: ["ต้นไม้ล้มขวางถนน", "ต้นไม้ล้ม ผ่านได้ช่องทางเดียว"] },
  { value: "landslide", label: "ดินสไลด์", expiryHours: 48, templates: ["ดินสไลด์ปิดถนน", "ดินสไลด์ เสี่ยงอันตราย หลีกเลี่ยงพื้นที่"] },
  { value: "other", label: "อื่น ๆ", expiryHours: 12, templates: [] }
];

const CATEGORY_MAP = new Map(PROBLEM_CATEGORIES.map((item) => [item.value, item]));

export const TRAVEL_TEMPLATES = {
  impassable: "ถนนผ่านไม่ได้",
  difficult: "ถนนผ่านได้ยาก รถเล็กควรเลี่ยง",
  passable: "ถนนผ่านได้ตามปกติ"
};

export const REPORT_TYPE_LABELS = {
  help_request: "ขอความช่วยเหลือ",
  traffic_report: "รายงานเส้นทาง",
  problem_point: "แจ้งจุดปัญหา"
};

export const PUBLISH_STATUSES = [
  { value: "none", label: "ไม่เผยแพร่", tone: "gray" },
  { value: "published", label: "เผยแพร่อยู่", tone: "green" },
  { value: "expired", label: "หมดอายุ", tone: "amber" },
  { value: "withdrawn", label: "ถอดออก", tone: "gray" }
];

// ประเภทที่เผยแพร่ได้ — คำขอความช่วยเหลือเป็นข้อมูลส่วนบุคคล/สุขภาพ ไม่เผยแพร่เด็ดขาด
export const PUBLISHABLE_TYPES = new Set(["traffic_report", "problem_point"]);

export const TITLE_MAX = 150;
export const DETAIL_MAX = 500;
export const MAX_EXPIRY_HOURS = 24 * 7;
export const DEFAULT_EXPIRY_HOURS = 12;

export function categoryMeta(value) {
  return CATEGORY_MAP.get(value) || CATEGORY_MAP.get("other");
}

export function isValidCategory(value) {
  return CATEGORY_MAP.has(value);
}

export function defaultExpiryHours(report) {
  if (report?.report_type === "traffic_report") return 24;
  return CATEGORY_MAP.get(report?.problem_category)?.expiryHours || DEFAULT_EXPIRY_HOURS;
}

export function titleTemplates(report) {
  if (report?.report_type === "traffic_report") {
    return Object.values(TRAVEL_TEMPLATES);
  }
  const templates = categoryMeta(report?.problem_category).templates;
  const waterTitle = report?.problem_category === "flood" ? waterReportTitle(report) : null;
  return waterTitle ? [waterTitle, ...templates.filter((item) => item !== waterTitle)] : templates;
}

// หัวข้อเริ่มต้นที่เจ้าหน้าที่แก้ต่อได้ — ไม่ดึงข้อความที่ประชาชนพิมพ์มาเด็ดขาด
export function suggestTitle(report) {
  if (report?.report_type === "traffic_report") {
    return TRAVEL_TEMPLATES[report.travel_status] || "สภาพเส้นทาง";
  }
  // รายงานระดับน้ำ (เก็บรหัสช่วง เช่น knee_waist) → หัวข้อบอกระดับน้ำและการสัญจรทันที
  const waterTitle = report?.problem_category === "flood" ? waterReportTitle(report) : null;
  if (waterTitle) return waterTitle;
  const meta = categoryMeta(report?.problem_category);
  return meta.templates[0] || meta.label;
}

export function canPublish(report) {
  if (!report) return { ok: false, reason: "ไม่พบเรื่องนี้" };
  if (!PUBLISHABLE_TYPES.has(report.report_type || "help_request")) {
    return { ok: false, reason: "คำขอความช่วยเหลือเป็นข้อมูลส่วนบุคคล เผยแพร่ต่อสาธารณะไม่ได้" };
  }
  if (report.merged_into_id) return { ok: false, reason: "เรื่องนี้ถูกรวมกับเรื่องอื่นแล้ว ให้เผยแพร่ที่เรื่องหลัก" };
  if (["rejected", "resolved"].includes(report.status)) {
    return { ok: false, reason: "เรื่องที่ปิดแล้วหรือไม่ดำเนินการ เผยแพร่ไม่ได้" };
  }
  return { ok: true };
}

function cleanText(value, max) {
  return String(value ?? "").replace(/\s+/g, " ").trim().slice(0, max);
}

// ตรวจข้อมูลที่เจ้าหน้าที่ส่งมาตอนกดเผยแพร่
export function normalizePublishInput(input = {}, report = {}) {
  const title = cleanText(input.title, TITLE_MAX);
  const detail = cleanText(input.detail, DETAIL_MAX);
  if (title.length < 3) return { ok: false, error: "กรุณาเขียนหัวข้อที่จะเผยแพร่ (อย่างน้อย 3 ตัวอักษร)" };
  if (/(\d[\s-]?){9,}/.test(`${title} ${detail}`)) {
    return { ok: false, error: "ข้อความที่เผยแพร่มีตัวเลขคล้ายเบอร์โทรหรือเลขบัตร กรุณาลบออก" };
  }
  let hours = Number(input.expiresHours ?? defaultExpiryHours(report));
  if (!Number.isFinite(hours) || hours <= 0) hours = defaultExpiryHours(report);
  hours = Math.min(Math.round(hours), MAX_EXPIRY_HOURS);
  const photo = input.photo ? String(input.photo) : null;
  return { ok: true, value: { title, detail: detail || null, expiresHours: hours, photo } };
}

export function isPubliclyVisible(report, now = new Date()) {
  if (!report || report.publish_status !== "published") return false;
  if (!PUBLISHABLE_TYPES.has(report.report_type)) return false;
  if (report.expires_at && new Date(report.expires_at) <= now) return false;
  return true;
}

export function publicPhotoUrl(path) {
  if (!path) return null;
  return path.startsWith("/stn-eoc/") ? path : `/stn-eoc${path.startsWith("/") ? "" : "/"}${path}`;
}

// รูปแบบข้อมูลที่ส่งออกสู่สาธารณะ: ไม่มีชื่อ เบอร์ ข้อความต้นฉบับ หรือรูปต้นฉบับ
// คงชื่อฟิลด์เดิม (description, photo_path, urgency, travel_status) เพื่อให้แผนที่เดิมทำงานต่อได้
export function toPublicIncident(row, { exactLocation = false } = {}) {
  const title = row.public_title || suggestTitle(row);
  const detail = row.public_detail || "";
  return {
    id: row.id,
    report_type: row.report_type,
    problem_category: row.problem_category || null,
    category_label: row.report_type === "problem_point" ? categoryMeta(row.problem_category).label : REPORT_TYPE_LABELS[row.report_type],
    title,
    detail,
    description: detail ? `${title} — ${detail}` : title,
    village: row.village || null,
    sub_district: row.sub_district || null,
    district: row.district || null,
    latitude: exactLocation ? Number(row.latitude) : coarsenCoordinate(row.latitude),
    longitude: exactLocation ? Number(row.longitude) : coarsenCoordinate(row.longitude),
    location_precision: exactLocation ? "exact" : "approximate",
    urgency: row.urgency || "medium",
    travel_status: row.travel_status || null,
    // ระดับน้ำ/แนวโน้มเป็นข้อมูลสถานการณ์ ไม่ใช่ข้อมูลบุคคล — ส่งเฉพาะรหัสช่วงที่รู้จัก
    water_level: waterLevelMeta(row.water_level) ? row.water_level : null,
    water_trend: waterTrendMeta(row.water_trend) ? row.water_trend : null,
    disaster_type: row.disaster_type || null,
    occurred_at: row.occurred_at || null,
    photo_path: row.public_photo_path ? publicPhotoUrl(row.public_photo_path) : null,
    report_count: Number(row.report_count || 1),
    verified_at: row.published_at || row.reviewed_at || null,
    expires_at: row.expires_at || null,
    // จำนวนครั้งที่ประชาชนช่วยยืนยัน (ไม่ระบุตัวคน) ใช้บอกความสดของข้อมูล
    confirmations: {
      still: Number(row.still_reports || 0),
      still_at: row.still_reported_at || null,
      normal: Number(row.normal_reports || 0),
      normal_at: row.normal_reported_at || null
    },
    source: "citizen_verified"
  };
}

// ระยะทางโดยประมาณ (เมตร)
export function distanceMeters(a, b) {
  const lat1 = Number(a.latitude), lon1 = Number(a.longitude), lat2 = Number(b.latitude), lon2 = Number(b.longitude);
  if (![lat1, lon1, lat2, lon2].every(Number.isFinite)) return Infinity;
  const rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad;
  const dLon = (lon2 - lon1) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.sqrt(h));
}

function reportTime(report) {
  return new Date(report.occurred_at || report.created_at || report.reported_at || 0).getTime();
}

// หาเรื่องที่น่าจะซ้ำ: ประเภท/หมวดเดียวกัน ใกล้กัน และเวลาใกล้กัน
export function findDuplicateCandidates(report, others, { radiusMeters = 300, withinHours = 24 } = {}) {
  if (!report || !PUBLISHABLE_TYPES.has(report.report_type)) return [];
  const t = reportTime(report);
  return (others || [])
    .filter((other) => other.id !== report.id && !other.merged_into_id && other.report_type === report.report_type)
    .filter((other) => report.report_type !== "problem_point" || (other.problem_category || "other") === (report.problem_category || "other"))
    .filter((other) => !["rejected"].includes(other.status))
    .map((other) => ({ ...other, distance_m: Math.round(distanceMeters(report, other)) }))
    .filter((other) => other.distance_m <= radiusMeters && Math.abs(reportTime(other) - t) <= withinHours * 3600 * 1000)
    .sort((a, b) => (b.publish_status === "published") - (a.publish_status === "published") || a.distance_m - b.distance_m);
}

export function expiresAtFrom(hours, now = new Date()) {
  return new Date(now.getTime() + hours * 3600 * 1000);
}
