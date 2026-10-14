import {
  addDays, applyDailyReport, averageDailyUse, balanceAtStartOf, buildLedger, coverLevel, dateRange, daysOfCover,
  reportingStatus, thaiDateText, todayKey, validateDailyEntry
} from "@/lib/medicalDaily";
import { parseDateCell, parseRows, templateSheets } from "@/lib/imports/core";
import { importSpec } from "@/lib/imports/specs";
import { buildXlsx } from "@/lib/xlsxWriter";
import { readXlsx } from "@/lib/xlsxReader";

describe("dates", () => {
  test("todayKey uses Bangkok time", () => {
    expect(todayKey(new Date("2026-10-13T18:30:00Z"))).toBe("2026-10-14");
    expect(todayKey(new Date("2026-10-13T16:59:00Z"))).toBe("2026-10-13");
  });
  test("addDays / dateRange / thaiDateText", () => {
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
    expect(dateRange("2026-10-13", "2026-10-15")).toEqual(["2026-10-13", "2026-10-14", "2026-10-15"]);
    expect(dateRange("2026-01-01", "2026-10-15", 3)).toEqual(["2026-10-13", "2026-10-14", "2026-10-15"]);
    expect(thaiDateText("2026-10-14")).toBe("14/10/2569");
    expect(parseDateCell(thaiDateText("2026-10-14"))).toBe("2026-10-14");
  });
});

describe("validateDailyEntry", () => {
  test("used is required, 0 allowed", () => {
    expect(validateDailyEntry({}).ok).toBe(false);
    expect(validateDailyEntry({ used_qty: "0" })).toEqual({ ok: true, value: { received_qty: 0, used_qty: 0, counted_qty: null, note: null } });
  });
  test("parses commas and rejects negatives", () => {
    expect(validateDailyEntry({ used_qty: "1,200", received_qty: "50", counted_qty: "10" }).value).toMatchObject({ used_qty: 1200, received_qty: 50, counted_qty: 10 });
    expect(validateDailyEntry({ used_qty: -1 }).ok).toBe(false);
    expect(validateDailyEntry({ used_qty: 1, received_qty: "abc" }).ok).toBe(false);
  });
});

describe("applyDailyReport", () => {
  const stock = { received_qty: 0, issued_qty: 0, balance_qty: 1000, unit: "เม็ด" };
  test("new report deducts used and adds received", () => {
    const result = applyDailyReport(stock, null, { received_qty: 500, used_qty: 120 });
    expect(result).toMatchObject({ ok: true, before: 1000, after: 1380, next: { received_qty: 500, issued_qty: 120, balance_qty: 1380 } });
  });
  test("correcting the same day replaces the old values instead of double counting", () => {
    const after = { received_qty: 0, issued_qty: 120, balance_qty: 880 };
    const result = applyDailyReport(after, { received_qty: 0, used_qty: 120 }, { received_qty: 0, used_qty: 100 });
    expect(result.next).toEqual({ received_qty: 0, issued_qty: 100, balance_qty: 900 });
  });
  test("cannot use more than available", () => {
    expect(applyDailyReport(stock, null, { received_qty: 0, used_qty: 1001 }).ok).toBe(false);
  });
  test("detects unchanged resubmission", () => {
    const prev = { received_qty: "0.00", used_qty: "120.00", counted_qty: null, note: null };
    expect(applyDailyReport(stock, prev, { received_qty: 0, used_qty: 120, counted_qty: null, note: null }).unchanged).toBe(true);
  });
});

