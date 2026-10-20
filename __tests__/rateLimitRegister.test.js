/** @jest-environment node */
import { RATE_LIMITS, waitText, consumeRateLimit, resetInMemoryRateLimits } from "@/lib/rateLimit";

jest.mock("@/lib/db", () => ({ query: jest.fn(async () => { const error = new Error("no table"); error.code = "ER_NO_SUCH_TABLE"; throw error; }) }));

test("สมัครเจ้าหน้าที่จาก IP เดียวกันได้หลายคนก่อนถูกจำกัด", async () => {
  expect(RATE_LIMITS.register.limit).toBeGreaterThanOrEqual(30);
  resetInMemoryRateLimits();
  for (let i = 0; i < RATE_LIMITS.register.limit; i += 1) {
    expect((await consumeRateLimit("register", "10.0.0.1")).allowed).toBe(true);
  }
  const blocked = await consumeRateLimit("register", "10.0.0.1");
  expect(blocked.allowed).toBe(false);
  expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
});

test("ข้อความบอกเวลาที่ต้องรอ", () => {
  expect(waitText(30)).toBe("ประมาณ 30 วินาที");
  expect(waitText(600)).toBe("ประมาณ 10 นาที");
  expect(waitText(undefined)).toBe("ประมาณ 60 วินาที");
});
