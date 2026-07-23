import { z } from "zod";

export const teamMembersResponseSchema = z.object({
  success: z.literal(true),
  session: z.object({
    id: z.coerce.number().int().positive(),
    session_number: z.coerce.number().int().positive(),
    eoc_type: z.string(),
    status: z.string(),
  }).passthrough(),
  team: z.object({
    session_team_id: z.coerce.number().int().positive(),
    team_code: z.string(),
    team_name_th: z.string(),
    team_lead_name: z.string().nullable().optional(),
    member_count: z.coerce.number().int().nonnegative(),
    members: z.array(z.object({
      id: z.coerce.number().int().positive(),
      officer_id: z.coerce.number().int().positive(),
      title: z.string().nullable().optional(),
      given_name: z.string(),
      family_name: z.string(),
      position: z.string().nullable().optional(),
      department: z.string().nullable().optional(),
      role_in_team: z.string().nullable().optional(),
      is_team_lead: z.coerce.boolean().optional(),
    }).passthrough()),
  }).passthrough(),
});
