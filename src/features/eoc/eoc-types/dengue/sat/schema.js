import { z } from "zod";

export const dengueSatDashboardSchema = z.object({
  success: z.boolean(),
  totalStats: z.object({
    affected_districts: z.coerce.number().nonnegative().optional(),
    affected_facilities: z.coerce.number().nonnegative().optional(),
    diseases_count: z.coerce.number().nonnegative().optional(),
    total_patients: z.coerce.number().nonnegative().optional(),
    total_reports: z.coerce.number().nonnegative().optional(),
  }).optional(),
}).passthrough();
