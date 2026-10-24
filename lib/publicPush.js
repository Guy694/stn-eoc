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

/** ประกาศเตือนที่ควรส่งถึงประชาชน: ค่าเริ่มต้นเฉพาะระดับสูง, level = "watch" รวมระดับเฝ้าระวังด้วย */
export function warningCandidates(warnings = [], now = Date.now(), { level = "high" } = {}) {
  const seen = new Set();
  const out = [];
  const allowed = level === "watch" ? new Set(["high", "watch"]) : new Set(["high"]);
  for (const w of warnings || []) {
    if (!allowed.has(w?.level) || !w.message) continue;
    const key = warningKey(w, now);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ key, level: w.level, message: clean(w.message, 300), districts: districtsInText(w.message), source: w.source || null, issued_at: w.issued_at || null });
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
  const ordered = [...items].sort((a, b) => (a.level === "watch") - (b.level === "watch"));
  const first = ordered[0];
  const high = ordered.some((i) => i.level !== "watch");
  const label = high ? "⚠️ เตือนภัย จ.สตูล" : "เฝ้าระวัง จ.สตูล";
  const where = [...new Set(ordered.flatMap((i) => i.districts))];
  return {
    title: ordered.length > 1 ? `${label} ${ordered.length} เรื่อง${where.length ? ` (อ.${where.slice(0, 3).join(", อ.")})` : ""}` : label,
    body: clean(ordered.length > 1 ? ordered.slice(0, 3).map((i) => `• ${i.message}`).join("\n") : first.message, 400),
    url: "/stn-eoc/",
    tag: `${high ? "warn" : "watch"}-${bangkokDate(now)}`,
    level: high ? "high" : "info",
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
  // audience: "public" = ประชาชน (ทั้งจังหวัด/รายอำเภอ) · "officers" = เฉพาะเครื่องเจ้าหน้าที่ที่เปิดรับแจ้งเตือน (ไม่แยกอำเภอ)
  const audience = body.audience === "officers" ? "officers" : "public";
  return { value: { title, body: text, url, districts: audience === "officers" ? [] : districts, level, audience } };
}

export function normalizePushSettings(value) {
  const v = value && typeof value === "object" ? value : {};
  return { auto_enabled: v.auto_enabled === true, auto_level: v.auto_level === "watch" ? "watch" : "high", updated_at: v.updated_at || null, updated_by_name: v.updated_by_name || null };
}

/** แจ้ง "น้ำลดแล้ว" อัตโนมัติ: จากแจ้งเตือนสถานีที่เปลี่ยนจากล้นตลิ่งเป็นต่ำกว่าตลิ่ง (lib/waterAlerts buildAlert) */
export function resolvedCandidates(alerts = [], now = Date.now()) {
  return (alerts || [])
    .filter((a) => a?.kind === "water" && a.previousState === "overflow" && a.state !== "overflow")
    .map((a) => {
      const place = a.amphoe ? ` อ.${a.amphoe}` : "";
      const below = Number.isFinite(Number(a.bankDiff)) && Number(a.bankDiff) < 0 ? ` ต่ำกว่าตลิ่ง ${Math.abs(Number(a.bankDiff)).toFixed(2)} ม.` : "";
      return {
        key: `r:${bangkokDate(now)}:${String(a.stationId).slice(0, 40)}`,
        level: "info",
        title: `✅ น้ำลดลงต่ำกว่าตลิ่งแล้ว${place}`,
        message: clean(`สถานี${a.stationName}${place}${below} ยังควรระวังน้ำไหลเชี่ยว ก่อนเข้าบ้านตรวจปลั๊กและสายไฟให้แห้ง ถ้ามีไข้หรือแผลหลังลุยน้ำให้รีบพบแพทย์`, 400),
        districts: a.amphoe && SATUN_DISTRICTS.includes(a.amphoe) ? [a.amphoe] : []
      };
    });
}

