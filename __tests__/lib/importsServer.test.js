/** @jest-environment node */
import { buildXlsx } from "@/lib/xlsxWriter";
import { DATA_SHEET, headerText } from "@/lib/imports/core";
import { importSpec } from "@/lib/imports/specs";

const mockExecuted = [];
const mockTables = {
  session: { id: 9, eoc_type: "flood", session_number: 3, status: "active", opened_at: "2026-10-01T00:00:00", closed_at: null },
  villages: [
    { id: 101, distname: "ละงู", subdistnam: "กำแพง", moo: "3", villname: "บ้านทุ่ง" },
    { id: 102, distname: "ละงู", subdistnam: "กำแพง", moo: "4", villname: "บ้านนา" },
    { id: 201, distname: "เมืองสตูล", subdistnam: "พิมาน", moo: "1", villname: "บ้านพิมาน" }
  ],
  floodRecords: [{ id: 55, day: "2026-10-12", district: "ละงู", tambon: "กำแพง", village: "บ้านทุ่ง" }],
  facilities: [{ id: 7, name: "รพ.ละงู", district_name: "ละงู", typecode: "รพ.ชุมชน" }],
  stock: [{ id: 300, health_facility_id: 7, item_code: "ผงเกลือแร่_ORS", item_name: "ผงเกลือแร่ ORS", unit: "ซอง", received_qty: 0, issued_qty: 0, balance_qty: 100 }],
  persons: [{ id: 1, district: "ละงู", tambon: "กำแพง", name: "นางสมใจ ใจดี" }],
  dailyReports: [{ id: 70, stock_id: 300, report_date: "2026-10-02", received_qty: 0, used_qty: 10, counted_qty: null, note: null }]
};

function mockQuery(sql) {
  if (/FROM eoc_sessions/.test(sql)) return [mockTables.session];
  if (/FROM satun_village_polygon/.test(sql)) return mockTables.villages;
  if (/FROM flood_records/.test(sql)) return mockTables.floodRecords;
  if (/FROM health_facilities/.test(sql)) return mockTables.facilities;
  if (/FROM medical_inventory_events/.test(sql)) return [{ id: 40, event_name: "อุทกภัย ครั้งที่ 3" }];
  if (/FROM medical_inventory_stock/.test(sql)) return mockTables.stock;
  if (/FROM vulnerable_persons/.test(sql)) return mockTables.persons;
  if (/FROM medical_inventory_daily_reports/.test(sql)) return mockTables.dailyReports;
  return [];
}

jest.mock("@/lib/db", () => ({
  query: jest.fn(async (sql) => mockQuery(sql)),
  transaction: jest.fn(async (callback) => callback(async (sql, params) => {
    mockExecuted.push({ sql: sql.replace(/\s+/g, " ").trim(), params });
    if (/FOR UPDATE/.test(sql) && /FROM medical_inventory_daily_reports/.test(sql)) {
      return mockTables.dailyReports.filter((row) => row.stock_id === params[0] && row.report_date === params[1]);
    }
    if (/FOR UPDATE/.test(sql)) return mockTables.stock.filter((row) => (/id IN/.test(sql) ? params.slice(1).includes(row.id) : row.id === params[0]));
    return /^\s*INSERT/.test(sql) ? { insertId: 900 + mockExecuted.length } : { affectedRows: 1 };
  }))
}));
jest.mock("@/lib/eocModuleAccess", () => ({
  getModuleAccess: jest.fn(async () => ({ ok: true, canEdit: true })),
  modulePermissions: jest.fn(async () => ({ can_edit: true }))
}));
jest.mock("@/lib/recordArchive", () => ({ recordChange: jest.fn(async () => {}) }));
jest.mock("@/lib/eocAlertRunner", () => ({ triggerEventAlerts: jest.fn() }));
jest.mock("@/lib/vulnerableAccessLog", () => ({ logVulnerableAccess: jest.fn(async () => {}) }));
jest.mock("@/lib/vulnerablePersonsCrypto", () => ({
  decodePerson: (row) => ({ ...row }),
  encodePerson: (value) => ({ ...value, name_enc: "enc", phone_enc: null, address_enc: null, location_enc: null, needs_enc: null, caregiver_enc: null, clinical_enc: null, power_dependent: value.power_dependent ? 1 : 0 })
}));

const { runImport } = require("@/lib/imports/server");
const user = { id: 5, role: "SAT", username: "sat01" };
const file = (kind, rows) => buildXlsx([{ name: DATA_SHEET, rows: [importSpec(kind).columns.map(headerText), ...rows] }]);

