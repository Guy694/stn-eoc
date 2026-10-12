// รายงานรูปแบบเดียวกับ Google Sheet "รายงานเตรียมความพร้อมรับมืออุทกภัย" ของ สสจ.สตูล (ไม่แตะฐานข้อมูล ทดสอบได้)
// รับข้อมูลที่โหลดแล้ว (lib/sheetExportData.js) → รายการแผ่นงานสำหรับ lib/xlsxWriter.js
// ไม่รวมแท็บข้อมูลรายบุคคล (หญิงตั้งครรภ์/ผู้ป่วยฟอกไต) เพราะเป็นข้อมูลส่วนบุคคล
import { columnName } from "@/lib/xlsxWriter";
import { floodLevelRank } from "@/lib/areaRisk";
import { oxygenDays } from "@/lib/liquidOxygen";
import { FLOOD_PRESET_ITEMS } from "@/lib/medicalInventory";
import { summarizeRecovery, tambonRecovery } from "@/lib/tambonRecovery";
import { TEAM_REPORT_TYPES, parseMetrics } from "@/lib/teamDailyReports";

// ลำดับอำเภอตามชีตของหน่วยงาน
export const SHEET_DISTRICTS = ["เมืองสตูล", "ควนโดน", "ควนกาหลง", "ท่าแพ", "ละงู", "ทุ่งหว้า", "มะนัง"];

const n = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};
const dk = (name) => String(name || "").trim().replace(/^(อำเภอ|อ\.)\s*/, "").replace(/^สตูล$/, "เมืองสตูล").trim();
export const thaiDate = (value) => {
  if (!value) return "";
  const date = new Date(`${String(value).slice(0, 10)}T00:00:00`);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" });
};
const H = (v) => ({ v, s: "header" });
const T = (v) => (typeof v === "number" ? { v, s: "total" } : { v, s: "totalText" });

/**
 * โครงตารางมาตรฐาน: ชื่อ → คำอธิบาย → หัวตาราง (หลายแถว รวมเซลล์ได้) → ข้อมูล → แถวรวม → หมายเหตุ
 * header: แถวของ { label, span = 1, rowSpan = 1 } (เซลล์ที่ถูกรวมให้ข้ามเอง)
 */
export function makeTable({ name, title, subtitle, header, rows, total, notes = [], cols }) {
  const width = Math.max(...header.map((row) => row.reduce((sum, cell) => sum + (cell.span || 1), 0)));
  const out = [[{ v: title, s: "title" }], [{ v: subtitle, s: "subtitle" }]];
  const merges = [];
  const start = out.length;
  const grid = header.map(() => Array(width).fill(undefined));
  header.forEach((row, r) => {
    let c = 0;
    for (const cell of row) {
      while (grid[r][c] !== undefined) c += 1;
      const span = cell.span || 1;
      const rowSpan = cell.rowSpan || 1;
      for (let rr = r; rr < r + rowSpan; rr += 1) for (let cc = c; cc < c + span; cc += 1) grid[rr][cc] = H("");
      grid[r][c] = H(cell.label);
      if (span > 1 || rowSpan > 1) merges.push(`${columnName(c)}${start + r + 1}:${columnName(c + span - 1)}${start + r + rowSpan}`);
      c += span;
    }
  });
  out.push(...grid.map((row) => row.map((cell) => cell || H(""))));
  out.push(...rows);
  if (total) out.push(total.map(T));
  for (const note of notes) out.push([{ v: note, s: "note" }]);
  return { name, rows: out, merges, cols: cols || Array(width).fill(12), freezeRows: start + header.length };
}

const sumBy = (rows, key) => rows.reduce((sum, row) => sum + n(row[key]), 0);
// แถวรวม: คอลัมน์ที่ไม่มีตัวเลขเลยเว้นว่าง (ไม่แสดง 0 ปลอม)
const totalRow = (label, rows, width) => [label, ...Array.from({ length: width - 1 }, (_, i) => {
  const values = rows.map((row) => row[i + 1]).filter((value) => typeof value === "number");
  return values.length ? values.reduce((a, b) => a + b, 0) : null;
})];

