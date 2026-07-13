import { Request, Response } from "express";
import { Languages, LogCategory, LogOperation } from "../generated/prisma";

export interface ServiceContext {
  userId?: string;
  userEmail?: string;
  requestId?: string;
  ipAddress?: string;
  userAgent?: string;
  lang?: Languages;
  /** Recipient's stored language preference — used for notification copy, distinct from `lang` (request Accept-Language). */
  preferredLanguage?: string | null;
}

export interface OffsetPaginationParams {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

export interface OffsetPaginatedResult<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}

export interface CursorPaginationParams {
  cursor?: string; // ID of the last item seen on previous page
  limit?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

export interface CursorPaginatedResult<T> {
  data: T[];
  meta: {
    nextCursor: string | null; // null means no more pages
    hasNextPage: boolean;
    limit: number;
  };
}

export interface OffsetFindOptions {
  pagination?: OffsetPaginationParams;
  filters?: Record<string, any>;
  search?: string;
  include?: Record<string, boolean | object>;
  select?: Record<string, boolean>;
}

export interface CursorFindOptions {
  pagination?: CursorPaginationParams;
  filters?: Record<string, any>;
  search?: string;
  include?: Record<string, boolean | object>;
  select?: Record<string, boolean>;
}

export type AuditOperation = LogOperation;
export type AuditCategory = LogCategory;

export interface AuditLogOptions {
  operation: LogOperation;
  category: LogCategory;
  recordId: string;
  previousState?: Record<string, any> | null;
  newState?: Record<string, any> | null;
  changedFields?: string[];
  eventType?: string;
  targetType?: string;
}

export type FilterParams = Record<
  string,
  string | number | boolean | undefined
>;

export const RESERVED_QUERY_KEYS = [
  "page",
  "limit",
  "sort",
  "sortBy",
  "sortOrder",
  "search",
  "include",
  "fields",
  "cursor",
] as const;

export type ModuleType =
  | "standard"
  | "tableless"
  | "readonly"
  | "custom"
  | "external";

export interface SoftDeleteConfig {
  enabled: boolean;
  uniqueFields?: string[];
}
