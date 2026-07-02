import { BaseRepository } from "../../base/BaseRepository";
import { Prisma } from "../../generated/prisma";

export class PermissionOverrideRepository extends BaseRepository<any> {
  protected modelName = "permissionOverride";

  // Fields the ?search= query param searches across
  protected searchableFields: string[] = ["reason"];

  // Allowlist for ?include= query param
  // Any relation not listed here is stripped before the Prisma call
  protected allowedIncludes: string[] = ["user", "permission", "createdBy"];

  // PermissionOverride has no deletedAt column — overrides are removed
  // outright via clear() (hard delete) or superseded via GRANT/REVOKE
  // rows, not soft-deleted. Keep this false or every read/write path
  // in BaseRepository will inject a `deletedAt` filter Prisma rejects.
  protected softDeleteConfig = {
    enabled: false,
    uniqueFields: [] as string[],
  };

  // Set to true if this model has an isSystem boolean field
  protected hasSystemField = false;

  // TODO: override buildWhereClause if you need custom filtering
  // e.g. enum fields should use exact match not LIKE
  // protected buildWhereClause(filters: any, search?: string) {
  //   const where = super.buildWhereClause(filters, search)
  //   if (filters.status) where.status = filters.status  // exact match
  //   return where
  // }
}
