import { PrismaClient, Prisma } from "../generated/prisma";
import prisma from "../config/database.config";
import { AppError } from "../utils/AppError.util";
import {
  OffsetFindOptions,
  CursorFindOptions,
  OffsetPaginatedResult,
  CursorPaginatedResult,
  FilterParams,
  SoftDeleteConfig,
  RESERVED_QUERY_KEYS,
} from "./base.types";
import { StatusCodes } from "http-status-codes";

export abstract class BaseRepository<T> {
  protected prisma: PrismaClient = prisma;
  protected abstract modelName: string;
  protected searchableFields: string[] = [];
  protected allowedIncludes: string[] = [];
  protected softDeleteConfig: SoftDeleteConfig = {
    enabled: true,
    uniqueFields: [],
  };

  protected hasSystemField: boolean = false;

  protected get model(): any {
    return (this.prisma as any)[this.modelName];
  }

  async create(data: Partial<T>): Promise<T> {
    return this.model.create({ data });
  }

  async findById(
    id: string,
    include?: Record<string, boolean | object>
  ): Promise<T | null> {
    return this.model.findUnique({
      where: this.softDeleteConfig.enabled ? { id, deletedAt: null } : { id },
      include: this.sanitiseInclude(include),
    });
  }

  async findByIdOrThrow(
    id: string,
    include?: Record<string, boolean | object>
  ): Promise<T> {
    const record = await this.findById(id, include);
    if (!record) {
      throw new AppError("common/errors:db.notFound", StatusCodes.NOT_FOUND);
    }
    return record;
  }

  async findOne(
    where: Partial<T>,
    include?: Record<string, boolean | object>
  ): Promise<T | null> {
    return this.model.findFirst({
      where: this.addSoftDeleteFilter(where),
      include: this.sanitiseInclude(include),
    });
  }