// 1) กลุ่มเปราะบาง (พื้นที่)
const SHEET_GROUPS = [
  { label: "หญิงตั้งครรภ์", keys: ["pregnant"] },
  { label: "ติดบ้าน/ติดเตียง", keys: ["bedridden"] },
  { label: "เด็ก (0-5)", keys: ["children"] },
  { label: "โรคเรื้อรัง", keys: ["chronic_illness"] },
  { label: "จิตเวช", keys: ["psychiatric"] },
  { label: "ผู้ป่วยฟอกไต", keys: ["dialysis_hd", "dialysis_pd"] },
  { label: "ผู้พิการ", keys: ["disabled"] },
  { label: "ผู้สูงอายุ", keys: ["elderly"] }
];
function vulnerableSheet(data, meta) {
  const sumKeys = (rows, keys) => rows.reduce((sum, row) => sum + keys.reduce((s, key) => s + n(row[key]), 0), 0);
  const rows = SHEET_DISTRICTS.map((district) => {
    const base = (data.vulnerableBaseline || []).filter((row) => dk(row.district) === district);
    const event = (data.vulnerableEvent || []).filter((row) => dk(row.district) === district);
    const cells = [district];
    let affected = 0;
    for (const group of SHEET_GROUPS) {
      const hit = sumKeys(event, group.keys);
      affected += hit;
      cells.push(sumKeys(base, group.keys), hit, null);
    }
    cells.push(affected, sumBy(event, "cared_count"), sumBy(event, "moved_count"), null, meta.startDate, meta.endDate);
    return cells;
  });
  const width = 1 + SHEET_GROUPS.length * 3 + 6;
  const total = totalRow("รวม", rows, width).map((value, i) => (i >= width - 3 ? (i === width - 3 ? null : value || null) : value));
  total[width - 2] = null;
  total[width - 1] = null;
  return makeTable({
    name: "กลุ่มเปราะบาง(พื้นที่)",
    title: "ประชากรกลุ่มเปราะบางที่ได้รับผลกระทบที่ให้การดูแล (สะสม)",
    subtitle: meta.subtitle,
    header: [
      [{ label: "อำเภอ", rowSpan: 2 }, ...SHEET_GROUPS.map((group) => ({ label: group.label, span: 3 })),
        { label: "รวมกลุ่มเปราะบางที่ได้รับผลกระทบ", rowSpan: 2 }, { label: "ได้รับการดูแลแล้ว", rowSpan: 2 }, { label: "เคลื่อนย้ายแล้ว", rowSpan: 2 },
        { label: "หมายเหตุ", rowSpan: 2 }, { label: "วันเริ่มต้นเหตุการณ์", rowSpan: 2 }, { label: "วันสิ้นสุดเหตุการณ์", rowSpan: 2 }],
      SHEET_GROUPS.flatMap(() => [{ label: "ทั้งหมด" }, { label: "กระทบ" }, { label: "ดูแล" }])
    ],
    rows,
    total,
    notes: ["ทั้งหมด = ทะเบียนกลาง, กระทบ = หมู่บ้านที่บันทึกว่าประสบภัยในเหตุการณ์นี้", "ช่อง \"ดูแล\" รายประเภทเว้นว่าง: ระบบบันทึกการดูแลเป็นยอดรวมรายหมู่บ้าน (ดูคอลัมน์ ได้รับการดูแลแล้ว)"],
    cols: [14, ...Array(SHEET_GROUPS.length * 3).fill(8), 14, 12, 12, 16, 14, 14]
  });
}

