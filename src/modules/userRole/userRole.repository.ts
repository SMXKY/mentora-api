import { BaseRepository } from "../../base/BaseRepository";
import { Prisma } from "../../generated/prisma";

export class UserRoleRepository extends BaseRepository<any> {
  protected modelName = "userRole";

  // Fields the ?search= query param searches across
  protected searchableFields: string[] = ["reason"];

  // Allowlist for ?include= query param
  // Any relation not listed here is stripped before the Prisma call
  protected allowedIncludes: string[] = ["user", "role", "createdBy"];

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

  async findActiveByUserId(userId: string) {
    return this.model.findMany({
      where: { userId, isActive: true },
      include: { role: true },
    });
  }

  async findRoleHistoryByUserId(userId: string) {
    return this.model.findMany({
      where: { userId },
      include: { role: true, createdBy: true },
      orderBy: { createdAt: "desc" },
    });
  }

  async deactivate(id: string) {
    return this.model.update({
      where: { id },
      data: { isActive: false },
    });
  }
}
