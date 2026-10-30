/** @jest-environment node */
// รายละเอียดคำขอความช่วยเหลือ: จัดลำดับความเร่งด่วนที่เซิร์ฟเวอร์ + บันทึกเป็นบรรทัดให้ สสจ. ส่งต่อ ปภ.
import { deriveHelpUrgency, helpDetailLines, normalizeHelpDetails, travelStatusForAccess, waterLevelColumn } from "@/lib/helpRequestDetails";

const mockExecute = jest.fn(async () => [{ insertId: 91 }]);
jest.mock("@/lib/rateLimit", () => ({ enforceIpRateLimit: jest.fn(async () => null) }));
jest.mock("@/lib/db", () => ({ getConnection: jest.fn(async () => ({ execute: mockExecute })) }));
jest.mock("@/lib/telegram", () => ({ escapeTelegramHtml: (v) => v, getTelegramHelpNotifyChatIds: () => [], sendTelegramMessage: jest.fn(), sendTelegramPhoto: jest.fn() }));
jest.mock("@/lib/helpAlertsServer", () => ({ notifyOfficersOfNewHelp: jest.fn(async () => {}) }));
jest.mock("@/lib/incidentTrackingDb", () => ({ startTracking: jest.fn(async () => "XYZ789") }));
jest.mock("@/lib/incidentPublishingDb", () => ({ hasWaterTrendColumn: jest.fn(async () => true) }));
jest.mock("@/lib/eocOpen", () => ({ HELP_CLOSED_MESSAGE: "", PROBLEM_CLOSED_MESSAGE: "", WATER_CLOSED_MESSAGE: "", getOpenEocSessions: jest.fn(async () => [{ eoc_type: "flood" }]), hasOpenEoc: jest.fn(async () => true) }));

const { POST } = require("@/app/api/public/report-incident/route");

function post(fields) {
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) form.append(key, value);
  return POST(new Request("http://localhost/stn-eoc/api/public/report-incident", { method: "POST", body: form }));
}
const base = { firstName: "สมชาย", lastName: "ใจดี", phone: "0812345678", latitude: "6.91", longitude: "99.78", reportType: "help_request", helpCategory: "medicine", helpReason: "ยาหมด" };

beforeEach(() => mockExecute.mockClear());

describe("normalizeHelpDetails", () => {
  test("ตัดค่าที่ไม่รู้จักทิ้ง และไม่เก็บข้อมูลผู้ต้องการความช่วยเหลือเมื่อแจ้งเอง", () => {
    const d = normalizeHelpDetails({ vulnerableGroups: "bedridden,hacker,elderly,bedridden", peopleCount: "abc", mobility: "fly", patientName: "x" });
    expect(d.vulnerableGroups).toEqual(["bedridden", "elderly"]);
    expect(d.peopleCount).toBeNull();
    expect(d.mobility).toBe("");
    expect(d.patientName).toBe("");
  });
});

describe("deriveHelpUrgency", () => {
  test.each([
    [{}, "medium"],
    [{ medicineRemaining: "4_7" }, "medium"],
    [{ medicineRemaining: "1_3" }, "high"],
    [{ medicineRemaining: "out" }, "high"],
    [{ vulnerableGroups: ["elderly"], mobility: "assisted" }, "high"],
    [{ vulnerableGroups: ["bedridden"] }, "high"],
    [{ mobility: "trapped" }, "high"],
    [{ mobility: "trapped", vulnerableGroups: ["oxygen"] }, "critical"],
    [{ mobility: "trapped", homeWaterLevel: "waist_chest" }, "critical"],
    [{ medicineRemaining: "out", vulnerableGroups: ["dialysis"] }, "critical"],
    [{ homeWaterLevel: "chest_up" }, "critical"]
  ])("%j → %s", (input, expected) => {
    expect(deriveHelpUrgency(normalizeHelpDetails(input))).toBe(expected);
  });
});

test("ค่าคอลัมน์: ไม่มีน้ำท่วมไม่ลง water_level และการเข้าถึงแปลงเป็น travel_status", () => {
  expect(waterLevelColumn("none")).toBe("");
  expect(waterLevelColumn("knee_waist")).toBe("knee_waist");
  expect(travelStatusForAccess("boat")).toBe("impassable");
  expect(travelStatusForAccess("unknown")).toBeNull();
});

test("แจ้งแทนผู้อื่น: บรรทัดสรุประบุผู้ต้องการความช่วยเหลือ", () => {
  const lines = helpDetailLines(normalizeHelpDetails({ onBehalf: "other", relation: "ลูก/หลาน", patientName: "นางสมใจ ใจดี", patientPhone: "0899999999", peopleCount: "3" }));
  expect(lines).toEqual(["ผู้แจ้ง: แจ้งแทนผู้อื่น (ลูก/หลาน)", "ผู้ต้องการความช่วยเหลือ: นางสมใจ ใจดี · โทร 0899999999", "จำนวนคนในบ้าน: 3 คน"]);
});

test("API บันทึกรายละเอียด จัดความเร่งด่วนเอง (ไม่เชื่อ urgency จากเบราว์เซอร์)", async () => {
  const response = await post({
    ...base,
    urgency: "low",
    peopleCount: "4",
    vulnerableGroups: "bedridden,oxygen",
    medicineRemaining: "out",
    homeWaterLevel: "knee_waist",
    mobility: "trapped",
    accessRoute: "boat"
  });
  expect(response.status).toBe(200);
  const [sql, params] = mockExecute.mock.calls[0];
  expect(sql).toContain("INSERT INTO public_incident_reports");
  const description = params[6];
  expect(description.split("\n")[0]).toBe("ประเภทความช่วยเหลือ: ด้านยา");
  expect(description).toContain("กลุ่มที่ต้องดูแลพิเศษ: ผู้ป่วยติดเตียง, ใช้ออกซิเจน/เครื่องมือแพทย์ที่ใช้ไฟฟ้า");
  expect(description).toContain("การเข้าถึงพื้นที่: ต้องใช้เรือ");
  expect(params[7]).toBe("knee_waist"); // water_level
  expect(params[8]).toBe(4); // affected_people
  expect(params[9]).toBe("critical"); // urgency
  expect(params[10]).toBe("impassable"); // travel_status
});

test("API: เบอร์ผู้ต้องการความช่วยเหลือสั้นเกิน → 400", async () => {
  const response = await post({ ...base, onBehalf: "other", patientPhone: "0812" });
  expect(response.status).toBe(400);
  expect(mockExecute).not.toHaveBeenCalled();
});
