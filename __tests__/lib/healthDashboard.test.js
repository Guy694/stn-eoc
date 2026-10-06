import { adviceForDisease, buildHealthDashboard, changePercent, dateRange } from "@/lib/healthDashboard";

const today = "2026-10-06";
const raw = {
  session: { opened_at: "2026-09-25T08:00:00" },
  community: [
    { report_date: "2026-09-26", district: "ละงู", tambon: "กำแพง", village: "บ้านA", disease: "อุจจาระร่วง", cases: 2 },
    { report_date: "2026-10-04", district: "ละงู", tambon: "กำแพง", village: "บ้านA", disease: "อุจจาระร่วง", cases: 6 },
    { report_date: "2026-10-05", district: "ละงู", tambon: "กำแพง", village: "บ้านB", disease: "โรคฉี่หนู (เลปโตสไปโรซิส)", cases: 3 },
    { report_date: "2026-10-06", district: "เมืองสตูล", tambon: "พิมาน", village: "บ้านC", disease: "ตาแดง", cases: 1 }
  ],
  shelter: [
    { report_date: "2026-10-06", district: "ละงู", disease: "อุจจาระร่วง", cases: 4, hospitalized: 2, deaths: 0, severity: "high" }
  ],
  population: [{ district: "ละงู", population: 70000 }]
};

describe("healthDashboard", () => {
  it("builds date ranges and percentages", () => {
    expect(dateRange("2026-10-01", "2026-10-03")).toEqual(["2026-10-01", "2026-10-02", "2026-10-03"]);
    expect(changePercent(15, 10)).toBe(50);
    expect(changePercent(3, 0)).toBeNull();
    expect(changePercent(0, 0)).toBe(0);
  });

  it("maps advice to diseases", () => {
    expect(adviceForDisease("โรคฉี่หนู")).toContain("รองเท้าบูท");
    expect(adviceForDisease("ไม่รู้จัก")).toBeNull();
  });

  it("summarises totals, trend, districts, diseases and heatmap", () => {
    const result = buildHealthDashboard(raw, today);
    expect(result.range).toEqual({ start: "2026-09-25", end: today });
    expect(result.totals).toMatchObject({ cases: 16, community: 12, shelter: 4, today: 5, last7: 14, prev7: 2, change: 600, hospitalized: 2, districtsWithCases: 2, lastReport: today });
    expect(result.trend.at(-1)).toMatchObject({ day: today, community: 1, shelter: 4, total: 5 });
    expect(result.districts[0]).toMatchObject({ district: "ละงู", total: 15, last7: 13, prev7: 2, community: 11, shelter: 4 });
    expect(result.districts[0].ratePer100k).toBeCloseTo(21.4, 1);
    expect(result.diseases[0]).toMatchObject({ disease: "อุจจาระร่วง", total: 12 });
    expect(result.villages[0]).toMatchObject({ village: "บ้านA", last7: 6 });
    expect(result.heat.days).toHaveLength(12);
    expect(result.heat.rows[0].district).toBe("ละงู");
  });

  it("produces prioritised actions", () => {
    const titles = buildHealthDashboard(raw, today).actions.map((action) => action.title);
    expect(titles.some((title) => title.startsWith("ผู้ป่วยเพิ่มเร็ว"))).toBe(true);
    expect(titles.some((title) => title.startsWith("อ.ละงู"))).toBe(true);
    expect(titles.some((title) => title.startsWith("อุจจาระร่วง"))).toBe(true);
    expect(titles).toContain("ผู้ป่วยในศูนย์ต้องส่งต่อสูง");
    expect(buildHealthDashboard({ community: [], shelter: [] }, today).actions[0].title).toBe("ยังไม่มีรายงานผู้ป่วยในเหตุการณ์นี้");
  });
});
