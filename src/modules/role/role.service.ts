import { BaseService } from "../../base/BaseService";
import { RoleRepository } from "./role.repository";
import { ServiceContext } from "../../base/base.types";
import {
  AssignRoleInput,
  CreateRoleInput,
  UpdateRoleInput,
  UpdateRolePermissionsInput,
} from "./role.types";
import { AppError } from "../../utils/AppError.util";
import { UserRoleRepository } from "../userRole";
import { StatusCodes } from "http-status-codes";
import prisma from "../../config/database.config";
import { invalidatePermissionCache } from "../../utils/getUserPermissions.util";

export class RoleService extends BaseService<
  any,
  CreateRoleInput,
  UpdateRoleInput
> {
  protected repository = new RoleRepository();
  protected tableName = "role";
  protected userRoleRepository = new UserRoleRepository();

  // ============================================================
  // LIFECYCLE HOOKS
  // ============================================================

  protected async beforeUpdate(
    id: string,
    data: UpdateRoleInput,
    ctx: ServiceContext
  ) {
    const role = await this.repository.findByIdOrThrow(id);

    if (role.isSystem) {
      throw new AppError(
        "roles/errors:system_role_immutable",
        StatusCodes.FORBIDDEN
      );
    }

    return data;
  }

  protected async beforeDelete(id: string, ctx: ServiceContext) {
    const role = await this.repository.findByIdOrThrow(id);

    if (role.isSystem) {
      throw new AppError(
        "roles/errors:system_role_immutable",
        StatusCodes.FORBIDDEN
      );
    }

    const assignedCount = await this.userRoleRepository.count({
      roleId: id,
      isActive: true,
    } as any);

    if (assignedCount > 0) {
      throw new AppError(
        "roles/errors:role_has_assigned_users",
        StatusCodes.BAD_REQUEST
      );
    }
  }

  async getPermissionCatalogForRole(roleId: string, ctx: ServiceContext) {
    const role = await this.repository.findByIdOrThrow(roleId);

    const [modules, rolePermissions, implications] = await Promise.all([
      prisma.permissionModule.findMany({
        include: {
          submodules: {
            include: {
              permissions: {
                orderBy: { code: "asc" },
              },
            },
          },
          permissions: {
            where: { permissionSubmoduleId: null },
            orderBy: { code: "asc" },
          },
        },
        orderBy: { nameLocaleCode: "asc" },
      }),
      prisma.rolePermission.findMany({
        where: { roleId },
        select: { permission: { select: { code: true } } },
      }),
      prisma.permissionImplication.findMany({
        select: {
          permission: { select: { code: true } },
          impliedPermission: { select: { code: true } },
        },
      }),
    ]);

    const assignedCodes = new Set(
      rolePermissions.map((rp) => rp.permission.code)
    );

    const implicationMap = new Map<string, string[]>();
    for (const impl of implications) {
      const existing = implicationMap.get(impl.permission.code) ?? [];
      existing.push(impl.impliedPermission.code);
      implicationMap.set(impl.permission.code, existing);
    }

    // Codes that are implied by something already assigned —
    // the frontend renders these as locked/checked, not editable
    const impliedOnlyCodes = new Set<string>();
    for (const code of assignedCodes) {
      for (const implied of implicationMap.get(code) ?? []) {
        if (!assignedCodes.has(implied)) {
          impliedOnlyCodes.add(implied);
        }
      }
    }

    const formatPermission = (p: any) => ({
      id: p.id,
      code: p.code,
      nameLocaleCode: p.nameLocaleCode,
      descriptionLocaleCode: p.descriptionLocaleCode,
      riskLevel: p.riskLevel,
      isSystem: p.isSystem,
      isAssigned: assignedCodes.has(p.code),
      isImpliedOnly: impliedOnlyCodes.has(p.code),
      impliedBy: role.isSystem
        ? []
        : Array.from(implicationMap.entries())
            .filter(([, implied]) => implied.includes(p.code))
            .map(([source]) => source)
            .filter((source) => assignedCodes.has(source)),
    });

    return {
      role: {
        id: role.id,
        name: role.name,
        description: role.description,
        isSystem: role.isSystem,
        editable: !role.isSystem,
      },
      modules: modules.map((mod) => ({
        id: mod.id,
        nameLocaleCode: mod.nameLocaleCode,
        descriptionLocaleCode: mod.descriptionLocaleCode,
        directPermissions: mod.permissions.map(formatPermission),
        submodules: mod.submodules.map((sub) => ({
          id: sub.id,
          nameLocaleCode: sub.nameLocaleCode,
          descriptionLocaleCode: sub.descriptionLocaleCode,
          permissions: sub.permissions.map(formatPermission),
        })),
      })),
    };
  }

  async updatePermissions(
    roleId: string,
    data: UpdateRolePermissionsInput,
    ctx: ServiceContext
  ) {
    const role = await this.repository.findByIdOrThrow(roleId);

    if (role.isSystem) {
      throw new AppError(
        "roles/errors:system_role_permissions_immutable",
        StatusCodes.FORBIDDEN
      );
    }

    if (!ctx.userId) {
      throw new AppError(
        "auth/errors:notAuthenticated",
        StatusCodes.UNAUTHORIZED
      );
    }

    const { permissionCodes } = data;

    const validPermissions = await prisma.permission.findMany({
      where: { code: { in: permissionCodes } },
      select: { id: true, code: true },
    });

    const validCodes = new Set(validPermissions.map((p) => p.code));
    const invalidCodes = permissionCodes.filter((c) => !validCodes.has(c));

    if (invalidCodes.length > 0) {
      throw new AppError(
        "roles/errors:invalid_permission_codes",
        StatusCodes.BAD_REQUEST
      );
    }

    const previousState = await prisma.rolePermission.findMany({
      where: { roleId },
      select: { permission: { select: { code: true } } },
    });
    const previousCodes = previousState.map((rp) => rp.permission.code);

    await prisma.$transaction(async (tx) => {
      await tx.rolePermission.deleteMany({ where: { roleId } });

      if (validPermissions.length > 0) {
        await tx.rolePermission.createMany({
          data: validPermissions.map((p) => ({
            roleId,
            permissionId: p.id,
            createdById: String(ctx.userId),
          })),
        });
      }
    });

    // Every user holding this role now has stale cached permissions
    const affectedUsers = await this.userRoleRepository.findAll({
      roleId,
      isActive: true,
    } as any);

    await Promise.all(
      affectedUsers.map((ur: any) => invalidatePermissionCache(ur.userId))
    );

    this.log(ctx, {
      operation: "UPDATE",
      category: "WRITE",
      recordId: roleId,
      eventType: "role.permissions_updated",
      targetType: "role_permissions",
      previousState: { permissionCodes: previousCodes },
      newState: { permissionCodes: Array.from(validCodes) },
      changedFields: ["permissions"],
    });

    return this.getPermissionCatalogForRole(roleId, ctx);
  }

  // ============================================================
  // CUSTOM METHODS
  // ============================================================
  SELF_REGISTRATION_ROLE_NAMES = ["Parent", "Student", "Tutor"];

  async assignRole(userId: string, data: AssignRoleInput, ctx: ServiceContext) {
    const { roleId, reason, expiresAt } = data;

    const activeRoles = await this.userRoleRepository.findActiveByUserId(
      userId
    );

    const hasSelfRegistrationRole = activeRoles.some((ur: any) =>
      this.SELF_REGISTRATION_ROLE_NAMES.includes(ur.role.name)
    );

    if (hasSelfRegistrationRole) {
      throw new AppError(
        "roles/errors:cannot_modify_self_registration_user",
        StatusCodes.FORBIDDEN
      );
    }

    const role = await this.repository.findById(roleId);
    if (!role) {
      throw new AppError("roles/errors:notFound", StatusCodes.NOT_FOUND);
    }

    const existingExact = await this.userRoleRepository.findOne({
      userId,
      roleId,
    });

    if (existingExact && existingExact.isActive) {
      throw new AppError(
        "roles/errors:already_assigned",
        StatusCodes.BAD_REQUEST
      );
    }

    if (activeRoles.length > 0) {
      if (!role.allowsMultiple) {
        throw new AppError(
          "roles/errors:multiple_not_allowed",
          StatusCodes.BAD_REQUEST
        );
      }
      const hasExclusiveRole = activeRoles.some(
        (ur: any) => !ur.role.allowsMultiple
      );
      if (hasExclusiveRole) {
        throw new AppError(
          "roles/errors:user_has_exclusive_role",
          StatusCodes.BAD_REQUEST
        );
      }
    }

    const created = await this.userRoleRepository.transaction(async (tx) => {
      return this.userRoleRepository.create({
        userId,
        roleId,
        reason,
        expiresAt,
        createdById: ctx.userId,
      });
    });

    await invalidatePermissionCache(userId);

    this.log(ctx, {
      operation: "CREATE",
      category: "WRITE",
      recordId: created.id,
      eventType: "role.assigned",
      targetType: "user_roles",
      newState: created as Record<string, any>,
    });

    return created;
  }

  async unassignRole(userId: string, userRoleId: string, ctx: ServiceContext) {
    const activeRoles = await this.userRoleRepository.findActiveByUserId(
      userId
    );

    const hasSelfRegistrationRole = activeRoles.some((ur: any) =>
      this.SELF_REGISTRATION_ROLE_NAMES.includes(ur.role.name)
    );

    if (hasSelfRegistrationRole) {
      throw new AppError(
        "roles/errors:cannot_modify_self_registration_user",
        StatusCodes.FORBIDDEN
      );
    }

    const existing = await this.userRoleRepository.findById(userRoleId);

    if (!existing || existing.userId !== userId) {
      throw new AppError(
        "roles/errors:assignment_not_found",
        StatusCodes.NOT_FOUND
      );
    }

    if (!existing.isActive) {
      throw new AppError(
        "roles/errors:already_inactive",
        StatusCodes.BAD_REQUEST
      );
    }

    const updated = await this.userRoleRepository.deactivate(userRoleId);

    await invalidatePermissionCache(userId);

    this.log(ctx, {
      operation: "UPDATE",
      category: "WRITE",
      recordId: updated.id,
      eventType: "role.unassigned",
      targetType: "user_roles",
      previousState: existing as Record<string, any>,
      newState: updated as Record<string, any>,
      changedFields: ["isActive"],
    });

    return updated;
  }

  async getRoleHistory(userId: string, ctx: ServiceContext) {
    const history = await this.userRoleRepository.findRoleHistoryByUserId(
      userId
    );
    return history;
  }
}
