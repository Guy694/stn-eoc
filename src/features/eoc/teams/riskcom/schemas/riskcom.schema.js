import { z } from "zod";

export const riskcomAnnouncementsSchema = z.object({
  success: z.boolean(),
  data: z.array(z.object({
    id: z.union([z.string(), z.number()]),
    title: z.string(),
    created_at: z.string().nullable().optional(),
    show_popup: z.coerce.boolean().optional(),
    priority: z.coerce.number().optional(),
  }).passthrough()).default([]),
  meta: z.object({ fallback: z.boolean().optional() }).optional(),
}).passthrough();
