import { navigationRegistry } from "../registries/navigation.registry";
import { normalizeTeamCode } from "../registries/team.registry";

export function resolveTeamNavigation(teamCodeValue) {
  const teamCode = normalizeTeamCode(teamCodeValue);
  return teamCode ? navigationRegistry[teamCode] || [] : [];
}
