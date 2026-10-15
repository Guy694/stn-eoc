// อ่านไฟล์ข้อมูลยาที่ส่งออกจากระบบคลังยาของโรงพยาบาล (รูปแบบ DRUGLIST / INVENTORY / RECEIPT / DISTRIBUTION)
// ไม่มีการเรียกเครือข่ายในไฟล์นี้ ใช้ได้ทั้งฝั่งเบราว์เซอร์ (ตรวจไฟล์ก่อนส่ง) และฝั่งเซิร์ฟเวอร์

export const HOSPITAL_FILE_KINDS = {
  DRUGLIST: { label: "รายการยา", use: "ชื่อสามัญ หน่วยนับ บัญชียาหลัก" },
  INVENTORY: { label: "ยาคงคลังรายล็อต", use: "ยอดคงคลังและวันหมดอายุ" },
  RECEIPT: { label: "การรับยา", use: "ยอดรับรายเดือน" },
  DISTRIBUTION: { label: "การจ่ายยา", use: "ยอดใช้รายเดือน → อัตราใช้ปกติต่อวัน" }
};

// คำค้นยาจำเป็นช่วงอุทกภัย (ใช้ติ๊กให้อัตโนมัติ ทีมเลือกเพิ่ม/ลดเองได้)
export const ESSENTIAL_DRUG_KEYWORDS = [
  "doxycycline", "amoxicillin", "amoxycillin", "paracetamol", "ors", "oral rehydration", "electrolyte",
  "povidone", "chlorhexidine", "alcohol 70", "normal saline", "nss", "ringer", "dextrose", "glucose 50",
  "insulin", "metformin", "glipizide", "amlodipine", "enalapril", "losartan", "hydrochlorothiazide", "simvastatin",
  "salbutamol", "budesonide", "prednisolone", "dexamethasone", "adrenaline", "epinephrine",
  "chlorpheniramine", "cetirizine", "loratadine", "hydroxyzine", "calamine",
  "clotrimazole", "whitfield", "ketoconazole", "miconazole", "silver sulfadiazine", "mupirocin", "fusidic",
  "tetanus", "antivenom", "antivenin", "serum", "ceftriaxone", "cloxacillin", "dicloxacillin", "norfloxacin", "ciprofloxacin",
  "omeprazole", "antacid", "simethicone", "domperidone", "loperamide", "zinc",
  "diazepam", "tramadol", "ibuprofen", "diclofenac", "vitamin b"
];

const text = (value, max = 255) => String(value ?? "").replace(/\s+/g, " ").trim().slice(0, max);
const num = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};
const round2 = (value) => Math.round(value * 100) / 100;

/** "20280117" หรือ "20251003143334" → "2028-01-17" */
export function ymdToIso(value) {
  const match = /^(\d{4})(\d{2})(\d{2})/.exec(String(value || "").trim());
  if (!match) return null;
  const [, y, m, d] = match;
  if (Number(m) < 1 || Number(m) > 12 || Number(d) < 1 || Number(d) > 31) return null;
  return `${y}-${m}-${d}`;
}

export function daysInPeriod(period) {
  const match = /^(\d{4})(\d{2})$/.exec(String(period || ""));
  if (!match) return 30;
  return new Date(Date.UTC(Number(match[1]), Number(match[2]), 0)).getUTCDate();
}

export function periodLabel(period) {
  const match = /^(\d{4})(\d{2})$/.exec(String(period || ""));
  if (!match) return String(period || "");
  const months = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
  return `${months[Number(match[2]) - 1]} ${Number(match[1]) + 543}`;
}

/**
 * ถอดข้อความจากไฟล์: UTF-8 ก่อน ถ้าไม่ใช่ UTF-8 ใช้ TIS-620 (windows-874)
 * garbled = มีอักขระ � อยู่แล้วในไฟล์ (ภาษาไทยเสียตั้งแต่ตอนส่งออก กู้คืนไม่ได้)
 */
export function decodeHospitalFile(bytes) {
  const data = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let content;
  let encoding = "utf-8";
  try {
    content = new TextDecoder("utf-8", { fatal: true }).decode(data);
  } catch {
    content = new TextDecoder("windows-874").decode(data);
    encoding = "tis-620";
  }
  if (content.charCodeAt(0) === 0xfeff) content = content.slice(1);
  return { text: content, encoding, garbled: content.includes("�") };
}

export function isGarbled(value) {
  return String(value || "").includes("�");
}

function detectKind(record) {
  if (!record || typeof record !== "object") return null;
  if ("QTY_ONHAND" in record) return "INVENTORY";
  if ("QTY_RCV" in record) return "RECEIPT";
  if ("QTY_DIS" in record) return "DISTRIBUTION";
  if ("GENERIC_NAME" in record) return "DRUGLIST";
  return null;
}

