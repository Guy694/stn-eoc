// รายละเอียดคำขอความช่วยเหลือ (ด้านยา / ด้านกลุ่มเปราะบาง) ที่ใช้ร่วมกันระหว่างฟอร์มประชาชนและ API
// สสจ.สตูล รวบรวมคำขอ แล้วส่งต่อให้ ปภ. เข้าพื้นที่ → ข้อมูลต้องบอกได้ว่า "ใคร กี่คน ด่วนแค่ไหน เข้าถึงอย่างไร"
// เก็บลงคอลัมน์เดิม (affected_people, water_level, urgency, travel_status) + เป็นบรรทัดใน description
// (หน้าเจ้าหน้าที่แสดง description แบบหลายบรรทัดอยู่แล้ว จึงไม่ต้องเพิ่มคอลัมน์)
import { WATER_LEVELS, waterLevelMeta } from "@/lib/waterReport";

export const VULNERABLE_GROUPS = [
  { value: "bedridden", label: "ผู้ป่วยติดเตียง", critical: true },
  { value: "oxygen", label: "ใช้ออกซิเจน/เครื่องมือแพทย์ที่ใช้ไฟฟ้า", critical: true },
  { value: "dialysis", label: "ผู้ป่วยฟอกไต", critical: true },
  { value: "elderly", label: "ผู้สูงอายุ (60 ปีขึ้นไป)" },
  { value: "disabled", label: "ผู้พิการ" },
  { value: "child", label: "เด็กเล็ก (ต่ำกว่า 5 ปี)" },
  { value: "pregnant", label: "หญิงตั้งครรภ์/หลังคลอด" },
  { value: "chronic", label: "ผู้ป่วยโรคเรื้อรัง (เบาหวาน ความดัน หัวใจ ฯลฯ)" },
  { value: "psych", label: "ผู้ป่วยจิตเวช" }
];

export const MEDICINE_REMAINING = [
  { value: "out", label: "หมดแล้ว" },
  { value: "1_3", label: "เหลือ 1–3 วัน" },
  { value: "4_7", label: "เหลือ 4–7 วัน" },
  { value: "over_7", label: "เหลือมากกว่า 7 วัน" }
];

export const HOME_WATER_LEVELS = [
  { value: "none", label: "ไม่มีน้ำท่วม", range: "" },
  ...WATER_LEVELS.map(({ value, label, range }) => ({ value, label, range }))
];

export const MOBILITY = [
  // short/hint ใช้บนการ์ดในฟอร์ม (จอมือถือแคบ) · label เต็มใช้ในรายละเอียดคำขอ
  { value: "self", label: "ออกจากบ้านได้เอง", short: "ออกได้เอง" },
  { value: "assisted", label: "ออกได้ แต่ต้องมีคนช่วย/เปล/รถเข็น", short: "ต้องมีคนช่วย", hint: "เปล / รถเข็น" },
  { value: "trapped", label: "ติดค้าง ออกจากบ้านไม่ได้", short: "ติดค้าง", hint: "ออกจากบ้านไม่ได้" }
];

export const ACCESS_ROUTES = [
  { value: "car", label: "รถทั่วไปเข้าถึงได้", travel: "passable" },
  { value: "high_vehicle", label: "เฉพาะรถสูง", travel: "difficult" },
  { value: "boat", label: "ต้องใช้เรือ", travel: "impassable" },
  { value: "unknown", label: "ไม่ทราบ", travel: null }
];

export const ON_BEHALF_RELATIONS = ["ลูก/หลาน", "ญาติ", "เพื่อนบ้าน", "ผู้นำชุมชน/อสม.", "อื่น ๆ"];

const pick = (list, value) => list.find((item) => item.value === value) || null;
const labelOf = (list, value) => pick(list, value)?.label || "";
const cleanText = (value, max) => String(value ?? "").replace(/[\u0000-\u001F]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);

