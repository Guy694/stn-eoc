import { formatCategorized, formatSecurityBody, groupChatIds, personalAllowed, sendCategorized } from "@/lib/telegramChannels";

jest.mock("@/lib/db", () => ({ query: jest.fn() }));

const env = { TELEGRAM_BOT_TOKEN: "[ทดสอบ]", TELEGRAM_HELP_NOTIFY_CHAT_IDS: "-100staff", TELEGRAM_SECURITY_CHAT_IDS: "-100admin" };

test("เหตุความปลอดภัยไปกลุ่มผู้ดูแลเท่านั้น ไม่ถอยไปกลุ่มเจ้าหน้าที่", () => {
  expect(groupChatIds("security", env)).toEqual(["-100admin"]);
  expect(groupChatIds("security", { TELEGRAM_HELP_NOTIFY_CHAT_IDS: "-100staff" })).toEqual([]);
  expect(groupChatIds("water", env)).toEqual(["-100staff"]);
  expect(groupChatIds("rain", { ...env, TELEGRAM_WATER_CHAT_IDS: "-100water" })).toEqual(["-100water"]);
});

test("ข้อความส่วนตัว: แอดมินได้ทุกเรื่อง เจ้าหน้าที่ได้เฉพาะน้ำ ฝน คำขอช่วยเหลือ", () => {
  expect(personalAllowed("security", "admin")).toBe(true);
  expect(personalAllowed("security", "staff")).toBe(false);
  expect(personalAllowed("water", "SEhRT")).toBe(true);
  expect(personalAllowed("event", "staff")).toBe(false);
  expect(personalAllowed("test", "admin")).toBe(false);
});

test("หัวข้อความบอกประเภทและผู้รับชัดเจน", () => {
  const text = formatCategorized("security", "x", { now: new Date("2026-10-22T08:30:00Z") });
  expect(text.split("\n")[0]).toBe("🔐 <b>ความปลอดภัยระบบ</b>");
  expect(text).toContain("ถึง: ผู้ดูแลระบบเท่านั้น");
  expect(formatCategorized("water", "x")).toContain("ถึง: เจ้าหน้าที่ทุกคน");
  const body = formatSecurityBody("account_locked_after_failed_logins", { username: "<test>", scope: "ip" });
  expect(body).toContain("บัญชีถูกล็อก");
  expect(body).toContain("&lt;test&gt;");
  expect(body).toContain("เครือข่าย/IP เดียวกัน");
});

test("ส่งไม่ซ้ำ chat และเจ้าหน้าที่ทั่วไปไม่ได้รับเหตุความปลอดภัย", async () => {
  const send = jest.fn().mockResolvedValue({ ok: true });
  const run = jest.fn().mockResolvedValue([
    { telegram_chat_id: "111", role: "admin" },
    { telegram_chat_id: "-100admin", role: "admin" },
    { telegram_chat_id: "222", role: "staff" }
  ]);
  const result = await sendCategorized("security", "[ทดสอบ]", { env, send, run });
  expect(run.mock.calls[0][0]).toContain("role = 'admin'");
  expect(send.mock.calls.map((call) => call[0]).sort()).toEqual(["-100admin", "111"]);
  expect(result).toMatchObject({ delivered: 2, total: 2 });
});
