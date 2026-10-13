// อ่านไฟล์ Excel (.xlsx) และ CSV แบบเบา ไม่พึ่งไลบรารีภายนอก — ใช้เฉพาะฝั่งเซิร์ฟเวอร์
// คืนค่าเป็นแผ่นงาน: [{ name, rows: [[cell]] }] โดย cell = string | number | boolean | null
import zlib from "zlib";

export class SpreadsheetError extends Error {
  constructor(message) {
    super(message);
    this.code = "spreadsheet_invalid";
  }
}

const MAX_UNZIPPED_BYTES = 60 * 1024 * 1024;

// ---- zip ----
function readZip(buffer) {
  let end = -1;
  for (let i = buffer.length - 22; i >= Math.max(0, buffer.length - 65557); i -= 1) {
    if (buffer.readUInt32LE(i) === 0x06054b50) { end = i; break; }
  }
  if (end < 0) throw new SpreadsheetError("ไฟล์ไม่ใช่ Excel (.xlsx) ที่ถูกต้อง");
  const count = buffer.readUInt16LE(end + 10);
  let pointer = buffer.readUInt32LE(end + 16);
  const entries = new Map();
  let total = 0;
  for (let i = 0; i < count; i += 1) {
    if (buffer.readUInt32LE(pointer) !== 0x02014b50) throw new SpreadsheetError("โครงสร้างไฟล์ Excel เสียหาย");
    const method = buffer.readUInt16LE(pointer + 10);
    const compressedSize = buffer.readUInt32LE(pointer + 20);
    const size = buffer.readUInt32LE(pointer + 24);
    const nameLength = buffer.readUInt16LE(pointer + 28);
    const extraLength = buffer.readUInt16LE(pointer + 30);
    const commentLength = buffer.readUInt16LE(pointer + 32);
    const localOffset = buffer.readUInt32LE(pointer + 42);
    const name = buffer.toString("utf8", pointer + 46, pointer + 46 + nameLength);
    total += size;
    if (total > MAX_UNZIPPED_BYTES) throw new SpreadsheetError("ไฟล์ใหญ่เกินไป");
    entries.set(name, { method, compressedSize, localOffset });
    pointer += 46 + nameLength + extraLength + commentLength;
  }
  return {
    has: (name) => entries.has(name),
    text(name) {
      const entry = entries.get(name);
      if (!entry) return null;
      const local = entry.localOffset;
      if (buffer.readUInt32LE(local) !== 0x04034b50) throw new SpreadsheetError("โครงสร้างไฟล์ Excel เสียหาย");
      const start = local + 30 + buffer.readUInt16LE(local + 26) + buffer.readUInt16LE(local + 28);
      const raw = buffer.subarray(start, start + entry.compressedSize);
      if (entry.method === 0) return raw.toString("utf8");
      if (entry.method === 8) return zlib.inflateRawSync(raw, { maxOutputLength: MAX_UNZIPPED_BYTES }).toString("utf8");
      throw new SpreadsheetError("ไฟล์ Excel ใช้รูปแบบบีบอัดที่ไม่รองรับ");
    }
  };
}

// ---- xml helpers ----
const ENTITIES = { amp: "&", lt: "<", gt: ">", quot: "\"", apos: "'" };
export function decodeXml(value) {
  return String(value).replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (match, code) => {
    if (code[0] === "#") {
      const point = code[1] === "x" || code[1] === "X" ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(point) ? String.fromCodePoint(point) : match;
    }
    return ENTITIES[code.toLowerCase()] ?? match;
  });
}

const attr = (tag, name) => {
  const found = new RegExp(`\\s${name}="([^"]*)"`).exec(tag);
  return found ? decodeXml(found[1]) : null;
};

// ข้อความใน <si>/<is>: รวมทุก <t> ยกเว้นคำอ่าน (rPh)
function richText(xml) {
  const clean = xml.replace(/<rPh\b[\s\S]*?<\/rPh>/g, "");
  let out = "";
  const re = /<t(?:\s[^>]*)?>([\s\S]*?)<\/t>|<t(?:\s[^>]*)?\/>/g;
  let m;
  while ((m = re.exec(clean))) out += m[1] ? decodeXml(m[1]) : "";
  return out;
}