// ชื่อไฟล์แบบ Download_INVENTORY_EA0010746_... ช่วยยืนยันชนิดเมื่อไฟล์ว่าง
function kindFromFilename(filename) {
  const match = /(DRUGLIST|INVENTORY|RECEIPT|DISTRIBUTION)/i.exec(String(filename || ""));
  return match ? match[1].toUpperCase() : null;
}

function normalizeRecord(kind, record) {
  const workingCode = text(record.WORKING_CODE, 40);
  if (!workingCode) return null;
  const packSize = num(record.PACK_SIZE) || 1;
  const base = {
    working_code: workingCode,
    hosp_code: text(record.HOSP_CODE, 20),
    unit: text(record.BASE_UNIT, 40),
    tpuid: text(record.TPUID, 20)
  };
  if (kind === "DRUGLIST") {
    return { ...base, generic_name: text(record.GENERIC_NAME), nlem: text(record.NLEM, 4), status: text(record.STATUS, 4), period: text(record.PERIOD_RPT, 6) };
  }
  if (kind === "INVENTORY") {
    const qty = num(record.QTY_ONHAND);
    if (qty === null) return null;
    return {
      ...base,
      trade_name: text(record.TRADE_NAME),
      lot_no: text(record.LOT_NO, 60),
      expire_date: ymdToIso(record.EXPIRE_DATE),
      onhand_date: ymdToIso(record.DATE_ONHAND),
      qty: round2(qty * packSize), // QTY_ONHAND นับเป็นแพ็ก (ส่วนใหญ่ PACK_SIZE = 1)
      value: num(record.VALUE_ONHAND),
      unit_cost: packSize > 0 && num(record.PACK_COST) !== null ? round2(num(record.PACK_COST) / packSize) : null
    };
  }
  if (kind === "RECEIPT") {
    const qty = num(record.QTY_RCV);
    if (qty === null) return null;
    return {
      ...base,
      trade_name: text(record.TRADE_NAME),
      period: text(record.PERIOD_RPT, 6),
      received_date: ymdToIso(record.DATE_RCV),
      lot_no: text(record.LOT_NO, 60),
      expire_date: ymdToIso(record.EXPIRE_DATE),
      qty: round2(qty * packSize), // QTY_RCV นับเป็นแพ็ก × PACK_SIZE = หน่วยนับย่อย
      value: num(record.TOTAL_VALUE)
    };
  }
  if (kind === "DISTRIBUTION") {
    const qty = num(record.QTY_DIS);
    if (qty === null) return null;
    return {
      ...base,
      trade_name: text(record.TRADE_NAME),
      period: text(record.PERIOD_RPT, 6),
      dept_group: text(record.DIS_DEPT_GROUP, 10),
      qty: round2(qty * packSize),
      value: num(record.VALUE)
    };
  }
  return null;
}

/** แปลงข้อความในไฟล์ 1 ไฟล์ (JSON แบบแบ่งหน้า {content: []} หรือ array ตรง ๆ หรือ JSON ทีละบรรทัด) */
export function parseHospitalFile(content, filename = "") {
  let json = null;
  const trimmed = String(content || "").trim();
  try {
    json = JSON.parse(trimmed);
  } catch {
    const lines = trimmed.split(/\r?\n/).filter(Boolean);
    try {
      json = lines.map((line) => JSON.parse(line));
    } catch {
      return { filename, error: "อ่านไฟล์ไม่ได้ ต้องเป็นไฟล์ข้อมูลยาแบบ JSON ที่ส่งออกจากระบบคลังยา" };
    }
  }
  const records = Array.isArray(json) ? json : Array.isArray(json?.content) ? json.content : Array.isArray(json?.data) ? json.data : null;
  if (!records) return { filename, error: "ไม่พบรายการข้อมูลในไฟล์" };
  const kind = detectKind(records[0]) || kindFromFilename(filename);
  if (!kind) return { filename, error: "ไม่รู้จักชนิดไฟล์ (ต้องเป็น DRUGLIST, INVENTORY, RECEIPT หรือ DISTRIBUTION)" };
  const rows = records.map((record) => normalizeRecord(kind, record)).filter(Boolean);
  const hospCodes = [...new Set(rows.map((row) => row.hosp_code).filter(Boolean))];
  const paged = !Array.isArray(json) && Number.isFinite(Number(json?.totalPages));
  return {
    filename,
    kind,
    rows,
    hospCodes,
    skipped: records.length - rows.length,
    page: paged ? Number(json.number ?? json.pageable?.pageNumber ?? 0) : null,
    totalPages: paged ? Number(json.totalPages) : null,
    totalElements: paged ? Number(json.totalElements) : null,
    garbled: rows.some((row) => Object.values(row).some(isGarbled))
  };
}

