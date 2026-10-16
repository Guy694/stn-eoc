/** @jest-environment node */
// บันทึกคำขอความช่วยเหลือ/รายงานระดับน้ำ: เวลาเกิดเหตุต้องส่งเข้า MySQL เป็น Date (ไม่ใช่ ISO ลงท้าย Z ที่ MySQL strict ปฏิเสธ)
const mockExecute = jest.fn(async () => [{ insertId: 77 }]);
jest.mock("@/lib/rateLimit", () => ({ enforceIpRateLimit: jest.fn(async () => null) }));
jest.mock("@/lib/db", () => ({ getConnection: jest.fn(async () => ({ execute: mockExecute })) }));
jest.mock("@/lib/telegram", () => ({ escapeTelegramHtml: (v) => v, getTelegramHelpNotifyChatIds: () => [], sendTelegramMessage: jest.fn(), sendTelegramPhoto: jest.fn() }));
jest.mock("@/lib/helpAlertsServer", () => ({ notifyOfficersOfNewHelp: jest.fn(async () => {}) }));
jest.mock("@/lib/incidentTrackingDb", () => ({ startTracking: jest.fn(async () => "ABC123") }));
jest.mock("@/lib/incidentPublishingDb", () => ({ hasWaterTrendColumn: jest.fn(async () => true) }));
jest.mock("@/lib/eocOpen", () => ({ HELP_CLOSED_MESSAGE: "", PROBLEM_CLOSED_MESSAGE: "", WATER_CLOSED_MESSAGE: "", getOpenEocSessions: jest.fn(async () => [{ eoc_type: "flood" }]), hasOpenEoc: jest.fn(async () => true) }));

const { POST } = require("@/app/api/public/report-incident/route");

function post(fields) {
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) form.append(key, value);
  return POST(new Request("http://localhost/stn-eoc/api/public/report-incident", { method: "POST", body: form }));
}
const localNow = () => {
  const d = new Date(Date.now() + 7 * 3600e3);
  return d.toISOString().slice(0, 16); // เวลาไทยแบบ datetime-local
};

beforeEach(() => mockExecute.mockClear());

test("ขอความช่วยเหลือ [ทดสอบ] บันทึกได้ และ occurred_at เป็น Date", async () => {
  const response = await post({ firstName: "[ทดสอบ]", lastName: "ใจดี", phone: "0812345678", latitude: "6.91", longitude: "99.78", reportType: "help_request", helpCategory: "other", helpReason: "น้ำเข้าบ้าน", occurredAt: localNow() });
  const json = await response.json();
  expect(response.status).toBe(200);
  expect(json).toMatchObject({ success: true, reportId: 77, trackingCode: "ABC123" });
  const params = mockExecute.mock.calls[0][1];
  const occurred = params.find((value) => value instanceof Date);
  expect(occurred).toBeInstanceOf(Date);
  expect(params.some((value) => typeof value === "string" && /T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value))).toBe(false);
});

test("รายงานระดับน้ำ [ทดสอบ] บันทึกได้ และ occurred_at เป็น Date", async () => {
  const response = await post({ reportSource: "water_level", firstName: "[ทดสอบ]", waterLevel: "ankle_knee", latitude: "6.91", longitude: "99.78", occurredAt: localNow() });
  const json = await response.json();
  expect(json.success).toBe(true);
  const params = mockExecute.mock.calls[0][1];
  expect(params.some((value) => value instanceof Date)).toBe(true);
});
