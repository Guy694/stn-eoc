// หมุดกลุ่มเปราะบาง: สีหมุด = กลุ่มสี (แดง/เหลือง/เขียว ตามแนวทาง SAT) · สัญลักษณ์ในหมุด = สถานะการช่วยเหลือ
// จัดการแล้ว = หมุดสีเทา (คนที่ยังต้องไปจะเด่นบนแผนที่)
//   ! รอช่วยเหลือ   ? เข้าถึงไม่ได้   → กำลังเดินทาง   ⌂ ถึงพื้นที่แล้ว   ✓ ช่วยเหลือแล้ว   ↗ เคลื่อนย้ายแล้ว   ✓ (เทา) ปลอดภัย
import { caseStatus, typeMeta } from "@/lib/vulnerablePersons";
import { careGroupMeta, effectiveCareGroup } from "@/lib/careGroups";

const STROKE = 'fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"';

export const STATUS_GLYPHS = {
  waiting: `<path d="M12 6.5v6.5" ${STROKE}/><circle cx="12" cy="17" r="1.6" fill="#fff"/>`,
  unreachable: `<path d="M8 8l8 8M16 8l-8 8" ${STROKE}/>`,
  en_route: `<path d="M6.5 12h10M12.5 7.5l4.5 4.5-4.5 4.5" ${STROKE}/>`,
  arrived: `<path d="M6.5 12.2 12 7.5l5.5 4.7V17.5h-11z" ${STROKE}/>`,
  assisted: `<path d="M6.5 12.5l3.6 3.6 7.4-7.6" ${STROKE}/>`,
  moved: `<path d="M8 16l8-8M10 8h6v6" ${STROKE}/>`,
  safe: `<path d="M6.5 12.5l3.6 3.6 7.4-7.6" ${STROKE}/>`,
  returned: `<path d="M6.5 12.2 12 7.5l5.5 4.7V17.5h-11z" ${STROKE}/><path d="M12 17.5v-3" ${STROKE}/>`,
  followed_up: `<path d="M6.5 12.5l3.6 3.6 7.4-7.6" ${STROKE}/>`
};

/** SVG ของหมุด — fill ไม่ระบุ = สีโทนสถานะ (ใช้ในคำอธิบาย/ปุ่ม) */
export function pinSvg(statusKey, size = 30, fill = null) {
  const status = caseStatus(statusKey);
  const height = Math.round(size * 1.33);
  return `<svg width="${size}" height="${height}" viewBox="0 0 24 32" aria-hidden="true" focusable="false">
    <path d="M12 31s10-10.2 10-18.5A10 10 0 0 0 2 12.5C2 20.8 12 31 12 31z" fill="${fill || status.color}" stroke="#fff" stroke-width="1.6"/>
    <g transform="translate(0 0.5)">${STATUS_GLYPHS[status.key] || STATUS_GLYPHS.waiting}</g>
  </svg>`;
}

// สถานะที่แสดงเป็นสีเขียว (เขียวเข้มกว่ากลุ่มสีเขียว และมีเครื่องหมาย ✓ ในหมุด)
export const GREEN_DONE = new Set(["assisted", "safe"]);

/** สีหมุดบนแผนที่: ช่วยเหลือแล้ว/ปลอดภัย = เขียว, จัดการแล้วอื่น ๆ = เทา, นอกนั้น = กลุ่มสี */
export function pinFill(person) {
  const status = caseStatus(person.status);
  if (GREEN_DONE.has(status.key)) return status.color;
  if (status.group === "done") return "#9aa6b5";
  return careGroupMeta(effectiveCareGroup(person))?.color || status.color;
}

/** ข้อความกำกับหมุดสำหรับโปรแกรมอ่านหน้าจอ */
export function pinLabel(person) {
  return `${careGroupMeta(effectiveCareGroup(person))?.label || ""} • ${caseStatus(person.status).label} • ${typeMeta(person.vulnerable_type)?.short || ""} • ${person.name || ""}${person.location?.approx ? " • ตำแหน่งประมาณ ยังไม่ใช่บ้านจริง" : ""}`;
}

