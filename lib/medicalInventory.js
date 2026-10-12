// ตรรกะคลังเวชภัณฑ์ที่ไม่แตะฐานข้อมูล (ทดสอบได้): ระดับคงเหลือ และการคำนวณรับเข้า/เบิกจ่าย

export const MOVEMENT_TYPES = {
  receive: "รับเข้า",
  issue: "เบิกจ่าย",
  adjust: "ปรับยอด (ตรวจนับ)"
};

const num = (value) => {
  const parsed = Number(String(value ?? "").replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
};

/** ใกล้หมด = เหลือไม่ถึง 20% ของยอดที่มีทั้งหมด (ยกมา + รับเข้า) */
export const LOW_STOCK_RATIO = 0.2;

export function stockLevel(row) {
  if (row?.data_status === "not_recorded") return "unknown";
  const balance = num(row?.balance_qty);
  const available = num(row?.opening_qty) + num(row?.received_qty);
  if (balance <= 0) return "out";
  if (available > 0 && balance / available < LOW_STOCK_RATIO) return "low";
  return "ok";
}

export const STOCK_LEVEL_LABELS = {
  out: { label: "หมด", tone: "red" },
  low: { label: "ใกล้หมด", tone: "amber" },
  ok: { label: "พอใช้", tone: "green" },
  unknown: { label: "ยังไม่รายงาน", tone: "gray" }
};

export function summarizeStock(rows) {
  const summary = { rows: rows.length, items: new Set(), agencies: new Set(), out: 0, low: 0, unknown: 0, received_qty: 0, issued_qty: 0, balance_qty: 0 };
  for (const row of rows) {
    summary.items.add(row.item_code);
    summary.agencies.add(row.health_facility_id || row.inventory_agency_id);
    const level = stockLevel(row);
    if (level === "out") summary.out += 1;
    if (level === "low") summary.low += 1;
    if (level === "unknown") summary.unknown += 1;
    summary.received_qty += num(row.received_qty);
    summary.issued_qty += num(row.issued_qty);
    summary.balance_qty += num(row.balance_qty);
  }
  return { ...summary, items: summary.items.size, agencies: summary.agencies.size };
}

/**
 * คำนวณยอดใหม่หลังรับเข้า/เบิกจ่าย/ปรับยอด
 * adjust: qty คือ "ยอดคงเหลือที่นับได้จริง"
 */
export function applyMovement(stock, type, qtyInput) {
  const qty = num(qtyInput);
  if (!MOVEMENT_TYPES[type]) return { ok: false, error: "ประเภทการเคลื่อนไหวไม่ถูกต้อง" };
  if (type === "adjust" ? qty < 0 : qty <= 0) return { ok: false, error: "จำนวนต้องมากกว่า 0" };
  const before = num(stock.balance_qty);
  const next = { received_qty: num(stock.received_qty), issued_qty: num(stock.issued_qty), balance_qty: before };
  if (type === "receive") {
    next.received_qty += qty;
    next.balance_qty = before + qty;
  } else if (type === "issue") {
    if (qty > before) return { ok: false, error: `เบิกได้ไม่เกินยอดคงเหลือ (${before.toLocaleString("th-TH")} ${stock.unit || ""})`.trim() };
    next.issued_qty += qty;
    next.balance_qty = before - qty;
  } else {
    next.balance_qty = qty;
  }
  return { ok: true, before, after: next.balance_qty, movementQty: type === "adjust" ? Math.abs(qty - before) : qty, next };
}

/** แปลงชื่อรายการเป็นรหัส (กรณีไม่ระบุรหัส) */
/** รหัสที่ผู้ใช้กรอกเอง (ไม่ใช่รหัสที่ระบบสร้างจากชื่อ) — ใช้ตัดสินว่าควรแสดงรหัสหรือไม่ */
export function displayItemCode(row) {
  const code = String(row?.item_code || "").trim();
  if (!code || code === normalizeItemCode("", row?.item_name)) return "";
  return code;
}

export function normalizeItemCode(code, name) {
  const base = String(code || "").trim() || String(name || "").trim();
  return base.toUpperCase().replace(/\s+/g, "_").slice(0, 80);
}

// รายการมาตรฐานกรณีอุทกภัย (ตามแบบรายงานคงคลังของกลุ่มภารกิจ Logistic สสจ.สตูล)
export const FLOOD_PRESET_ITEMS = [
  { item_code: "FLOOD_RELIEF_KIT", item_name: "ชุดยาช่วยเหลือผู้ประสบภัย", unit: "ชุด" },
  { item_code: "HOSPITAL_KIT", item_name: "ชุดยาจัดเอง (โรงพยาบาล)", unit: "ชุด" },
  { item_code: "FOOT_MED", item_name: "ยาน้ำกัดเท้า (Whitfield + บาทาพิทักษ์)", unit: "ชุด" },
  { item_code: "DOXYCYCLINE_100", item_name: "ยา Doxycycline 100 mg", unit: "เม็ด" },
  { item_code: "RUBBER_BOOTS", item_name: "รองเท้าบูท", unit: "คู่" },
  { item_code: "ANTIVENOM_COBRA", item_name: "Serum งูเห่า", unit: "ขวด" },
  { item_code: "ANTIVENOM_MALAYAN_PIT_VIPER", item_name: "Serum งูกะปะ", unit: "ขวด" },
  { item_code: "MEDICAL_GLOVES", item_name: "ถุงมือยางทางการแพทย์", unit: "คู่" },
  { item_code: "FACE_MASK", item_name: "หน้ากากอนามัย", unit: "ชิ้น" },
  { item_code: "LIFE_JACKET", item_name: "เสื้อชูชีพ", unit: "ตัว" }
];

/** รายการมาตรฐานที่หน่วยบริการยังไม่มีในบัญชีคลัง */
export function missingPresetItems(existingCodes = []) {
  const have = new Set(existingCodes.map((code) => normalizeItemCode(code)));
  return FLOOD_PRESET_ITEMS.filter((item) => !have.has(item.item_code));
}
