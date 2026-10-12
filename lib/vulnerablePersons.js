// ทะเบียนกลุ่มเปราะบางรายบุคคล + สถานะการเข้าช่วยเหลือ (ไม่แตะฐานข้อมูล/การเข้ารหัส ใช้ได้ทั้งเซิร์ฟเวอร์และหน้าเว็บ)
import { VULNERABLE_TYPES } from "@/lib/vulnerableEvent";
import { CARE_GROUPS, careGroupRank, effectiveCareGroup, isCareGroup } from "@/lib/careGroups";
import { WORK_TONES } from "@/lib/riskPalette";

export { VULNERABLE_TYPES, CARE_GROUPS, effectiveCareGroup };

// กลุ่มสถานะ: pending = ยังไม่จัดการ, progress = กำลังดำเนินการ, done = จัดการแล้ว
// ใช้โทนน้ำเงิน/เทา (ไม่ใช่แดง/เหลือง/เขียว) เพราะสีนั้นสงวนไว้สำหรับกลุ่มสีผู้ป่วยและธงเตือนภัย
export const CASE_GROUPS = [
  { key: "pending", label: "ยังไม่จัดการ", color: WORK_TONES.pending },
  { key: "progress", label: "กำลังดำเนินการ", color: WORK_TONES.progress },
  { key: "done", label: "จัดการแล้ว", color: WORK_TONES.done }
];

// ลำดับในรายการ = ลำดับการทำงานหน้างาน
export const CASE_STATUSES = [
  { key: "waiting", label: "รอช่วยเหลือ", group: "pending", color: "#1e3a5f", tone: "red", hint: "ยังไม่มีเจ้าหน้าที่ไปถึง" },
  { key: "unreachable", label: "เข้าถึงไม่ได้", group: "pending", color: "#6d28d9", tone: "red", hint: "ติดต่อไม่ได้ หรือเส้นทางถูกตัดขาด ต้องวางแผนใหม่" },
  { key: "en_route", label: "กำลังเดินทาง", group: "progress", color: "#2563eb", tone: "blue", hint: "เจ้าหน้าที่ออกเดินทางแล้ว" },
  { key: "arrived", label: "ถึงพื้นที่แล้ว", group: "progress", color: "#0284c7", tone: "blue", hint: "เจ้าหน้าที่อยู่ที่บ้าน กำลังช่วยเหลือ" },
  { key: "assisted", label: "ช่วยเหลือแล้ว", group: "done", color: "#64748b", tone: "gray", hint: "ดูแล/ส่งของ/ให้ยา เรียบร้อย อยู่บ้านต่อได้" },
  { key: "moved", label: "เคลื่อนย้ายแล้ว", group: "done", color: "#475569", tone: "gray", hint: "ย้ายไปศูนย์พักพิง โรงพยาบาล หรือบ้านญาติ" },
  { key: "safe", label: "ปลอดภัย ไม่ต้องช่วย", group: "done", color: "#94a3b8", tone: "gray", hint: "ตรวจแล้ว ไม่ได้รับผลกระทบ" },
  // หลังน้ำลด (Trigger 6): ส่งกลับบ้านแล้วต้องเยี่ยมติดตามภายใน 24–48 ชม.
  { key: "returned", label: "กลับบ้านแล้ว รอติดตาม", group: "progress", color: "#0891b2", tone: "blue", hint: "ส่งกลับบ้านแล้ว ต้องเยี่ยมติดตามภายใน 24–48 ชม." },
  { key: "followed_up", label: "ติดตามหลังกลับบ้านแล้ว", group: "done", color: "#64748b", tone: "gray", hint: "เยี่ยมติดตามหลังกลับบ้านแล้ว ไม่มีภาวะแทรกซ้อน" }
];

