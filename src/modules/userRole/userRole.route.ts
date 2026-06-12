import { Router } from "express";
import { userRoleController } from "./userRole.controller";
import {
  validate,
  ParamsId,
  PaginationQuery,
} from "../../middlewares/validate.middleware";
import {
  CreateUserRoleSchema,
  UpdateUserRoleSchema,
} from "./userRole.schema";
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
  validate(CreateUserRoleSchema),
  userRoleController.create
);

// READ — offset paginated list (admin)
router.get(
  "/",
  // protect,
  validate(PaginationQuery, "query"),
  userRoleController.findMany
);

// READ — cursor paginated search (public)
router.get(
  "/search",
  // protect,
  validate(PaginationQuery, "query"),
  userRoleController.search
);

// READ — soft deleted records (admin only)
router.get(
  "/deleted",
  // protect,
  // restrictTo("resource.read_deleted"),
  validate(PaginationQuery, "query"),
  userRoleController.findDeleted
);

// READ — single soft deleted record (admin only)
router.get(
  "/deleted/:id",
  // protect,
  // restrictTo("resource.read_deleted"),
  validate(ParamsId, "params"),
  userRoleController.findDeletedById
);

// READ — single record
router.get(
  "/:id",
  // protect,
  validate(ParamsId, "params"),
  userRoleController.findById
);

// UPDATE
router.patch(
  "/:id",
  // protect,
  // restrictTo("resource.update"),
  validate(ParamsId, "params"),
  validate(UpdateUserRoleSchema),
  userRoleController.update
);

// RESTORE
router.patch(
  "/:id/restore",
  // protect,
  // restrictTo("resource.restore"),
  validate(ParamsId, "params"),
  userRoleController.restore
);

// DELETE
router.delete(
  "/:id",
  // protect,
  // restrictTo("resource.delete"),
  validate(ParamsId, "params"),
  userRoleController.delete
);

export default router;
