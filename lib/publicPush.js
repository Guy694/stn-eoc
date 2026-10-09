// แจ้งเตือนภัยถึงประชาชน: กติกาเลือกเรื่องที่จะส่ง และใครควรได้รับ (ไม่มีการเรียกเครือข่าย ทดสอบได้)
import crypto from "node:crypto";
import { SATUN_DISTRICT_NAMES } from "@/lib/satunDistricts";

export const SATUN_DISTRICTS = SATUN_DISTRICT_NAMES;
export const PUSH_SETTINGS_KEY = "public_push";
const MAX_AREAS = 20;

const clean = (value, max) => String(value ?? "").replace(/[\u0000-\u001f]/g, " ").trim().slice(0, max);

/** ตรวจข้อมูลสมัครรับแจ้งเตือนจากหน้าเว็บ */
export function validateSubscriptionInput(body = {}, { isAllowedEndpoint } = {}) {
  const sub = body.subscription || {};
  const endpoint = String(sub.endpoint || "");
  const p256dh = String(sub.keys?.p256dh || "");
  const auth = String(sub.keys?.auth || "");
  if (!endpoint || (isAllowedEndpoint && !isAllowedEndpoint(endpoint))) return { error: "ปลายทางการแจ้งเตือนไม่ถูกต้อง" };
  if (!/^[A-Za-z0-9_-]{80,100}$/.test(p256dh) || !/^[A-Za-z0-9_-]{16,32}$/.test(auth)) return { error: "กุญแจการแจ้งเตือนไม่ถูกต้อง" };
  const districts = [...new Set((Array.isArray(body.districts) ? body.districts : []).map((d) => clean(d, 40)).filter((d) => SATUN_DISTRICTS.includes(d)))];
  const tambons = [...new Set((Array.isArray(body.tambons) ? body.tambons : []).map((t) => clean(t, 90)).filter((t) => /^[^|]+\|[^|]+$/.test(t) && SATUN_DISTRICTS.includes(t.split("|")[0])))].slice(0, MAX_AREAS);
  const scope = body.scope === "areas" && (districts.length || tambons.length) ? "areas" : "all";
  return { value: { endpoint, p256dh, auth, scope, districts: scope === "areas" ? districts : [], tambons: scope === "areas" ? tambons : [] } };
}

export const endpointHash = (endpoint) => crypto.createHash("sha256").update(String(endpoint)).digest("hex");

/** อำเภอที่ถูกกล่าวถึงในข้อความเตือน ("อ.ละงู", "อำเภอเมือง", "อ.เมือง") — ไม่พบ = ทั้งจังหวัด */
export function districtsInText(text = "") {
  const found = new Set();
  const value = String(text);
  for (const d of SATUN_DISTRICTS) {
    const short = d === "เมืองสตูล" ? "เมือง" : d;
    if (new RegExp(`(?:อ\\.|อำเภอ)\\s*${short}`).test(value)) found.add(d);
  }
  return [...found];
}

const bangkokDate = (ms) => new Date(ms + 7 * 3600e3).toISOString().slice(0, 10);
/** กุญแจกันส่งซ้ำ: เรื่องเดียวกันในวันเดียวกัน ส่งครั้งเดียว (ตัดตัวเลขที่เปลี่ยนทุกรอบ เช่น ปริมาณฝน/เวลา ออก) */
export function warningKey(warning, now = Date.now()) {
  const text = String(warning?.message || "").replace(/[\d.,:]+/g, "#").replace(/\s+/g, " ").trim();
  return `w:${bangkokDate(now)}:${crypto.createHash("sha1").update(text).digest("hex").slice(0, 20)}`;
}

/** ประกาศเตือนที่ควรส่งถึงประชาชน (เฉพาะระดับสูง) */
export function warningCandidates(warnings = [], now = Date.now()) {
  const seen = new Set();
  const out = [];
  for (const w of warnings || []) {
    if (w?.level !== "high" || !w.message) continue;
    const key = warningKey(w, now);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ key, level: "high", message: clean(w.message, 300), districts: districtsInText(w.message), source: w.source || null, issued_at: w.issued_at || null });
  }
  return out;
}

/** เครื่องนี้ควรได้รับเรื่องนี้ไหม: ไม่ระบุอำเภอ = ทุกคน; สมัครทั้งจังหวัด = ทุกเรื่อง */
export function subscriptionWants(sub, districts = []) {
  if (!districts.length || sub.scope !== "areas") return true;
  const subDistricts = new Set([...(sub.districts || []), ...(sub.tambons || []).map((t) => String(t).split("|")[0])]);
  return districts.some((d) => subDistricts.has(d));
}

/** รวมหลายเรื่องเป็นการแจ้งเตือนเดียวต่อเครื่อง */
export function buildWarningPayload(items, now = Date.now()) {
  const first = items[0];
  const where = [...new Set(items.flatMap((i) => i.districts))];
  return {
    title: items.length > 1 ? `⚠️ เตือนภัย จ.สตูล ${items.length} เรื่อง${where.length ? ` (อ.${where.slice(0, 3).join(", อ.")})` : ""}` : "⚠️ เตือนภัย จ.สตูล",
    body: clean(items.length > 1 ? items.slice(0, 3).map((i) => `• ${i.message}`).join("\n") : first.message, 400),
    url: "/stn-eoc/",
    tag: `warn-${bangkokDate(now)}`,
    level: "high",
    at: new Date(now).toISOString()
  };
}

/** ตรวจข้อความที่เจ้าหน้าที่ส่งเอง */
export function validateBroadcastInput(body = {}) {
  const title = clean(body.title, 100);
  const text = clean(body.body, 400);
  if (title.length < 4) return { error: "กรุณาใส่หัวข้อ (อย่างน้อย 4 ตัวอักษร)" };
  if (text.length < 8) return { error: "กรุณาใส่ข้อความ (อย่างน้อย 8 ตัวอักษร)" };
  let url = "/stn-eoc/";
  if (body.url) {
    const raw = String(body.url).trim();
    if (!/^\/stn-eoc\/[A-Za-z0-9/_\-.?=&%]*$/.test(raw)) return { error: "ลิงก์ต้องเป็นหน้าในระบบนี้ (ขึ้นต้นด้วย /stn-eoc/)" };
    url = raw;
  }
  const districts = [...new Set((Array.isArray(body.districts) ? body.districts : []).filter((d) => SATUN_DISTRICTS.includes(d)))];
  const level = body.level === "high" ? "high" : "info";
  return { value: { title, body: text, url, districts, level } };
}

export function normalizePushSettings(value) {
  const v = value && typeof value === "object" ? value : {};
  return { auto_enabled: v.auto_enabled === true, updated_at: v.updated_at || null, updated_by_name: v.updated_by_name || null };
}
