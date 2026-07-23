import { z } from "zod";

export const itResourceSummarySchema = z.object({
  success: z.boolean(),
  stats: z.object({
    total: z.coerce.number().nonnegative().default(0),
    online: z.coerce.number().nonnegative().default(0),
    offline: z.coerce.number().nonnegative().default(0),
    maintenance: z.coerce.number().nonnegative().default(0),
    unknown: z.coerce.number().nonnegative().default(0),
  }).passthrough(),
}).passthrough();