/** ติดตามหลังกลับบ้าน: ครบ 24 ชม. = ถึงกำหนด, เกิน 48 ชม. = เลยกำหนด — null = ยังไม่ถึง/ไม่เกี่ยว */
export const FOLLOW_UP_DUE_HOURS = 24;
export const FOLLOW_UP_LATE_HOURS = 48;
export function followUpState(person, now = Date.now()) {
  if (person?.status !== "returned" || !person.status_updated_at) return null;
  const hours = (now - new Date(person.status_updated_at).getTime()) / 3600000;
  if (!Number.isFinite(hours)) return null;
  if (hours >= FOLLOW_UP_LATE_HOURS) return { key: "late", hours, text: `เลยกำหนดติดตาม (กลับบ้าน ${Math.floor(hours)} ชม.)` };
  if (hours >= FOLLOW_UP_DUE_HOURS) return { key: "due", hours, text: `ถึงกำหนดติดตาม (กลับบ้าน ${Math.floor(hours)} ชม.)` };
  return { key: "soon", hours, text: `ติดตามภายใน ${Math.max(1, Math.ceil(FOLLOW_UP_LATE_HOURS - hours))} ชม.` };
}

const STATUS_BY_KEY = new Map(CASE_STATUSES.map((item) => [item.key, item]));
export const DEFAULT_STATUS = "waiting";

export function caseStatus(key) {
  return STATUS_BY_KEY.get(key) || STATUS_BY_KEY.get(DEFAULT_STATUS);
}

export function isValidStatus(key) {
  return STATUS_BY_KEY.has(key);
}

export function caseGroup(key) {
  return caseStatus(key).group;
}

export function typeMeta(key) {
  return VULNERABLE_TYPES.find((type) => type.key === key) || null;
}

// กรอบพิกัดคร่าว ๆ ของ จ.สตูล และพื้นที่ติดกัน — กันพิมพ์สลับ lat/lng หรือพิมพ์ผิดหลัก
export const SATUN_BOUNDS = { minLat: 6.2, maxLat: 7.4, minLng: 99.4, maxLng: 100.6 };

/** แปลงพิกัดที่กรอก → { lat, lng } (ปัด 6 ตำแหน่ง) หรือ null; ค่าผิด → { error } */
export function parseLocation(lat, lng) {
  const hasLat = lat !== undefined && lat !== null && String(lat).trim() !== "";
  const hasLng = lng !== undefined && lng !== null && String(lng).trim() !== "";
  if (!hasLat && !hasLng) return null;
  if (!hasLat || !hasLng) return { error: "กรอกพิกัดให้ครบทั้งละติจูดและลองจิจูด" };
  const latitude = Number.parseFloat(lat);
  const longitude = Number.parseFloat(lng);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return { error: "พิกัดต้องเป็นตัวเลข" };
  const { minLat, maxLat, minLng, maxLng } = SATUN_BOUNDS;
  if (latitude < minLat || latitude > maxLat || longitude < minLng || longitude > maxLng) {
    return { error: "พิกัดอยู่นอกพื้นที่ จ.สตูล — ตรวจว่าไม่ได้สลับละติจูด/ลองจิจูด" };
  }
  return { lat: Math.round(latitude * 1e6) / 1e6, lng: Math.round(longitude * 1e6) / 1e6 };
}

const text = (value, max) => String(value ?? "").replace(/\s+/g, " ").trim().slice(0, max);
const phone = (value) => String(value ?? "").replace(/[^\d+]/g, "").slice(0, 15);

/** ตรวจและทำความสะอาดข้อมูลบุคคลก่อนบันทึก → { value } หรือ { error } */
export function validatePerson(input = {}) {
  const value = {
    vulnerable_type: text(input.vulnerable_type, 30),
    district: text(input.district, 100),
    tambon: text(input.tambon, 100),
    village: text(input.village, 100) || null,
    name: text(input.name, 150),
    phone: phone(input.phone) || null,
    address: text(input.address, 300) || null,
    needs: text(input.needs, 500) || null,
    caregiver_name: text(input.caregiver_name, 150) || null,
    caregiver_phone: phone(input.caregiver_phone) || null,
    due_date: null,
    preterm_history: false,
    // กลุ่มสี: ว่าง = ให้ระบบเสนอตามประเภท
    care_group: isCareGroup(input.care_group) ? input.care_group : null,
    power_dependent: input.power_dependent === true || input.power_dependent === "1" || input.power_dependent === 1
  };
  // หญิงตั้งครรภ์: กำหนดคลอด + ประวัติคลอดก่อนกำหนด (ใช้จัดลำดับและเตือนใกล้คลอด)
  if (value.vulnerable_type === "pregnant") {
    const due = text(input.due_date, 10);
    if (due && !/^\d{4}-\d{2}-\d{2}$/.test(due)) return { error: "กำหนดคลอดไม่ถูกต้อง" };
    value.due_date = due || null;
    value.preterm_history = input.preterm_history === true || input.preterm_history === "1" || input.preterm_history === 1;
  }
  if (!value.name) return { error: "กรุณากรอกชื่อ-นามสกุล" };
  if (!typeMeta(value.vulnerable_type)) return { error: "กรุณาเลือกประเภทกลุ่มเปราะบาง" };
  if (!value.district || !value.tambon) return { error: "กรุณาเลือกอำเภอและตำบล" };
  if (value.phone && value.phone.replace(/\D/g, "").length < 9) return { error: "เบอร์โทรไม่ครบ" };
  if (value.caregiver_phone && value.caregiver_phone.replace(/\D/g, "").length < 9) return { error: "เบอร์โทรผู้ดูแลไม่ครบ" };
  const location = parseLocation(input.lat, input.lng);
  if (location?.error) return { error: location.error };
  value.location = location;
  return { value };
}

