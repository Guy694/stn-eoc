import { TEAM_CODES } from "@/src/features/eoc/registries/team.registry";
import { teamReportDefinitionRegistry } from "@/src/features/eoc/registries/team-report-definition.registry";
import { validateTeamReportPayload } from "@/src/features/eoc/teams/shared/schemas/team-report-payload.schema";

function validValue(field) {
  if (field.type === "number") return 1;
  if (field.type === "select") return field.options[0];
  if (field.type === "datetime-local") return "2026-07-27T09:00";
  return "ข้อมูลทดสอบ";
}

describe("team report payload validation", () => {
  test.each(TEAM_CODES)("accepts a complete %s report", (teamCode) => {
    const definition = teamReportDefinitionRegistry[teamCode];
    const payload = Object.fromEntries(definition.fields.map((field) => [field.name, validValue(field)]));
    const result = validateTeamReportPayload(teamCode, payload, { requireComplete: true });
    expect(result.success).toBe(true);
    expect(result.completeness.percent).toBe(100);
  });

  test("rejects unknown fields and invalid numeric values", () => {
    expect(validateTeamReportPayload("finance", { unknown: "value" }).success).toBe(false);
    const definition = teamReportDefinitionRegistry.finance;
    const payload = Object.fromEntries(definition.fields.map((field) => [field.name, validValue(field)]));
    payload.initial_budget = -1;
    const result = validateTeamReportPayload("finance", payload, { requireComplete: true });
    expect(result.success).toBe(false);
    expect(result.fieldErrors.initial_budget).toContain("ไม่น้อยกว่า");
  });

  test("reports missing submit fields without blocking legacy reads", () => {
    const result = validateTeamReportPayload("sat", { situation_summary: "สรุป" }, { requireComplete: true });
    expect(result.success).toBe(false);
    expect(result.completeness.percent).toBeLessThan(100);
    expect(result.completeness.missing).toContain("reporting_period");
  });
});
