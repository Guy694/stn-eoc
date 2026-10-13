// แกนกลางการนำเข้าข้อมูลจาก Excel — ไม่แตะฐานข้อมูล ใช้ได้ทั้งเซิร์ฟเวอร์และหน้าเว็บ
// สเปกคอลัมน์: { key, header, required, type, options, ref, max, min, maxValue, example, help, width, aliases }
// type: text | int | number | date | enum | phone | bool

export const DATA_SHEET = "กรอกข้อมูล";
export const HELP_SHEET = "คำอธิบาย";
export const LIST_SHEET = "รายการให้เลือก";
export const MAX_IMPORT_ROWS = 2000;
export const MAX_IMPORT_BYTES = 5 * 1024 * 1024;

export const normalizeKey = (value) => String(value ?? "")
  .replace(/\(.*?\)/g, "")
  .replace(/[*\s._\-/:]/g, "")
  .toLowerCase();

const isBlank = (value) => value === null || value === undefined || String(value).trim() === "";
const clean = (value) => String(value ?? "").replace(/\s+/g, " ").trim();

/** หัวคอลัมน์ที่แสดงในไฟล์: ช่องที่ต้องกรอกมี * ต่อท้าย */
export const headerText = (column) => `${column.header}${column.required ? " *" : ""}`;

/** ค่าที่เลือกได้ของคอลัมน์ (options คงที่ หรือรายการอ้างอิงจากเซิร์ฟเวอร์) */
export function columnOptions(column, refs = {}) {
  if (column.options) return column.options;
  if (column.ref && Array.isArray(refs[column.ref])) return refs[column.ref].map((value) => (typeof value === "object" ? value : { value, label: value }));
  return null;
}

// ---- วันที่ ----
const pad = (n) => String(n).padStart(2, "0");
function validDate(y, m, d) {
  if (y > 2400) y -= 543; // พ.ศ. → ค.ศ.
  if (y < 1990 || y > 2100 || m < 1 || m > 12 || d < 1 || d > 31) return null;
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCMonth() !== m - 1) return null;
  return `${y}-${pad(m)}-${pad(d)}`;
}

