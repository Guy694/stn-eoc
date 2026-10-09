// ทะเบียนกลุ่มเปราะบางรายบุคคล + สถานะการเข้าช่วยเหลือ (ไม่แตะฐานข้อมูล/การเข้ารหัส ใช้ได้ทั้งเซิร์ฟเวอร์และหน้าเว็บ)
import { VULNERABLE_TYPES } from "@/lib/vulnerableEvent";

export { VULNERABLE_TYPES };

// กลุ่มสถานะ: pending = ยังไม่จัดการ, progress = กำลังดำเนินการ, done = จัดการแล้ว
export const CASE_GROUPS = [
  { key: "pending", label: "ยังไม่จัดการ", color: "#dc2626" },
  { key: "progress", label: "กำลังดำเนินการ", color: "#f59e0b" },
  { key: "done", label: "จัดการแล้ว", color: "#16a34a" }
];

// ลำดับในรายการ = ลำดับการทำงานหน้างาน
export const CASE_STATUSES = [
  { key: "waiting", label: "รอช่วยเหลือ", group: "pending", color: "#dc2626", tone: "red", hint: "ยังไม่มีเจ้าหน้าที่ไปถึง" },
  { key: "unreachable", label: "เข้าถึงไม่ได้", group: "pending", color: "#7c3aed", tone: "red", hint: "ติดต่อไม่ได้ หรือเส้นทางถูกตัดขาด ต้องวางแผนใหม่" },
  { key: "en_route", label: "กำลังเดินทาง", group: "progress", color: "#f59e0b", tone: "amber", hint: "เจ้าหน้าที่ออกเดินทางแล้ว" },
  { key: "arrived", label: "ถึงพื้นที่แล้ว", group: "progress", color: "#0284c7", tone: "blue", hint: "เจ้าหน้าที่อยู่ที่บ้าน กำลังช่วยเหลือ" },
  { key: "assisted", label: "ช่วยเหลือแล้ว", group: "done", color: "#16a34a", tone: "green", hint: "ดูแล/ส่งของ/ให้ยา เรียบร้อย อยู่บ้านต่อได้" },
  { key: "moved", label: "เคลื่อนย้ายแล้ว", group: "done", color: "#0f766e", tone: "green", hint: "ย้ายไปศูนย์พักพิง โรงพยาบาล หรือบ้านญาติ" },
  { key: "safe", label: "ปลอดภัย ไม่ต้องช่วย", group: "done", color: "#64748b", tone: "gray", hint: "ตรวจแล้ว ไม่ได้รับผลกระทบ" }
];

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
    caregiver_phone: phone(input.caregiver_phone) || null
  };
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
  if (status === "moved" && !movedTo) return { error: "กรุณาระบุว่าเคลื่อนย้ายไปที่ไหน" };
  return { value: { status, moved_to: status === "moved" ? movedTo : null, note: text(input.note, 500) || null } };
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
  let withLocation = 0;
  for (const person of persons) {
    const status = caseStatus(person.status).key;
    byStatus[status] += 1;
    byGroup[caseGroup(status)] += 1;
    if (byType[person.vulnerable_type] !== undefined) byType[person.vulnerable_type] += 1;
    if (person.location) withLocation += 1;
  }
  const total = persons.length;
  return { total, withLocation, byStatus, byGroup, byType, donePercent: total ? Math.round((byGroup.done / total) * 100) : 0 };
}

/** กรองรายการ: { group, status, type, district, tambon, search, onlyMapped } */
export function filterPersons(persons = [], filters = {}) {
  const search = String(filters.search || "").trim().toLowerCase();
  return persons.filter((person) => {
    const status = caseStatus(person.status).key;
    if (filters.group && filters.group !== "all" && caseGroup(status) !== filters.group) return false;
    if (filters.status && filters.status !== "all" && status !== filters.status) return false;
    if (filters.type && filters.type !== "all" && person.vulnerable_type !== filters.type) return false;
    if (filters.district && filters.district !== "all" && person.district !== filters.district) return false;
    if (filters.tambon && filters.tambon !== "all" && person.tambon !== filters.tambon) return false;
    if (filters.onlyMapped && !person.location) return false;
    if (search) {
      const haystack = [person.name, person.village, person.tambon, person.district, person.address, person.needs, person.moved_to]
        .filter(Boolean).join(" ").toLowerCase();
      if (!haystack.includes(search)) return false;
    }
    return true;
  });
}

/** เรียงให้คนที่ต้องไปก่อนอยู่บน: ยังไม่จัดการ → กำลังดำเนินการ → จัดการแล้ว, ในกลุ่มเดียวกันติดเตียง/พิการก่อน */
export function sortByUrgency(persons = []) {
  const groupOrder = { pending: 0, progress: 1, done: 2 };
  return [...persons].sort((a, b) => {
    const group = groupOrder[caseGroup(a.status)] - groupOrder[caseGroup(b.status)];
    if (group) return group;
    const priority = (typeMeta(b.vulnerable_type)?.priority || 0) - (typeMeta(a.vulnerable_type)?.priority || 0);
    if (priority) return priority;
    return String(a.name || "").localeCompare(String(b.name || ""), "th");
  });
}
