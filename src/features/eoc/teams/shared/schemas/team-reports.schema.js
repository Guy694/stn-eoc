import { z } from "zod";

export const teamReportSchema = z.object({
  id: z.coerce.number().int().positive(),
  report_date: z.union([z.string(), z.date()]),
  report_type: z.string(),
  title: z.string(),
  status: z.enum(["draft", "submitted", "verified", "approved", "returned"]),
  payload: z.record(z.string(), z.unknown()),
  created_by: z.coerce.number(),
  created_by_name: z.string().nullable().optional(),
  updated_at: z.union([z.string(), z.date()]).optional(),
  review_comment: z.string().nullable().optional(),
}).passthrough();

export const teamReportsResponseSchema = z.object({
  success: z.literal(true),
  session: z.object({ session_id: z.coerce.number(), session_team_id: z.coerce.number(), session_number: z.coerce.number(), session_status: z.string(), team_code: z.string(), team_name_th: z.string() }).passthrough(),
  permissions: z.object({ canWrite: z.boolean(), canSubmit: z.boolean(), canReview: z.boolean() }),
  summary: z.object({ total: z.coerce.number(), draft: z.coerce.number(), submitted: z.coerce.number(), verified: z.coerce.number(), approved: z.coerce.number(), returned: z.coerce.number() }),
  data: z.array(teamReportSchema),
});
