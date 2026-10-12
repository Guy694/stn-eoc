import { daysLeft, oxygenDays, oxygenLevel, summarizeOxygen, validateOxygenReport } from "@/lib/liquidOxygen";

describe("liquidOxygen", () => {
  test("daysLeft", () => {
    expect(daysLeft(1000, 250)).toBe(4);
    expect(daysLeft(100, 300)).toBe(0.3);
    expect(daysLeft(0, 10)).toBe(0);
    expect(daysLeft(100, 0)).toBeNull();
    expect(daysLeft("", 10)).toBeNull();
    expect(daysLeft("1,200", "300")).toBe(4);
  });

  test("oxygenDays sums available sources", () => {
    expect(oxygenDays({ tank_qty: 600, tank_use_per_day: 300, big_qty: 4, big_use_per_day: 2, small_qty: null })).toEqual({ tank: 2, big: 2, small: null, total: 4 });
    expect(oxygenDays({}).total).toBeNull();
  });

  test("oxygenLevel thresholds", () => {
    expect(oxygenLevel({ tank_qty: 100, tank_use_per_day: 200 })).toBe("critical");
    expect(oxygenLevel({ tank_qty: 500, tank_use_per_day: 200 })).toBe("low");
    expect(oxygenLevel({ tank_qty: 600, tank_use_per_day: 200 })).toBe("ok");
    expect(oxygenLevel({})).toBe("unknown");
  });

  test("validateOxygenReport", () => {
    expect(validateOxygenReport({}).ok).toBe(false);
    expect(validateOxygenReport({ tank_qty: 100 }).error).toMatch("ใช้ต่อวัน");
    expect(validateOxygenReport({ tank_qty: -1, tank_use_per_day: 2 }).ok).toBe(false);
    expect(validateOxygenReport({ tank_qty: 100, tank_use_per_day: 20, procurement_problem: true }).error).toMatch("ปัญหา");
    const ok = validateOxygenReport({ tank_qty: "100", tank_use_per_day: "20", procurement_problem: "1", problem_note: " รถขนส่งเข้าไม่ได้ " });
    expect(ok.ok).toBe(true);
    expect(ok.value).toMatchObject({ tank_qty: 100, tank_use_per_day: 20, big_qty: null, procurement_problem: 1, problem_note: "รถขนส่งเข้าไม่ได้" });
  });

  test("summarizeOxygen sorts worst first", () => {
    const summary = summarizeOxygen([
      { id: 1, tank_qty: 1000, tank_use_per_day: 100 },
      { id: 2, tank_qty: 50, tank_use_per_day: 100, procurement_problem: 1 },
      { id: 3 },
      { id: 4, tank_qty: 250, tank_use_per_day: 100 }
    ]);
    expect(summary.items.map((item) => item.id)).toEqual([2, 4, 3, 1]);
    expect(summary).toMatchObject({ facilities: 4, critical: 1, low: 1, ok: 1, problems: 1, minDays: 0.5 });
  });
});

describe("oxygen in situation board and alerts", () => {
  const { buildKpis } = require("@/lib/situationBoard");
  const { detectAlerts } = require("@/lib/eocAlerts");
  const oxygen = summarizeOxygen([
    { health_facility_id: 7, facility_name: "รพ.ทดสอบ", report_date: "2026-10-11", tank_qty: 50, tank_use_per_day: 100 },
    { health_facility_id: 8, facility_name: "รพ.สอง", report_date: "2026-10-11", tank_qty: 900, tank_use_per_day: 100 }
  ]);

  test("KPI only when reports exist", () => {
    expect(buildKpis({}).some((kpi) => kpi.key === "oxygen")).toBe(false);
    const kpi = buildKpis({ oxygen }).find((item) => item.key === "oxygen");
    expect(kpi).toMatchObject({ value: 0.5, tone: "red", href: "/eoc/flood/oxygen" });
  });

  test("alert per critical facility and report date", () => {
    const alerts = detectAlerts({ oxygen });
    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toMatchObject({ key: "oxygen-critical:7:2026-10-11", level: "critical" });
  });
});
