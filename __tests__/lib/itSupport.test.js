import { nextTicketNo, sortTickets, summarizeIt, validateTicket } from "@/lib/itSupport";

describe("itSupport", () => {
  it("validates tickets", () => {
    expect(validateTicket({ title: "x" }).error).toContain("หน่วยงาน");
    expect(validateTicket({ unit_name: "สสจ." }).error).toContain("หัวข้อ");
    expect(validateTicket({ unit_name: "a", title: "b", status: "resolved" }).error).toContain("ผลการแก้ไข");
    const ok = validateTicket({ unit_name: " รพ.ละงู ", title: "เน็ตล่ม", category: "nope", severity: "x", it_resource_id: "4" });
    expect(ok.ticket).toMatchObject({ unit_name: "รพ.ละงู", category: "other", severity: "medium", status: "open", it_resource_id: 4 });
  });

  it("numbers tickets per event", () => {
    expect(nextTicketNo(3, [])).toBe("IT3-001");
    expect(nextTicketNo(3, ["IT3-002", "IT3-010", null])).toBe("IT3-011");
  });

  it("sorts open and severe first", () => {
    const sorted = sortTickets([
      { id: 1, status: "resolved", severity: "critical", reported_at: "2026-10-06T08:00:00" },
      { id: 2, status: "open", severity: "low", reported_at: "2026-10-06T09:00:00" },
      { id: 3, status: "in_progress", severity: "critical", reported_at: "2026-10-06T07:00:00" }
    ]);
    expect(sorted.map((ticket) => ticket.id)).toEqual([3, 2, 1]);
  });

  it("summarises tickets and resources", () => {
    const now = new Date("2026-10-06T18:00:00").getTime();
    const summary = summarizeIt([
      { status: "open", severity: "critical", category: "internet", unit_name: "สสอ.ละงู", reported_at: "2026-10-06T10:00:00" },
      { status: "in_progress", severity: "low", category: "hardware", unit_name: "สสอ.ละงู", reported_at: "2026-10-06T15:00:00" },
      { status: "resolved", severity: "high", category: "internet", unit_name: "รพ.สตูล", reported_at: "2026-10-06T08:00:00", resolved_at: "2026-10-06T11:00:00" }
    ], [{ status: "online" }, { status: "offline" }, {}], now);
    expect(summary).toMatchObject({ total: 3, open: 2, critical: 1, resolvedToday: 1, avgHoursToResolve: 3, oldestOpenHours: 8, unitsWithProblems: ["สสอ.ละงู"] });
    expect(summary.byCategory[0]).toMatchObject({ key: "internet", total: 2, open: 1 });
    expect(summary.resources).toMatchObject({ total: 3, online: 1, offline: 1, unknown: 1 });
  });
});

describe("formatDuration", () => {
  const { formatDuration } = require("@/lib/itSupport");
  it("แสดงหน่วยที่อ่านง่ายตามช่วงเวลา", () => {
    expect(formatDuration(null)).toBe("-");
    expect(formatDuration(0.05)).toBe("3 นาที");
    expect(formatDuration(0)).toBe("1 นาที");
    expect(formatDuration(3.25)).toBe("3.3 ชม.");
    expect(formatDuration(72)).toBe("3 วัน");
  });
});
