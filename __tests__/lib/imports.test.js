import { buildXlsx, zip } from "@/lib/xlsxWriter";
import { readCsv, readSpreadsheet, readXlsx } from "@/lib/xlsxReader";
import { DATA_SHEET, HELP_SHEET, LIST_SHEET, convertCell, headerText, parseDateCell, parseRows, summarizeCheck, templateSheets } from "@/lib/imports/core";
import { IMPORT_SPECS, importSpec } from "@/lib/imports/specs";

const refs = {
  districts: ["เมืองสตูล", "ละงู"],
  tambons: ["พิมาน", "กำแพง"],
  facilities: [{ value: 7, label: "รพ.ละงู", aliases: ["7"] }]
};

describe("parseDateCell", () => {
  test.each([
    ["13/10/2569", "2026-10-13"],
    ["13/10/2026", "2026-10-13"],
    ["2026-10-13", "2026-10-13"],
    ["1.2.2569", "2026-02-01"],
    [46308, "2026-10-13"]
  ])("%p → %p", (input, expected) => expect(parseDateCell(input)).toBe(expected));
  test("rejects impossible dates", () => {
    expect(parseDateCell("31/02/2569")).toBeNull();
    expect(parseDateCell("hello")).toBeNull();
  });
});

describe("convertCell", () => {
  const phone = { header: "เบอร์", type: "phone" };
  test("restores leading zero Excel drops", () => expect(convertCell(phone, 812345678)).toEqual({ value: "0812345678" }));
  test("enum matches label, alias and key", () => {
    const type = importSpec("vulnerable").columns[0];
    expect(convertCell(type, "ติดเตียง").value).toBe("bedridden");
    expect(convertCell(type, "ผู้พิการ").value).toBe("disabled");
    expect(convertCell(type, "อื่น ๆ").error).toMatch("ไม่อยู่ในรายการ");
  });
  test("ref enum uses server lists", () => {
    const district = importSpec("vulnerable").columns.find((c) => c.key === "district");
    expect(convertCell(district, "ละงู", refs).value).toBe("ละงู");
    expect(convertCell(district, "หาดใหญ่", refs).error).toBeTruthy();
  });
  test("required, numbers and booleans", () => {
    expect(convertCell({ type: "text", required: true }, "  ").error).toBe("ต้องกรอก");
    expect(convertCell({ type: "int" }, "1,200").value).toBe(1200);
    expect(convertCell({ type: "int" }, 1.5).error).toMatch("จำนวนเต็ม");
    expect(convertCell({ type: "number", maxValue: 10 }, 11).error).toMatch("ไม่เกิน");
    expect(convertCell({ type: "bool" }, "ใช่").value).toBe(true);
    expect(convertCell({ type: "bool" }, "").value).toBe(false);
  });
});

describe("template", () => {
  test.each(Object.keys(IMPORT_SPECS))("%s template opens with help, data and list sheets", (kind) => {
    const spec = importSpec(kind);
    const sheets = readXlsx(buildXlsx(templateSheets(spec, refs)));
    expect(sheets.map((sheet) => sheet.name)).toEqual([HELP_SHEET, DATA_SHEET, LIST_SHEET, ...(spec.examples?.length ? ["ตัวอย่าง"] : [])]);
    const data = sheets[1];
    expect(data.rows[0]).toEqual(spec.columns.map(headerText));
    expect(sheets[0].rows.flat()).toEqual(expect.arrayContaining(spec.columns.map((c) => c.header)));
  });
  test("template has dropdowns and text columns", () => {
    const xml = templateSheets(importSpec("supplies"), refs)[1];
    expect(xml.validations[0].source).toContain(LIST_SHEET);
    expect(xml.textCols.length).toBeGreaterThan(0);
  });
});

