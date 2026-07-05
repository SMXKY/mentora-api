import { Router } from "express";
import { auditLogController } from "./auditLog.controller";
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
  restrictTo(permissions.audit.readAll),
  validate(PaginationQuery, "query"),
  auditLogController.findMany
);

router.get(
  "/search",
  protect,
  restrictTo(permissions.audit.readAll),
  validate(PaginationQuery, "query"),
  auditLogController.search
);

router.get(
  "/:id",
  protect,
  restrictTo(permissions.audit.read),
  validate(ParamsId, "params"),
  auditLogController.findById
);

export default router;
