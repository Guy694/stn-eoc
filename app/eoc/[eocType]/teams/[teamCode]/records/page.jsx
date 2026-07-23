import { notFound } from "next/navigation";
import TeamRecordsEntry from "@/src/features/eoc/entries/team-records-entry";
import { parseTeamRouteParams } from "@/src/features/eoc/shared/schemas/route-params.schema";
import { resolveTeamRecords } from "@/src/features/eoc/resolvers/records.resolver";

export default async function TeamRecordsPage({ params }) {
  const parsed = parseTeamRouteParams(await params);
  if (!parsed.success || !resolveTeamRecords(parsed.data.eocType, parsed.data.teamCode)) notFound();
  return <TeamRecordsEntry {...parsed.data} />;
}