// 2) พื้นที่ประสบภัย (พื้นที่)
function areaSheet(data, meta) {
  const floodRows = (data.floodRows || []).filter((row) => !meta.date || String(row.date) <= meta.date);
  const recovery = summarizeRecovery(tambonRecovery(floodRows));
  const rows = SHEET_DISTRICTS.map((district) => {
    const polygons = (data.polygons || []).filter((row) => dk(row.district) === district);
    const mine = floodRows.filter((row) => dk(row.district) === district);
    const villages = new Map();
    for (const row of mine) {
      if (floodLevelRank(row.level) === 0) continue;
      const key = `${row.tambon}|${row.village || ""}`;
      const current = villages.get(key) || { tambon: row.tambon, village: row.village, households: 0 };
      current.households = Math.max(current.households, n(row.households));
      villages.set(key, current);
    }
    const list = [...villages.values()];
    const byTambon = new Map();
    for (const item of list) byTambon.set(item.tambon, [...(byTambon.get(item.tambon) || []), item.village || "ทั้งตำบล"]);
    const status = recovery.districts.find((row) => dk(row.district) === district) || {};
    return [
      district,
      new Set(polygons.map((row) => row.tambon)).size || null,
      byTambon.size,
      polygons.length || null,
      list.length,
      list.reduce((sum, item) => sum + item.households, 0),
      [...byTambon.entries()].map(([tambon, names]) => `ต.${tambon}: ${names.join(", ")}`).join(" / ") || null,
      n(status.normal), n(status.easing), n(status.ongoing),
      meta.startDate, meta.endDate
    ];
  });
  const total = totalRow("รวม", rows, 12);
  total[6] = null; total[10] = null; total[11] = null;
  return makeTable({
    name: "พื้นที่ประสบภัย(พื้นที่)",
    title: "พื้นที่ประสบภัย",
    subtitle: meta.subtitle,
    header: [[
      { label: "อำเภอ" }, { label: "จำนวนตำบลทั้งหมด" }, { label: "ตำบลประสบภัย" }, { label: "จำนวนหมู่บ้านทั้งหมด" }, { label: "จำนวนหมู่บ้านประสบภัย" },
      { label: "จำนวนครัวเรือนประสบภัย" }, { label: "รายชื่อหมู่บ้านที่ประสบภัย" }, { label: "ตำบลที่กลับสู่ภาวะปกติ" }, { label: "ตำบลที่สถานการณ์คลี่คลาย" },
      { label: "ตำบลที่สถานการณ์ยังไม่คลี่คลาย" }, { label: "วันเริ่มต้นเหตุการณ์" }, { label: "วันสิ้นสุดเหตุการณ์" }
    ]],
    rows,
    total,
    notes: ["สถานะตำบลคำนวณจากระดับน้ำล่าสุดของแต่ละหมู่บ้านในบันทึกพื้นที่น้ำท่วม"],
    cols: [14, 10, 10, 10, 10, 12, 60, 10, 10, 10, 14, 14]
  });
}

// 3) ได้รับผลกระทบ (พื้นที่)
const AFFECTED_GROUPS = [["ประชาชน", "citizen"], ["อสม.", "volunteer"], ["บุคลากร", "staff"]];
const AFFECTED_FIELDS = [["ทรัพย์สิน", "property"], ["บาดเจ็บ", "injured"], ["เสียชีวิต", "deaths"], ["สูญหาย", "missing"]];
function affectedSheet(data, meta) {
  const rows = SHEET_DISTRICTS.map((district) => {
    const mine = (data.affected || []).filter((row) => dk(row.district) === district);
    return [
      district,
      ...AFFECTED_GROUPS.flatMap(([, prefix]) => AFFECTED_FIELDS.map(([, field]) => sumBy(mine, `${prefix}_${field}`))),
      sumBy(mine, "medicine_support"), sumBy(mine, "evacuated"), sumBy(mine, "not_evacuated"),
      meta.startDate, meta.endDate
    ];
  });
  const total = totalRow("รวม", rows, 18);
  total[16] = null; total[17] = null;
  return makeTable({
    name: "ได้รับผลกระทบ(พื้นที่)",
    title: "ประชาชน/อสม./บุคลากร ที่ได้รับผลกระทบที่ให้การดูแล",
    subtitle: meta.subtitle,
    header: [
      [{ label: "อำเภอ", rowSpan: 2 }, ...AFFECTED_GROUPS.map(([label]) => ({ label, span: 4 })),
        { label: "การจ่ายยา/เวชภัณฑ์ (รวมที่ได้รับสนับสนุนจากหน่วยงานภายนอก)", rowSpan: 2 }, { label: "การช่วยเหลือ", span: 2 },
        { label: "วันเริ่มต้นเหตุการณ์", rowSpan: 2 }, { label: "วันสิ้นสุดเหตุการณ์", rowSpan: 2 }],
      [...AFFECTED_GROUPS.flatMap(() => AFFECTED_FIELDS.map(([label]) => ({ label }))), { label: "อพยพ" }, { label: "ไม่อพยพ" }]
    ],
    rows,
    total,
    cols: [14, ...Array(12).fill(9), 18, 10, 10, 14, 14]
  });
}

