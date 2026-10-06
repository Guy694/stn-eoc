jest.mock("@/lib/db", () => ({ query: jest.fn() }));
jest.mock("@/lib/eocBriefData", () => ({ loadEventBrief: jest.fn() }));
jest.mock("@/lib/telegram", () => ({ escapeTelegramHtml: (v) => v, getTelegramHelpNotifyChatIds: () => ["1"], sendTelegramMessage: jest.fn(async () => ({ ok: true })) }));

import { query } from "@/lib/db";
import { loadEventBrief } from "@/lib/eocBriefData";
import { sendTelegramMessage } from "@/lib/telegram";
import * as alerts from "@/lib/eocAlerts";
import { alertSendingEnabled, isTestAlert, runEventAlerts } from "@/lib/eocAlertRunner";

const session = { id: 58, eoc_type: "flood", session_number: 5, status: "active" };

beforeEach(() => {
  jest.clearAllMocks();
  process.env.TELEGRAM_BOT_TOKEN = "x";
  delete process.env.EOC_ALERTS_TELEGRAM;
  query.mockImplementation(async (sql) => (sql.startsWith("SELECT") ? [] : { affectedRows: 1 }));
  loadEventBrief.mockResolvedValue({});
});

it("แยกเรื่องจากข้อมูลทดสอบ", () => {
  expect(isTestAlert({ text: "ศูนย์ [ทดสอบ] เต็ม" })).toBe(true);
  expect(isTestAlert({ text: "อ.ละงู ผู้ป่วยเพิ่ม" })).toBe(false);
});

it("ปิดการส่งได้ด้วย EOC_ALERTS_TELEGRAM=off", () => {
  expect(alertSendingEnabled()).toBe(true);
  process.env.EOC_ALERTS_TELEGRAM = "off";
  expect(alertSendingEnabled()).toBe(false);
});

it("ไม่ส่งเรื่องทดสอบออก Telegram แต่ยังบันทึกประวัติ", async () => {
  jest.spyOn(alerts, "detectAlerts").mockReturnValue([{ key: "shelter-full:1", level: "serious", text: "ศูนย์ [ทดสอบ] เต็ม" }]);
  const result = await runEventAlerts(session);
  expect(sendTelegramMessage).not.toHaveBeenCalled();
  expect(result.sent).toBe(1);
  expect(query.mock.calls.some(([sql]) => sql.includes("INSERT IGNORE INTO eoc_alert_log"))).toBe(true);
});

it("ส่งเรื่องจริงตามปกติ และไม่ส่งเมื่อปิดสวิตช์", async () => {
  jest.spyOn(alerts, "detectAlerts").mockReturnValue([{ key: "deaths:1", level: "critical", text: "มีผู้เสียชีวิต 1 ราย" }]);
  await runEventAlerts(session);
  expect(sendTelegramMessage).toHaveBeenCalledTimes(1);
  sendTelegramMessage.mockClear();
  process.env.EOC_ALERTS_TELEGRAM = "off";
  await runEventAlerts(session);
  expect(sendTelegramMessage).not.toHaveBeenCalled();
});
