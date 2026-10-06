import { checkDateInSession, toDateKey, validateSessionDates } from "@/lib/sessionDateRange";

describe("sessionDateRange", () => {
  const today = new Date(2026, 9, 5);
  const open = { opened_at: "2026-09-20T08:00:00", closed_at: null };
  const closed = { opened_at: "2025-06-01", closed_at: "2025-07-01" };

  it("normalises dates", () => {
    expect(toDateKey("2026-09-20T23:00:00Z")).toBe("2026-09-20");
    expect(toDateKey("not-a-date")).toBe("");
  });

  it("accepts dates inside an open event up to today", () => {
    expect(checkDateInSession(open, "2026-09-20", today).ok).toBe(true);
    expect(checkDateInSession(open, "2026-10-05", today).ok).toBe(true);
  });

  it("rejects dates before opening or after today/closing", () => {
    expect(checkDateInSession(open, "2026-09-19", today)).toMatchObject({ ok: false, status: 400 });
    expect(checkDateInSession(open, "2026-10-06", today).error).toContain("วันนี้");
    expect(checkDateInSession(closed, "2025-07-02", today).error).toContain("วันปิด EOC");
  });

  it("looks up the session and checks every date", async () => {
    const execute = jest.fn().mockResolvedValue([[closed]]);
    await expect(validateSessionDates(execute, 4, ["2025-06-10", "2025-06-11"], { eocType: "flood" })).resolves.toMatchObject({ ok: true });
    expect(execute.mock.calls[0][1]).toEqual([4, "flood"]);
    await expect(validateSessionDates(execute, 4, ["2025-08-01"])).resolves.toMatchObject({ ok: false });
    await expect(validateSessionDates(jest.fn().mockResolvedValue([[]]), 9, ["2025-06-10"])).resolves.toMatchObject({ ok: false, status: 404 });
    await expect(validateSessionDates(execute, null, [])).resolves.toMatchObject({ ok: false, status: 400 });
  });
});
