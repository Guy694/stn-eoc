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

// งานของกลุ่มภารกิจ 1 ทีม: รายงานประจำวัน (ทุกทีม) + งานเฉพาะที่ยังไม่มีในเมนูเหตุการณ์
export function createTeamWorkItems(eocType, teamCode) {
  const routeEocType = eocType === "dengue" ? "disease" : eocType;
  const team = getTeam(teamCode);
  const items = [{
    key: `team-report-${teamCode}`,
    name: `รายงานประจำวัน ${team?.shortName || teamCode}`,
    path: `/eoc/${routeEocType}/teams/${teamCode}/records`,
    iconKey: "records",
    description: `${getTeamReportDefinition(teamCode)?.title || "รายงานผล"} — ส่งให้ผู้บัญชาการตรวจและอนุมัติ`,
    teamWork: true,
  }];

  const extraByTeam = {
    riskcom: { key: "team-riskcom-announcements", name: "ข่าวประกาศ", path: `/admin/announcements?eoc=${routeEocType}`, iconKey: "megaphone" },
  };
  if (extraByTeam[teamCode]) items.push({ ...extraByTeam[teamCode], teamWork: true });
  return items;
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
