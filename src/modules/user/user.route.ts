import { Router } from "express";
import multer from "multer";
import os from "os";
import path from "path";
import { randomUUID } from "crypto";
import { userController } from "./user.controller";
import {
  validate,
  ParamsId,
  PaginationQuery,
} from "../../middlewares/validate.middleware";
import {
  CreateUserSchema,
  UpdateUserSchema,
  UpdateMeSchema,
} from "./user.schema";
import protect from "../../middlewares/protect.middleware";
import restrictTo from "../../middlewares/restrictTo.middleware";
import { permissions } from "../../data/permission.data";

const router = Router();

const uploadProfilePicture = multer({
  storage: multer.diskStorage({
    destination: os.tmpdir(),
    filename: (_req, file, cb) =>
      cb(
        null,
        `${randomUUID()}${path.extname(file.originalname).toLowerCase()}`
      ),
  }),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
});

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

// Self-service — must be registered before the generic "/:id" routes below,
// otherwise Express would treat "me" as an :id value.
router.patch("/me", protect, validate(UpdateMeSchema), userController.updateMe);

router.patch(
  "/me/profile-picture",
  protect,
  uploadProfilePicture.single("profilePicture"),
  userController.updateMyProfilePicture
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