function columnIndex(ref) {
  const letters = /^[A-Z]+/.exec(ref || "")?.[0] || "";
  let n = 0;
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

function parseSheet(xml, shared) {
  const rows = [];
  const rowRe = /<row\b([^>]*?)(?:\/>|>([\s\S]*?)<\/row>)/g;
  let rowMatch;
  let nextRow = 0;
  while ((rowMatch = rowRe.exec(xml))) {
    const r = Number(attr(rowMatch[1], "r"));
    const rowIndex = Number.isFinite(r) && r > 0 ? r - 1 : nextRow;
    nextRow = rowIndex + 1;
    if (rowIndex > 20000) throw new SpreadsheetError("ไฟล์มีแถวเกิน 20,000 แถว");
    const cells = [];
    const body = rowMatch[2] || "";
    const cellRe = /<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g;
    let cellMatch;
    let nextCol = 0;
    while ((cellMatch = cellRe.exec(body))) {
      const ref = attr(cellMatch[1], "r");
      const col = ref ? columnIndex(ref) : nextCol;
      nextCol = col + 1;
      if (col > 200) continue;
      const type = attr(cellMatch[1], "t");
      const inner = cellMatch[2] || "";
      const v = /<v>([\s\S]*?)<\/v>/.exec(inner)?.[1];
      let value = null;
      if (type === "s") value = v === undefined ? null : shared[Number(v)] ?? null;
      else if (type === "inlineStr") value = richText(inner);
      else if (type === "str") value = v === undefined ? null : decodeXml(v);
      else if (type === "b") value = v === "1";
      else if (type === "e") value = null;
      else if (v !== undefined && v !== "") {
        const number = Number(v);
        value = Number.isFinite(number) ? number : decodeXml(v);
      }
      cells[col] = value;
    }
    rows[rowIndex] = cells;
  }
  for (let i = 0; i < rows.length; i += 1) if (!rows[i]) rows[i] = [];
  return rows;
}

/** อ่าน .xlsx → [{ name, rows }] ตามลำดับแผ่นงานในไฟล์ */
export function readXlsx(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 22) throw new SpreadsheetError("ไฟล์ว่างหรือไม่สมบูรณ์");
  if (buffer.readUInt32LE(0) !== 0x04034b50) {
    if (buffer.readUInt32LE(0) === 0xe011cfd0) throw new SpreadsheetError("ไฟล์ .xls (Excel รุ่นเก่า) ไม่รองรับ — เปิดใน Excel แล้วเลือกบันทึกเป็น .xlsx");
    throw new SpreadsheetError("ไฟล์ไม่ใช่ Excel (.xlsx)");
  }
  const zip = readZip(buffer);
  const workbook = zip.text("xl/workbook.xml");
  if (!workbook) throw new SpreadsheetError("ไม่พบข้อมูลแผ่นงานในไฟล์");
  const rels = zip.text("xl/_rels/workbook.xml.rels") || "";
  const targets = new Map();
  for (const m of rels.matchAll(/<Relationship\b[^>]*>/g)) {
    const id = attr(m[0], "Id");
    const target = attr(m[0], "Target");
    if (id && target) targets.set(id, target.startsWith("/") ? target.slice(1) : `xl/${target.replace(/^\.\//, "")}`);
  }
  const sharedXml = zip.text("xl/sharedStrings.xml") || "";
  const shared = [...sharedXml.matchAll(/<si>([\s\S]*?)<\/si>|<si\/>/g)].map((m) => richText(m[1] || ""));
  const sheets = [];
  let index = 0;
  for (const m of workbook.matchAll(/<sheet\b[^>]*>/g)) {
    index += 1;
    const name = attr(m[0], "name") || `Sheet${index}`;
    const rid = attr(m[0], "r:id");
    const path = (rid && targets.get(rid)) || `xl/worksheets/sheet${index}.xml`;
    const xml = zip.text(path);
    if (xml === null) continue;
    sheets.push({ name, rows: parseSheet(xml, shared) });
  }
  if (!sheets.length) throw new SpreadsheetError("ไม่พบแผ่นงานในไฟล์");
  return sheets;
}

/** อ่าน CSV (คั่นด้วย , หรือ ; รองรับเครื่องหมายคำพูด และ BOM) */
export function readCsv(input) {
  const text = (Buffer.isBuffer(input) ? input.toString("utf8") : String(input)).replace(/^﻿/, "");
  const firstLine = text.split(/\r?\n/, 1)[0] || "";
  const delimiter = (firstLine.match(/;/g) || []).length > (firstLine.match(/,/g) || []).length ? ";" : ",";
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (quoted) {
      if (ch === "\"" && text[i + 1] === "\"") { cell += "\""; i += 1; }
      else if (ch === "\"") quoted = false;
      else cell += ch;
    } else if (ch === "\"" && cell === "") quoted = true;
    else if (ch === delimiter) { row.push(cell); cell = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i += 1;
      row.push(cell); rows.push(row); row = []; cell = "";
      if (rows.length > 20000) throw new SpreadsheetError("ไฟล์มีแถวเกิน 20,000 แถว");
    } else cell += ch;
  }
  if (cell !== "" || row.length) { row.push(cell); rows.push(row); }
  return [{ name: "CSV", rows: rows.map((r) => r.map((value) => (value === "" ? null : value))) }];
}

/** เลือกตัวอ่านตามชนิดไฟล์ */
export function readSpreadsheet(buffer, filename = "") {
  if (/\.csv$/i.test(filename)) return readCsv(buffer);
  if (/\.xls$/i.test(filename)) throw new SpreadsheetError("ไฟล์ .xls (Excel รุ่นเก่า) ไม่รองรับ — เปิดใน Excel แล้วเลือกบันทึกเป็น .xlsx");
  return readXlsx(buffer);
}
