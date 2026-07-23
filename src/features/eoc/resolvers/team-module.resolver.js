import { defaultTeamModule } from "../registries/team-module.registry";
import { normalizeEocType } from "../registries/eoc-type.registry";
import { normalizeTeamCode } from "../registries/team.registry";

export function resolveTeamModule(eocTypeValue, teamCodeValue) {
  const eocType = normalizeEocType(eocTypeValue);
  const teamCode = normalizeTeamCode(teamCodeValue);
  if (!eocType || !teamCode) return null;
  return { ...defaultTeamModule, eocType, teamCode };
}
