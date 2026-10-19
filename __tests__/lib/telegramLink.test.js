/** @jest-environment node */
// เชื่อม Telegram ด้วยลิงก์บอท: รหัสครั้งเดียว → /start <รหัส> → ผูก chat_id ให้เจ้าหน้าที่เจ้าของรหัส
const mockQuery = jest.fn();
jest.mock("@/lib/db", () => ({ query: (...args) => mockQuery(...args) }));

const { parseStartToken, startMessages, processTelegramUpdates, hashLinkToken, syncTelegramUpdates, resetTelegramLinkState, createTelegramLink } = require("@/lib/telegramLink");

const TOKEN = "AbCdEfGhIjKlMnOpQrStUvWx";
const update = (id, text, type = "private", chatId = 555) => ({ update_id: id, message: { chat: { id: chatId, type }, from: { first_name: "[ทดสอบ]" }, text } });

beforeEach(() => {
  mockQuery.mockReset();
  resetTelegramLinkState();
  process.env.TELEGRAM_BOT_TOKEN = "test-token";
  process.env.TELEGRAM_BOT_USERNAME = "stn_eoc_test_bot";
});

test("อ่านรหัสจาก /start เฉพาะรูปแบบที่ถูกต้อง", () => {
  expect(parseStartToken(`/start ${TOKEN}`)).toBe(TOKEN);
  expect(parseStartToken(`/start@stn_eoc_test_bot ${TOKEN}`)).toBe(TOKEN);
  expect(parseStartToken("/start")).toBeNull();
  expect(parseStartToken("/start officer_5")).toBeNull(); // รูปแบบเดิมที่เดาได้ ใช้ไม่ได้แล้ว
  expect(parseStartToken("สวัสดี")).toBeNull();
});

test("รับเฉพาะ /start จากแชตส่วนตัว (ไม่รับจากกลุ่ม)", () => {
  const list = startMessages([update(1, `/start ${TOKEN}`), update(2, `/start ${TOKEN}`, "group"), update(3, "hello")]);
  expect(list).toEqual([{ chatId: "555", token: TOKEN, name: "[ทดสอบ]" }]);
});

test("สร้างลิงก์: เก็บเฉพาะ hash ของรหัส และลิงก์ชี้ไปบอท", async () => {
  mockQuery.mockResolvedValue({ affectedRows: 1 });
  const link = await createTelegramLink(7);
  expect(link.url).toMatch(/^https:\/\/t\.me\/stn_eoc_test_bot\?start=[A-Za-z0-9_-]{24}$/);
  const token = link.url.split("start=")[1];
  const insert = mockQuery.mock.calls.find(([sql]) => sql.startsWith("INSERT"));
  expect(insert[1]).toEqual([hashLinkToken(token), 7]);
  expect(JSON.stringify(mockQuery.mock.calls)).not.toContain(token);
});

test("รหัสถูกต้อง → ผูก chat_id + เปิดรับ และส่งข้อความยืนยัน · รหัสใช้ได้ครั้งเดียว", async () => {
  mockQuery.mockImplementation(async (sql) => {
    if (sql.startsWith("SELECT officer_id")) return [{ officer_id: 7 }];
    if (sql.startsWith("DELETE")) return { affectedRows: 1 };
    if (sql.startsWith("UPDATE officer")) return { affectedRows: 1 };
    if (sql.startsWith("SELECT id, title")) return [{ id: 7, title: "นาย", given_name: "[ทดสอบ]", family_name: "ใจดี" }];
    return [];
  });
  const send = jest.fn(async () => ({ ok: true }));
  const linked = await processTelegramUpdates([update(10, `/start ${TOKEN}`)], { send });
  expect(linked).toEqual([7]);
  expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining("UPDATE officer SET telegram_chat_id"), ["555", 7]);
  expect(send).toHaveBeenCalledWith("555", expect.stringContaining("เชื่อม Telegram"));
});

test("รหัสหมดอายุ/ไม่มี → ไม่ผูก และตอบวิธีเชื่อม", async () => {
  mockQuery.mockResolvedValue([]);
  const send = jest.fn(async () => ({ ok: true }));
  expect(await processTelegramUpdates([update(11, `/start ${TOKEN}`)], { send })).toEqual([]);
  expect(mockQuery).not.toHaveBeenCalledWith(expect.stringContaining("UPDATE officer"), expect.anything());
  expect(send).toHaveBeenCalledWith("555", expect.stringContaining("หน้าโปรไฟล์"));
});

test("บอทถูกตั้ง webhook/ระบบอื่นใช้อยู่ (409) → แจ้ง conflict", async () => {
  const fetchImpl = jest.fn(async () => ({ status: 409, json: async () => ({ ok: false, error_code: 409 }) }));
  const result = await syncTelegramUpdates({ fetchImpl });
  expect(result).toMatchObject({ ok: false, conflict: true });
});

test("getUpdates: ยืนยัน offset หลังประมวลผล", async () => {
  mockQuery.mockResolvedValue([]);
  const bodies = [];
  const fetchImpl = jest.fn(async (_url, init) => {
    bodies.push(JSON.parse(init.body));
    return { status: 200, json: async () => ({ ok: true, result: bodies.length === 1 ? [update(41, "hi"), update(42, "hey")] : [] }) };
  });
  await syncTelegramUpdates({ fetchImpl, send: jest.fn() });
  await new Promise((resolve) => setTimeout(resolve, 2100));
  await syncTelegramUpdates({ fetchImpl, send: jest.fn() });
  expect(bodies[1].offset).toBe(43);
}, 10000);
