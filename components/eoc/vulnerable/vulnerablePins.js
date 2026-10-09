// หมุดกลุ่มเปราะบาง: สีตามสถานะ + สัญลักษณ์ในหมุดบอกความหมายโดยไม่ต้องพึ่งสีอย่างเดียว
//   ! รอช่วยเหลือ   ? เข้าถึงไม่ได้   → กำลังเดินทาง   ⌂ ถึงพื้นที่แล้ว   ✓ ช่วยเหลือแล้ว   ↗ เคลื่อนย้ายแล้ว   ✓ (เทา) ปลอดภัย
import { caseStatus, typeMeta } from "@/lib/vulnerablePersons";

const STROKE = 'fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"';

export const STATUS_GLYPHS = {
  waiting: `<path d="M12 6.5v6.5" ${STROKE}/><circle cx="12" cy="17" r="1.6" fill="#fff"/>`,
  unreachable: `<path d="M8 8l8 8M16 8l-8 8" ${STROKE}/>`,
  en_route: `<path d="M6.5 12h10M12.5 7.5l4.5 4.5-4.5 4.5" ${STROKE}/>`,
  arrived: `<path d="M6.5 12.2 12 7.5l5.5 4.7V17.5h-11z" ${STROKE}/>`,
  assisted: `<path d="M6.5 12.5l3.6 3.6 7.4-7.6" ${STROKE}/>`,
  moved: `<path d="M8 16l8-8M10 8h6v6" ${STROKE}/>`,
  safe: `<path d="M6.5 12.5l3.6 3.6 7.4-7.6" ${STROKE}/>`
};

/** SVG ของหมุด (ใช้ทั้งบนแผนที่และในคำอธิบายสัญลักษณ์) */
export function pinSvg(statusKey, size = 30) {
  const status = caseStatus(statusKey);
  const height = Math.round(size * 1.33);
  return `<svg width="${size}" height="${height}" viewBox="0 0 24 32" aria-hidden="true" focusable="false">
    <path d="M12 31s10-10.2 10-18.5A10 10 0 0 0 2 12.5C2 20.8 12 31 12 31z" fill="${status.color}" stroke="#fff" stroke-width="1.6"/>
    <g transform="translate(0 0.5)">${STATUS_GLYPHS[status.key] || STATUS_GLYPHS.waiting}</g>
  </svg>`;
}

/** ข้อความกำกับหมุดสำหรับโปรแกรมอ่านหน้าจอ */
export function pinLabel(person) {
  return `${caseStatus(person.status).label} • ${typeMeta(person.vulnerable_type)?.short || ""} • ${person.name || ""}`;
}

/** หมุด + วงกะพริบสำหรับผู้ที่ยังไม่ได้รับการช่วยเหลือและอยู่ในกลุ่มเร่งด่วน (ติดเตียง/พิการ/ตั้งครรภ์) */
export function pinHtml(person, { selected = false } = {}) {
  const urgent = person.status === "waiting" && (typeMeta(person.vulnerable_type)?.priority || 0) >= 2;
  const size = selected ? 38 : 30;
  return `<div class="vp-pin${urgent ? " vp-pin--urgent" : ""}${selected ? " vp-pin--selected" : ""}" style="width:${size}px;height:${Math.round(size * 1.33)}px">${pinSvg(person.status, size)}</div>`;
}