beforeEach(() => { mockExecuted.length = 0; });

describe("flood records import", () => {
  const rows = [
    ["12/10/2569", "ละงู", "กำแพง", 3, null, "สูง", 80, 10, 30, null],       // แทนที่ของเดิม
    ["13/10/2569", "ละงู", "กำแพง", null, "นา", "ปานกลาง", null, 5, 12, null],  // หาด้วยชื่อ (ไม่มีคำว่า บ้าน)
    ["13/10/2569", "ละงู", "พิมาน", 1, null, "ต่ำ", null, null, null, null],     // ตำบลไม่อยู่ในอำเภอ
    ["13/10/2569", "ละงู", "กำแพง", 9, null, "ต่ำ", null, null, null, null],     // ไม่มีหมู่ 9
    ["30/09/2569", "ละงู", "กำแพง", 4, null, "ต่ำ", null, 20, 10, null]        // ก่อนเปิดเหตุการณ์ + ครัวเรือน > คน
  ];

  test("check plans update/create and explains each bad row", async () => {
    const result = await runImport("flood-records", { buffer: file("flood-records", rows), filename: "f.xlsx", user, sessionId: 9 });
    expect(result.committed).toBe(false);
    expect(result.plan).toMatchObject({ create: 1, update: 1 });
    expect(result.check).toMatchObject({ total: 5, valid: 2, invalid: 3 });
    const byRow = Object.groupBy(result.check.problems, (p) => p.row);
    expect(byRow[4][0].message).toMatch("ไม่อยู่ใน อ.ละงู");
    expect(byRow[5][0].message).toMatch("ไม่พบหมู่บ้าน");
    expect(byRow[6].map((p) => p.column)).toEqual(["วันที่", "ครัวเรือนที่ได้รับผลกระทบ"]);
    expect(mockExecuted).toHaveLength(0);
  });

  test("commit refuses while rows have problems, unless only valid rows are chosen", async () => {
    await expect(runImport("flood-records", { buffer: file("flood-records", rows), filename: "f.xlsx", user, sessionId: 9, commit: true })).rejects.toThrow("ยังมีปัญหา 3 แถว");
    const result = await runImport("flood-records", { buffer: file("flood-records", rows), filename: "f.xlsx", user, sessionId: 9, commit: true, onlyValid: true });
    expect(result.result).toEqual({ created: 1, updated: 1 });
    expect(mockExecuted[0].sql).toMatch(/^UPDATE flood_records/);
    expect(mockExecuted[0].params).toEqual([101, "สูง", "2026-10-12", 80, 10, 30, null, 55, 9]);
    expect(mockExecuted[1].sql).toMatch(/^INSERT INTO flood_records/);
    expect(mockExecuted[1].params).toContain("บ้านนา");
  });
});

describe("supplies import", () => {
  test("adds new items, adjusts changed balances, skips equal ones", async () => {
    const rows = [
      ["รพ.ละงู", null, "ผงเกลือแร่ ORS", "ซอง", 80, "นับเช้า"],
      ["รพ.ละงู", null, "ยาพาราเซตามอล 500 มก.", "เม็ด", 1000, null],
      ["รพ.ละงู", null, "ผงเกลือแร่ ORS", "ซอง", 70, null],
      ["รพ.ไม่มีจริง", null, "ถุงมือ", "คู่", 5, null]
    ];
    const check = await runImport("supplies", { buffer: file("supplies", rows), filename: "stock.xlsx", user, sessionId: 9 });
    expect(check.check.problems.map((p) => [p.row, p.column])).toEqual([[4, "ชื่อรายการ"], [5, "หน่วยบริการ/คลัง"]]);
    const done = await runImport("supplies", { buffer: file("supplies", rows.slice(0, 2)), filename: "stock.xlsx", user, sessionId: 9, commit: true });
    expect(done.result).toEqual({ created: 1, updated: 1 });
    const movement = mockExecuted.find((e) => /INSERT INTO medical_inventory_movements/.test(e.sql));
    expect(movement.params).toEqual([300, 20, 100, 80, "sat01", 9, "นับยอดจาก Excel: stock.xlsx — นับเช้า", 5]);
    const same = await runImport("supplies", { buffer: file("supplies", [["รพ.ละงู", null, "ผงเกลือแร่ ORS", "ซอง", 100, null]]), filename: "s.xlsx", user, sessionId: 9 });
    expect(same.plan).toMatchObject({ create: 0, update: 0, skip: 1, skipped: [{ row: 2, reason: "ยอดเท่าเดิม" }] });
  });
});

