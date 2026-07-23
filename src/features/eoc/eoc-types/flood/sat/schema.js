import { z } from "zod";

export const floodSatDashboardSchema = z.object({
  success: z.boolean(),
  totalStats: z.object({
    affected_districts: z.coerce.number().nonnegative().optional(),
    affected_villages: z.coerce.number().nonnegative().optional(),
    total_households: z.coerce.number().nonnegative().optional(),
    total_population: z.coerce.number().nonnegative().optional(),
  }).optional(),
}).passthrough();
