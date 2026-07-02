import { BaseService } from "../../base/BaseService";
import { PermissionOverrideRepository } from "./permissionOverride.repository";
import { ServiceContext } from "../../base/base.types";
import {
  GrantPermissionOverrideInput,
  RevokePermissionOverrideInput,
} from "./permissionOverride.types";
import { AppError } from "../../utils/AppError.util";
import { StatusCodes } from "http-status-codes";
import prisma from "../../config/database.config";
import { GrantType } from "../../generated/prisma";
import { invalidatePermissionCache } from "../../utils/getUserPermissions.util";

export class PermissionOverrideService extends BaseService<any, any, any> {
  protected repository = new PermissionOverrideRepository();
  protected tableName = "permissionOverride";

  // ============================================================
  // GRANT — give a user a permission directly, independent of role
  // ============================================================

  async grant(data: GrantPermissionOverrideInput, ctx: ServiceContext) {
    return this.createOverride(data, GrantType.GRANT, ctx);
  }

  // ============================================================
  // REVOKE — deny a user a permission directly, overriding their role
  // ============================================================

  async revoke(data: RevokePermissionOverrideInput, ctx: ServiceContext) {
    return this.createOverride(data, GrantType.REVOKE, ctx);
  }

  private async createOverride(
    data: GrantPermissionOverrideInput | RevokePermissionOverrideInput,
    grantType: GrantType,
    ctx: ServiceContext
  ) {
    if (!ctx.userId) {
      throw new AppError(
        "auth/errors:notAuthenticated",
        StatusCodes.UNAUTHORIZED
      );
    }

    const { userId, permissionCode, reason, expiresAt } = data;

    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });

    if (!targetUser) {
      throw new AppError(
        "permissionOverride/errors:userNotFound",
        StatusCodes.NOT_FOUND
      );
    }

    const permission = await prisma.permission.findUnique({
      where: { code: permissionCode },
      select: { id: true },
    });

    if (!permission) {
      throw new AppError(
        "permissionOverride/errors:permissionNotFound",
        StatusCodes.NOT_FOUND
      );
    }

    // Upsert on the (userId, permissionId) unique constraint instead of a
    // manual findFirst-then-create/update — the manual version has a real
    // TOCTOU race under concurrent requests for the same pair (two
    // requests can both see "no existing row" and both attempt create(),
    // and the loser gets a raw 409 unique-constraint error instead of a
    // clean upsert). This also means an override that's expired but not
    // yet cleaned up gets correctly reactivated/overwritten rather than
    // producing a duplicate-row conflict.
    const wasExisting = await prisma.permissionOverride.findUnique({
      where: {
        userId_permissionId: { userId, permissionId: permission.id },
      },
      select: { id: true },
    });

    const override = await prisma.permissionOverride.upsert({
      where: {
        userId_permissionId: { userId, permissionId: permission.id },
      },
      update: {
        grantType,
        reason,
        expiresAt: expiresAt ?? null,
        createdById: ctx.userId,
      },
      create: {
        userId,
        permissionId: permission.id,
        grantType,
        reason,
        expiresAt: expiresAt ?? null,
        createdById: ctx.userId,
      },
    });

    await invalidatePermissionCache(userId);

    this.log(ctx, {
      operation: wasExisting ? "UPDATE" : "CREATE",
      category: "WRITE",
      recordId: override.id,
      eventType:
        grantType === GrantType.GRANT
          ? "permission.override_granted"
          : "permission.override_revoked",
      targetType: "permission_overrides",
      newState: override as Record<string, any>,
    });

    return override;
  }

  // ============================================================
  // LIST — active overrides currently applying to a user
  // ============================================================

  async listActiveForUser(userId: string, ctx: ServiceContext) {
    return prisma.permissionOverride.findMany({
      where: {
        userId,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      include: {
        permission: {
          select: { code: true, nameLocaleCode: true, riskLevel: true },
        },
        createdBy: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  // ============================================================
  // CLEAR — remove an override entirely (not the same as revoking
  // a permission — this deletes the override row, returning the
  // user to whatever their role alone grants)
  // ============================================================

  async clear(overrideId: string, ctx: ServiceContext) {
    const override = await this.repository.findByIdOrThrow(overrideId);

    await this.repository.delete(overrideId);

    await invalidatePermissionCache(override.userId);

    this.log(ctx, {
      operation: "DELETE",
      category: "WRITE",
      recordId: overrideId,
      eventType: "permission.override_cleared",
      targetType: "permission_overrides",
      previousState: override as Record<string, any>,
    });

    return { cleared: true };
  }
}
