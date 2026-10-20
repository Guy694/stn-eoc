// สื่อความรู้จากคลังสื่อสารความเสี่ยง สสจ.สตูล (riskcom-stn) — https://riskcom-stn.vercel.app/developers
// เงื่อนไขการใช้: ใช้ URL รูป/ไฟล์จาก API ตรง ๆ ไม่ดัดแปลงเนื้อหา และระบุที่มา "สำนักงานสาธารณสุขจังหวัดสตูล"
export const RISKCOM_BASE = "https://riskcom-stn.vercel.app/api/v1/media";
export const RISKCOM_CREDIT = "สำนักงานสาธารณสุขจังหวัดสตูล";
export const RISKCOM_SITE = "https://riskcom-stn.vercel.app";

export const RISKCOM_PHASES = {
  before: "ก่อนเกิดเหตุ",
  during: "ระหว่างเกิดเหตุ",
  after: "หลังเกิดเหตุ"
};

const TOPIC_RULES = [
  ["flood", /น้ำท่วม|อุทกภัย|น้ำป่า|ดินถล่ม|flood/i],
  ["disease", /โรค|ไข้|ระบาด|ยุง|ติดเชื้อ|วัคซีน|disease|dengue|covid/i],
  ["accident", /อุบัติเหตุ|จราจร|ถนน|จมน้ำ|accident/i],
  ["drought", /แล้ง|ฝุ่น|pm\s?2\.?5|หมอกควัน|ความร้อน|drought|heat/i]
];

/** หมวดของระบบจากหมวด/คำค้นของสื่อ (ไม่ตรงหมวดไหน = ทั่วไป) */
export function riskcomTopic(item) {
  const text = `${item?.category || ""} ${(item?.keywords || []).join(" ")} ${item?.title || ""}`;
  return TOPIC_RULES.find(([, pattern]) => pattern.test(text))?.[0] || "general";
}

function safeUrl(value) {
  try {
    const url = new URL(String(value || ""));
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function text(value, max = 2000) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

/** แปลงรายการจาก API ให้อยู่ในรูปเดียวกับประกาศของระบบ (เพิ่ม source/href/รายละเอียดสื่อ) */
export function normalizeRiskcomItem(raw) {
  if (!raw || typeof raw !== "object" || !raw.id) return null;
  const id = String(raw.id).replace(/[^A-Za-z0-9_-]/g, "").slice(0, 80);
  if (!id) return null;
  const keywords = (Array.isArray(raw.keywords) ? raw.keywords : [])
    .flatMap((value) => String(value || "").split(/[\s,]+/))
    .map((value) => value.replace(/^#/, "").trim())
    .filter(Boolean)
    .slice(0, 12);
  const phase = RISKCOM_PHASES[raw.phase] ? raw.phase : null;
  const date = raw.eventDate || raw.createdAt || null;
  return {
    id: `riskcom-${id}`,
    riskcom_id: id,
    source: "riskcom",
    href: `/public/announcements/riskcom/${id}`,
    title: text(raw.title, 300) || "สื่อความรู้",
    description: text(raw.description),
    category: text(raw.category, 120) || null,
    eoc_type: riskcomTopic({ ...raw, keywords }),
    phase,
    phase_label: phase ? RISKCOM_PHASES[phase] : null,
    location: text(raw.location, 200) || null,
    keywords,
    alt_text: text(raw.altText, 500),
    image_url: safeUrl(raw.thumbnailUrl),
    download_url: safeUrl(raw.downloadUrl),
    file_name: text(raw.fileName, 200) || null,
    file_type: text(raw.fileType, 100) || null,
    start_date: date,
    created_at: raw.createdAt || date,
    updated_at: raw.updatedAt || null,
    display_status: "knowledge",
    credit: RISKCOM_CREDIT
  };
}

/** สร้าง URL เรียก API ต้นทางจากพารามิเตอร์ที่อนุญาตเท่านั้น */
export function buildRiskcomUrl(params = {}) {
  const id = String(params.id || "").replace(/[^A-Za-z0-9_-]/g, "");
  if (id) return `${RISKCOM_BASE}/${id}`;
  const url = new URL(RISKCOM_BASE);
  const limit = Math.min(Math.max(Number.parseInt(params.limit, 10) || 20, 1), 100);
  const page = Math.max(Number.parseInt(params.page, 10) || 1, 1);
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("page", String(page));
  url.searchParams.set("sort", ["newest", "oldest", "updated"].includes(params.sort) ? params.sort : "newest");
  if (params.q) url.searchParams.set("q", String(params.q).slice(0, 100));
  if (RISKCOM_PHASES[params.phase]) url.searchParams.set("phase", params.phase);
  if (params.category) url.searchParams.set("category", String(params.category).slice(0, 100));
  return url.toString();
}

/** สื่อจาก สสจ.สตูล แทนเนื้อหาความรู้เดิม แต่ประกาศของศูนย์ฯ ที่ยังอยู่ในช่วงเผยแพร่ยังขึ้นก่อนเสมอ
 *  ถ้าดึงคลังสื่อไม่ได้ ใช้ประกาศของระบบทั้งหมดแทน หน้าจะได้ไม่ว่าง */
export function mergeAnnouncementSources(internal = [], riskcom = null) {
  if (!Array.isArray(riskcom) || riskcom.length === 0) return internal;
  const current = internal.filter((item) => item.display_status === "current");
  return [...current, ...riskcom];
}
