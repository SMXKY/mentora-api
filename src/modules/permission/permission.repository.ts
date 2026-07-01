import { BaseRepository } from "../../base/BaseRepository";
import { Prisma } from "../../generated/prisma";

export class PermissionRepository extends BaseRepository<any> {
  protected modelName = "permission";

  // Fields the ?search= query param searches across
  // Empty means search is silently ignored
  // TODO: update with the fields that make sense to search
  protected searchableFields: string[] = [];

  // Allowlist for ?include= query param
  // Any relation not listed here is stripped before the Prisma call
  protected allowedIncludes: string[] = ["permissionModule", "permissionSubmodule", "rolePermissions", "overrides", "implies", "impliedBy"];

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
