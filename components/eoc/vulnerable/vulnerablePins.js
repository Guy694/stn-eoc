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

/** สีหมุดบนแผนที่: จัดการแล้ว = เทา, นอกนั้น = กลุ่มสี */
export function pinFill(person) {
  const status = caseStatus(person.status);
  if (status.group === "done") return "#9aa6b5";
  return careGroupMeta(effectiveCareGroup(person))?.color || status.color;
}

/** ข้อความกำกับหมุดสำหรับโปรแกรมอ่านหน้าจอ */
export function pinLabel(person) {
  return `${careGroupMeta(effectiveCareGroup(person))?.label || ""} • ${caseStatus(person.status).label} • ${typeMeta(person.vulnerable_type)?.short || ""} • ${person.name || ""}`;
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
  return `<div class="vp-pin${urgent ? " vp-pin--urgent" : ""}${selected ? " vp-pin--selected" : ""}" style="width:${size}px;height:${Math.round(size * 1.33)}px">${pinSvg(person.status, size, pinFill(person))}${tag}</div>`;
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
