/** @jest-environment node */
// สถานการณ์จำลอง [ทดสอบ]: ฝนตกหนัก / น้ำขึ้นใกล้ตลิ่ง → ระบบบันทึกแจ้งเตือน (popup เจ้าหน้าที่) + Telegram + เตือนประชาชน
jest.mock("@/lib/db", () => ({ query: jest.fn(), getPool: jest.fn() }));
jest.mock("@/lib/thaiWaterClient", () => ({ getSatunWaterLevels: jest.fn(), getSatunRainfall: jest.fn() }));
jest.mock("@/lib/publicPushServer", () => ({ sendResolvedAlerts: jest.fn(async () => ({ sent: 1, delivered: 1, recipients: 1 })) }));
jest.mock("@/lib/telegram", () => ({
  escapeTelegramHtml: (v) => String(v),
  getTelegramHelpNotifyChatIds: jest.fn(() => ["-100test"]),
  sendTelegramMessage: jest.fn(async () => ({ ok: true }))
}));

import { query } from "@/lib/db";
import { getSatunRainfall, getSatunWaterLevels } from "@/lib/thaiWaterClient";
import { sendTelegramMessage } from "@/lib/telegram";
import { sendResolvedAlerts } from "@/lib/publicPushServer";
import { runWaterAlerts } from "@/lib/waterAlertRunner";
import { measuredWarnings } from "@/lib/weatherWatch";
import { warningCandidates } from "@/lib/publicPush";

const minutesAgo = (m) => new Date(Date.now() - m * 60000).toISOString();
const water = (bankDiff, over = {}) => ({ id: "T1", name: "[ทดสอบ] บ้านปันจอร์", amphoe: "ควนโดน", tambon: "ย่านซื่อ", bankDiff, waterLevelMsl: 20 + bankDiff, bankLevelMsl: 20, observedAt: minutesAgo(20), ...over });
const rain = (rain24h, over = {}) => ({ id: "R1", name: "[ทดสอบ] ทุ่งหว้า", amphoe: "ทุ่งหว้า", tambon: "ทุ่งหว้า", rain24h, rain1h: 12, observedAt: minutesAgo(20), ...over });

let states;
let logs;
function fakeDb() {
  states = new Map();
  logs = [];
  query.mockImplementation(async (sql, params = []) => {
    if (sql.startsWith("SELECT station_id, state FROM water_station_alert_state")) return [...states].map(([station_id, state]) => ({ station_id, state }));
    if (sql.includes("INSERT INTO water_station_alert_state")) { states.set(params[0], params[3]); return {}; }
    if (sql.includes("INSERT INTO water_alert_log")) { logs.push({ kind: params[0], level: params[3], title: params[8] }); return { insertId: logs.length }; }
    return {};
  });
}

const ENV = { ...process.env };
beforeEach(() => {
  jest.clearAllMocks();
  fakeDb();
  process.env = { ...ENV, TELEGRAM_BOT_TOKEN: "test-token", TELEGRAM_HELP_NOTIFY_CHAT_IDS: "-100test", EOC_ALERTS_TELEGRAM: "" };
});
afterAll(() => { process.env = ENV; });

async function round(waterStations, rainStations) {
  getSatunWaterLevels.mockResolvedValue({ stations: waterStations });
  getSatunRainfall.mockResolvedValue({ stations: rainStations });
  return runWaterAlerts();
}

test("น้ำขึ้น: ปกติ → ใกล้ตลิ่ง → ล้นตลิ่ง แจ้งทุกครั้งที่แย่ลง ไม่แจ้งซ้ำเมื่อคงที่", async () => {
  expect((await round([water(-2)], [])).saved).toBe(0);
  let result = await round([water(-0.4)], []);
  expect(logs.at(-1)).toMatchObject({ kind: "water", level: "serious" });
  expect(logs.at(-1).title).toContain("ใกล้ล้นตลิ่ง");
  expect(result.delivered).toBe(1);
  expect((await round([water(-0.35)], [])).saved).toBe(0); // ยังใกล้ตลิ่ง ไม่แจ้งซ้ำ
  result = await round([water(0.15)], []);
  expect(logs.at(-1)).toMatchObject({ level: "critical" });
  expect(logs.at(-1).title).toContain("น้ำล้นตลิ่ง");
  expect(sendTelegramMessage).toHaveBeenCalledTimes(2);
});

test("ฝนหนัก ≥ 35.1 มม. = เฝ้าระวัง, ≥ 90.1 มม. = วิกฤต (เกณฑ์ ปภ.)", async () => {
  await round([], [rain(35)]);
  expect(logs).toHaveLength(0);
  await round([], [rain(40)]);
  expect(logs.at(-1)).toMatchObject({ kind: "rain", level: "serious" });
  await round([], [rain(95)]);
  expect(logs.at(-1)).toMatchObject({ kind: "rain", level: "critical" });
});

test("ข้อมูลเก่า (น้ำ > 3 ชม. / ฝน > 6 ชม.) ไม่ใช้ตัดสินการเตือน", async () => {
  await round([water(0.5, { observedAt: minutesAgo(4 * 60) })], [rain(120, { observedAt: minutesAgo(7 * 60) })]);
  expect(logs).toHaveLength(0);
});

test("ไม่มี Telegram: ยังบันทึกให้ popup บนเว็บเจ้าหน้าที่เด้ง แต่ไม่ส่ง", async () => {
  delete process.env.TELEGRAM_BOT_TOKEN;
  const result = await round([water(0.2)], []);
  expect(logs).toHaveLength(1);
  expect(result.delivered).toBe(0);
  expect(sendTelegramMessage).not.toHaveBeenCalled();
});

test("เตือนประชาชน (Web Push): ส่งเฉพาะน้ำล้นตลิ่ง หรือฝน 24 ชม. ≥ 90 มม.", () => {
  const now = Date.now();
  const warnings = measuredWarnings([water(-0.3), water(0.1, { id: "T2", name: "[ทดสอบ] ควนกาหลง", amphoe: "ควนกาหลง" })], [rain(70), rain(95, { id: "R2" })], now);
  expect(warnings.filter((w) => w.level === "watch")).toHaveLength(2); // ขึ้นแถบเตือนบนเว็บ แต่ไม่ push
  const push = warningCandidates(warnings, now);
  expect(push).toHaveLength(2);
  expect(push.map((p) => p.message).join(" ")).toMatch(/น้ำล้นตลิ่ง.*ฝนตกหนัก/);
});

test("น้ำลดจากล้นตลิ่ง → แจ้งประชาชนว่าน้ำลดแล้ว (ส่งต่อให้ระบบ push)", async () => {
  jest.spyOn(console, "info").mockImplementation(() => {});
  await round([water(0.2)], []);
  expect(sendResolvedAlerts).not.toHaveBeenCalled();
  await round([water(-0.3)], []);
  expect(sendResolvedAlerts).toHaveBeenCalledTimes(1);
  expect(sendResolvedAlerts.mock.calls[0][0][0]).toMatchObject({ previousState: "overflow", state: "near", amphoe: "ควนโดน" });
});
