import { notFound } from "next/navigation";
import TeamRecordsEntry from "@/src/features/eoc/entries/team-records-entry";
import { recordRouteParamsSchema } from "@/src/features/eoc/shared/schemas/route-params.schema";

export default async function TeamRecordDetailPage({ params }) {
  const parsed = recordRouteParamsSchema.safeParse(await params);
  if (!parsed.success) notFound();
  return <TeamRecordsEntry {...parsed.data} mode="detail" />;
}
