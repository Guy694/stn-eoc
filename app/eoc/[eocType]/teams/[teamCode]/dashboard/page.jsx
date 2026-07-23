import { notFound } from "next/navigation";
import TeamDashboardEntry from "@/src/features/eoc/entries/team-dashboard-entry";
import { parseTeamRouteParams } from "@/src/features/eoc/shared/schemas/route-params.schema";
import { resolveTeamDashboard } from "@/src/features/eoc/resolvers/dashboard.resolver";

export default async function TeamDashboardPage({ params }) {
  const parsed = parseTeamRouteParams(await params);
  if (!parsed.success || !resolveTeamDashboard(parsed.data.eocType, parsed.data.teamCode)) notFound();
  return <TeamDashboardEntry {...parsed.data} />;
}
