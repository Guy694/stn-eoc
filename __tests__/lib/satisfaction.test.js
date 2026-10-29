import { HOUSEKEEPING } from "@/lib/pdpaRetention.mjs";
import { ratedRecently, summarizeRatings, validateSatisfaction } from "@/lib/satisfaction";

describe("ประเมินความพึงพอใจ", () => {
  test("ดาวบังคับ 1–5 ข้อเสนอแนะไม่บังคับ", () => {
    expect(validateSatisfaction({ rating: 5 }).value).toEqual({ rating: 5, comment: null });
    expect(validateSatisfaction({ rating: "4", comment: "  ใช้ง่าย\u0007 ดีมาก  " }).value).toEqual({ rating: 4, comment: "ใช้ง่าย ดีมาก" });
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
});
