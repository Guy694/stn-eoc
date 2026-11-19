// ค่าคำนวณของแอนิเมชันฝั่งประชาชน (ไม่มี DOM — ทดสอบได้)
// ใช้กับ components/public/motion/* · ทุกแอนิเมชันปิดเมื่อผู้ใช้ตั้ง "ลดการเคลื่อนไหว" หรือเปิดโหมดประหยัดข้อมูล

/** ช้าลงตอนท้าย (นับตัวเลขขึ้นแล้วค่อย ๆ หยุด) */
export function easeOutCubic(progress) {
  const p = Math.min(1, Math.max(0, Number(progress) || 0));
  return 1 - (1 - p) ** 3;
}

/** ค่าระหว่างนับขึ้น ณ ความคืบหน้า 0–1 (ปัดตามจำนวนทศนิยมของค่าปลายทาง) */
export function countUpValue(from, to, progress, decimals = 0) {
  const start = Number(from) || 0;
  const end = Number(to);
  if (!Number.isFinite(end)) return to;
  const value = start + (end - start) * easeOutCubic(progress);
  const factor = 10 ** Math.max(0, decimals);
  return Math.round(value * factor) / factor;
}

/** จำนวนทศนิยมของค่า (12.5 → 1) ใช้ให้ตัวเลขระหว่างนับมีรูปแบบเดียวกับค่าจริง */
export function decimalsOf(value) {
  const text = String(value ?? "");
  if (!/^-?\d+(\.\d+)?$/.test(text)) return 0;
  return (text.split(".")[1] || "").length;
}

/**
 * วงกระเพื่อมของ "ฝนตอนนี้" บนแผนที่ ตามฝน 1 ชม. (มม.) ของสถานีที่ตกหนักสุดในอำเภอ
 * ไม่มีฝน = ไม่แสดง · ยิ่งตกหนัก วงยิ่งมากและกระเพื่อมเร็วขึ้น (เกณฑ์เดียวกับสีแผนที่: 5 / 20 มม.)
 */
export function rainRipple(mm) {
  const value = Number(mm);
  if (!Number.isFinite(value) || value <= 0) return null;
  if (value >= 20) return { rings: 3, durationS: 1.2, level: "heavy" };
  if (value >= 5) return { rings: 2, durationS: 1.8, level: "moderate" };
  return { rings: 1, durationS: 2.6, level: "light" };
}

/** ความกว้างแถบโอกาสฝน (0–100) · ไม่มีข้อมูล = null */
export function rainBarPercent(pct) {
  if (pct === null || pct === undefined || pct === "") return null;
  const value = Number(pct);
  if (!Number.isFinite(value)) return null;
  return Math.min(100, Math.max(0, Math.round(value)));
}

/** เล่นแอนิเมชันได้ไหม (ผู้ใช้ไม่ได้ขอลดการเคลื่อนไหว และไม่ได้เปิดประหยัดข้อมูล) */
export function motionAllowed({ reducedMotion = false, saveData = false } = {}) {
  return !reducedMotion && !saveData;
}
