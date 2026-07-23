import { notFound } from "next/navigation";
import TeamRecordsEntry from "@/src/features/eoc/entries/team-records-entry";
import { parseTeamRouteParams } from "@/src/features/eoc/shared/schemas/route-params.schema";

export default async function CreateTeamRecordPage({ params }) {
  const parsed = parseTeamRouteParams(await params);
  if (!parsed.success) notFound();
  return <TeamRecordsEntry {...parsed.data} mode="create" />;
}
