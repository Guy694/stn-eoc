import { PROMPT_KEY, promptMode, readPromptState, snooze } from "@/lib/alertPrompt";

const ready = { supported: true, enabled: true, subscribed: false, permission: "default" };

describe("alertPrompt", () => {
  test("ชวนเฉพาะเครื่องที่ยังไม่ได้รับและไม่ได้ปฏิเสธ", () => {
    expect(promptMode({ status: ready })).toBe("subscribe");
    expect(promptMode({ status: { ...ready, subscribed: true } })).toBeNull();
    expect(promptMode({ status: { ...ready, permission: "denied" } })).toBeNull();
    expect(promptMode({ status: { ...ready, enabled: false } })).toBeNull();
    expect(promptMode({ status: { supported: false } })).toBeNull();
  });

  test("iPhone ที่ยังไม่เพิ่มหน้าจอโฮม / เปิดในแอป LINE ได้คำแนะนำเฉพาะ", () => {
    expect(promptMode({ status: { supported: false }, env: { ios: true, standalone: false } })).toBe("ios-install");
    expect(promptMode({ status: ready, env: { ios: true, standalone: true } })).toBe("subscribe");
    expect(promptMode({ status: ready, env: { inApp: true } })).toBe("open-browser");
  });

  test("ไว้ทีหลัง = เว้น 3 วัน", () => {
    const store = new Map();
    const storage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) };
    const now = Date.parse("2026-10-20T10:00:00+07:00");
    snooze(storage, "later", now);
    expect(store.has(PROMPT_KEY)).toBe(true);
    const state = readPromptState(storage);
    expect(promptMode({ status: ready, state, now: now + 86400000 })).toBeNull();
    expect(promptMode({ status: ready, state, now: now + 4 * 86400000 })).toBe("subscribe");
  });
});
