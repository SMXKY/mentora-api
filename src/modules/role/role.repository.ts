import { BaseRepository } from "../../base/BaseRepository";
import { Prisma } from "../../generated/prisma";

export class RoleRepository extends BaseRepository<any> {
  protected modelName = "role";

  // Fields the ?search= query param searches across
  protected searchableFields: string[] = ["name", "description"];

  // Allowlist for ?include= query param
  // Any relation not listed here is stripped before the Prisma call
  protected allowedIncludes: string[] = ["rolePermissions", "userRoles", "storageQuotaDefaults"];

  protected softDeleteConfig = {
    enabled: true,
    // `name` is unique — free it up on soft-delete so a new role
    // can reuse the name without hitting a unique constraint
    uniqueFields: ["name"] as string[],
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
