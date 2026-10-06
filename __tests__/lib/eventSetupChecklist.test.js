import { buildSetupChecklist } from "@/lib/eventSetupChecklist";

describe("buildSetupChecklist", () => {
  it("เหตุการณ์ที่ยังไม่มีทีม SAT ต้องขึ้นเป็นข้อจำเป็นที่ยังไม่ทำ อยู่บนสุด", () => {
    const result = buildSetupChecklist({ today: "2026-10-06" }, { teams: [{ code: "ITSUPPORT", members: 5, hasLead: true }], telegram: { ready: true } });
    expect(result.items[0]).toMatchObject({ key: "sat-team", required: true, done: false, href: "/eoc/flood/operations-team" });
    expect(result.requiredDone).toBe(1);
    expect(result.complete).toBe(false);
  });

  it("ครบทุกข้อเมื่อทุกส่วนพร้อม", () => {
    const brief = {
      today: "2026-10-06",
      shelters: { activeCount: 2 },
      supplies: { opened: true },
      vulnerable: { villages: 3 },
      impact: { latest: { date: "2026-10-06" } },
      directives: { date: "2026-10-06" }
    };
    const result = buildSetupChecklist(brief, { teams: [{ code: "SAT", members: 3, hasLead: true }], telegram: { ready: true, enabled: true } });
    expect(result.complete).toBe(true);
    expect(result.done).toBe(result.total);
  });

  it("เตือนเมื่อปิดการส่ง Telegram หรือมีทีมที่ไม่มีคน", () => {
    const result = buildSetupChecklist({}, { teams: [{ code: "SAT", members: 0, hasLead: false }], telegram: { ready: true, enabled: false } });
    const byKey = Object.fromEntries(result.items.map((item) => [item.key, item]));
    expect(byKey.alerts.done).toBe(false);
    expect(byKey.alerts.detail).toContain("EOC_ALERTS_TELEGRAM=off");
    expect(byKey["team-members"]).toMatchObject({ done: false, detail: "ยังไม่มีคนในทีม: SAT" });
  });

  it("EOC โรคระบาดไม่มีข้อของน้ำท่วม", () => {
    const keys = buildSetupChecklist({}, { eocType: "disease" }).items.map((item) => item.key);
    expect(keys).not.toContain("sat-team");
    expect(keys).not.toContain("first-report");
  });
});