// 4) สถานบริการ (พื้นที่)
function facilitySheet(data, meta) {
  const affected = (row) => ["access_cut", "flooded"].includes(row.flood_status);
  const closed = (row) => row.service_status === "closed";
  const rows = SHEET_DISTRICTS.map((district) => {
    const mine = (data.facilities || []).filter((row) => dk(row.district_name) === district);
    const hospitals = mine.filter((row) => row.level === "hospital");
    const primary = mine.filter((row) => row.level === "primary");
    const hit = mine.filter((row) => affected(row) || closed(row));
    return [
      district,
      hospitals.length, hospitals.filter(affected).length, hospitals.filter(closed).length,
      primary.length, primary.filter(affected).length, primary.filter((row) => affected(row) && !closed(row)).length, primary.filter(closed).length,
      hit.map((row) => `${row.name}${closed(row) ? " (ปิด)" : row.flood_status === "flooded" ? " (น้ำท่วม)" : " (เส้นทางถูกตัด)"}`).join(", ") || null
    ];
  });
  const total = totalRow("รวม", rows, 9);
  total[8] = null;
  return makeTable({
    name: "สถานบริการ(พื้นที่)",
    title: "สถานบริการสาธารณสุขที่ได้รับผลกระทบ จังหวัดสตูล",
    subtitle: meta.subtitle,
    header: [
      [{ label: "อำเภอ", rowSpan: 2 }, { label: "โรงพยาบาล", span: 3 }, { label: "โรงพยาบาลส่งเสริมสุขภาพตำบล", span: 4 }, { label: "หมายเหตุ", rowSpan: 2 }],
      [{ label: "ทั้งหมด" }, { label: "กระทบ" }, { label: "ปิดบริการ" }, { label: "ทั้งหมด" }, { label: "กระทบ" }, { label: "เปิดบริการ" }, { label: "ปิดบริการ" }]
    ],
    rows,
    total,
    notes: ["กระทบ = สถานะน้ำท่วมที่ตั้ง หรือเส้นทางถูกตัด จากหน้าจัดการหน่วยบริการ"],
    cols: [14, 10, 10, 10, 10, 10, 10, 10, 50]
  });
}

// 5–8, 10) รายงานประจำวันรายอำเภอ
function teamRows(data, type, date) {
  return (data.teamReports || []).filter((row) => row.report_type === type).map((row) => ({ ...row, metrics: parseMetrics(row.metrics) }))
    .filter((row) => !date || row.report_date <= date);
}
function teamSheet(data, meta, { type, name, title, header, fields, extra }) {
  const all = teamRows(data, type, meta.date);
  const today = all.filter((row) => row.report_date === meta.date);
  const rows = SHEET_DISTRICTS.map((district) => {
    const mine = today.filter((row) => dk(row.district_name) === district);
    const cells = [district, ...fields.map((key) => (mine.length ? mine.reduce((sum, row) => sum + n(row.metrics[key]), 0) : null))];
    return extra ? extra(cells, mine) : cells;
  });
  const reported = SHEET_DISTRICTS.filter((district) => today.some((row) => dk(row.district_name) === district)).length;
  return makeTable({
    name, title: `${title} วันที่ ${thaiDate(meta.date)}`, subtitle: meta.subtitle, header, rows,
    notes: [`อำเภอที่รายงานวันนี้ ${reported} จาก ${SHEET_DISTRICTS.length} อำเภอ (ช่องว่าง = ยังไม่รายงาน)`],
    cols: [14, ...Array(rows[0].length - 1).fill(11)]
  });
}

function withTotals(table, total, cumulative) {
  const notesStart = table.rows.findIndex((row) => row?.[0]?.s === "note");
  const insertAt = notesStart === -1 ? table.rows.length : notesStart;
  table.rows.splice(insertAt, 0, total.map(T), cumulative.map(T));
  return table;
}

function mcattSheet(data, meta) {
  const config = TEAM_REPORT_TYPES.mcatt;
  const keys = config.fields.map((field) => field.key);
  return withTotals(...teamSheetArgs(data, meta, {
    type: "mcatt", name: "MCATT", title: "ผลการดำเนินงานทีม MCATT",
    fields: keys,
    header: [
      [{ label: "อำเภอ", rowSpan: 2 }, { label: "ทีม MCATT", span: 2 }, { label: "จำนวนผู้รับบริการ", span: 4 }, { label: "ผลการประเมินความเครียด", span: 4 }],
      [{ label: "จำนวน" }, { label: "ปฏิบัติงาน" }, { label: "เยี่ยมบ้าน" }, { label: "ให้สุขศึกษา" }, { label: "ประเมินความเครียด" }, { label: "ส่งต่อ" },
        { label: "ปกติ" }, { label: "เครียดน้อย" }, { label: "เครียดปานกลาง" }, { label: "เครียดสูง" }]
    ]
  }));
}
// ตารางของทีม + แถว "รวมวันนี้" และ "สะสมทั้งเหตุการณ์"
function teamSheetArgs(data, meta, options) {
  const table = teamSheet(data, meta, options);
  const all = teamRows(data, options.type, meta.date);
  const today = all.filter((row) => row.report_date === meta.date);
  const width = table.cols.length;
  const sum = (rows, key) => rows.reduce((s, row) => s + n(row.metrics[key]), 0);
  const total = [`รวมวันที่ ${thaiDate(meta.date)}`, ...options.fields.map((key) => sum(today, key))];
  const cumulative = ["สะสมทั้งเหตุการณ์", ...options.fields.map((key) => sum(all, key))];
  if (options.extraTotals) options.extraTotals(total, cumulative);
  while (total.length < width) total.push(null);
  while (cumulative.length < width) cumulative.push(null);
  return [table, total, cumulative];
}

