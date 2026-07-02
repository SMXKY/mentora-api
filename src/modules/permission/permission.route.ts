import { Router } from "express";
import { permissionController } from "./permission.controller";
import {
  validate,
  ParamsId,
  PaginationQuery,
} from "../../middlewares/validate.middleware";
import protect from "../../middlewares/protect.middleware";
import restrictTo from "../../middlewares/restrictTo.middleware";
import { permissions } from "../../data/permission.data";

const router = Router();

router.get(
  "/",
  protect,
  restrictTo(permissions.rbac.permissionsRead),
  validate(PaginationQuery, "query"),
  permissionController.findMany
);

router.get(
  "/search",
  protect,
  restrictTo(permissions.rbac.permissionsRead),
  validate(PaginationQuery, "query"),
  permissionController.search
);

router.get(
  "/:id",
  protect,
  restrictTo(permissions.rbac.permissionsRead),
  validate(ParamsId, "params"),
  permissionController.findById
);

export default router;
