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
router.get("/me", protect, userController.getMe);

router.patch("/me", protect, validate(UpdateMeSchema), userController.updateMe);

router.patch(
  "/me/profile-picture",
  protect,
  uploadProfilePicture.single("profilePicture"),
  userController.updateMyProfilePicture
);

// Self-service preview of the same redacted profile a tutor sees via
// getBookerProfile — must be registered before "/:id/booker-profile" below,
// otherwise Express would try to treat "me" as an :id value there too.
router.get(
  "/me/booker-profile",
  protect,
  userController.previewMyBookerProfile
);

// Full, paginated/sortable/filterable reviews list — same self-preview
// reasoning as /me/booker-profile above, must also precede "/:id/..." below.
router.get(
  "/me/booker-profile/reviews",
  protect,
  userController.previewMyBookerProfileReviews
);

// Tutor-only, relationship-gated (booking or conversation) — see
// UserService.getBookerProfile. Registered before the admin "/:id" route
// below, though the extra path segment means there's no pattern collision
// either way.
router.get(
  "/:id/booker-profile",
  protect,
  validate(ParamsId, "params"),
  userController.getBookerProfile
);

// Full, paginated/sortable/filterable reviews list behind the same gate —
// powers a "see all reviews" screen for a booker's profile.
router.get(
  "/:id/booker-profile/reviews",
  protect,
  validate(ParamsId, "params"),
  userController.getBookerProfileReviews
);

// Chat-only block/unblock — any authenticated user, no special permission,
// same reasoning as booker-profile: this is a self-service action on the
// caller's own relationship to another user, not an admin operation.
router.post(
  "/:id/block",
  protect,
  validate(ParamsId, "params"),
  userController.blockUser
);
router.delete(
  "/:id/block",
  protect,
  validate(ParamsId, "params"),
  userController.unblockUser
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