  async findMany(
    options: OffsetFindOptions = {}
  ): Promise<OffsetPaginatedResult<T>> {
    const { pagination = {}, filters = {}, search, include, select } = options;

    const page = pagination.page || 1;
    const limit = Math.min(pagination.limit || 20, 100);
    const skip = (page - 1) * limit;
    const sortBy = pagination.sortBy || "createdAt";
    const sortOrder = pagination.sortOrder || "desc";

    const where = this.buildWhereClause(filters, search);

    const [data, total] = await Promise.all([
      this.model.findMany({
        where,
        include: this.sanitiseInclude(include),
        select,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
      }),
      this.model.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    };
  }

  async findManyCursor(
    options: CursorFindOptions = {}
  ): Promise<CursorPaginatedResult<T>> {
    const { pagination = {}, filters = {}, search, include, select } = options;

    const limit = Math.min(pagination.limit || 20, 100);
    const sortBy = pagination.sortBy || "createdAt";
    const sortOrder = pagination.sortOrder || "desc";
    const cursor = pagination.cursor;

    const where = this.buildWhereClause(filters, search);

    const data = await this.model.findMany({
      where,
      include: this.sanitiseInclude(include),
      select,
      take: limit + 1,
      ...(cursor && {
        cursor: { id: cursor },
        skip: 1,
      }),
      orderBy: { [sortBy]: sortOrder },
    });

    const hasNextPage = data.length > limit;
    const results = hasNextPage ? data.slice(0, limit) : data;
    const nextCursor =
      hasNextPage && results.length > 0
        ? (results[results.length - 1] as any).id
        : null;

    return {
      data: results,
      meta: {
        nextCursor,
        hasNextPage,
        limit,
      },
    };
  }

  async findAll(
    where: Partial<T> = {},
    include?: Record<string, boolean | object>
  ): Promise<T[]> {
    return this.model.findMany({
      where: this.addSoftDeleteFilter(where),
      include: this.sanitiseInclude(include),
    });
  }

  async update(id: string, data: Partial<T>): Promise<T> {
    const record = await this.findByIdOrThrow(id);
    this.assertNotSystem(record);

    return this.model.update({
      where: { id },
      data,
    });
  }

  async delete(id: string): Promise<T> {
    const record = await this.findByIdOrThrow(id);
    this.assertNotSystem(record);

    return this.model.delete({ where: { id } });
  }

  async softDelete(id: string): Promise<T> {
    if (!this.softDeleteConfig.enabled) {
      throw new AppError("common/errors:db.softDeleteNotSupported", 405);
    }

    const record = await this.findByIdOrThrow(id);
    this.assertNotSystem(record);

    const timestamp = Date.now();
    const updateData: Record<string, any> = {
      deletedAt: new Date(),
    };

    if (this.softDeleteConfig.uniqueFields?.length) {
      for (const field of this.softDeleteConfig.uniqueFields) {
        if ((record as any)[field]) {
          updateData[field] = `${(record as any)[field]}_deleted_${timestamp}`;
        }
      }
    }

    return this.model.update({
      where: { id },
      data: updateData,
    });
  }

  async restore(id: string): Promise<T> {
    const record = await this.model.findUnique({ where: { id } });

    if (!record) {
      throw new AppError("common/errors:db.notFound", StatusCodes.NOT_FOUND);
    }

    if (record.deletedAt === null) {
      throw new AppError(
        "common/errors:db.notDeleted",
        StatusCodes.BAD_REQUEST
      );
    }

    return this.model.update({
      where: { id },
      data: { deletedAt: null },
    });
  }

  async findDeleted(
    options: OffsetFindOptions = {}
  ): Promise<OffsetPaginatedResult<T>> {
    const { pagination = {}, filters = {}, search, include, select } = options;

    const page = pagination.page || 1;
    const limit = Math.min(pagination.limit || 20, 100);
    const skip = (page - 1) * limit;
    const sortBy = pagination.sortBy || "deletedAt";
    const sortOrder = pagination.sortOrder || "desc";

    const where = this.buildWhereClauseDeleted(filters, search);

    const [data, total] = await Promise.all([
      this.model.findMany({
        where,
        include: this.sanitiseInclude(include),
        select,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
      }),
      this.model.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    };
  }

  async findDeletedById(
    id: string,
    include?: Record<string, boolean | object>
  ): Promise<T | null> {
    return this.model.findFirst({
      where: { id, deletedAt: { not: null } },
      include: this.sanitiseInclude(include),
    });
  }

  async findDeletedByIdOrThrow(
    id: string,
    include?: Record<string, boolean | object>
  ): Promise<T> {
    const record = await this.findDeletedById(id, include);
    if (!record) {
      throw new AppError("common/errors:db.notFound", StatusCodes.NOT_FOUND);
    }
    return record;
  }

  async exists(where: Partial<T>): Promise<boolean> {
    const count = await this.model.count({
      where: this.addSoftDeleteFilter(where),
    });
    return count > 0;
  }

  async count(where: Partial<T> = {}): Promise<number> {
    return this.model.count({
      where: this.addSoftDeleteFilter(where),
    });
  }

  async transaction<R>(
    fn: (tx: Prisma.TransactionClient) => Promise<R>
  ): Promise<R> {
    return this.prisma.$transaction(fn);
  }

  protected buildWhereClause(
    filters: FilterParams,
    search?: string
  ): Record<string, any> {
    const where: Record<string, any> = this.softDeleteConfig.enabled
      ? { deletedAt: null }
      : {};

    for (const [key, value] of Object.entries(filters)) {
      if (value === undefined || value === "") continue;

      if (typeof value === "string" && this.isUuid(value)) {
        where[key] = value;
      } else if (typeof value === "string") {
        where[key] = { contains: value, mode: "insensitive" };
      } else {
        where[key] = value;
      }
    }

    if (search && this.searchableFields.length > 0) {
      where.OR = this.searchableFields.map((field) => ({
        [field]: { contains: search, mode: "insensitive" },
      }));
    }

    return where;
  }

  protected buildWhereClauseDeleted(
    filters: FilterParams,
    search?: string
  ): Record<string, any> {
    const where: Record<string, any> = { deletedAt: { not: null } };

    if (!this.softDeleteConfig.enabled) {
      throw new AppError("common/errors:db.softDeleteNotSupported", 405);
    }

    for (const [key, value] of Object.entries(filters)) {
      if (value === undefined || value === "") continue;

      if (typeof value === "string" && this.isUuid(value)) {
        where[key] = value;
      } else if (typeof value === "string") {
        where[key] = { contains: value, mode: "insensitive" };
      } else {
        where[key] = value;
      }
    }

    if (search && this.searchableFields.length > 0) {
      where.OR = this.searchableFields.map((field) => ({
        [field]: { contains: search, mode: "insensitive" },
      }));
    }

    return where;
  }

  protected sanitiseInclude(
    include?: Record<string, boolean | object>
  ): Record<string, boolean | object> | undefined {
    if (!include) return undefined;
    if (this.allowedIncludes.length === 0) return undefined;

    const sanitised: Record<string, boolean | object> = {};

    for (const key of Object.keys(include)) {
      if (this.allowedIncludes.includes(key)) {
        sanitised[key] = include[key];
      }
    }

    return Object.keys(sanitised).length > 0 ? sanitised : undefined;
  }

  protected addSoftDeleteFilter(where: Partial<T>): Record<string, any> {
    return this.softDeleteConfig.enabled
      ? { ...where, deletedAt: null }
      : { ...where };
  }

  protected assertNotSystem(record: any): void {
    if (this.hasSystemField && record?.isSystem === true) {
      throw new AppError("common/errors:db.systemRecordImmutable", 403);
    }
  }

  protected isUuid(value: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      value
    );
  }
}