function medicalSheet(data, meta) {
  return withTotals(...teamSheetArgs(data, meta, {
    type: "medical", name: "หน่วยแพทย์", title: "ผลการดำเนินงานหน่วยแพทย์เคลื่อนที่",
    fields: ["units", "treated", "counseled", "referred"],
    header: [[{ label: "อำเภอ" }, { label: "จำนวนหน่วยที่ออก" }, { label: "ตรวจรักษา" }, { label: "ให้คำปรึกษา" }, { label: "ส่งต่อ" }]]
  }));
}
function mertSheet(data, meta) {
  return withTotals(...teamSheetArgs(data, meta, {
    type: "mert", name: "MERT", title: "การให้บริการหน่วยแพทย์เคลื่อนที่ MERT mini-MERT",
    fields: ["mert_teams", "mini_mert_teams", "rescue_teams", "area", "served", "referred"],
    extra: (cells, mine) => { cells[4] = mine.map((row) => row.area_note).filter(Boolean).join(", ") || null; return cells; },
    extraTotals: (total, cumulative) => { total[4] = null; cumulative[4] = null; },
    header: [
      [{ label: "อำเภอ", rowSpan: 2 }, { label: "จำนวนทีม MERT/mini-MERT/กู้ภัยกู้ชีพ ที่ออกปฏิบัติการ", span: 3 }, { label: "พื้นที่ออกปฏิบัติการ", rowSpan: 2 },
        { label: "จำนวนผู้รับบริการ", rowSpan: 2 }, { label: "ส่งต่อโรงพยาบาล", rowSpan: 2 }],
      [{ label: "MERT (ทีม)" }, { label: "mini-MERT (ทีม)" }, { label: "กู้ชีพกู้ภัย" }]
    ]
  }));
}
function doxySheet(data, meta) {
  const all = teamRows(data, "doxy", meta.date);
  const keyOf = (row) => `${dk(row.district_name)}|${row.area_note || ""}`;
  const units = new Map();
  for (const row of all) {
    const key = keyOf(row);
    const entry = units.get(key) || { district: dk(row.district_name), unit: row.area_note || "(ไม่ระบุหน่วย)", atRisk: 0, today: 0, total: 0, first: row.report_date, note: row.note };
    entry.total += n(row.metrics.doxy_new);
    if (row.report_date === meta.date) { entry.today += n(row.metrics.doxy_new); entry.atRisk += n(row.metrics.at_risk); }
    if (row.report_date < entry.first) entry.first = row.report_date;
    units.set(key, entry);
  }
  const rows = [];
  for (const district of SHEET_DISTRICTS) {
    const mine = [...units.values()].filter((entry) => entry.district === district);
    if (!mine.length) continue;
    rows.push([{ v: `อำเภอ${district}`, s: "totalText" }, T(mine.reduce((s, e) => s + e.atRisk, 0)), T(mine.reduce((s, e) => s + e.today, 0)), T(mine.reduce((s, e) => s + e.total, 0)), { v: "", s: "totalText" }]);
    for (const entry of mine) rows.push([entry.unit, entry.atRisk, entry.today, entry.total, `เริ่มให้วันที่ ${thaiDate(entry.first)}`]);
  }
  const total = ["รวมทั้งจังหวัด", [...units.values()].reduce((s, e) => s + e.atRisk, 0), [...units.values()].reduce((s, e) => s + e.today, 0), [...units.values()].reduce((s, e) => s + e.total, 0), null];
  return makeTable({
    name: "สำรวจdoxy", title: `สำรวจกลุ่มเสี่ยงและจ่ายยา Doxycycline วันที่ ${thaiDate(meta.date)}`, subtitle: meta.subtitle,
    header: [
      [{ label: "หน่วยบริการ", rowSpan: 2 }, { label: "กลุ่มเสี่ยง", rowSpan: 2 }, { label: "จ่ายยา", span: 2 }, { label: "หมายเหตุ", rowSpan: 2 }],
      [{ label: "รายใหม่วันนี้" }, { label: "สะสม" }]
    ],
    rows: rows.length ? rows : [["ยังไม่มีรายงาน", null, null, null, null]],
    total,
    cols: [30, 12, 12, 12, 24]
  });
}