// ---------- นับผู้รับแจ้งเตือน: service worker ส่งสัญญาณกลับเมื่อแจ้งเตือนขึ้นบนเครื่อง (shown) และเมื่อกดเปิด (opened) ----------
export const RECEIPT_EVENTS = ["shown", "opened"];
export const MAX_RECEIPT_IDS = 10;

/** แปลงรหัสรายการส่ง (public_push_log.id) ให้เป็นรายการตัวเลขที่ใช้ได้ */
export function receiptIds(value) {
  const list = Array.isArray(value) ? value : [value];
  return [...new Set(list.map(Number).filter((n) => Number.isInteger(n) && n > 0))].slice(0, MAX_RECEIPT_IDS);
}

/** ตรวจสัญญาณจาก service worker: { ids, event, endpoint } */
export function validateReceiptInput(body = {}, { isAllowedEndpoint } = {}) {
  const event = RECEIPT_EVENTS.includes(body?.event) ? body.event : null;
  if (!event) return { error: "event" };
  const ids = receiptIds(body.ids);
  if (!ids.length) return { error: "ids" };
  const endpoint = typeof body.endpoint === "string" ? body.endpoint : "";
  if (!endpoint || (isAllowedEndpoint && !isAllowedEndpoint(endpoint))) return { error: "endpoint" };
  return { value: { event, ids, endpoint } };
}

/** ประเภทอุปกรณ์อย่างหยาบจาก user agent ที่เก็บไว้ตอนสมัคร (ไม่ระบุตัวบุคคล) */
export function deviceKind(userAgent = "") {
  const ua = String(userAgent || "");
  if (/iphone|ipad|ipod/i.test(ua)) return "iPhone/iPad";
  if (/android/i.test(ua)) return "Android";
  if (/windows/i.test(ua)) return "Windows";
  if (/macintosh|mac os x/i.test(ua)) return "Mac";
  if (/linux|cros/i.test(ua)) return "Linux/Chromebook";
  return "อื่น ๆ";
}

/** รวมยอด "แสดงแล้ว/เปิดอ่าน" เข้ากับรายการส่ง — counts = [{ log_id, event, n }] · รายการที่ส่งก่อนเริ่มนับ (tracked = false) ได้ค่า null */
export function attachReceipts(rows = [], counts = []) {
  const map = new Map();
  for (const c of counts || []) {
    const key = Number(c.log_id);
    const entry = map.get(key) || { shown: 0, opened: 0 };
    if (RECEIPT_EVENTS.includes(c.event)) entry[c.event] = Number(c.n) || 0;
    map.set(key, entry);
  }
  return rows.map((row) => {
    const tracked = Boolean(Number(row.receipt_tracked));
    const got = map.get(Number(row.id)) || { shown: 0, opened: 0 };
    const shown = tracked ? Math.max(got.shown, got.opened) : null;
    const opened = tracked ? got.opened : null;
    const delivered = Number(row.delivered) || 0;
    return { ...row, tracked, shown, opened, open_rate: tracked && delivered ? Math.round((opened / delivered) * 1000) / 10 : null };
  });
}

/** สรุปรวมช่วงเวลา: นับเฉพาะรายการที่เริ่มนับแล้ว เพื่อไม่ให้ % ต่ำผิดจริง */
export function receiptTotals(rows = []) {
  const tracked = rows.filter((row) => row.tracked);
  const sum = (key) => tracked.reduce((total, row) => total + (Number(row[key]) || 0), 0);
  const delivered = sum("delivered");
  const shown = sum("shown");
  const opened = sum("opened");
  return {
    alerts: rows.length, tracked_alerts: tracked.length, recipients: sum("recipients"), delivered, shown, opened,
    shown_rate: delivered ? Math.round((shown / delivered) * 1000) / 10 : null,
    open_rate: delivered ? Math.round((opened / delivered) * 1000) / 10 : null
  };
}