export function isEssentialDrug(name) {
  const lower = String(name || "").toLowerCase();
  return ESSENTIAL_DRUG_KEYWORDS.some((keyword) => lower.includes(keyword));
}

/**
 * รวมหลายไฟล์ (หลายชนิด/หลายหน้า) ของโรงพยาบาลเดียว → รายการยาตาม WORKING_CODE
 * พร้อมยอดคงคลัง ล็อต วันหมดอายุใกล้สุด และยอดรับ/จ่ายรายเดือน
 */
export function mergeHospitalFiles(parsedFiles = []) {
  const warnings = [];
  const errors = parsedFiles.filter((file) => file.error).map((file) => `${file.filename}: ${file.error}`);
  const files = parsedFiles.filter((file) => !file.error);
  const hospCodes = [...new Set(files.flatMap((file) => file.hospCodes))];
  if (hospCodes.length > 1) warnings.push(`ไฟล์มาจากหลายโรงพยาบาล (${hospCodes.join(", ")}) — นำเข้าทีละโรงพยาบาล`);

  // หน้าซ้ำ (ไฟล์เดียวกันเลือกซ้ำ) ใช้ครั้งเดียว · ตรวจว่าได้ครบทุกหน้าหรือไม่
  const pages = new Map();
  const used = [];
  for (const file of files) {
    const key = file.page !== null ? `${file.kind}|${file.page}|${file.totalElements}` : `${file.kind}|${file.filename}|${file.rows.length}`;
    if (pages.has(key)) { warnings.push(`${file.filename} ซ้ำกับ ${pages.get(key)} ใช้ข้อมูลครั้งเดียว`); continue; }
    pages.set(key, file.filename);
    used.push(file);
  }
  const coverage = {};
  for (const file of used) {
    const entry = coverage[file.kind] || { kind: file.kind, files: 0, rows: 0, pages: new Set(), totalPages: null, totalElements: null };
    entry.files += 1;
    entry.rows += file.rows.length;
    if (file.page !== null) entry.pages.add(file.page);
    entry.totalPages = file.totalPages ?? entry.totalPages;
    entry.totalElements = file.totalElements ?? entry.totalElements;
    coverage[file.kind] = entry;
  }
  const kinds = Object.values(coverage).map((entry) => {
    const partial = entry.totalPages !== null && entry.pages.size < entry.totalPages;
    if (partial) warnings.push(`${HOSPITAL_FILE_KINDS[entry.kind].label}: ได้ ${entry.pages.size} จาก ${entry.totalPages} หน้า (${entry.rows.toLocaleString("th-TH")} จาก ${Number(entry.totalElements).toLocaleString("th-TH")} รายการ) ยอดของยาที่อยู่ในหน้าที่ขาดจะไม่ครบ`);
    return { kind: entry.kind, label: HOSPITAL_FILE_KINDS[entry.kind].label, files: entry.files, rows: entry.rows, partial, pages: entry.pages.size, totalPages: entry.totalPages, totalElements: entry.totalElements };
  });
  if (used.some((file) => file.garbled)) warnings.push("ภาษาไทยในไฟล์เสียหายตั้งแต่ตอนส่งออก (แสดงเป็น �) ระบบใช้รหัสยาและชื่อภาษาอังกฤษแทน ควรส่งออกไฟล์ใหม่ให้ภาษาไทยถูกต้อง");

  const items = new Map();
  const item = (row) => {
    if (!items.has(row.working_code)) {
      items.set(row.working_code, {
        working_code: row.working_code, generic_name: "", trade_name: "", unit: "", nlem: "", tpuid: row.tpuid || "",
        onhand: null, onhand_date: null, value: 0, lots: [], usage: new Map(), receivedByDate: {}
      });
    }
    return items.get(row.working_code);
  };
  const setUnit = (target, unit) => {
    if (unit && unit !== "-" && (!target.unit || (isGarbled(target.unit) && !isGarbled(unit)))) target.unit = unit;
  };
  const byKind = (kind) => used.filter((file) => file.kind === kind).flatMap((file) => file.rows);

  for (const row of byKind("DRUGLIST")) {
    const target = item(row);
    target.generic_name = row.generic_name;
    target.nlem = row.nlem;
    setUnit(target, row.unit);
  }
  // ยอดคงคลังใช้วันที่ล่าสุดในไฟล์เท่านั้น (กันไฟล์หลายวันมาบวกกัน)
  const inventory = byKind("INVENTORY");
  const latestOnhand = inventory.map((row) => row.onhand_date).filter(Boolean).sort().pop() || null;
  const onhandDates = [...new Set(inventory.map((row) => row.onhand_date).filter(Boolean))];
  if (onhandDates.length > 1) warnings.push(`ยอดคงคลังมีหลายวันที่ (${onhandDates.join(", ")}) ใช้วันล่าสุด ${latestOnhand}`);
  const lotSeen = new Set();
  for (const row of inventory) {
    if (latestOnhand && row.onhand_date && row.onhand_date !== latestOnhand) continue;
    const key = `${row.working_code}|${row.lot_no}|${row.expire_date}|${row.qty}`;
    if (lotSeen.has(key)) continue;
    lotSeen.add(key);
    const target = item(row);
    if (!target.trade_name) target.trade_name = row.trade_name;
    setUnit(target, row.unit);
    target.onhand = round2((target.onhand || 0) + row.qty);
    target.onhand_date = latestOnhand;
    target.value = round2(target.value + (row.value || 0));
    target.lots.push({ lot_no: row.lot_no, expire_date: row.expire_date, qty: row.qty, value: row.value, unit_cost: row.unit_cost });
  }
  for (const kind of ["RECEIPT", "DISTRIBUTION"]) {
    for (const row of byKind(kind)) {
      const target = item(row);
      if (!target.trade_name) target.trade_name = row.trade_name;
      setUnit(target, row.unit);
      const period = row.period || "";
      const entry = target.usage.get(period) || { period, used: 0, received: 0 };
      if (kind === "RECEIPT") {
        entry.received = round2(entry.received + row.qty);
        if (row.received_date) target.receivedByDate[row.received_date] = round2((target.receivedByDate[row.received_date] || 0) + row.qty);
      }
      else entry.used = round2(entry.used + row.qty);
      target.usage.set(period, entry);
    }
  }

  const list = [...items.values()].map((entry) => {
    const name = (!isGarbled(entry.generic_name) && entry.generic_name) || entry.trade_name || entry.generic_name || entry.working_code;
    const lots = entry.lots.sort((a, b) => String(a.expire_date || "9999").localeCompare(String(b.expire_date || "9999")));
    const usage = [...entry.usage.values()].sort((a, b) => b.period.localeCompare(a.period)).map((month) => ({
      ...month,
      days: daysInPeriod(month.period),
      avg_daily: round2(month.used / daysInPeriod(month.period))
    }));
    return {
      working_code: entry.working_code,
      name: name.slice(0, 255),
      generic_name: entry.generic_name,
      trade_name: entry.trade_name,
      unit: (entry.unit && !isGarbled(entry.unit) ? entry.unit : "หน่วย").slice(0, 40),
      unit_garbled: isGarbled(entry.unit),
      nlem: entry.nlem,
      onhand: entry.onhand,
      onhand_date: entry.onhand_date,
      value: entry.value,
      lots,
      nearest_expiry: lots.find((lot) => lot.expire_date)?.expire_date || null,
      usage,
      received_by_date: entry.receivedByDate,
      essential: isEssentialDrug(`${entry.generic_name} ${entry.trade_name}`)
    };
  }).sort((a, b) => Number(b.essential) - Number(a.essential) || a.name.localeCompare(b.name));

  const inventoryKind = kinds.find((kind) => kind.kind === "INVENTORY");
  return {
    hospCode: hospCodes[0] || "", hospCodes, kinds, warnings, errors, onhandDate: latestOnhand, items: list,
    inventoryComplete: Boolean(inventoryKind && !inventoryKind.partial)
  };
}

