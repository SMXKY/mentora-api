import { z } from "zod";
import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";

extendZodWithOpenApi(z);

export const SuspendUserSchema = z
  .object({
    reason: z.string().min(1, "adminUser/errors:reasonRequired"),
  })
  .openapi("SuspendUser");

export type SuspendUserInput = z.infer<typeof SuspendUserSchema>;

export const SuspensionResponseSchema = z
  .object({
    userId: z.string().uuid(),
    status: z.string(),
    reason: z.string().optional(),
  })
  .openapi("SuspensionResult");
