import { z } from "zod";

export const medicalInventorySummarySchema = z.object({
  success: z.boolean(),
  event: z.object({
    name: z.string().nullish(),
    session_number: z.coerce.number().nullish(),
  }).passthrough(),
  summary: z.object({
    total_rows: z.coerce.number().nonnegative().default(0),
    agency_count: z.coerce.number().nonnegative().default(0),
    item_count: z.coerce.number().nonnegative().default(0),
    received_qty: z.coerce.number().nonnegative().default(0),
    issued_qty: z.coerce.number().nonnegative().default(0),
    balance_qty: z.coerce.number().nonnegative().default(0),
    not_recorded_rows: z.coerce.number().nonnegative().default(0),
  }).passthrough(),
}).passthrough();