describe("parseRows", () => {
  const spec = importSpec("flood-records");
  const header = spec.columns.map(headerText);
  const workbook = (rows) => readXlsx(buildXlsx([{ name: HELP_SHEET, rows: [["อ่านก่อน"]] }, { name: DATA_SHEET, rows: [header, ...rows] }]));

  test("reads values and reports per-cell problems with Excel row numbers", () => {
    const sheets = workbook([
      ["13/10/2569", "ละงู", "กำแพง", 3, "บ้านทุ่ง", "ปานกลาง", 40, 25, 80, "ถนนขาด"],
      [],
      ["ไม่ใช่วันที่", "ละงู", "กำแพง", 4, null, "ท่วมมาก", null, null, null, null]
    ]);
    const parsed = parseRows(sheets, spec, refs);
    expect(parsed.sheetName).toBe(DATA_SHEET);
    expect(parsed.rows).toHaveLength(2);
    expect(parsed.rows[0]).toMatchObject({ row: 2, errors: [], values: { date: "2026-10-13", moo: 3, flood_level: "ปานกลาง", affected_people: 80 } });
    expect(parsed.rows[1].row).toBe(4);
    expect(parsed.rows[1].errors.map((e) => e.column)).toEqual(["วันที่", "ระดับน้ำท่วม"]);
    expect(summarizeCheck(parsed.rows)).toMatchObject({ total: 2, valid: 1, invalid: 1 });
  });

  test("finds header without * and in another column order", () => {
    const sheets = [{ name: "Sheet1", rows: [["ระดับน้ำท่วม", "ตำบล", "อำเภอ", "วันที่", "หมู่"], ["ต่ำ", "พิมาน", "เมืองสตูล", "2026-10-13", 1]] }];
    const parsed = parseRows(sheets, spec, refs);
    expect(parsed.rows[0].values).toMatchObject({ district: "เมืองสตูล", tambon: "พิมาน", moo: 1, flood_level: "ต่ำ" });
  });

  test("explains a file without the expected header", () => {
    expect(parseRows([{ name: "x", rows: [["a", "b"], [1, 2]] }], spec, refs).error).toMatch("ไม่พบหัวคอลัมน์");
    expect(parseRows([{ name: "x", rows: [header] }], spec, refs).error).toMatch("ไม่พบข้อมูล");
  });
});

describe("readers", () => {
  test("CSV with BOM, quotes and Thai", () => {
    const [sheet] = readCsv(Buffer.from("﻿ชื่อ,หมายเหตุ\n\"สมใจ, ใจดี\",\"เธอบอกว่า \"\"ด่วน\"\"\"\n"));
    expect(sheet.rows).toEqual([["ชื่อ", "หมายเหตุ"], ["สมใจ, ใจดี", "เธอบอกว่า \"ด่วน\""]]);
  });
  test("rejects old .xls and non-excel files clearly", () => {
    expect(() => readSpreadsheet(Buffer.from("abc"), "x.xls")).toThrow(".xls");
    expect(() => readXlsx(Buffer.from("not a zip file at all, definitely"))).toThrow("ไม่ใช่ Excel");
  });
  test("reads shared strings and inline strings written by Excel", () => {
    const sheets = readXlsx(buildXlsx([{ name: "A", rows: [["ก", 1, "x & <y>"]] }]));
    expect(sheets[0].rows[0]).toEqual(["ก", 1, "x & <y>"]);
  });
  test("reads shared strings, rich text and skips phonetic runs (as saved by Excel)", () => {
    const file = zip([
      { name: "xl/workbook.xml", data: '<workbook xmlns:r="r"><sheets><sheet name="ข้อมูล" sheetId="1" r:id="rId1"/></sheets></workbook>' },
      { name: "xl/_rels/workbook.xml.rels", data: '<Relationships><Relationship Id="rId1" Type="ws" Target="worksheets/sheet1.xml"/></Relationships>' },
      { name: "xl/sharedStrings.xml", data: '<sst><si><t>ชื่อ</t></si><si><r><t>สม</t></r><r><t xml:space="preserve">ใจ </t></r><rPh><t>x</t></rPh></si></sst>' },
      { name: "xl/worksheets/sheet1.xml", data: '<worksheet><sheetData><row r="1"><c r="A1" t="s"><v>0</v></c><c r="C1" t="b"><v>1</v></c></row><row r="3"><c r="B3" t="s"><v>1</v></c><c r="C3"><v>12.5</v></c></row></sheetData></worksheet>' }
    ]);
    const [sheet] = readXlsx(file);
    expect(sheet.name).toBe("ข้อมูล");
    expect(sheet.rows[0]).toEqual(["ชื่อ", undefined, true]);
    expect(sheet.rows[1]).toEqual([]);
    expect(sheet.rows[2]).toEqual([undefined, "สมใจ ", 12.5]);
  });
});
