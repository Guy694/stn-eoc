import {
  baseTeamRecordsRegistry,
  defaultTeamRecords,
  eocTypeTeamRecordsRegistry,
} from "../registries/records.registry";
import { normalizeEocType } from "../registries/eoc-type.registry";
import { normalizeTeamCode } from "../registries/team.registry";

export function resolveTeamRecords(eocTypeValue, teamCodeValue) {
  const eocType = normalizeEocType(eocTypeValue);
  const teamCode = normalizeTeamCode(teamCodeValue);
  if (!eocType || !teamCode) return null;
  return eocTypeTeamRecordsRegistry[`${eocType}:${teamCode}`]
    || baseTeamRecordsRegistry[teamCode]
    || defaultTeamRecords;
}
