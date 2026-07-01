import { Router } from "express";
import { roleController } from "./role.controller";
import {
  validate,
  ParamsId,
  PaginationQuery,
} from "../../middlewares/validate.middleware";
import {
  CreateRoleSchema,
  UpdateRoleSchema,
  AssignRoleSchema,
} from "./role.schema";
import { UpdateRolePermissionsSchema } from "./role.schema";
import protect from "../../middlewares/protect.middleware";
import restrictTo from "../../middlewares/restrictTo.middleware";
import { permissions } from "../../data/permission.data";

const router = Router();

router.post(
  "/",
  protect,
  restrictTo(permissions.rbac.rolesCreate),
  validate(CreateRoleSchema),
  roleController.create
);

router.get(
  "/",
  protect,
  restrictTo(permissions.rbac.rolesRead),
  validate(PaginationQuery, "query"),
  roleController.findMany
);

router.get(
  "/search",
  protect,
  restrictTo(permissions.rbac.rolesRead),
  validate(PaginationQuery, "query"),
  roleController.search
);

router.get(
  "/deleted",
  protect,
  restrictTo(permissions.rbac.rolesRead),
  validate(PaginationQuery, "query"),
  roleController.findDeleted
);

router.get(
  "/deleted/:id",
  protect,
  restrictTo(permissions.rbac.rolesRead),
  validate(ParamsId, "params"),
  roleController.findDeletedById
);

router.get(
  "/:id",
  protect,
  restrictTo(permissions.rbac.rolesRead),
  validate(ParamsId, "params"),
  roleController.findById
);

router.patch(
  "/:id",
  protect,
  restrictTo(permissions.rbac.rolesUpdate),
  validate(ParamsId, "params"),
  validate(UpdateRoleSchema),
  roleController.update
);

router.patch(
  "/:id/restore",
  protect,
  restrictTo(permissions.rbac.rolesCreate),
  validate(ParamsId, "params"),
  roleController.restore
);

router.delete(
  "/:id",
  protect,
  restrictTo(permissions.rbac.rolesDelete),
  validate(ParamsId, "params"),
  roleController.delete
);

router.get(
  "/:id/permissions",
  protect,
  restrictTo(permissions.rbac.permissionsRead),
  validate(ParamsId, "params"),
  roleController.getPermissionCatalog
);

router.put(
  "/:id/permissions",
  protect,
  restrictTo(permissions.rbac.permissionsWrite),
  validate(ParamsId, "params"),
  validate(UpdateRolePermissionsSchema),
  roleController.updatePermissions
);

router.post(
  "/assign/:userId",
  protect,
  restrictTo(permissions.rbac.rolesUpdate),
  validate(AssignRoleSchema),
  roleController.assignRole
);

router.patch(
  "/unassign/:userId/:userRoleId",
  protect,
  restrictTo(permissions.rbac.rolesUpdate),
  roleController.unassignRole
);

router.get(
  "/history/:userId",
  protect,
  restrictTo(permissions.rbac.rolesRead),
  roleController.roleHistory
);

export default router;
