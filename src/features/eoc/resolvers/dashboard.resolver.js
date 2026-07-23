import {
  baseTeamDashboardRegistry,
  defaultTeamDashboard,
  eocTypeTeamDashboardRegistry,
} from "../registries/dashboard.registry";
import { normalizeEocType } from "../registries/eoc-type.registry";
import { normalizeTeamCode } from "../registries/team.registry";

export function resolveTeamDashboard(eocTypeValue, teamCodeValue) {
  const eocType = normalizeEocType(eocTypeValue);
  const teamCode = normalizeTeamCode(teamCodeValue);
  if (!eocType || !teamCode) return null;
  return eocTypeTeamDashboardRegistry[`${eocType}:${teamCode}`]
    || baseTeamDashboardRegistry[teamCode]
    || defaultTeamDashboard;
}
