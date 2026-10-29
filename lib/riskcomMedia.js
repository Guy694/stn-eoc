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
  // v1.1: tags = [{ name, color, backgroundColor }], categories = [string] (รุ่นเก่า: keywords, category)
  const tagNames = (Array.isArray(raw.tags) ? raw.tags : []).map((tag) => (typeof tag === "string" ? tag : tag?.name));
  const keywords = [...(Array.isArray(raw.keywords) ? raw.keywords : []), ...tagNames]
    .flatMap((value) => String(value || "").split(/[\s,]+/))
    .map((value) => value.replace(/^#/, "").trim())
    .filter(Boolean)
    .filter((value, index, all) => all.indexOf(value) === index)
    .slice(0, 12);
  const categories = (Array.isArray(raw.categories) ? raw.categories : [raw.category])
    .map((value) => text(value, 120))
    .filter(Boolean)
    .slice(0, 6);
  const images = (Array.isArray(raw.images) ? raw.images : [])
    .map((image) => ({ id: String(image?.id || "").replace(/[^A-Za-z0-9_-]/g, "").slice(0, 80), url: safeUrl(image?.downloadUrl) }))
    .filter((image) => image.url)
    .slice(0, 30);
  const phase = RISKCOM_PHASES[raw.phase] ? raw.phase : null;
  const date = raw.eventDate || raw.createdAt || null;
  return {
    id: `riskcom-${id}`,
    riskcom_id: id,
    source: "riskcom",
    href: `/public/announcements/riskcom/${id}`,
    title: text(raw.title, 300) || "สื่อความรู้",
    description: text(raw.description),
    category: categories[0] || null,
    categories,
    eoc_type: riskcomTopic({ category: categories.join(" "), keywords, title: raw.title }),
    phase,
    phase_label: phase ? RISKCOM_PHASES[phase] : null,
    location: text(raw.location, 200) || null,
    keywords,
    alt_text: text(raw.altText, 500),
    image_url: safeUrl(raw.thumbnailUrl) || images[0]?.url || null,
    images,
    image_count: Number.isFinite(raw.imageCount) ? raw.imageCount : images.length,
    view_count: Number.isFinite(raw.viewCount) ? raw.viewCount : null,
    is_recommended: raw.isRecommended === true,
    recommendation_rank: Number.isFinite(raw.recommendationRank) ? raw.recommendationRank : null,
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

/** คีย์ API (v1.1 ต้องส่ง X-API-Key) อ่านจาก RISKCOM_API_KEY ฝั่งเซิร์ฟเวอร์เท่านั้น ห้ามส่งไปเบราว์เซอร์ */
export function riskcomHeaders(env = process.env) {
  const headers = { Accept: "application/json" };
  const key = String(env.RISKCOM_API_KEY || "").trim();
  if (key) headers["X-API-Key"] = key;
  return headers;
}

/** สร้าง URL เรียก API ต้นทางจากพารามิเตอร์ที่อนุญาตเท่านั้น */
export function buildRiskcomUrl(params = {}) {
  if (params.view === "recommended") return `${RISKCOM_BASE}/recommended`;
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

/** ผลจาก /media/recommended — เอกสารไม่ระบุโครงสร้างแน่ชัด จึงรับได้หลายรูปแบบ
 *  (data เป็นอาร์เรย์ หรือ data.{media|recommended|items}) และไม่ทำให้พังถ้าไม่มีสถานการณ์ */
export function parseRecommended(json) {
  const root = json?.data && !Array.isArray(json.data) && typeof json.data === "object" ? json.data : json || {};
  const list = Array.isArray(json?.data) ? json.data : [root.media, root.recommended, root.items, root.recommendations, root.data].find(Array.isArray) || [];
  const items = list
    .map(normalizeRiskcomItem)
    .filter(Boolean)
    .sort((a, b) => (a.recommendation_rank ?? 1e9) - (b.recommendation_rank ?? 1e9));
  const raw = root.situation ?? root.currentSituation ?? json?.situation ?? null;
  const label = typeof raw === "string" ? raw : text(raw?.label || raw?.name || raw?.title || raw?.description, 200);
  const phase = [raw?.phase, root.phase, json?.phase].find((value) => RISKCOM_PHASES[value]) || null;
  return { items, situation: label || phase ? { label: label || null, phase, phase_label: phase ? RISKCOM_PHASES[phase] : null } : null };
}

/** สื่อจาก สสจ.สตูล แทนเนื้อหาความรู้เดิม แต่ประกาศของศูนย์ฯ ที่ยังอยู่ในช่วงเผยแพร่ยังขึ้นก่อนเสมอ
 *  ถ้าดึงคลังสื่อไม่ได้ ใช้ประกาศของระบบทั้งหมดแทน หน้าจะได้ไม่ว่าง */
export function mergeAnnouncementSources(internal = [], riskcom = null) {
  if (!Array.isArray(riskcom) || riskcom.length === 0) return internal;
  const current = internal.filter((item) => item.display_status === "current");
  return [...current, ...riskcom];
}