// 9) คงคลังเวชภัณฑ์ (คบส.)
const TRACKED = FLOOD_PRESET_ITEMS.slice(0, 5);
const BALANCE_ONLY = FLOOD_PRESET_ITEMS.slice(5);
function stockSheet(data, meta) {
  const codes = new Set(FLOOD_PRESET_ITEMS.map((item) => item.item_code));
  const stock = (data.stock || []).filter((row) => codes.has(String(row.item_code || "").toUpperCase()));
  const agencies = [...new Set(stock.map((row) => row.agency_name))];
  const find = (agency, code) => stock.find((row) => row.agency_name === agency && String(row.item_code).toUpperCase() === code);
  const rows = agencies.map((agency, index) => [
    index + 1, agency,
    ...TRACKED.flatMap((item) => {
      const row = find(agency, item.item_code);
      return row ? [n(row.opening_qty), n(row.received_qty), n(row.issued_qty), n(row.balance_qty)] : [null, null, null, null];
    }),
    ...BALANCE_ONLY.map((item) => { const row = find(agency, item.item_code); return row ? n(row.balance_qty) : null; })
  ]);
  const width = 2 + TRACKED.length * 4 + BALANCE_ONLY.length;
  const total = ["", ...totalRow("รวม", rows.map((row) => row.slice(1)), width - 1)];
  return makeTable({
    name: "Logistic - คงคลัง(คบส.)", title: `ยอดคงคลัง ยา/เวชภัณฑ์ กรณีอุทกภัย จ.สตูล วันที่ ${thaiDate(meta.date)}`, subtitle: meta.subtitle,
    header: [
      [{ label: "ลำดับที่", rowSpan: 2 }, { label: "หน่วยงาน", rowSpan: 2 }, ...TRACKED.map((item) => ({ label: `${item.item_name} (${item.unit})`, span: 4 })),
        ...BALANCE_ONLY.map((item) => ({ label: item.item_name, rowSpan: 1 }))],
      [...TRACKED.flatMap(() => [{ label: "เดิม" }, { label: "รับ" }, { label: "จ่าย" }, { label: "คงเหลือ" }]), ...BALANCE_ONLY.map((item) => ({ label: `(${item.unit})` }))]
    ],
    rows: rows.length ? rows : [[null, "ยังไม่มีรายการมาตรฐานในบัญชีคลังของเหตุการณ์นี้"]],
    total,
    notes: ["นับเฉพาะรายการมาตรฐาน 10 รายการ (เพิ่มได้จากหน้าเวชภัณฑ์และคลังยา → เพิ่มรายการ → เพิ่มทั้งชุด)"],
    cols: [7, 22, ...Array(TRACKED.length * 4).fill(8), ...Array(BALANCE_ONLY.length).fill(11)]
  });
}

// 10) ทรัพยากรสนับสนุน (พื้นที่) — สะสมทั้งเหตุการณ์
function resourcesSheet(data, meta) {
  const config = TEAM_REPORT_TYPES.resources;
  const all = teamRows(data, "resources", meta.date);
  const rows = SHEET_DISTRICTS.map((district) => {
    const mine = all.filter((row) => dk(row.district_name) === district);
    const values = config.fields.map((field) => mine.reduce((s, row) => s + n(row.metrics[field.key]), 0));
    return [district, ...values, values.reduce((a, b) => a + b, 0)];
  });
  return makeTable({
    name: "Logistic - ทรัพยากรสนับสนุน", title: "การสนับสนุนทรัพยากรให้แก่ประชาชน (สะสม)", subtitle: meta.subtitle,
    header: [[{ label: "อำเภอ" }, ...config.fields.map((field) => ({ label: `${field.label} (${field.unit})` })), { label: "รวม" }]],
    rows,
    total: totalRow("รวม", rows, config.fields.length + 2),
    cols: [14, ...Array(config.fields.length + 1).fill(13)]
  });
}

