import { BaseService } from "../../base/BaseService";
import { RoleRepository } from "./role.repository";
import { ServiceContext } from "../../base/base.types";
import {
  AssignRoleInput,
  CreateRoleInput,
  UpdateRoleInput,
} from "./role.types";
import { AppError } from "../../utils/AppError.util";
import { UserRoleRepository } from "../userRole";
import { StatusCodes } from "http-status-codes";
import { LogOperation, LogCategory } from "../../generated/prisma";

export class RoleService extends BaseService<
  any,
  CreateRoleInput,
  UpdateRoleInput
> {
  protected repository = new RoleRepository();
  protected tableName = "role";
  protected userRoleRepository = new UserRoleRepository();

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

  // protected async afterUpdate(record: any, ctx: ServiceContext) {
  //   // Side effects after successful update
  // }

  protected async beforeDelete(id: string, ctx: ServiceContext) {
    const role = await this.repository.findByIdOrThrow(id);

    if (role.isSystem) {
      throw new AppError(
        "roles/errors:system_role_immutable",
        StatusCodes.FORBIDDEN
      );
    }
  }

  // protected async afterDelete(record: any, ctx: ServiceContext) {
  //   // Side effects after deletion
  // }

  // ============================================================
  // CUSTOM METHODS
  // ============================================================

  async assignRole(userId: string, data: AssignRoleInput, ctx: ServiceContext) {
    const { roleId, reason, expiresAt } = data;

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

    const activeRoles = await this.userRoleRepository.findActiveByUserId(
      userId
    );

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
