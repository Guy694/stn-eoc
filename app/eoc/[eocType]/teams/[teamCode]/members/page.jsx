import { notFound } from "next/navigation";
import TeamMembersEntry from "@/src/features/eoc/entries/team-members-entry";
import { parseTeamRouteParams } from "@/src/features/eoc/shared/schemas/route-params.schema";

export default async function TeamMembersPage({ params }) {
  const parsed = parseTeamRouteParams(await params);
  if (!parsed.success) notFound();
  return <TeamMembersEntry {...parsed.data} />;
}
