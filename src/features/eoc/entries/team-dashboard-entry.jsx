import { createElement } from "react";
import TeamRouteGuard from "../shared/components/team-route-guard";
import { normalizeEocType } from "../registries/eoc-type.registry";
import { normalizeTeamCode } from "../registries/team.registry";
import { resolveTeamDashboard } from "../resolvers/dashboard.resolver";

export default function TeamDashboardEntry({ eocType: eocTypeValue, teamCode: teamCodeValue }) {
  const eocType = normalizeEocType(eocTypeValue);
  const teamCode = normalizeTeamCode(teamCodeValue);
  const Dashboard = resolveTeamDashboard(eocType, teamCode);
  if (!Dashboard) return null;
  return (
    <TeamRouteGuard eocType={eocType} teamCode={teamCode}>
      {createElement(Dashboard, { eocType, teamCode })}
    </TeamRouteGuard>
  );
}
