import { parseOccurredAt } from "@/lib/publicReportTime";

const now = Date.parse("2026-10-16T09:20:00Z"); // 16:20 เวลาไทย

describe("parseOccurredAt", () => {
  it("เวลาจากฟอร์ม (ไม่มีโซน) ตีความเป็นเวลาไทย และคืนเป็น Date ไม่ใช่สตริงลงท้าย Z", () => {
    const value = parseOccurredAt("2026-10-16T16:17", { now });
    expect(value).toBeInstanceOf(Date);
    expect(value.toISOString()).toBe("2026-10-16T09:17:00.000Z");
  });

  it("รับรูปแบบมีวินาที/เว้นวรรค และสตริงที่มีโซนเวลา", () => {
    expect(parseOccurredAt("2026-10-16 16:17:30", { now }).toISOString()).toBe("2026-10-16T09:17:30.000Z");
    expect(parseOccurredAt("2026-10-16T09:00:00Z", { now }).toISOString()).toBe("2026-10-16T09:00:00.000Z");
  });

  it("ค่าว่าง ผิดรูป อนาคตเกิน 1 วัน หรือเก่ากว่า 30 วัน → ใช้เวลาปัจจุบัน", () => {
    for (const raw of ["", null, "abc", "2026-10-20T10:00", "2026-08-01T10:00"]) {
      expect(parseOccurredAt(raw, { now }).getTime()).toBe(now);
    }
  });
});