/** ตรวจคำขอเปลี่ยนสถานะ → { value } หรือ { error } */
export function validateStatusChange(input = {}) {
  const status = text(input.status, 20);
  if (!isValidStatus(status)) return { error: "สถานะไม่ถูกต้อง" };
  const movedTo = text(input.moved_to, 255) || null;
  const shelterId = Number(input.moved_shelter_id);
  const movedShelterId = status === "moved" && Number.isInteger(shelterId) && shelterId > 0 ? shelterId : null;
  if (status === "moved" && !movedTo && !movedShelterId) return { error: "กรุณาเลือกศูนย์พักพิง หรือระบุว่าเคลื่อนย้ายไปที่ไหน" };
  return { value: { status, moved_to: status === "moved" ? movedTo : null, moved_shelter_id: movedShelterId, note: text(input.note, 500) || null } };
}

/** 0812345678 → 081-xxx-5678 (แสดงในตารางรวม) */
export function maskPhone(value) {
  const digits = String(value || "").replace(/\D/g, "");
  if (digits.length < 7) return digits ? "xxx" : "";
  return `${digits.slice(0, 3)}-xxx-${digits.slice(-4)}`;
}

/** สรุปจำนวนตามสถานะ/กลุ่ม/ประเภท สำหรับแถบตัวเลขและคำอธิบายแผนที่ */
export function summarizePersons(persons = []) {
  const byStatus = Object.fromEntries(CASE_STATUSES.map((item) => [item.key, 0]));
  const byGroup = Object.fromEntries(CASE_GROUPS.map((item) => [item.key, 0]));
  const byType = Object.fromEntries(VULNERABLE_TYPES.map((item) => [item.key, 0]));
  const byCare = Object.fromEntries(CARE_GROUPS.map((item) => [item.key, 0]));
  let withLocation = 0;
  for (const person of persons) {
    const status = caseStatus(person.status).key;
    byStatus[status] += 1;
    byGroup[caseGroup(status)] += 1;
    if (byType[person.vulnerable_type] !== undefined) byType[person.vulnerable_type] += 1;
    byCare[effectiveCareGroup(person)] += 1;
    if (person.location) withLocation += 1;
  }
  const total = persons.length;
  return { total, withLocation, byStatus, byGroup, byType, byCare, donePercent: total ? Math.round((byGroup.done / total) * 100) : 0 };
}

// ตัวกรองลัด (กดเดียว) — in_flood_area คำนวณที่หน้าเว็บจากพื้นที่น้ำท่วมล่าสุด
export const QUICK_FILTERS = [
  { key: "all", label: "ทั้งหมด" },
  { key: "priority", label: "ต้องช่วยก่อน", hint: "กลุ่มสีแดง และหญิงตั้งครรภ์ใกล้คลอด/เคยคลอดก่อนกำหนด ที่ยังไม่ได้จัดการ" },
  { key: "flood_pending", label: "อยู่ในพื้นที่น้ำท่วม ยังไม่ได้ช่วย", hint: "บ้านอยู่ในหมู่บ้านที่รายงานน้ำท่วมล่าสุด และยังไม่ได้จัดการ" },
  { key: "unmapped", label: "ยังไม่มีพิกัดบ้าน", hint: "ปักหมุดเพื่อให้แสดงบนแผนที่" },
  { key: "follow_up", label: "ต้องติดตามหลังกลับบ้าน", hint: "กลับบ้านแล้ว ต้องเยี่ยมติดตามภายใน 24–48 ชม." }
];

