import { HOUSEKEEPING } from "@/lib/pdpaRetention.mjs";
import { ASK_SNOOZE_DAYS, recordVisit, shouldAskSatisfaction, summarizeSources, ratedRecently, summarizeRatings, validateSatisfaction } from "@/lib/satisfaction";

describe("ประเมินความพึงพอใจ", () => {
  test("ดาวบังคับ 1–5 ข้อเสนอแนะไม่บังคับ", () => {
    expect(validateSatisfaction({ rating: 5 }).value).toEqual({ rating: 5, comment: null, sources: null, sourceOther: null });
    expect(validateSatisfaction({ rating: "4", comment: "  ใช้ง่าย\u0007 ดีมาก  " }).value).toEqual({ rating: 4, comment: "ใช้ง่าย ดีมาก", sources: null, sourceOther: null });
    expect(validateSatisfaction({ rating: 0 }).error).toBeTruthy();
    expect(validateSatisfaction({ rating: 6 }).error).toBeTruthy();
    expect(validateSatisfaction({ rating: 3.5 }).error).toBeTruthy();
    expect(validateSatisfaction({ rating: 3, comment: "ก".repeat(1500) }).value.comment).toHaveLength(1000);
  });

  test("สรุปคะแนนเฉลี่ย สัดส่วน และ % พอใจ", () => {
    const s = summarizeRatings([{ rating: 5, n: 6 }, { rating: 4, n: 2 }, { rating: 1, n: 2 }]);
    expect(s).toMatchObject({ total: 10, average: 4, satisfied: 80 }); // (6×5 + 2×4 + 2×1) ÷ 10
    expect(s.counts).toEqual({ 1: 2, 2: 0, 3: 0, 4: 2, 5: 6 });
    expect(s.percent[5]).toBe(60);
    expect(summarizeRatings([])).toMatchObject({ total: 0, average: null, satisfied: null });
  });

  test("จำว่าเครื่องนี้ประเมินแล้ว 30 วัน", () => {
    const now = Date.parse("2026-10-28T00:00:00Z");
    expect(ratedRecently({ at: now - 5 * 86400000 }, now)).toBe(true);
    expect(ratedRecently({ at: now - 31 * 86400000 }, now)).toBe(false);
    expect(ratedRecently(null, now)).toBe(false);
  });

  test("ลบอัตโนมัติเมื่อเกินกำหนด", () => {
    expect(HOUSEKEEPING.map(([, sql]) => sql).join(" ")).toMatch(/DELETE FROM satisfaction_feedback/);
  });

  test("ช่องทางที่รู้จัก: รับเฉพาะรหัสที่กำหนด ไม่ซ้ำ และเก็บข้อความ อื่น ๆ เมื่อเลือกอื่น ๆ เท่านั้น", () => {
    const ok = validateSatisfaction({ rating: 5, sources: ["facebook", "line", "facebook", "hack", "other"], sourceOther: "  วิทยุชุมชน " }).value;
    expect(ok.sources).toBe("facebook,line,other");
    expect(ok.sourceOther).toBe("วิทยุชุมชน");
    const noOther = validateSatisfaction({ rating: 5, sources: ["line"], sourceOther: "ไม่ควรเก็บ" }).value;
    expect(noOther).toMatchObject({ sources: "line", sourceOther: null });
    expect(validateSatisfaction({ rating: 5, sources: "line" }).value.sources).toBeNull();
    expect(validateSatisfaction({ rating: 5, sources: ["other"], sourceOther: "ก".repeat(300) }).value.sourceOther).toHaveLength(100);
    expect(summarizeSources([{ sources: "facebook,line", n: 3 }, { sources: "line", n: 2 }, { sources: null, n: 5 }, { sources: "x", n: 1 }]).map((i) => [i.key, i.n]))
      .toEqual([["line", 5], ["facebook", 3]]);
  });

  test("เด้งขอประเมินเมื่อใช้งานมาสักพัก ไม่เด้งซ้ำถ้าเพิ่งประเมินหรือเพิ่งปิด", () => {
    const now = Date.parse("2026-10-30T03:00:00Z");
    let state = null;
    state = recordVisit(state, { now, newSession: true });
    expect(shouldAskSatisfaction(state, null, now)).toBe(false); // เข้าครั้งแรก
    state = recordVisit(state, { now });
    state = recordVisit(state, { now });
    expect(state).toMatchObject({ sessions: 1, pages: 3 });
    expect(shouldAskSatisfaction(state, null, now)).toBe(false);
    // เข้าใช้ครบ 3 ครั้ง
    let three = state;
    for (let i = 0; i < 2; i += 1) three = recordVisit(three, { now, newSession: true });
    expect(shouldAskSatisfaction(three, null, now)).toBe(true);
    // เปิดครบ 8 หน้า
    let pages = null;
    for (let i = 0; i < 8; i += 1) pages = recordVisit(pages, { now });
    expect(shouldAskSatisfaction(pages, null, now)).toBe(true);
    // กลับมาคนละวัน และเปิดอย่างน้อย 3 หน้า
    let days = recordVisit(null, { now, newSession: true });
    days = recordVisit(days, { now: now + 86400000, newSession: false });
    expect(shouldAskSatisfaction(days, null, now + 86400000)).toBe(false);
    days = recordVisit(days, { now: now + 86400000 });
    expect(shouldAskSatisfaction(days, null, now + 86400000)).toBe(true);
    // เพิ่งประเมิน / เพิ่งปิด → ไม่เด้ง และครบกำหนดแล้วเด้งอีก
    expect(shouldAskSatisfaction(pages, { at: now - 2 * 86400000 }, now)).toBe(false);
    const snoozed = { ...pages, dismissedAt: now - 3 * 86400000 };
    expect(shouldAskSatisfaction(snoozed, null, now)).toBe(false);
    expect(shouldAskSatisfaction({ ...pages, dismissedAt: now - (ASK_SNOOZE_DAYS + 1) * 86400000 }, null, now)).toBe(true);
  });
});
