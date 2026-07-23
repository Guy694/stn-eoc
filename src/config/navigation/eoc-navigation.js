import { getTeamPath } from "../../features/eoc/shared/utils/eoc-path";
import { getEocType, normalizeEocType } from "../../features/eoc/registries/eoc-type.registry";
import { getTeam, normalizeTeamCode, TEAM_CODES } from "../../features/eoc/registries/team.registry";
import { getTeamReportDefinition } from "../../features/eoc/registries/team-report-definition.registry";

const TEAM_MENU_CODES = TEAM_CODES;

export function createTeamNavigation(eocType, teamCode) {
  const eoc = getEocType(eocType);
  const team = getTeam(teamCode);
  if (!eoc || !team) return [];

  return team.menus.map((menu) => ({
    ...menu,
    href: getTeamPath(eoc.code, team.code, menu.key),
  }));
}

export function createLegacySatNavigation() {
  return createTeamNavigation("dengue", "sat");
}

export function getActiveOfficerEocType(pathname) {
  if (typeof pathname !== "string") return null;
  if (pathname.startsWith("/eoc/flood")) return "flood";
  if (pathname.startsWith("/eoc/disease") || pathname.startsWith("/eoc/dengue")) return "dengue";
  return null;
}

function createTeamWorkItems(eocType, teamCode) {
  const routeEocType = eocType === "dengue" ? "disease" : eocType;
  const dashboard = {
    key: "dashboard",
    name: "Dashboard",
    path: `/eoc/${routeEocType}/teams/${teamCode}/dashboard`,
    iconKey: "dashboard",
    description: `Dashboard กลุ่มภารกิจ ${getTeam(teamCode)?.shortName || teamCode}`,
  };

  const workItemByTeam = {
    sat: eocType === "flood"
      ? { key: "records", name: "รายงานสถานการณ์น้ำท่วม", path: "/eoc/flood/records", iconKey: "records" }
      : { key: "records", name: "รายงานผู้ป่วย", path: "/eoc/disease/records", iconKey: "records" },
    it: { key: "it-assets", name: "รายงานทรัพย์สินไอที", path: "/admin/it-resources", iconKey: "assets" },
    riskcom: {
      key: "announcements",
      name: "ข่าวประกาศ",
      path: `/admin/announcements?eoc=${routeEocType}`,
      iconKey: "announcements",
    },
  };

  const defaultWorkItem = {
    key: "records",
    name: getTeamReportDefinition(teamCode)?.title || "รายงานผล",
    path: `/eoc/${routeEocType}/teams/${teamCode}/records`,
    iconKey: "records",
  };
  return [dashboard, workItemByTeam[teamCode] || defaultWorkItem];
}

/**
 * สร้าง Sidebar เฉพาะกลุ่มภารกิจที่ผู้ใช้ได้รับมอบหมายใน EOC ปัจจุบัน
 * @param {{pathname: string, assignments?: Array<object>}} input
 */
export function createOfficerTeamSections({ pathname, assignments = [] }) {
  const eocType = getActiveOfficerEocType(pathname);
  if (!eocType) return [];

  const assignedTeams = new Set();
  assignments.forEach((assignment) => {
    if (normalizeEocType(assignment?.eoc_type) !== eocType) return;
    const teamCode = normalizeTeamCode(assignment?.team_code);
    if (teamCode) assignedTeams.add(teamCode);
  });

  return TEAM_MENU_CODES
    .filter((teamCode) => assignedTeams.has(teamCode))
    .map((teamCode) => {
      const team = getTeam(teamCode);
      return {
        title: `กลุ่มภารกิจ ${team.shortName}`,
        section: `officer-team-${eocType}-${teamCode}`,
        key: `officer-team-${eocType}-${teamCode}`,
        teamCode,
        collapsible: true,
        defaultExpanded: true,
        items: createTeamWorkItems(eocType, teamCode),
      };
    });
}
