import { z } from "zod";
import { normalizeEocType } from "../../registries/eoc-type.registry";
import { normalizeTeamCode } from "../../registries/team.registry";

export const teamRouteParamsSchema = z.object({
  eocType: z.string().trim().min(1).transform(normalizeEocType).pipe(z.string()),
  teamCode: z.string().trim().min(1).transform(normalizeTeamCode).pipe(z.string()),
});

export const recordRouteParamsSchema = teamRouteParamsSchema.extend({
  recordId: z.string().trim().min(1).max(128),
});

export function parseTeamRouteParams(params) {
  return teamRouteParamsSchema.safeParse(params);
}