describe("supplies daily import", () => {
  // คอลัมน์: วันที่ หน่วยบริการ รหัส ชื่อ หน่วย คงเหลือในระบบ รับเข้า ใช้ไป นับได้จริง หมายเหตุ
  const rows = [
    ["02/10/2569", "รพ.ละงู", null, "ผงเกลือแร่ ORS", "ซอง", 100, null, 20, null, null],   // แก้รายงานเดิมของวันที่ 2 (10 → 20)
    ["03/10/2569", "รพ.ละงู", null, "ผงเกลือแร่ ORS", "ซอง", 100, 50, 30, 90, "รับเพิ่ม"],  // วันใหม่
    ["03/10/2569", "รพ.ละงู", null, "ผงเกลือแร่ ORS", "ซอง", 100, null, 1, null, null],    // ซ้ำวันเดียวกัน
    ["04/10/2569", "รพ.ละงู", null, "ยาที่ไม่มีในคลัง", "ซอง", null, null, 1, null, null],   // ไม่มีในคลัง
    ["05/10/2569", "รพ.ละงู", null, "ผงเกลือแร่ ORS", "ซอง", null, null, null, null, null],   // ไม่กรอกใช้ไป
    ["06/10/2569", "รพ.ละงู", null, "ผงเกลือแร่ ORS", "ซอง", null, null, 500, null, null]     // ใช้เกินยอดที่มี
  ];

  test("check: update same day, create new day, and explain each bad row", async () => {
    const result = await runImport("supplies-daily", { buffer: file("supplies-daily", rows), filename: "d.xlsx", user, sessionId: 9 });
    expect(result.plan).toMatchObject({ create: 1, update: 1 });
    const byRow = Object.groupBy(result.check.problems, (p) => p.row);
    expect(byRow[4][0].message).toMatch("ซ้ำกับแถวที่ 3");
    expect(byRow[5][0].message).toMatch("ไม่มีรายการนี้ในคลัง");
    expect(byRow[6][0]).toMatchObject({ column: "ใช้ไป/จ่ายออก", message: "ต้องกรอก" });
    expect(byRow[7][0].message).toMatch("ใช้ไปเกินยอดคงเหลือ");
  });

  test("commit applies only the difference for a corrected day", async () => {
    const result = await runImport("supplies-daily", { buffer: file("supplies-daily", rows.slice(0, 2)), filename: "d.xlsx", user, sessionId: 9, commit: true });
    expect(result.result).toEqual({ created: 1, updated: 1 });
    const stockUpdates = mockExecuted.filter((e) => /^UPDATE medical_inventory_stock/.test(e.sql)).map((e) => e.params.slice(0, 3));
    // 100 → แก้วันที่ 2 ใช้เพิ่ม 10 → 90 → วันที่ 3 รับ 50 ใช้ 30 → 110
    expect(stockUpdates).toEqual([[0, 10, 90], [50, 40, 110]]);
    const insert = mockExecuted.find((e) => /INSERT INTO medical_inventory_daily_reports/.test(e.sql));
    expect(insert.params).toEqual([40, 300, "2026-10-03", 50, 30, 90, "รับเพิ่ม", "excel", 5, "sat01"]);
  });
});

describe("vulnerable import", () => {
  test("skips people already registered and validates per row", async () => {
    const rows = [
      ["ติดเตียง", "นางสมใจ  ใจดี", "ละงู", "กำแพง", null, "0812345678"],
      ["ผู้พิการ", "นายใหม่ มาก่อน", "ละงู", "กำแพง", "หมู่ 3", 812345678, null, 6.9, null],
      ["หญิงตั้งครรภ์", "นางสาวเอ บี", "ละงู", "กำแพง", null, null, null, null, null, null, null, null, null, null, "15/12/2569"],
      ["ผู้สูงอายุ", "นายซี ดี", "ละงู", "กำแพง", null, null, null, null, null, null, null, null, null, null, "15/12/2569"]
    ];
    const result = await runImport("vulnerable", { buffer: file("vulnerable", rows), filename: "v.xlsx", user, eocType: "flood" });
    expect(result.plan).toMatchObject({ create: 1, skip: 1 });
    expect(result.check.problems.map((p) => [p.row, p.message])).toEqual([
      [3, "กรอกพิกัดให้ครบทั้งละติจูดและลองจิจูด"],
      [5, "กรอกได้เฉพาะหญิงตั้งครรภ์"]
    ]);
  });
});