/** ตรวจ/ทำความสะอาดค่าจากฟอร์ม — ค่าที่ไม่รู้จักถูกตัดทิ้ง (ไม่ทำให้ส่งคำขอไม่ได้) */
export function normalizeHelpDetails(raw = {}) {
  const groups = Array.isArray(raw.vulnerableGroups)
    ? raw.vulnerableGroups
    : String(raw.vulnerableGroups || "").split(",");
  const people = Number.parseInt(String(raw.peopleCount ?? "").trim(), 10);
  const onBehalf = raw.onBehalf === "other";
  return {
    onBehalf,
    relation: onBehalf ? cleanText(raw.relation, 50) : "",
    patientName: onBehalf ? cleanText(raw.patientName, 150) : "",
    patientPhone: onBehalf ? cleanText(raw.patientPhone, 20).replace(/[^0-9+\-\s]/g, "") : "",
    peopleCount: Number.isFinite(people) && people > 0 && people <= 999 ? people : null,
    vulnerableGroups: [...new Set(groups.map((g) => String(g).trim()).filter((g) => pick(VULNERABLE_GROUPS, g)))],
    medicineRemaining: pick(MEDICINE_REMAINING, raw.medicineRemaining)?.value || "",
    medicineNeeded: cleanText(raw.medicineNeeded, 300),
    homeWaterLevel: pick(HOME_WATER_LEVELS, raw.homeWaterLevel)?.value || "",
    mobility: pick(MOBILITY, raw.mobility)?.value || "",
    accessRoute: pick(ACCESS_ROUTES, raw.accessRoute)?.value || ""
  };
}

const LEVEL_RANK = Object.fromEntries(WATER_LEVELS.map((item, index) => [item.value, index]));
const atLeast = (level, threshold) => level in LEVEL_RANK && LEVEL_RANK[level] >= LEVEL_RANK[threshold];

/** จัดลำดับความเร่งด่วนจากข้อเท็จจริงที่แจ้ง (เซิร์ฟเวอร์เป็นผู้ตัดสิน ไม่เชื่อค่าจากเบราว์เซอร์) */
export function deriveHelpUrgency(details) {
  const d = details || {};
  const groups = d.vulnerableGroups || [];
  const hasCritical = groups.some((g) => pick(VULNERABLE_GROUPS, g)?.critical);
  const trapped = d.mobility === "trapped";
  const deepWater = atLeast(d.homeWaterLevel, "waist_chest");
  const medicineOut = d.medicineRemaining === "out";

  if (atLeast(d.homeWaterLevel, "chest_up")) return "critical";
  if (trapped && (hasCritical || deepWater)) return "critical";
  if (medicineOut && (groups.includes("oxygen") || groups.includes("dialysis"))) return "critical";

  if (trapped || medicineOut || hasCritical || deepWater) return "high";
  if (atLeast(d.homeWaterLevel, "knee_waist") || d.medicineRemaining === "1_3") return "high";
  if (d.mobility === "assisted" && groups.length) return "high";
  return "medium";
}

export function travelStatusForAccess(value) {
  return pick(ACCESS_ROUTES, value)?.travel || null;
}

/** ค่าที่จะลงคอลัมน์ water_level: เฉพาะระดับน้ำจริง ("ไม่มีน้ำท่วม" → ว่าง) */
export function waterLevelColumn(value) {
  return waterLevelMeta(value) ? value : "";
}

/** บรรทัดสรุปสำหรับ description / Telegram / ส่งต่อ ปภ. */
export function helpDetailLines(details) {
  const d = details || {};
  const lines = [];
  if (d.onBehalf) {
    lines.push(`ผู้แจ้ง: แจ้งแทนผู้อื่น${d.relation ? ` (${d.relation})` : ""}`);
    const who = [d.patientName, d.patientPhone ? `โทร ${d.patientPhone}` : ""].filter(Boolean).join(" · ");
    if (who) lines.push(`ผู้ต้องการความช่วยเหลือ: ${who}`);
  }
  if (d.peopleCount) lines.push(`จำนวนคนในบ้าน: ${d.peopleCount} คน`);
  if (d.vulnerableGroups?.length) lines.push(`กลุ่มที่ต้องดูแลพิเศษ: ${d.vulnerableGroups.map((g) => labelOf(VULNERABLE_GROUPS, g)).join(", ")}`);
  if (d.medicineRemaining) lines.push(`ยาคงเหลือ: ${labelOf(MEDICINE_REMAINING, d.medicineRemaining)}`);
  if (d.medicineNeeded) lines.push(`ยา/โรคประจำตัว: ${d.medicineNeeded}`);
  if (d.homeWaterLevel) {
    const level = pick(HOME_WATER_LEVELS, d.homeWaterLevel);
    lines.push(`ระดับน้ำที่บ้าน: ${level.label}${level.range ? ` (${level.range})` : ""}`);
  }
  if (d.mobility) lines.push(`การออกจากบ้าน: ${labelOf(MOBILITY, d.mobility)}`);
  if (d.accessRoute) lines.push(`การเข้าถึงพื้นที่: ${labelOf(ACCESS_ROUTES, d.accessRoute)}`);
  return lines;
}