// 11) Liquid oxygen
function oxygenSheet(data, meta) {
  const rows = (data.oxygen || []).map((row, index) => {
    const days = oxygenDays(row);
    const num = (value) => (value === null || value === undefined || value === "" ? null : n(value));
    const problem = Number(row.procurement_problem) === 1;
    return [index + 1, row.facility_name,
      num(row.tank_qty), num(row.tank_use_per_day), days.tank,
      num(row.big_qty), num(row.big_use_per_day), days.big,
      num(row.small_qty), num(row.small_use_per_day), days.small,
      days.total, problem ? "/" : null, problem ? null : "/", problem ? row.problem_note : null, thaiDate(row.report_date)];
  });
  return makeTable({
    name: "Logistic - Liquid oxygen", title: `ยอดคงคลัง Liquid Oxygen (ออกซิเจนเหลว) ข้อมูลล่าสุด ณ ${thaiDate(meta.date)}`, subtitle: meta.subtitle,
    header: [
      [{ label: "ลำดับที่", rowSpan: 3 }, { label: "หน่วยงาน", rowSpan: 3 }, { label: "ปริมาณ Liquid Oxygen ใน Tank (psi)", span: 3, rowSpan: 2 },
        { label: "ปริมาณ Liquid Oxygen สำรอง", span: 6 }, { label: "ประมาณการใช้ได้รวม (วัน)", rowSpan: 3 }, { label: "ปัญหาในการจัดซื้อ/จัดหา", span: 3, rowSpan: 2 },
        { label: "รายงานวันที่", rowSpan: 3 }],
      [{ label: "ถังใหญ่ (ถัง)", span: 3 }, { label: "ถังเล็ก (ถัง)", span: 3 }],
      [...Array(3).fill(0).flatMap(() => [{ label: "รับ/เดิม" }, { label: "ประมาณการใช้ต่อวัน" }, { label: "จำนวนวันที่พอใช้" }]), { label: "พบ" }, { label: "ไม่พบ" }, { label: "รายละเอียด" }]
    ],
    rows: rows.length ? rows : [[null, "ยังไม่มีรายงาน"]],
    notes: ["ประมาณการใช้ได้รวม = (a)/(b) + (c)/(d) + ถังเล็ก — ใช้รายงานล่าสุดของแต่ละโรงพยาบาล"],
    cols: [7, 22, 10, 10, 10, 10, 10, 10, 10, 10, 10, 12, 6, 6, 26, 12]
  });
}

// 12) โรค (พื้นที่) — รายงานจากชุมชน แยกโรงพยาบาลอำเภอ วันนี้/สะสม
const DISEASE_DISTRICTS = ["เมืองสตูล", "ควนโดน", "ควนกาหลง", "ท่าแพ", "ละงู", "มะนัง", "ทุ่งหว้า"];
function diseaseAreaSheet(data, meta) {
  const reports = (data.diseaseCommunity || []).filter((row) => !meta.date || row.date <= meta.date);
  const diseases = [...new Set(reports.map((row) => row.disease).filter(Boolean))].sort((a, b) => a.localeCompare(b, "th"));
  const rows = diseases.map((disease) => {
    const mine = reports.filter((row) => row.disease === disease);
    const cells = [disease];
    let today = 0;
    let total = 0;
    for (const district of DISEASE_DISTRICTS) {
      const d = mine.filter((row) => dk(row.district) === district);
      const t = d.filter((row) => row.date === meta.date).reduce((s, row) => s + n(row.cases), 0);
      const c = d.reduce((s, row) => s + n(row.cases), 0);
      today += t; total += c;
      cells.push(t, c);
    }
    cells.push(today, total);
    return cells;
  });
  return makeTable({
    name: "โรค(พื้นที่)", title: "การเฝ้าระวังโรคที่มากับน้ำท่วม (รายงานจากชุมชน)", subtitle: meta.subtitle,
    header: [
      [{ label: "โรค", rowSpan: 2 }, ...DISEASE_DISTRICTS.map((district) => ({ label: district === "เมืองสตูล" ? "สตูล" : district, span: 2 })), { label: "รวม", span: 2 }],
      [...DISEASE_DISTRICTS.flatMap(() => [{ label: "วันนี้" }, { label: "สะสม" }]), { label: "วันนี้" }, { label: "สะสม" }]
    ],
    rows: rows.length ? rows : [["ยังไม่มีรายงาน"]],
    total: rows.length ? totalRow("รวม", rows, 1 + DISEASE_DISTRICTS.length * 2 + 2) : null,
    cols: [20, ...Array(DISEASE_DISTRICTS.length * 2 + 2).fill(8)]
  });
}

