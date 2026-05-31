import { Router } from "express";
import { testResourceController } from "./testResource.controller";
import {
  validate,
  ParamsId,
  PaginationQuery,
} from "../../middlewares/validate.middleware";
import {
  CreateTestResourceSchema,
  UpdateTestResourceSchema,
} from "./testResource.schema";
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
  validate(CreateTestResourceSchema),
  testResourceController.create
);

// READ — offset paginated list (admin)
router.get(
  "/",
  // protect,
  validate(PaginationQuery, "query"),
  testResourceController.findMany
);

// READ — cursor paginated search (public)
router.get(
  "/search",
  // protect,
  validate(PaginationQuery, "query"),
  testResourceController.search
);

// READ — soft deleted records (admin only)
router.get(
  "/deleted",
  // protect,
  // restrictTo("resource.read_deleted"),
  validate(PaginationQuery, "query"),
  testResourceController.findDeleted
);

// READ — single soft deleted record (admin only)
router.get(
  "/deleted/:id",
  // protect,
  // restrictTo("resource.read_deleted"),
  validate(ParamsId, "params"),
  testResourceController.findDeletedById
);

// READ — single record
router.get(
  "/:id",
  // protect,
  validate(ParamsId, "params"),
  testResourceController.findById
);

// UPDATE
router.patch(
  "/:id",
  // protect,
  // restrictTo("resource.update"),
  validate(ParamsId, "params"),
  validate(UpdateTestResourceSchema),
  testResourceController.update
);

// RESTORE
router.patch(
  "/:id/restore",
  // protect,
  // restrictTo("resource.restore"),
  validate(ParamsId, "params"),
  testResourceController.restore
);

// DELETE
router.delete(
  "/:id",
  // protect,
  // restrictTo("resource.delete"),
  validate(ParamsId, "params"),
  testResourceController.delete
);

export default router;