/** กลุ่มต้องช่วยก่อน: กลุ่มสีแดง หรือหญิงตั้งครรภ์ใกล้คลอด/เคยคลอดก่อนกำหนด */
export function isPriorityPerson(person, today) {
  return effectiveCareGroup(person) === "red" || Boolean(pregnancyAlert(person, today));
}

export function matchesQuickFilter(person, key, today) {
  const pending = caseGroup(caseStatus(person.status).key) === "pending";
  if (key === "priority") return pending && isPriorityPerson(person, today);
  if (key === "flood_pending") return pending && Boolean(person.in_flood_area);
  if (key === "unmapped") return !person.location;
  if (key === "follow_up") return caseStatus(person.status).key === "returned";
  return true;
}

/** กรองรายการ: { group, status, type, care, district, tambon, search, onlyMapped, quick, today } */
export function filterPersons(persons = [], filters = {}) {
  const search = String(filters.search || "").trim().toLowerCase();
  return persons.filter((person) => {
    const status = caseStatus(person.status).key;
    if (filters.group && filters.group !== "all" && caseGroup(status) !== filters.group) return false;
    if (filters.status && filters.status !== "all" && status !== filters.status) return false;
    if (filters.type && filters.type !== "all" && person.vulnerable_type !== filters.type) return false;
    if (filters.care && filters.care !== "all" && effectiveCareGroup(person) !== filters.care) return false;
    if (filters.district && filters.district !== "all" && person.district !== filters.district) return false;
    if (filters.tambon && filters.tambon !== "all" && person.tambon !== filters.tambon) return false;
    if (filters.onlyMapped && !person.location) return false;
    if (filters.quick && filters.quick !== "all" && !matchesQuickFilter(person, filters.quick, filters.today)) return false;
    if (search) {
      const haystack = [person.name, person.village, person.tambon, person.district, person.address, person.needs, person.moved_to]
        .filter(Boolean).join(" ").toLowerCase();
      if (!haystack.includes(search)) return false;
    }
    return true;
  });
}

/** หญิงตั้งครรภ์ที่ต้องเฝ้าระวัง: ใกล้คลอด (≤30 วัน) / เลยกำหนด / เคยคลอดก่อนกำหนด — null = ไม่มีประเด็น */
export const NEAR_DUE_DAYS = 30;
export function pregnancyAlert(person, today) {
  if (person?.vulnerable_type !== "pregnant") return null;
  const reasons = [];
  let days = null;
  if (person.due_date && today) {
    days = Math.round((Date.parse(`${person.due_date}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86400000);
    if (days < 0) reasons.push(`เลยกำหนดคลอด ${-days} วัน`);
    else if (days <= NEAR_DUE_DAYS) reasons.push(days === 0 ? "ครบกำหนดคลอดวันนี้" : `ใกล้คลอด อีก ${days} วัน`);
  }
  if (person.preterm_history) reasons.push("เคยคลอดก่อนกำหนด");
  return reasons.length ? { text: reasons.join(" · "), days } : null;
}

/** เรียงให้คนที่ต้องไปก่อนอยู่บน: ยังไม่จัดการ → กำลังดำเนินการ → จัดการแล้ว, ในกลุ่มเดียวกันสีแดง → เหลือง → เขียว แล้วตามประเภท */
export function sortByUrgency(persons = []) {
  const groupOrder = { pending: 0, progress: 1, done: 2 };
  return [...persons].sort((a, b) => {
    const group = groupOrder[caseGroup(a.status)] - groupOrder[caseGroup(b.status)];
    if (group) return group;
    const care = careGroupRank(b) - careGroupRank(a);
    if (care) return care;
    const priority = (typeMeta(b.vulnerable_type)?.priority || 0) - (typeMeta(a.vulnerable_type)?.priority || 0);
    if (priority) return priority;
    // หญิงตั้งครรภ์: ใกล้คลอดก่อน
    if (a.vulnerable_type === "pregnant" && (a.due_date || b.due_date)) {
      const due = String(a.due_date || "9999").localeCompare(String(b.due_date || "9999"));
      if (due) return due;
    }
    return String(a.name || "").localeCompare(String(b.name || ""), "th");
  });
}
