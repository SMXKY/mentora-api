import { Router } from "express";
import { userController } from "./user.controller";
import {
  validate,
  ParamsId,
  PaginationQuery,
} from "../../middlewares/validate.middleware";
import {
  CreateUserSchema,
  UpdateUserSchema,
} from "./user.schema";
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
  validate(CreateUserSchema),
  userController.create
);

// READ — offset paginated list (admin)
router.get(
  "/",
  // protect,
  validate(PaginationQuery, "query"),
  userController.findMany
);

// READ — cursor paginated search (public)
router.get(
  "/search",
  // protect,
  validate(PaginationQuery, "query"),
  userController.search
);

// READ — soft deleted records (admin only)
router.get(
  "/deleted",
  // protect,
  // restrictTo("resource.read_deleted"),
  validate(PaginationQuery, "query"),
  userController.findDeleted
);

// READ — single soft deleted record (admin only)
router.get(
  "/deleted/:id",
  // protect,
  // restrictTo("resource.read_deleted"),
  validate(ParamsId, "params"),
  userController.findDeletedById
);

// READ — single record
router.get(
  "/:id",
  // protect,
  validate(ParamsId, "params"),
  userController.findById
);

// UPDATE
router.patch(
  "/:id",
  // protect,
  // restrictTo("resource.update"),
  validate(ParamsId, "params"),
  validate(UpdateUserSchema),
  userController.update
);

// RESTORE
router.patch(
  "/:id/restore",
  // protect,
  // restrictTo("resource.restore"),
  validate(ParamsId, "params"),
  userController.restore
);

// DELETE
router.delete(
  "/:id",
  // protect,
  // restrictTo("resource.delete"),
  validate(ParamsId, "params"),
  userController.delete
);

export default router;
