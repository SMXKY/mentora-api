import { Router } from "express";
import { permissionController } from "./permission.controller";
import { validate, ParamsId, PaginationQuery } from "../../middlewares/validate.middleware";
// import { protect } from "../../middlewares/protect.middleware";
// import { restrictTo } from "../../middlewares/restrictTo.middleware";

const router = Router();

// Read-only routes
router.get(
  "/",
  // protect,
  validate(PaginationQuery, "query"),
  permissionController.findMany
);

router.get(
  "/search",
  // protect,
  validate(PaginationQuery, "query"),
  permissionController.search
);

router.get(
  "/:id",
  // protect,
  validate(ParamsId, "params"),
  permissionController.findById
);

export default router;