/** ข้อมูลที่ส่งไปบันทึก (เฉพาะรายการที่เลือก ตัดฟิลด์ที่ไม่ใช้) */
export function buildImportPayload(merged, selectedCodes) {
  const chosen = new Set(selectedCodes);
  return merged.items.filter((entry) => chosen.has(entry.working_code)).map((entry) => ({
    working_code: entry.working_code,
    name: entry.name,
    unit: entry.unit,
    onhand: entry.onhand,
    received_on: merged.onhandDate ? entry.received_by_date?.[merged.onhandDate] || 0 : 0,
    lots: entry.lots.map((lot) => ({ lot_no: lot.lot_no, expire_date: lot.expire_date, qty: lot.qty, value: lot.value })),
    usage: entry.usage.map((month) => ({ period: month.period, used: month.used, received: month.received }))
  }));
}

/** วันหมดอายุ → กลุ่มความเร่งด่วน */
export function expiryStatus(expireDate, today) {
  if (!expireDate) return null;
  const diff = Math.round((Date.parse(`${expireDate}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86400000);
  if (diff < 0) return { key: "expired", label: "หมดอายุแล้ว", days: diff };
  if (diff <= 90) return { key: "within90", label: "หมดอายุใน 3 เดือน", days: diff };
  if (diff <= 180) return { key: "within180", label: "หมดอายุใน 6 เดือน", days: diff };
  return { key: "ok", label: "", days: diff };
}
