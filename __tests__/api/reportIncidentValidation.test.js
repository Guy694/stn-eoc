/** @jest-environment node */
// ตรวจข้อมูลจากประชาชนก่อนแตะฐานข้อมูล: เบอร์ พิกัด และช่องที่ส่งไฟล์มาแทนข้อความ
jest.mock("@/lib/rateLimit", () => ({ enforceIpRateLimit: jest.fn(async () => null) }));
jest.mock("@/lib/db", () => ({ getConnection: jest.fn(() => { throw new Error("ไม่ควรถึงฐานข้อมูล"); }) }));
jest.mock("@/lib/telegram", () => ({ escapeTelegramHtml: (v) => v, getTelegramHelpNotifyChatIds: () => [], sendTelegramMessage: jest.fn(), sendTelegramPhoto: jest.fn() }));
jest.mock("@/lib/helpAlertsServer", () => ({ notifyOfficersOfNewHelp: jest.fn() }));
jest.mock("@/lib/incidentTrackingDb", () => ({ startTracking: jest.fn() }));
jest.mock("@/lib/incidentPublishingDb", () => ({ hasWaterTrendColumn: jest.fn(async () => false) }));
jest.mock("@/lib/eocOpen", () => ({ HELP_CLOSED_MESSAGE: "", PROBLEM_CLOSED_MESSAGE: "", WATER_CLOSED_MESSAGE: "", getOpenEocSessions: jest.fn(async () => []), hasOpenEoc: jest.fn(async () => true) }));

const { POST } = require("@/app/api/public/report-incident/route");

function post(fields) {
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) form.append(key, value);
  return POST(new Request("http://localhost/stn-eoc/api/public/report-incident", { method: "POST", body: form }));
}
const base = { firstName: "สมใจ", lastName: "ใจดี", phone: "0812345678", latitude: "6.91", longitude: "99.78", reportType: "help_request", helpCategory: "อพยพ", description: "น้ำเข้าบ้าน" };

test.each([
  ["เบอร์โทรสั้น/มีตัวอักษร", { phone: "08x12" }, "เบอร์โทร"],
  ["พิกัดนอกประเทศไทย", { latitude: "48.85", longitude: "2.35" }, "ตำแหน่ง"],
  ["พิกัดไม่ใช่ตัวเลข", { latitude: "abc" }, "ตำแหน่ง"],
  ["ส่งไฟล์มาแทนชื่อ", { firstName: new Blob(["x"]) }, "กรอกข้อมูลที่จำเป็น"]
])("%s → 400 ก่อนบันทึก", async (_label, override, message) => {
  const response = await post({ ...base, ...override });
  expect(response.status).toBe(400);
  expect((await response.json()).message).toContain(message);
});
