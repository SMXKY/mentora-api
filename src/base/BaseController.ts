import { Request, Response, NextFunction } from "express";
import { BaseService } from "./BaseService";
import { appResponder } from "../utils/appResponder.util";
import { buildContext } from "../utils/buildContext.util";
import { AppError } from "../utils/AppError.util";
import { catchAsync } from "../utils/catchAsync.util";
import {
  OffsetFindOptions,
  CursorFindOptions,
  FilterParams,
  RESERVED_QUERY_KEYS,
} from "./base.types";
import { StatusCodes } from "http-status-codes";

// ============================================================
// BASE CONTROLLER
// Handles HTTP concerns only — extracts data from the request,
// calls one service method, sends the response.
//
// Concrete controllers extend this and define:
//   - service: the concrete service instance
//
// Rules:
//   - Five lines maximum per handler
//   - No try/catch — catchAsync handles all async errors
//   - No business logic — that belongs in the service
//   - No direct Prisma calls — that belongs in the repository
//   - buildContext() is called once per handler to build ServiceContext
//
// All handlers are wrapped with catchAsync so errors propagate
// to the global error handler via next() automatically.
// ============================================================

export abstract class BaseController<T> {
  protected abstract service: BaseService<T, any, any>;

  create = catchAsync(async (req: Request, res: Response): Promise<void> => {
    const ctx = buildContext(req, res);
    const record = await this.service.create(req.body, ctx);
    appResponder(StatusCodes.CREATED, record as object, res);
  });

  findById = catchAsync(async (req: Request, res: Response): Promise<void> => {
    const ctx = buildContext(req, res);
    const include = this.parseInclude(req.query.include as string);
    const record = await this.service.findById(req.params.id, ctx, include);
    appResponder(StatusCodes.OK, record as object, res);
  });

  findMany = catchAsync(async (req: Request, res: Response): Promise<void> => {
    const ctx = buildContext(req, res);
    const options = this.buildOffsetFindOptions(req);
    const result = await this.service.findMany(options, ctx);
    appResponder(StatusCodes.OK, result.data, res, result.meta);
  });

  search = catchAsync(async (req: Request, res: Response): Promise<void> => {
    const ctx = buildContext(req, res);
    const options = this.buildCursorFindOptions(req);
    const result = await this.service.findManyCursor(options, ctx);
    appResponder(StatusCodes.OK, result.data, res, result.meta);
  });

  update = catchAsync(async (req: Request, res: Response): Promise<void> => {
    const ctx = buildContext(req, res);
    const record = await this.service.update(req.params.id, req.body, ctx);
    appResponder(StatusCodes.OK, record as object, res);
  });

  delete = catchAsync(async (req: Request, res: Response): Promise<void> => {
    const ctx = buildContext(req, res);
    const soft = req.query.hard !== "true";
    await this.service.delete(req.params.id, ctx, soft);
    appResponder(StatusCodes.OK, { deleted: true }, res);
  });

  restore = catchAsync(async (req: Request, res: Response): Promise<void> => {
    const ctx = buildContext(req, res);
    const record = await this.service.restore(req.params.id, ctx);
    appResponder(StatusCodes.OK, record as object, res);
  });

  findDeleted = catchAsync(
    async (req: Request, res: Response): Promise<void> => {
      const ctx = buildContext(req, res);
      const options = this.buildOffsetFindOptions(req);
      const result = await this.service.findDeleted(options, ctx);
      appResponder(StatusCodes.OK, result.data, res, result.meta);
    }
  );

  findDeletedById = catchAsync(
    async (req: Request, res: Response): Promise<void> => {
      const ctx = buildContext(req, res);
      const include = this.parseInclude(req.query.include as string);
      const record = await this.service.findDeletedById(
        req.params.id,
        ctx,
        include
      );
      appResponder(StatusCodes.OK, record as object, res);
    }
  );

  protected buildOffsetFindOptions(req: Request): OffsetFindOptions {
    const query = req.query as Record<string, any>;

    return {
      pagination: {
        page: query.page ? Number(query.page) : 1,
        limit: query.limit ? Number(query.limit) : 20,
        sortBy: query.sortBy as string,
        sortOrder: (query.sortOrder as "asc" | "desc") || "desc",
      },
      filters: this.parseFilters(query),
      search: query.search as string | undefined,
      include: this.parseInclude(query.include as string),
    };
  }

  protected buildCursorFindOptions(req: Request): CursorFindOptions {
    const query = req.query as Record<string, any>;

    return {
      pagination: {
        cursor: query.cursor as string | undefined,
        limit: query.limit ? Number(query.limit) : 20,
        sortBy: query.sortBy as string,
        sortOrder: (query.sortOrder as "asc" | "desc") || "desc",
      },
      filters: this.parseFilters(query),
      search: query.search as string | undefined,
      include: this.parseInclude(query.include as string),
    };
  }

  protected parseFilters(query: Record<string, any>): FilterParams {
    const filters: FilterParams = {};

    for (const [key, value] of Object.entries(query)) {
      if (RESERVED_QUERY_KEYS.includes(key as any)) continue;
      if (value === undefined || value === "") continue;

      if (Array.isArray(value)) {
        filters[key] = value[0];
      } else {
        filters[key] = value;
      }
    }

    return filters;
  }

  protected parseInclude(
    include?: string
  ): Record<string, boolean> | undefined {
    if (!include) return undefined;

    return include
      .split(",")
      .map((f) => f.trim())
      .filter(Boolean)
      .reduce((acc, field) => {
        acc[field] = true;
        return acc;
      }, {} as Record<string, boolean>);
  }
}
