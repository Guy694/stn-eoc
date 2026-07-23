import { createElement } from "react";
import TeamRouteGuard from "../shared/components/team-route-guard";
import { normalizeEocType } from "../registries/eoc-type.registry";
import { normalizeTeamCode } from "../registries/team.registry";
import { resolveTeamRecords } from "../resolvers/records.resolver";

export default function TeamRecordsEntry({ eocType: eocTypeValue, teamCode: teamCodeValue, mode = "list", recordId }) {
  const eocType = normalizeEocType(eocTypeValue);
  const teamCode = normalizeTeamCode(teamCodeValue);
  const Records = resolveTeamRecords(eocType, teamCode);
  if (!Records) return null;
  return (
    <TeamRouteGuard eocType={eocType} teamCode={teamCode}>
      {createElement(Records, { eocType, teamCode, mode, recordId })}
    </TeamRouteGuard>
  );
}
