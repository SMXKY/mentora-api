import { Router } from "express";
import { adminUserController } from "./adminUser.controller";
import { validate } from "../../middlewares/validate.middleware";
import { z } from "zod";
import { SuspendUserSchema } from "./adminUser.schema";
import protect from "../../middlewares/protect.middleware";
import restrictTo from "../../middlewares/restrictTo.middleware";
import { permissions } from "../../data/permission.data";

const router = Router();

const ParamsUserId = z.object({
  user_id: z.string().uuid("common/errors:validation.invalidFormat"),
});

router.post(
  "/:user_id/suspend",
  protect,
  restrictTo(permissions.users.suspend),
  validate(ParamsUserId, "params"),
  validate(SuspendUserSchema),
  adminUserController.suspend
);

router.post(
  "/:user_id/unsuspend",
  protect,
  restrictTo(permissions.users.unsuspend),
  validate(ParamsUserId, "params"),
  adminUserController.unsuspend
);

export default router;
