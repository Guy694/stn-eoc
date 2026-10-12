import { STEPS, runTestDataCleanup, toCount } from "@/lib/testDataCleanup.mjs";
import { validateTeamReport } from "@/lib/teamDailyReports";

describe("test data cleanup", () => {
  test("every step is a DELETE with the test tag", () => {
    for (const [, sql] of STEPS) {
      expect(sql).toMatch(/^DELETE/);
      expect(sql).toContain("LIKE ?");
      expect(toCount(sql)).toMatch(/^SELECT COUNT\(\*\) AS count FROM/);
    }
  });

  test("dry run counts, skips missing tables, never deletes", async () => {
    const seen = [];
    const run = async (sql, params) => {
      seen.push(sql);
      expect(params.every((value) => value === "%[ทดสอบ]%")).toBe(true);
      if (sql.includes("liquid_oxygen_reports")) { const error = new Error("missing"); error.code = "ER_NO_SUCH_TABLE"; throw error; }
      return [[{ count: 2 }]];
    };
    const results = await runTestDataCleanup(run);
    expect(seen.every((sql) => sql.startsWith("SELECT"))).toBe(true);
    expect(results.find((row) => row.label === "รายงานออกซิเจนเหลว")).toMatchObject({ count: 0, skipped: "ER_NO_SUCH_TABLE" });
    expect(results.filter((row) => row.count === 2).length).toBe(STEPS.length - 1);
  });

  test("apply returns affected rows", async () => {
    const results = await runTestDataCleanup(async () => ({ affectedRows: 1 }), { apply: true });
    expect(results.every((row) => row.count === 1)).toBe(true);
  });
});

describe("doxy per unit", () => {
  test("requires unit name", () => {
    expect(validateTeamReport("doxy", { district_name: "มะนัง", doxy_new: 3 }).error).toMatch("หน่วยบริการ");
    expect(validateTeamReport("doxy", { district_name: "มะนัง", doxy_new: 3, area_note: "รพ.สต.บ้านมะนัง" }).ok).toBe(true);
  });
});
