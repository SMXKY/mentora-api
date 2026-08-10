import { z } from "zod";
import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";

extendZodWithOpenApi(z);

export const ANALYTICS_RANGES = ["4w", "3m", "12m", "all"] as const;
export type AnalyticsRange = (typeof ANALYTICS_RANGES)[number];

export const GetAnalyticsQuerySchema = z
  .object({
    range: z.enum(ANALYTICS_RANGES).optional().default("3m"),
  })
  .openapi("GetAnalyticsQuery");
export type GetAnalyticsQueryInput = z.infer<typeof GetAnalyticsQuerySchema>;

export const ListAnalyticsSessionsQuerySchema = z
  .object({
    range: z.enum(ANALYTICS_RANGES).optional().default("3m"),
    cursor: z.string().uuid().optional(),
    limit: z.coerce.number().int().min(1).max(50).optional().default(20),
  })
  .openapi("ListAnalyticsSessionsQuery");
export type ListAnalyticsSessionsQueryInput = z.infer<typeof ListAnalyticsSessionsQuerySchema>;
