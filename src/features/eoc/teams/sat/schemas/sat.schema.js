import { z } from "zod";

export const satFilterSchema = z.object({
  date: z.string().date().optional(),
  district: z.string().trim().max(120).optional(),
});