/**
 * คนที่มีพิกัดโดยประมาณจุดเดียวกัน (กลางหมู่บ้าน) → กระจายหมุดเป็นวงรอบจุดนั้นเพื่อให้กดได้ทีละคน
 * ระยะ ~35–90 ม. (ไม่ใช่ตำแหน่งบ้านจริง) · คนที่ปักหมุดบ้านจริงแล้วไม่ขยับ
 */
export function spreadApproxPositions(people) {
  const groups = new Map();
  for (const person of people) {
    if (!person.location?.approx) continue;
    const key = `${person.location.lat.toFixed(6)},${person.location.lng.toFixed(6)}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(person);
  }
  const positions = new Map();
  for (const members of groups.values()) {
    if (members.length < 2) continue;
    const sorted = [...members].sort((a, b) => a.id - b.id);
    sorted.forEach((person, index) => {
      const ring = Math.floor(index / 8);
      const slots = Math.min(8, sorted.length - ring * 8);
      const angle = (2 * Math.PI * (index % 8)) / slots + ring * 0.4;
      const meters = 35 + ring * 30;
      const dLat = (meters * Math.cos(angle)) / 111320;
      const dLng = (meters * Math.sin(angle)) / (111320 * Math.cos((person.location.lat * Math.PI) / 180));
      positions.set(person.id, [person.location.lat + dLat, person.location.lng + dLng]);
    });
  }
  return positions;
}

const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));

/**
 * หมุด: สี = กลุ่มสี, สัญลักษณ์ = สถานะ, ป้ายมุมขวาบน = ประเภท (เตียง, HD, ครรภ์ ...) ⚡ = ใช้อุปกรณ์ไฟฟ้า
 * วงกะพริบ = กลุ่มสีแดงที่ยังรอช่วยเหลือ
 */
export function pinHtml(person, { selected = false } = {}) {
  const type = typeMeta(person.vulnerable_type);
  const care = careGroupMeta(effectiveCareGroup(person));
  const urgent = person.status === "waiting" && care?.key === "red";
  const size = selected ? 38 : 30;
  const label = `${type?.tag || ""}${person.power_dependent ? " ⚡" : ""}`.trim();
  const tag = label ? `<span class="vp-tag">${escapeHtml(label)}</span>` : "";
  const approx = person.location?.approx ? " vp-pin--approx" : "";
  return `<div class="vp-pin${urgent ? " vp-pin--urgent" : ""}${selected ? " vp-pin--selected" : ""}${approx}" style="width:${size}px;height:${Math.round(size * 1.33)}px">${pinSvg(person.status, size, pinFill(person))}${tag}</div>`;
}

/** หมุดศูนย์พักพิง: สี่เหลี่ยมสีตามประเภทศูนย์ + ตัวเลขที่ว่าง */
export function shelterPinHtml({ color = "#0b4c86", free = null, active = true, full = false }) {
  const label = !active ? "ปิด" : free === null ? "" : full ? "เต็ม" : String(free);
  const bg = !active ? "#94a3b8" : color;
  return `<div class="vp-shelter${full ? " vp-shelter--full" : ""}" style="--c:${bg}">
    <svg width="26" height="26" viewBox="0 0 24 24" aria-hidden="true"><rect x="1.5" y="1.5" width="21" height="21" rx="5" fill="${bg}" stroke="#fff" stroke-width="2"/><path d="M6.5 12.5 12 7.5l5.5 5v5h-11z" fill="none" stroke="#fff" stroke-width="2" stroke-linejoin="round"/></svg>
    ${label ? `<span class="vp-shelter__free">${escapeHtml(label)}</span>` : ""}
  </div>`;
}
