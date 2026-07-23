import { EOC_TYPES, normalizeEocType } from "@/src/features/eoc/registries/eoc-type.registry";
import { TEAM_CODES, normalizeTeamCode, teamRegistry } from "@/src/features/eoc/registries/team.registry";
import { resolveTeamDashboard } from "@/src/features/eoc/resolvers/dashboard.resolver";
import BaseTeamDashboard from "@/src/features/eoc/teams/shared/components/base-team-dashboard";
import DengueSatDashboard from "@/src/features/eoc/eoc-types/dengue/sat/components/dengue-sat-dashboard";
import FloodSatDashboard from "@/src/features/eoc/eoc-types/flood/sat/components/flood-sat-dashboard";
import ItDashboard from "@/src/features/eoc/teams/it/components/it-dashboard";
import RiskcomDashboard from "@/src/features/eoc/teams/riskcom/components/riskcom-dashboard";
import { createOfficerTeamSections } from "@/src/config/navigation/eoc-navigation";
import { teamMembersResponseSchema } from "@/src/features/eoc/teams/shared/schemas/team-members.schema";
import { teamReportDefinitionRegistry } from "@/src/features/eoc/registries/team-report-definition.registry";

describe("EOC registries and resolvers", () => {
  test("registers all 23 production teams", () => {
    expect(TEAM_CODES).toHaveLength(23);
    expect(Object.keys(teamRegistry)).toHaveLength(23);
  });

  test("normalizes legacy EOC and team codes", () => {
    expect(normalizeEocType("disease")).toBe("dengue");
    expect(normalizeTeamCode("SAT")).toBe("sat");
    expect(normalizeTeamCode("ITSUPPORT")).toBe("it");
    expect(normalizeTeamCode("EOC_ADMIN")).toBe("admin");
  });

  test("contains the extensible EOC type set", () => {
    expect(EOC_TYPES).toEqual(expect.arrayContaining(["flood", "dengue", "storm", "drought", "epidemic", "fire"]));
  });

  test("prefers an EOC-specific dashboard override", () => {
    expect(resolveTeamDashboard("disease", "SAT")).toBe(DengueSatDashboard);
    expect(resolveTeamDashboard("flood", "SAT")).toBe(FloodSatDashboard);
  });

  test("resolves the IT and RISKCOM team dashboards", () => {
    expect(resolveTeamDashboard("flood", "ITSUPPORT")).toBe(ItDashboard);
    expect(resolveTeamDashboard("disease", "RISKCOM")).toBe(RiskcomDashboard);
  });

  test("uses the inventory dashboard for LOGISTICS", () => {
    expect(resolveTeamDashboard("storm", "LOGISTICS").name).toBe("LogisticsDashboard");
  });

  test("falls back to the shared dashboard for teams without an override", () => {
    expect(resolveTeamDashboard("storm", "FINANCE")).toBe(BaseTeamDashboard);
  });

  test("rejects unknown route values", () => {
    expect(resolveTeamDashboard("unknown", "SAT")).toBeNull();
    expect(resolveTeamDashboard("flood", "unknown")).toBeNull();
  });

  test("builds an officer sidebar from an active team assignment", () => {
    const sections = createOfficerTeamSections({ pathname: "/eoc/disease/overview", assignments: [{ eoc_type: "disease", team_code: "SAT" }] });
    expect(sections).toHaveLength(1);
    expect(sections[0].title).toBe("กลุ่มภารกิจ SAT");
    expect(sections[0].items.map((item) => item.name)).toEqual(["Dashboard", "รายงานผู้ป่วย"]);
  });

  test("builds assigned-team menus only for the current EOC", () => {
    const sections = createOfficerTeamSections({
      pathname: "/eoc/flood/overview",
      userRole: "staff",
      assignments: [
        { eoc_type: "flood", team_code: "ITSUPPORT" },
        { eoc_type: "flood", team_code: "RISKCOM" },
        { eoc_type: "disease", team_code: "SAT" },
        { eoc_type: "flood", team_code: "LOGISTICS" },
      ],
    });
    expect(sections.map((section) => section.teamCode)).toEqual(["riskcom", "logistics", "it"]);
  });

  test("does not add team menus outside disease and flood modules", () => {
    expect(createOfficerTeamSections({ pathname: "/dashboard", userRole: "SAT" })).toEqual([]);
  });

  test("supports menu definitions for all 23 assigned teams", () => {
    const assignments = TEAM_CODES.map((teamCode) => ({ eoc_type: "flood", team_code: teamRegistry[teamCode].legacyCode }));
    expect(createOfficerTeamSections({ pathname: "/eoc/flood/overview", assignments })).toHaveLength(23);
  });

  test("provides a real report form definition for all 23 teams", () => {
    expect(Object.keys(teamReportDefinitionRegistry)).toHaveLength(23);
    TEAM_CODES.forEach((teamCode) => {
      expect(teamReportDefinitionRegistry[teamCode].title).toBeTruthy();
      expect(teamReportDefinitionRegistry[teamCode].fields.length).toBeGreaterThanOrEqual(4);
      expect(teamReportDefinitionRegistry[teamCode].fields.some((item) => item.name === "situation_summary")).toBe(true);
    });
  });

  test("validates a session team member response including a closed session", () => {
    const result = teamMembersResponseSchema.parse({
      success: true,
      session: { id: 54, session_number: 3, eoc_type: "flood", status: "closed" },
      team: {
        session_team_id: 39,
        team_code: "SAT",
        team_name_th: "กลุ่มภารกิจตระหนักรู้สถานการณ์",
        member_count: 1,
        members: [{ id: 1, officer_id: 7, given_name: "ทดสอบ", family_name: "ระบบ", is_team_lead: 1 }],
      },
    });
    expect(result.session.id).toBe(54);
    expect(result.team.members[0].is_team_lead).toBe(true);
  });
});
