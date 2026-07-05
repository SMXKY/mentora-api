import { Router } from "express";
import { userRoleController } from "./userRole.controller";
import {
  validate,
  ParamsId,
  PaginationQuery,
} from "../../middlewares/validate.middleware";
import { CreateUserRoleSchema, UpdateUserRoleSchema } from "./userRole.schema";
import protect from "../../middlewares/protect.middleware";
import restrictTo from "../../middlewares/restrictTo.middleware";
import { permissions } from "../../data/permission.data";

const router = Router();

// ============================================================
// STANDARD CRUD ROUTES
// Not currently mounted in src/app.ts (see docs/permissionModuleAudit.md).
// Auth is wired up so this module is safe to mount later —
// it operates on the same UserRole model as role.route.ts's
// assign/unassign endpoints, so it reuses the same rbac.roles* codes.
// ============================================================

// CREATE
router.post(
  "/",
  protect,
  restrictTo(permissions.rbac.rolesUpdate),
  validate(CreateUserRoleSchema),
  userRoleController.create
);

// READ — offset paginated list (admin)
router.get(
  "/",
  protect,
  restrictTo(permissions.rbac.rolesRead),
  validate(PaginationQuery, "query"),
  userRoleController.findMany
);

// READ — cursor paginated search (admin)
router.get(
  "/search",
  protect,
  restrictTo(permissions.rbac.rolesRead),
  validate(PaginationQuery, "query"),
  userRoleController.search
);

// READ — soft deleted records (admin only)
router.get(
  "/deleted",
  protect,
  restrictTo(permissions.rbac.rolesRead),
  validate(PaginationQuery, "query"),
  userRoleController.findDeleted
);

// READ — single soft deleted record (admin only)
router.get(
  "/deleted/:id",
  protect,
  restrictTo(permissions.rbac.rolesRead),
  validate(ParamsId, "params"),
  userRoleController.findDeletedById
);

// READ — single record
router.get(
  "/:id",
  protect,
  restrictTo(permissions.rbac.rolesRead),
  validate(ParamsId, "params"),
  userRoleController.findById
);

// UPDATE
router.patch(
  "/:id",
  protect,
  restrictTo(permissions.rbac.rolesUpdate),
  validate(ParamsId, "params"),
  validate(UpdateUserRoleSchema),
  userRoleController.update
);

// RESTORE
router.patch(
  "/:id/restore",
  protect,
  restrictTo(permissions.rbac.rolesUpdate),
  validate(ParamsId, "params"),
  userRoleController.restore
);

// DELETE
router.delete(
  "/:id",
  protect,
  restrictTo(permissions.rbac.rolesDelete),
  validate(ParamsId, "params"),
  userRoleController.delete
);

export default router;
