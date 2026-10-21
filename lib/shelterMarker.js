// หมุดสถานที่บนแผนที่ (ใช้ทั้งระบบ) — สีตามความหมายสากล (ISO 7010):
//   เขียว = ที่ปลอดภัย/ไปที่นี่ได้ (ศูนย์พักพิง, ศูนย์พักพิงทางการแพทย์/โรงพยาบาลสนาม = กากบาทขาวแบบป้ายปฐมพยาบาล)
//   น้ำเงิน = สถานพยาบาล (ตัว H แบบป้ายโรงพยาบาล) — สถานะเปิด/จำกัด/ปิด แสดงเป็นจุดสีที่มุม ไม่เปลี่ยนสีพื้น
//   แดง/ส้ม ใช้กับอันตรายเท่านั้น
// ห้ามใช้กากบาทแดงบนพื้นขาว (เครื่องหมายกาชาด) — คุ้มครองตาม พ.ร.บ.กาชาด พ.ศ. 2499 และอนุสัญญาเจนีวา
export const SHELTER_COLOR = "#15803d";
export const SHELTER_CLOSED_COLOR = "#94a3b8";
export const HEALTH_COLOR = "#1d4ed8";
export const SHELTER_MARKER_SIZE = 26;
export const MEDICAL_SHELTER_TYPES = ["medical", "field_hospital"];

const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

// เต็นท์ (เส้นเดียวกับ lucide "Tent") และกากบาทปฐมพยาบาล (ทึบ สีขาว)
const TENT = '<path d="M3.5 21 14 3"/><path d="M20.5 21 10 3"/><path d="M15.5 21 12 15l-3.5 6"/><path d="M2 21h20"/>';
const CROSS = '<path d="M9 3h6v6h6v6h-6v6H9v-6H3V9h6z" fill="#fff" stroke="none"/>';

export const isMedicalShelter = (type) => MEDICAL_SHELTER_TYPES.includes(String(type || ""));

/**
 * @param {{ type?: string, free?: number|null, full?: boolean, active?: boolean, size?: number, showLabel?: boolean }} options
 * type = shelter_type (medical / field_hospital → กากบาทขาว) · active = false → สีเทา + "ปิด" · full → "เต็ม"
 */
export function shelterMarkerHtml({ type = "general", free = null, full = false, active = true, size = SHELTER_MARKER_SIZE, showLabel = true } = {}) {
  const bg = active ? SHELTER_COLOR : SHELTER_CLOSED_COLOR;
  const medical = isMedicalShelter(type);
  const label = !showLabel ? "" : !active ? "ปิด" : full ? "เต็ม" : free === null || free === undefined ? "" : `ว่าง ${Number(free).toLocaleString("th-TH")}`;
  const labelStyle = full && active
    ? "background:#fee2e2;color:#b91c1c;box-shadow:0 0 0 1px #dc2626"
    : `background:#fff;color:${bg};box-shadow:0 0 0 1px ${bg}`;
  const inner = Math.round(size * (medical ? 0.56 : 0.6));
  const glyph = medical
    ? `<svg width="${inner}" height="${inner}" viewBox="0 0 24 24" aria-hidden="true">${CROSS}</svg>`
    : `<svg width="${inner}" height="${inner}" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${TENT}</svg>`;
  return `<div style="position:relative;width:${size}px;height:${size}px;filter:drop-shadow(0 2px 2px rgba(15,23,42,.35))">`
    + `<div style="width:${size}px;height:${size}px;box-sizing:border-box;border-radius:${Math.round(size * 0.28)}px;border:2px solid #fff;background:${bg};display:flex;align-items:center;justify-content:center">${glyph}</div>`
    + (label ? `<span style="position:absolute;left:50%;top:${size - 1}px;transform:translateX(-50%);white-space:nowrap;border-radius:6px;padding:2px 4px;font:800 10px/1 var(--font-kanit),system-ui,sans-serif;${labelStyle}">${esc(label)}</span>` : "")
    + `</div>`;
}

/** ตัวเลือก L.divIcon ของหมุดศูนย์พักพิง (ใส่ L จากหน้าที่เรียก เพื่อไม่ให้ไฟล์นี้ต้อง import leaflet) */
export function shelterDivIconOptions(options = {}) {
  const size = options.size || SHELTER_MARKER_SIZE;
  return {
    className: "shelter-marker-icon",
    html: shelterMarkerHtml({ ...options, size }),
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2],
    tooltipAnchor: [0, -size / 2]
  };
}

/**
 * หมุดสถานพยาบาล: พื้นน้ำเงิน + ตัว H สีขาว · จุดสีที่มุมขวาบน = สถานะ (เขียวเปิด เหลืองจำกัด แดงปิด/น้ำท่วม เทายังไม่มีรายงาน)
 * level: hospital (ใหญ่ มีชื่อใต้หมุด) / primary (รพ.สต.) / office (สำนักงาน: เล็ก สีเทา ไม่มีจุดสถานะ)
 */
export function healthMarkerHtml({ level = "primary", statusColor = null, name = "" } = {}) {
  const size = level === "hospital" ? 34 : level === "office" ? 22 : 26;
  const bg = level === "office" ? "#64748b" : HEALTH_COLOR;
  const font = Math.round(size * 0.55);
  const dot = level !== "office" && statusColor
    ? `<span style="position:absolute;right:-3px;top:-3px;width:${level === "hospital" ? 13 : 11}px;height:${level === "hospital" ? 13 : 11}px;border-radius:50%;background:${statusColor};border:2px solid #fff;box-shadow:0 1px 2px rgba(0,0,0,.3)"></span>`
    : "";
  const label = level === "hospital" && name
    ? `<div style="position:absolute;left:50%;top:${size + 2}px;transform:translateX(-50%);white-space:nowrap;padding:1px 6px;border-radius:6px;background:rgba(255,255,255,.94);color:#0f172a;font:700 11px/1.35 var(--font-kanit),system-ui,sans-serif;box-shadow:0 1px 3px rgba(0,0,0,.25)">${esc(name)}</div>`
    : "";
  return `<div style="position:relative;width:${size}px;height:${size}px">`
    + `<div style="width:${size}px;height:${size}px;box-sizing:border-box;border-radius:${level === "hospital" ? 9 : 7}px;border:${level === "hospital" ? 3 : 2}px solid #fff;background:${bg};color:#fff;box-shadow:0 3px 10px rgba(0,0,0,.28);display:flex;align-items:center;justify-content:center;font:900 ${font}px/1 system-ui,sans-serif">H</div>`
    + dot + label + `</div>`;
}

export function healthDivIconOptions(options = {}) {
  const size = options.level === "hospital" ? 34 : options.level === "office" ? 22 : 26;
  return {
    className: "public-hospital-icon",
    html: healthMarkerHtml(options),
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2],
    tooltipAnchor: [0, -size / 2]
  };
}