/** วันที่จาก Excel (เลขลำดับวัน) หรือข้อความ 13/10/2569, 2026-10-13 → "YYYY-MM-DD" | null */
export function parseDateCell(value) {
  if (isBlank(value)) return null;
  if (typeof value === "number") {
    if (value < 20000 || value > 80000) return null;
    const date = new Date(Date.UTC(1899, 11, 30) + Math.floor(value) * 86400000);
    return validDate(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
  }
  const text = clean(value);
  let m = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/.exec(text);
  if (m) return validDate(Number(m[1]), Number(m[2]), Number(m[3]));
  m = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/.exec(text);
  if (m) return validDate(Number(m[3]), Number(m[2]), Number(m[1]));
  return null;
}

const TRUE_WORDS = new Set(["ใช่", "มี", "y", "yes", "true", "1", "✓", "/", "x"]);
const FALSE_WORDS = new Set(["ไม่", "ไม่ใช่", "ไม่มี", "n", "no", "false", "0", "-"]);

/** แปลงค่าหนึ่งช่องตามชนิดคอลัมน์ → { value } | { error } */
export function convertCell(column, raw, refs = {}) {
  if (isBlank(raw)) {
    if (column.required) return { error: "ต้องกรอก" };
    return { value: column.type === "bool" ? false : null };
  }
  switch (column.type) {
    case "int":
    case "number": {
      const number = typeof raw === "number" ? raw : Number(clean(raw).replace(/,/g, ""));
      if (!Number.isFinite(number)) return { error: "ต้องเป็นตัวเลข" };
      const min = column.min ?? 0;
      if (number < min) return { error: `ต้องไม่น้อยกว่า ${min}` };
      if (column.maxValue !== undefined && number > column.maxValue) return { error: `ต้องไม่เกิน ${column.maxValue.toLocaleString("th-TH")}` };
      if (column.type === "int" && !Number.isInteger(number)) return { error: "ต้องเป็นจำนวนเต็ม" };
      return { value: number };
    }
    case "date": {
      const date = parseDateCell(raw);
      return date ? { value: date } : { error: "วันที่ไม่ถูกต้อง (ใช้ 13/10/2569 หรือ 2026-10-13)" };
    }
    case "phone": {
      let digits = typeof raw === "number" ? String(Math.round(raw)) : clean(raw).replace(/[^\d+]/g, "");
      if (/^[1-9]\d{8}$/.test(digits)) digits = `0${digits}`; // Excel ตัดเลข 0 นำหน้า
      if (digits.replace(/\D/g, "").length < 9) return { error: "เบอร์โทรไม่ครบ" };
      return { value: digits.slice(0, 15) };
    }
    case "bool": {
      const word = clean(raw).toLowerCase();
      if (raw === true || TRUE_WORDS.has(word)) return { value: true };
      if (raw === false || FALSE_WORDS.has(word)) return { value: false };
      return { error: "ใส่ ใช่ หรือ ไม่" };
    }
    case "enum": {
      const options = columnOptions(column, refs) || [];
      const key = normalizeKey(raw);
      const found = options.find((option) => [option.value, option.label, ...(option.aliases || [])].some((name) => normalizeKey(name) === key));
      if (!found) return { error: `ไม่อยู่ในรายการที่เลือกได้ (ดูแผ่นงาน "${LIST_SHEET}")` };
      return { value: found.value };
    }
    default: {
      const text = clean(typeof raw === "number" ? String(raw) : raw);
      if (column.max && text.length > column.max) return { error: `ยาวเกิน ${column.max} ตัวอักษร` };
      return { value: text };
    }
  }
}

/** หาแถวหัวตาราง (ใน 10 แถวแรก) → { index, map: columnKey → ตำแหน่ง } | null */
export function findHeader(rows, columns) {
  const required = columns.filter((column) => column.required);
  for (let r = 0; r < Math.min(rows.length, 10); r += 1) {
    const map = {};
    (rows[r] || []).forEach((cell, c) => {
      const key = normalizeKey(cell);
      if (!key) return;
      const column = columns.find((item) => [item.header, ...(item.aliases || [])].some((name) => normalizeKey(name) === key));
      if (column && map[column.key] === undefined) map[column.key] = c;
    });
    const hits = required.filter((column) => map[column.key] !== undefined).length;
    if (hits && hits >= Math.ceil(required.length / 2)) return { index: r, map };
  }
  return null;
}

/** เลือกแผ่นงานที่มีข้อมูล: ชื่อ "กรอกข้อมูล" ก่อน ไม่งั้นแผ่นแรกที่หาหัวตารางเจอ */
export function pickSheet(sheets, columns) {
  const named = sheets.find((sheet) => sheet.name.trim() === DATA_SHEET);
  const ordered = named ? [named, ...sheets.filter((sheet) => sheet !== named)] : sheets;
  for (const sheet of ordered) {
    const header = findHeader(sheet.rows, columns);
    if (header) return { sheet, header };
  }
  return null;
}

/**
 * แปลงแผ่นงาน → แถวข้อมูล พร้อมข้อผิดพลาดรายช่อง
 * คืน { error } เมื่อหาหัวตารางไม่เจอ หรือ { rows: [{ row, values, errors: [{ column, message }] }], missing: [header] }
 */
export function parseRows(sheets, spec, refs = {}) {
  const picked = pickSheet(sheets, spec.columns);
  if (!picked) {
    return { error: `ไม่พบหัวคอลัมน์ที่ระบบรู้จัก — ใช้ไฟล์ตัวอย่างของหน้านี้ และอย่าแก้ชื่อหัวคอลัมน์ (ต้องมี ${spec.columns.filter((c) => c.required).map((c) => c.header).join(", ")})` };
  }
  const { sheet, header } = picked;
  const missing = spec.columns.filter((column) => column.required && header.map[column.key] === undefined).map((column) => column.header);
  if (missing.length) return { error: `ไฟล์ขาดคอลัมน์ที่ต้องมี: ${missing.join(", ")}` };
  const rows = [];
  for (let r = header.index + 1; r < sheet.rows.length; r += 1) {
    const cells = sheet.rows[r] || [];
    const used = spec.columns.filter((column) => header.map[column.key] !== undefined);
    if (used.every((column) => isBlank(cells[header.map[column.key]]))) continue;
    if (rows.length >= MAX_IMPORT_ROWS) return { error: `นำเข้าได้ครั้งละไม่เกิน ${MAX_IMPORT_ROWS.toLocaleString("th-TH")} แถว — แบ่งไฟล์แล้วนำเข้าทีละส่วน` };
    const values = {};
    const errors = [];
    for (const column of spec.columns) {
      const position = header.map[column.key];
      const result = convertCell(column, position === undefined ? null : cells[position], refs);
      if (result.error) errors.push({ column: column.header, message: result.error });
      else values[column.key] = result.value;
    }
    rows.push({ row: r + 1, values, errors });
  }
  if (!rows.length) return { error: `ไม่พบข้อมูลในแผ่นงาน "${sheet.name}" (มีแต่หัวคอลัมน์)` };
  return { rows, sheetName: sheet.name };
}

/** สรุปผลตรวจ: จำนวนแถวที่ใช้ได้ / มีปัญหา + รายการปัญหา (ตัดที่ 200 รายการ) */
export function summarizeCheck(rows) {
  const bad = rows.filter((row) => row.errors.length);
  const problems = bad.flatMap((row) => row.errors.map((error) => ({ row: row.row, column: error.column, message: error.message })));
  return { total: rows.length, valid: rows.length - bad.length, invalid: bad.length, problems: problems.slice(0, 200), more_problems: Math.max(0, problems.length - 200) };
}

/** โครงไฟล์ตัวอย่าง (ส่งให้ buildXlsx): คำอธิบาย → กรอกข้อมูล → รายการให้เลือก */
export function templateSheets(spec, refs = {}) {
  const columns = spec.columns;
  const enumColumns = columns.filter((column) => columnOptions(column, refs)?.length);
  const listColumns = enumColumns.map((column) => ({ column, values: columnOptions(column, refs).map((option) => option.label ?? option.value) }));
  const lastRow = MAX_IMPORT_ROWS + 1;
  const colName = (i) => {
    let name = "";
    let n = i + 1;
    while (n > 0) { const rem = (n - 1) % 26; name = String.fromCharCode(65 + rem) + name; n = Math.floor((n - 1) / 26); }
    return name;
  };
  const quotedList = `'${LIST_SHEET}'`;

  const help = [
    [{ v: spec.title, s: "title" }],
    [{ v: spec.summary, s: "subtitle" }],
    [],
    [{ v: "วิธีใช้", s: "header" }],
    ...[
      `1. ไปที่แผ่นงาน "${DATA_SHEET}" (แท็บด้านล่าง) แล้วกรอก ${spec.unit}`,
      "2. หัวคอลัมน์สีส้มและมี * คือช่องที่ต้องกรอก ห้ามแก้ชื่อหัวคอลัมน์ ลบคอลัมน์ที่ไม่ใช้ไม่ได้ แต่เว้นว่างได้",
      `3. ช่องที่มีรายการให้เลือก คลิกช่องแล้วกดลูกศรเลือก หรือพิมพ์ให้ตรงกับแผ่นงาน "${LIST_SHEET}"`,
      "4. บันทึกเป็น .xlsx แล้วกด \"นำเข้า Excel\" ในหน้าเดียวกับที่ดาวน์โหลดไฟล์นี้",
      "5. ระบบจะตรวจทุกแถวและบอกแถวที่มีปัญหาก่อน ยังไม่บันทึกจนกว่าจะกดยืนยัน"
    ].map((line) => [{ v: line, s: "default" }]),
    [],
    [{ v: "คอลัมน์", s: "header" }, { v: "ต้องกรอก", s: "header" }, { v: "วิธีกรอก", s: "header" }, { v: "ตัวอย่าง", s: "header" }],
    ...columns.map((column) => [
      { v: column.header, s: "body" },
      { v: column.required ? "ต้องกรอก" : "ไม่บังคับ", s: "body" },
      { v: column.help || "", s: "body" },
      { v: column.example ?? "", s: "body" }
    ]),
    [],
    [{ v: "ถ้านำเข้าซ้ำหรือข้อมูลมีอยู่แล้ว", s: "header" }],
    ...(spec.notes || []).map((line) => [{ v: `• ${line}`, s: "default" }])
  ];

  const data = {
    name: DATA_SHEET,
    rows: [columns.map((column) => ({ v: headerText(column), s: column.required ? "required" : "header" }))],
    cols: columns.map((column) => column.width || 16),
    textCols: columns.map((column, index) => (["phone", "text"].includes(column.type) ? index : -1)).filter((index) => index >= 0),
    freezeRows: 1,
    validations: listColumns.map(({ column, values }, listIndex) => {
      const index = columns.indexOf(column);
      return {
        range: `${colName(index)}2:${colName(index)}${lastRow}`,
        source: `${quotedList}!$${colName(listIndex)}$2:$${colName(listIndex)}$${values.length + 1}`,
        promptTitle: column.header,
        prompt: column.help
      };
    })
  };

  const listRows = [listColumns.map(({ column }) => ({ v: column.header, s: "header" }))];
  const longest = Math.max(0, ...listColumns.map(({ values }) => values.length));
  for (let i = 0; i < longest; i += 1) listRows.push(listColumns.map(({ values }) => (values[i] === undefined ? null : { v: values[i], s: "body" })));

  return [
    { name: HELP_SHEET, rows: help, cols: [26, 12, 70, 24] },
    data,
    { name: LIST_SHEET, rows: listRows, cols: listColumns.map(() => 30), freezeRows: 1 }
  ];
}
