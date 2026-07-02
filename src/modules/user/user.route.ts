import { Router } from "express";
import { userController } from "./user.controller";
import {
  validate,
  ParamsId,
  PaginationQuery,
} from "../../middlewares/validate.middleware";
import { CreateUserSchema, UpdateUserSchema } from "./user.schema";
import protect from "../../middlewares/protect.middleware";
import restrictTo from "../../middlewares/restrictTo.middleware";
import { permissions } from "../../data/permission.data";

const router = Router();

router.post(
  "/",
  protect,
  restrictTo(permissions.users.manage),
  validate(CreateUserSchema),
  userController.create
);

router.get(
  "/",
  protect,
  restrictTo(permissions.users.readAll),
  validate(PaginationQuery, "query"),
  userController.findMany
);

router.get(
  "/search",
  protect,
  restrictTo(permissions.users.readAll),
  validate(PaginationQuery, "query"),
  userController.search
);

router.get(
  "/deleted",
  protect,
  restrictTo(permissions.users.readAll),
  validate(PaginationQuery, "query"),
  userController.findDeleted
);

router.get(
  "/deleted/:id",
  protect,
  restrictTo(permissions.users.manage),
  validate(ParamsId, "params"),
  userController.findDeletedById
);

router.get(
  "/:id",
  protect,
  restrictTo(permissions.users.read),
  validate(ParamsId, "params"),
  userController.findById
);

router.patch(
  "/:id",
  protect,
  restrictTo(permissions.users.manage),
  validate(ParamsId, "params"),
  validate(UpdateUserSchema),
  userController.update
);

router.patch(
  "/:id/restore",
  protect,
  restrictTo(permissions.users.manage),
  validate(ParamsId, "params"),
  userController.restore
);

router.delete(
  "/:id",
  protect,
  restrictTo(permissions.users.manage),
  validate(ParamsId, "params"),
  userController.delete
);

export default router;
