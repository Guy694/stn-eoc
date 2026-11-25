// แผนที่สถานการณ์สำหรับเจ้าหน้าที่ (/analytics): ตัวกรองและสรุป — ไม่มี DOM ทดสอบได้
// ชั้นข้อมูลเพิ่มจากแผนที่ประชาชน: กลุ่มเปราะบางรายบุคคล (สถานะการช่วยเหลือในเหตุการณ์) และคำขอความช่วยเหลือจากประชาชน
import { CASE_STATUSES, VULNERABLE_TYPES } from "@/lib/vulnerablePersons";
import { CARE_GROUPS, effectiveCareGroup } from "@/lib/careGroups";
import { INCIDENT_STATUSES } from "@/lib/incidentStatuses";

// สีจุดคำขอความช่วยเหลือบนแผนที่ ตามสถานะเรื่อง (รอ = แดง เด่นสุด, ปิดแล้ว = เทา)
export const HELP_STATUS_COLORS = { pending: "#dc2626", reviewing: "#2563eb", verified: "#0d9488", resolved: "#64748b", rejected: "#a1a1aa" };

// คำขอที่ยังต้องทำ (ค่าเริ่มต้นของตัวกรอง) — เรื่องที่ปิดแล้วเปิดดูได้จากตัวกรอง
export const OPEN_HELP_STATUSES = ["pending", "reviewing", "verified"];

export function defaultStaffMapFilters() {
  return {
    showPeople: true,
    showHelp: true,
    types: VULNERABLE_TYPES.map((item) => item.key),
    careGroups: CARE_GROUPS.map((item) => item.key),
    statuses: CASE_STATUSES.map((item) => item.key),
    helpStatuses: [...OPEN_HELP_STATUSES],
    district: ""
  };
}

const sameDistrict = (value, district) => !district || String(value || "").replace(/^อ(\.|ำเภอ)\s*/, "").trim() === district;

/** กลุ่มเปราะบางที่ผ่านตัวกรอง (เฉพาะคนที่มีพิกัด ถ้า requireLocation) */
export function filterPeople(persons = [], filters = defaultStaffMapFilters(), { requireLocation = false } = {}) {
  if (!filters.showPeople) return [];
  const types = new Set(filters.types);
  const groups = new Set(filters.careGroups);
  const statuses = new Set(filters.statuses);
  return persons.filter((person) => types.has(person.vulnerable_type)
    && groups.has(effectiveCareGroup(person) || "red")
    && statuses.has(person.status || "waiting")
    && sameDistrict(person.district, filters.district)
    && (!requireLocation || Boolean(person.location)));
}

/** คำขอความช่วยเหลือที่ผ่านตัวกรอง */
export function filterHelpRequests(reports = [], filters = defaultStaffMapFilters(), { requireLocation = false } = {}) {
  if (!filters.showHelp) return [];
  const statuses = new Set(filters.helpStatuses);
  return reports.filter((report) => statuses.has(report.status)
    && sameDistrict(report.district, filters.district)
    && (!requireLocation || (Number.isFinite(Number(report.latitude)) && Number.isFinite(Number(report.longitude)) && Number(report.latitude) !== 0)));
}

/** นับตามคีย์ (ใช้แสดงตัวเลขข้างตัวกรอง) */
export function countBy(items = [], keyOf) {
  const counts = {};
  for (const item of items) {
    const key = keyOf(item);
    counts[key] = (counts[key] || 0) + 1;
  }
  return counts;
}

/** สรุปบนแถบรายละเอียด: ทั้งหมด / ยังไม่จัดการ / กำลังดำเนินการ / จัดการแล้ว / ไม่มีพิกัด */
export function summarizeStaffMap(people = [], help = []) {
  const groupOf = new Map(CASE_STATUSES.map((item) => [item.key, item.group]));
  const byGroup = { pending: 0, progress: 0, done: 0 };
  for (const person of people) byGroup[groupOf.get(person.status || "waiting") || "pending"] += 1;
  return {
    people: people.length,
    people_pending: byGroup.pending,
    people_progress: byGroup.progress,
    people_done: byGroup.done,
    people_no_location: people.filter((person) => !person.location).length,
    help: help.length,
    help_pending: help.filter((report) => report.status === "pending").length
  };
}

/** สลับค่าในรายการตัวกรอง (เลือก/ไม่เลือก) */
export function toggleValue(list = [], value) {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
}

export { CASE_STATUSES, CARE_GROUPS, INCIDENT_STATUSES, VULNERABLE_TYPES };
