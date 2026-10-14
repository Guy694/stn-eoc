import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import SuppliesDashboard from "@/components/eoc/supplies/SuppliesDashboard";
import SuppliesDailyReport from "@/components/eoc/supplies/SuppliesDailyReport";
import { buildSupplyDashboard } from "@/lib/medicalDailyServer";

jest.mock("@/lib/db", () => ({ query: jest.fn(), transaction: jest.fn() }));
global.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };

const stock = [
  { id: 1, health_facility_id: 7, agency_name: "รพ.ละงู", district_name: "ละงู", item_code: "DOXY", item_name: "ยา Doxycycline 100 mg", unit: "เม็ด", opening_qty: 1000, received_qty: 500, issued_qty: 470, balance_qty: 1030, created_day: "2026-10-13" },
  { id: 2, health_facility_id: 5, agency_name: "รพ.ทุ่งหว้า", district_name: "ทุ่งหว้า", item_code: "DOXY", item_name: "ยา Doxycycline 100 mg", unit: "เม็ด", opening_qty: 100, received_qty: 0, issued_qty: 90, balance_qty: 10, created_day: "2026-10-13" }
];
const reports = [
  { stock_id: 1, report_date: "2026-10-14", received_qty: 0, used_qty: 120, counted_qty: null },
  { stock_id: 1, report_date: "2026-10-15", received_qty: 500, used_qty: 200, counted_qty: 1180 },
  { stock_id: 1, report_date: "2026-10-16", received_qty: 0, used_qty: 150, counted_qty: 1000 },
  { stock_id: 2, report_date: "2026-10-15", received_qty: 0, used_qty: 90, counted_qty: null }
];
const data = { stock, reports, reportsByStock: new Map([[1, reports.slice(0, 3)], [2, reports.slice(3)]]), adjustmentsByStock: new Map() };
const session = { id: 9, opened_at: "2026-10-13T08:00:00", closed_at: null };

test("dashboard renders sections from real server summary", async () => {
  const dashboard = buildSupplyDashboard(data, session, new Date("2026-10-16T09:00:00+07:00"));
  expect(dashboard.items[0]).toMatchObject({ balance: 1040 });
  expect(dashboard.discrepancies[0]).toMatchObject({ diff: -30 });
  expect(dashboard.urgent[0].agency_name).toBe("รพ.ทุ่งหว้า");
  global.fetch = jest.fn(async () => ({ ok: true, json: async () => ({ success: true, dashboard }) }));
  render(<SuppliesDashboard sessionId={9} />);
  await waitFor(() => expect(screen.getByRole("heading", { name: "ต้องเติมด่วน" })).toBeInTheDocument());
  expect(screen.getByRole("heading", { name: "ยอดนับจริงไม่ตรงกับที่ระบบคำนวณ" })).toBeInTheDocument();
  expect(screen.getAllByText("รพ.ทุ่งหว้า").length).toBeGreaterThan(0);
  fireEvent.click(screen.getByText("รายอำเภอ"));
  expect(screen.getByText("อ.ละงู")).toBeInTheDocument();
});

test("daily form computes balance and blocks blanks", async () => {
  global.fetch = jest.fn(async () => ({ ok: true, json: async () => ({
    success: true, today: "2026-10-16", can_report: true, status: { total: 2, complete: 0, partial: 0, missing: 2, facilities: [] },
    rows: [{ stock_id: 1, item_name: "ยา Doxycycline 100 mg", unit: "เม็ด", start_qty: 1180, balance_qty: 1180, report: null }]
  }) }));
  render(<SuppliesDailyReport facilities={[{ id: 7, name: "รพ.ละงู" }]} facilityId="7" onFacilityChange={() => {}} />);
  const used = await screen.findByLabelText("ใช้ไป ยา Doxycycline 100 mg");
  fireEvent.click(screen.getByText(/บันทึกรายงานวันที่/));
  expect(screen.getByRole("alert").textContent).toMatch("ยังไม่กรอก");
  fireEvent.change(used, { target: { value: "150" } });
  expect(screen.getByText("1,030")).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("นับได้จริง ยา Doxycycline 100 mg"), { target: { value: "1000" } });
  expect(screen.getByText("ต่าง -30")).toBeInTheDocument();
});
