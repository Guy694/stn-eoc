import { flushQueue, getQueue, sendOrQueue } from "@/lib/offlineQueue";

describe("offlineQueue", () => {
  beforeEach(() => {
    window.localStorage.clear();
    Object.defineProperty(window.navigator, "onLine", { configurable: true, value: true });
  });

  it("sends directly when online", async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ success: true, message: "ok" }) });
    await expect(sendOrQueue("/api/x", { body: { a: 1 }, label: "ยอด" })).resolves.toMatchObject({ message: "ok" });
    expect(getQueue()).toHaveLength(0);
  });

  it("queues on network failure and while offline, then flushes", async () => {
    global.fetch = jest.fn().mockRejectedValue(new TypeError("Failed to fetch"));
    await expect(sendOrQueue("/api/x", { body: { a: 1 }, label: "ยอดศูนย์" })).resolves.toMatchObject({ queued: true });
    Object.defineProperty(window.navigator, "onLine", { configurable: true, value: false });
    await sendOrQueue("/api/y", { method: "PATCH", body: { b: 2 }, label: "สถานะ" });
    expect(getQueue().map((item) => item.label)).toEqual(["ยอดศูนย์", "สถานะ"]);

    global.fetch = jest.fn()
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ success: true }) })
      .mockResolvedValueOnce({ ok: false, status: 400, json: async () => ({ success: false, message: "เหตุการณ์ปิดแล้ว" }) });
    await expect(flushQueue()).resolves.toEqual({ sent: 1, remaining: 1, failed: 1 });
    expect(getQueue()[0]).toMatchObject({ label: "สถานะ", lastError: "เหตุการณ์ปิดแล้ว", attempts: 1 });
  });

  it("does not queue validation errors", async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 400, json: async () => ({ success: false, message: "ข้อมูลไม่ครบ" }) });
    await expect(sendOrQueue("/api/x", { body: {} })).rejects.toThrow("ข้อมูลไม่ครบ");
    expect(getQueue()).toHaveLength(0);
  });
});