describe("ledger", () => {
  // ยอดตั้งต้น 1000 → 14: ใช้ 120 → 15: รับ 500 ใช้ 200 นับได้ 1180 → 16: ใช้ 150 นับได้ 1000 (ขาด 30)
  const reports = [
    { report_date: "2026-10-14", received_qty: 0, used_qty: 120, counted_qty: null },
    { report_date: "2026-10-15", received_qty: 500, used_qty: 200, counted_qty: 1180 },
    { report_date: "2026-10-16", received_qty: 0, used_qty: 150, counted_qty: 1000 }
  ];
  const stock = { balance_qty: 1030, created_day: "2026-10-13" };
  const days = dateRange("2026-10-13", "2026-10-17");
  const ledger = buildLedger(stock, reports, [], days);

  test("running balance follows opening + received − used", () => {
    expect(ledger.map((day) => day.end)).toEqual([1000, 880, 1180, 1030, 1030]);
    expect(ledger[0].start).toBe(1000);
    expect(balanceAtStartOf(1030, reports, [], "2026-10-15")).toBe(880);
  });
  test("counted vs calculated difference", () => {
    expect(ledger[2].diff).toBe(0);
    expect(ledger[3].diff).toBe(-30);
    expect(ledger[4]).toMatchObject({ reported: false, diff: null });
  });
  test("other adjustments (count corrections) are part of the ledger", () => {
    const withAdjust = buildLedger({ balance_qty: 1000 }, reports, [{ day: "2026-10-16", net: -30 }], days);
    expect(withAdjust.map((day) => day.end)).toEqual([1000, 880, 1180, 1000, 1000]);
  });
  test("days before the item was added are flagged", () => {
    const later = buildLedger({ balance_qty: 5, created_day: "2026-10-15" }, [], [], days);
    expect(later.map((day) => day.exists)).toEqual([false, false, true, true, true]);
  });
  test("average use counts from the first reported day only", () => {
    expect(averageDailyUse(ledger)).toBe(Math.round(((120 + 200 + 150 + 0) / 4) * 100) / 100);
    expect(averageDailyUse(buildLedger({ balance_qty: 1 }, [], [], days))).toBe(0);
  });
  test("days of cover and level", () => {
    expect(daysOfCover(1030, 117.5)).toBe(8.7);
    expect(daysOfCover(10, 0)).toBeNull();
    expect(coverLevel(null)).toBe("idle");
    expect(coverLevel(2.5)).toBe("critical");
    expect(coverLevel(7)).toBe("warning");
    expect(coverLevel(8)).toBe("ok");
  });
});

describe("reportingStatus", () => {
  const stock = [
    { id: 1, health_facility_id: 7, agency_name: "รพ.ละงู" },
    { id: 2, health_facility_id: 7, agency_name: "รพ.ละงู" },
    { id: 3, health_facility_id: 5, agency_name: "รพ.ทุ่งหว้า" },
    { id: 4, health_facility_id: 1, agency_name: "รพ.สตูล" }
  ];
  test("complete / partial / missing per facility", () => {
    const status = reportingStatus(stock, [{ stock_id: 1 }, { stock_id: 2 }, { stock_id: 3 }]);
    expect(status).toMatchObject({ total: 3, complete: 2, partial: 0, missing: 1 });
    expect(status.facilities[0]).toMatchObject({ name: "รพ.สตูล", status: "missing" });
    expect(reportingStatus(stock, [{ stock_id: 1 }]).partial).toBe(1);
  });
});

describe("daily Excel template", () => {
  const spec = importSpec("supplies-daily");
  const refs = { facilities: [{ value: 7, label: "รพ.ละงู", aliases: ["7"] }] };
  const prefill = [
    { date: "14/10/2569", facility: "รพ.ละงู", item_code: "DOXYCYCLINE_100", item_name: "ยา Doxycycline 100 mg", unit: "เม็ด", system_balance: 1000 },
    { date: "14/10/2569", facility: "รพ.ละงู", item_code: "FOOT_MED", item_name: "ยาน้ำกัดเท้า", unit: "ชุด", system_balance: 300 }
  ];
  const sheets = templateSheets(spec, refs, { prefill });

  test("has help, data (prefilled), list and example sheets", () => {
    expect(sheets.map((sheet) => sheet.name)).toEqual(["คำอธิบาย", "กรอกข้อมูล", "รายการให้เลือก", "ตัวอย่าง"]);
    expect(sheets[1].rows).toHaveLength(3);
    const usedIndex = spec.columns.findIndex((column) => column.key === "used_qty");
    expect(sheets[1].rows[1][usedIndex].s).toBe("input");
    expect(sheets[1].textCols).toContain(0); // วันที่เป็นข้อความ
  });

  test("a prefilled file left blank asks for used qty; filled rows parse", () => {
    const blank = parseRows(readXlsx(buildXlsx(sheets)), spec, refs);
    expect(blank.rows).toHaveLength(2);
    expect(blank.rows[0].errors[0]).toMatchObject({ column: "ใช้ไป/จ่ายออก" });

    const filled = templateSheets(spec, refs, { prefill: prefill.map((row, i) => ({ ...row, used_qty: i ? 0 : 120, received_qty: i ? 200 : "" })) });
    const parsed = parseRows(readXlsx(buildXlsx(filled)), spec, refs);
    expect(parsed.rows.every((row) => !row.errors.length)).toBe(true);
    expect(parsed.rows[0].values).toMatchObject({ date: "2026-10-14", facility: 7, used_qty: 120, received_qty: null, system_balance: "1000" });
    expect(parsed.rows[1].values).toMatchObject({ used_qty: 0, received_qty: 200 });
  });

  test("example sheet is not picked as data", () => {
    const parsed = parseRows(readXlsx(buildXlsx(sheets)), spec, refs);
    expect(parsed.sheetName).toBe("กรอกข้อมูล");
  });
});
