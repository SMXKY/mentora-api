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
// import { protect } from "../../middlewares/protect.middleware";
// import { restrictTo } from "../../middlewares/restrictTo.middleware";

const router = Router();

// ============================================================
// STANDARD CRUD ROUTES
// Uncomment protect and restrictTo as you implement auth
// Add the correct permission string to restrictTo
// ============================================================

// CREATE
router.post(
  "/",
  // protect,
  // restrictTo("resource.create"),
  validate(CreateRoleSchema),
  roleController.create
);

// READ — offset paginated list (admin)
router.get(
  "/",
  // protect,
  validate(PaginationQuery, "query"),
  roleController.findMany
);

// READ — cursor paginated search (public)
router.get(
  "/search",
  // protect,
  validate(PaginationQuery, "query"),
  roleController.search
);

// READ — soft deleted records (admin only)
router.get(
  "/deleted",
  // protect,
  // restrictTo("resource.read_deleted"),
  validate(PaginationQuery, "query"),
  roleController.findDeleted
);

// READ — single soft deleted record (admin only)
router.get(
  "/deleted/:id",
  // protect,
  // restrictTo("resource.read_deleted"),
  validate(ParamsId, "params"),
  roleController.findDeletedById
);

// READ — single record
router.get(
  "/:id",
  // protect,
  validate(ParamsId, "params"),
  roleController.findById
);

// UPDATE
router.patch(
  "/:id",
  // protect,
  // restrictTo("resource.update"),
  validate(ParamsId, "params"),
  validate(UpdateRoleSchema),
  roleController.update
);

// RESTORE
router.patch(
  "/:id/restore",
  // protect,
  // restrictTo("resource.restore"),
  validate(ParamsId, "params"),
  roleController.restore
);

// DELETE
router.delete(
  "/:id",
  // protect,
  // restrictTo("resource.delete"),
  validate(ParamsId, "params"),
  roleController.delete
);

// ============================================================
// USER ROLE ASSIGNMENT ROUTES
// ============================================================

// ASSIGN — assign a role to a user
router.post(
  "/asign/:userId",
  // protect,
  // restrictTo("roles.assign"),
  validate(AssignRoleSchema),
  roleController.assignRole
);

// UNASSIGN — deactivate a user's role assignment
router.patch(
  "/unassign/:userId/:userRoleId",
  // protect,
  // restrictTo("roles.unassign"),
  roleController.unassignRole
);

// HISTORY — view a user's role assignment history
router.get(
  "/history/:userId",
  // protect,
  // restrictTo("roles.view_history"),
  roleController.roleHistory
);

export default router;
