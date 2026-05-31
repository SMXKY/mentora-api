import { Request, Response, NextFunction } from "express";
import { ZodSchema, ZodError } from "zod";
import { AppError } from "../utils/AppError.util";

type ValidateTarget = "body" | "params" | "query";

export const validate =
  (schema: ZodSchema, target: ValidateTarget = "body") =>
  (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req[target]);

    if (!result.success) {
      const firstError = result.error.issues[0];

      const field =
        firstError.path.length > 0 ? firstError.path.join(".") : target;

      return next(
        new AppError(firstError.message, 400, {
          field,
          target,
          issues: result.error.issues.map((issue) => ({
            field: issue.path.join(".") || target,
            message: issue.message,
            code: issue.code,
          })),
        })
      );
    }

    req[target] = result.data;

    next();
  };

import { z } from "zod";

export const ParamsId = z.object({
  id: z.string().uuid("Invalid ID format"),
});

export const PaginationQuery = z.object({
  page: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 1))
    .pipe(z.number().int().min(1)),
  limit: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 20))
    .pipe(z.number().int().min(1).max(100)),
  sortBy: z.string().optional(),
  sortOrder: z.enum(["asc", "desc"]).optional().default("desc"),
  search: z.string().optional(),
  include: z.string().optional(),
  cursor: z.string().uuid().optional(),
});

export type PaginationQueryType = z.infer<typeof PaginationQuery>;
