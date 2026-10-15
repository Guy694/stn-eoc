/**
 * @jest-environment node
 */
const mockSave = jest.fn(async () => ({ created: 1, updated: 0, unchanged: 0 }));
const mockQuery = jest.fn();
const mockCalls = [];
jest.mock("@/lib/db", () => ({
  query: (...args) => mockQuery(...args),
  transaction: async (callback) => callback(async (sql, params) => {
    mockCalls.push({ sql, params });
    if (/FROM medical_inventory_stock WHERE inventory_event_id = \? AND health_facility_id = \?/.test(sql)) {
      return [{ id: 1, item_code: "EA1:100", item_name: "Doxycycline", unit: "เม็ด", balance_qty: 1000, received_qty: 0, issued_qty: 0, created_day: "2026-10-13" }];
    }
    if (/FROM medical_inventory_daily_reports/.test(sql) || /FROM medical_inventory_movements/.test(sql)) return [];
    if (/^\s*INSERT INTO medical_inventory_stock/.test(sql)) return { insertId: 77 };
    return { affectedRows: 1 };
  })
}));
jest.mock("@/lib/medicalDailyServer", () => ({ saveDailyEntries: (...args) => mockSave(...args), DailyError: class DailyError extends Error {} }));
jest.mock("@/lib/recordArchive", () => ({ recordChange: jest.fn() }));
jest.mock("@/lib/eocAlertRunner", () => ({ triggerEventAlerts: jest.fn() }));
jest.mock("@/lib/imports/server", () => ({
  ImportError: class ImportError extends Error { constructor(message, status = 400) { super(message); this.status = status; } },
  prepareSuppliesImport: jest.fn(async () => ({ session: { id: 5, opened_at: "2026-10-13" }, event: { id: 9 } }))
}));

import { commitHospitalImport } from "@/lib/hospitalDrugImportServer";

beforeEach(() => {
  mockCalls.length = 0;
  mockSave.mockClear();
  mockQuery.mockReset();
  mockQuery.mockResolvedValue([{ id: 3, name: "รพ.ละงู", typecode: "07" }]);
});

it("วันที่ 2: บันทึกรายงานประจำวันของยาที่ติดตาม เพิ่มยาใหม่ด้วยวันเริ่มตามไฟล์ และแทนที่ล็อต", async () => {
  jest.useFakeTimers().setSystemTime(new Date("2026-10-15T05:00:00Z"));
  const counts = await commitHospitalImport({
    user: { id: 1 }, eocType: "flood", sessionId: 5, facilityId: 3, hospCode: "EA1", onhandDate: "2026-10-14", inventoryComplete: true,
    filenames: ["Download_INVENTORY_EA1.txt"],
    items: [
      { working_code: "100", name: "Doxycycline", unit: "เม็ด", onhand: 880, lots: [{ lot_no: "L1", expire_date: "2027-01-01", qty: 880 }], usage: [] },
      { working_code: "200", name: "Amoxicillin", unit: "cap", onhand: 500, lots: [], usage: [{ period: "202509", used: 300, received: 0 }] }
    ]
  });
  jest.useRealTimers();
  expect(counts).toMatchObject({ reported: 1, created: 1, lots: 1, months: 1 });
  expect(mockSave).toHaveBeenCalledWith(expect.any(Function), expect.objectContaining({
    source: "hospital",
    entries: [expect.objectContaining({ stock_id: 1, report_date: "2026-10-14", value: expect.objectContaining({ received_qty: 0, used_qty: 120, counted_qty: 880 }) })]
  }));
  const insert = mockCalls.find((call) => /^\s*INSERT INTO medical_inventory_stock/.test(call.sql));
  expect(insert.params).toEqual(expect.arrayContaining(["EA1:200", 500, "2026-10-14 12:00:00"]));
  expect(mockCalls.some((call) => /DELETE FROM medical_inventory_lots/.test(call.sql) && call.params[0] === 1)).toBe(true);
  expect(mockCalls.some((call) => /medical_inventory_usage_baseline/.test(call.sql) && call.params[0] === 77)).toBe(true);
});
