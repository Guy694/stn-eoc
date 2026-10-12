import { summarizeTeamReports, teamReportHeadline, validateTeamReport } from "@/lib/teamDailyReports";

describe("teamDailyReports", () => {
  test("validate requires district and numbers", () => {
    expect(validateTeamReport("x", {}).ok).toBe(false);
    expect(validateTeamReport("medical", { treated: 3 }).error).toMatch("อำเภอ");
    expect(validateTeamReport("medical", { district_name: "ละงู" }).error).toMatch("อย่างน้อย");
    expect(validateTeamReport("medical", { district_name: "ละงู", treated: "-1" }).ok).toBe(false);
    expect(validateTeamReport("medical", { district_name: "ละงู", treated: "1.5" }).ok).toBe(false);
    expect(validateTeamReport("medical", { district_name: "ละงู", treated: "12" })).toEqual({ ok: true, metrics: { units: 0, treated: 12, counseled: 0, referred: 0 } });
  });

  test("mcatt stress results cannot exceed assessed", () => {
    expect(validateTeamReport("mcatt", { district_name: "ละงู", stress_assessed: 5, stress_normal: 4, stress_high: 2 }).error).toMatch("มากกว่า");
    expect(validateTeamReport("mcatt", { district_name: "ละงู", teams_total: 2, teams_working: 3 }).error).toMatch("ไม่เกิน");
    expect(validateTeamReport("mcatt", { district_name: "ละงู", stress_assessed: 5, stress_normal: 3, stress_high: 2 }).ok).toBe(true);
  });

  test("summarize today vs cumulative", () => {
    const rows = [
      { report_type: "medical", report_date: "2026-10-10", district_name: "ละงู", metrics: JSON.stringify({ treated: 10, referred: 1 }) },
      { report_type: "medical", report_date: "2026-10-11", district_name: "ละงู", metrics: { treated: 5 } },
      { report_type: "medical", report_date: "2026-10-11", district_name: "มะนัง", metrics: { treated: 2, referred: 1 } },
      { report_type: "mcatt", report_date: "2026-10-11", district_name: "ละงู", metrics: { home_visits: 7, stress_assessed: 4, stress_high: 1 } }
    ];
    const summary = summarizeTeamReports(rows, "2026-10-11");
    expect(summary.medical).toMatchObject({ reports: 3, servedToday: 7, servedTotal: 17, lastDate: "2026-10-11" });
    expect(summary.medical.districtsToday).toEqual(["ละงู", "มะนัง"]);
    expect(summary.medical.cumulative.referred).toBe(2);
    expect(summary.mert.reports).toBe(0);
    expect(teamReportHeadline(summary)).toEqual([
      "MCATT เยี่ยมบ้านสะสม 7 หลัง ประเมินความเครียด 4 ราย (เครียดสูง 1)",
      "หน่วยแพทย์ตรวจรักษาสะสม 17 ราย ส่งต่อ 2"
    ]);
  });
});

describe("team reports in situation board and agenda", () => {
  const { buildKpis } = require("@/lib/situationBoard");
  const { buildAgenda } = require("@/lib/meetingBrief");
  const teamReports = summarizeTeamReports([
    { report_type: "mcatt", report_date: "2026-10-11", district_name: "ละงู", metrics: { home_visits: 7, stress_assessed: 4, stress_high: 1 } },
    { report_type: "medical", report_date: "2026-10-11", district_name: "ละงู", metrics: { treated: 5 } }
  ], "2026-10-11");

  test("KPI sums served today and flags high stress", () => {
    expect(buildKpis({}).some((kpi) => kpi.key === "teams")).toBe(false);
    const kpi = buildKpis({ teamReports }).find((item) => item.key === "teams");
    expect(kpi).toMatchObject({ value: 12, tone: "amber" });
    expect(kpi.detail).toContain("เครียดสูงสะสม 1 ราย");
  });

  test("agenda mentions MCATT high stress", () => {
    const agenda = buildAgenda({ teamReports });
    expect(agenda.some((item) => item.title.includes("ความเครียดระดับสูง 1 ราย"))).toBe(true);
  });
});

describe("pregnancy alerts", () => {
  const { pregnancyAlert, validatePerson, sortByUrgency } = require("@/lib/vulnerablePersons");
  test("near due, overdue, preterm", () => {
    expect(pregnancyAlert({ vulnerable_type: "pregnant", due_date: "2026-10-20" }, "2026-10-11").text).toBe("ใกล้คลอด อีก 9 วัน");
    expect(pregnancyAlert({ vulnerable_type: "pregnant", due_date: "2026-10-01", preterm_history: true }, "2026-10-11").text).toBe("เลยกำหนดคลอด 10 วัน · เคยคลอดก่อนกำหนด");
    expect(pregnancyAlert({ vulnerable_type: "pregnant", due_date: "2027-03-01" }, "2026-10-11")).toBeNull();
    expect(pregnancyAlert({ vulnerable_type: "elderly", preterm_history: true }, "2026-10-11")).toBeNull();
  });
  test("validatePerson keeps pregnancy fields only for pregnant", () => {
    const base = { name: "[ทดสอบ] ก", district: "ละงู", tambon: "ละงู", due_date: "2026-11-01", preterm_history: true };
    expect(validatePerson({ ...base, vulnerable_type: "pregnant" }).value).toMatchObject({ due_date: "2026-11-01", preterm_history: true });
    expect(validatePerson({ ...base, vulnerable_type: "elderly" }).value).toMatchObject({ due_date: null, preterm_history: false });
    expect(validatePerson({ ...base, vulnerable_type: "pregnant", due_date: "1/11/69" }).error).toMatch("กำหนดคลอด");
  });
  test("pregnant sorted by due date", () => {
    const sorted = sortByUrgency([
      { name: "ข", vulnerable_type: "pregnant", due_date: "2026-12-01" },
      { name: "ก", vulnerable_type: "pregnant", due_date: "2026-10-20" },
      { name: "ค", vulnerable_type: "pregnant" }
    ]);
    expect(sorted.map((row) => row.name)).toEqual(["ก", "ข", "ค"]);
  });
});