// 13) โรค (ศูนย์พักพิง) — สะสม + เพิ่มขึ้นวันนี้
function diseaseShelterSheet(data, meta) {
  const reports = (data.diseaseShelter || []).filter((row) => !meta.date || row.date <= meta.date);
  const diseases = [...new Set(reports.map((row) => row.disease).filter(Boolean))].sort((a, b) => a.localeCompare(b, "th"));
  const rows = diseases.map((disease) => {
    const mine = reports.filter((row) => row.disease === disease);
    const perDistrict = SHEET_DISTRICTS.map((district) => mine.filter((row) => dk(row.district) === district).reduce((s, row) => s + n(row.cases), 0));
    return [disease, ...perDistrict, perDistrict.reduce((a, b) => a + b, 0), mine.filter((row) => row.date === meta.date).reduce((s, row) => s + n(row.cases), 0)];
  });
  return makeTable({
    name: "โรค(ศูนย์พักพิง)", title: "การเฝ้าระวังโรคที่มากับน้ำท่วมในศูนย์พักพิง (สะสมตั้งแต่น้ำท่วม)", subtitle: meta.subtitle,
    header: [
      [{ label: "โรค", rowSpan: 2 }, { label: "อำเภอ", span: SHEET_DISTRICTS.length }, { label: "รวม", rowSpan: 2 }, { label: "เพิ่มขึ้น (วันนี้)", rowSpan: 2 }],
      SHEET_DISTRICTS.map((district) => ({ label: district === "เมืองสตูล" ? "สตูล" : district }))
    ],
    rows: rows.length ? rows : [["ยังไม่มีรายงาน"]],
    total: rows.length ? totalRow("รวม", rows, SHEET_DISTRICTS.length + 3) : null,
    cols: [20, ...Array(SHEET_DISTRICTS.length + 2).fill(10)]
  });
}

// 14) ศูนย์พักพิง
function shelterSheet(data, meta) {
  const shelters = [...(data.shelters || [])].sort((a, b) =>
    SHEET_DISTRICTS.indexOf(dk(a.district_name)) - SHEET_DISTRICTS.indexOf(dk(b.district_name)) || n(b.active) - n(a.active) || String(a.sheltername).localeCompare(String(b.sheltername), "th"));
  const rows = shelters.map((row, index) => [
    index + 1, dk(row.district_name), row.sheltername, n(row.active) ? "เปิดใช้งาน" : "ไม่เปิด", row.tambon || null,
    n(row.shelter_capacity) || null, n(row.active) ? n(row.occupancy) : null, row.coordinator_name || null, row.coordinator_phone || row.contact_phone || null
  ]);
  const total = ["", "รวม", `${shelters.filter((row) => n(row.active)).length} ศูนย์เปิด`, "", "", sumBy(shelters, "shelter_capacity"), shelters.filter((row) => n(row.active)).reduce((s, row) => s + n(row.occupancy), 0), "", ""];
  return makeTable({
    name: "ศูนย์พักพิง", title: "ข้อมูลศูนย์พักพิงรองรับสถานการณ์อุทกภัยจังหวัดสตูล", subtitle: meta.subtitle,
    header: [[{ label: "ที่" }, { label: "อำเภอ" }, { label: "ศูนย์พักพิง" }, { label: "สถานะ" }, { label: "ตำบล" }, { label: "จำนวนที่รองรับได้ (คน)" }, { label: "ผู้พักพิง (คน)" }, { label: "ผู้ประสานงาน" }, { label: "โทร" }]],
    rows,
    total,
    cols: [6, 12, 34, 12, 14, 12, 12, 22, 14]
  });
}

/** สร้างทุกแผ่นงาน (ลำดับตามชีตของหน่วยงาน) */
export function buildSheetExport(data = {}) {
  const meta = {
    date: data.date,
    startDate: thaiDate(data.startDate),
    endDate: data.endDate ? thaiDate(data.endDate) : null,
    subtitle: `${data.eventLabel || "เหตุการณ์"} · ข้อมูล ณ ${thaiDate(data.date)} · ส่งออกจากระบบ Satun Geo-EOC${data.isTest ? " [ทดสอบ]" : ""}`
  };
  return [
    vulnerableSheet(data, meta),
    areaSheet(data, meta),
    affectedSheet(data, meta),
    facilitySheet(data, meta),
    mcattSheet(data, meta),
    medicalSheet(data, meta),
    diseaseAreaSheet(data, meta),
    stockSheet(data, meta),
    resourcesSheet(data, meta),
    oxygenSheet(data, meta),
    diseaseShelterSheet(data, meta),
    doxySheet(data, meta),
    shelterSheet(data, meta),
    mertSheet(data, meta)
  ];
}
