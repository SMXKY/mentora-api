import { Router } from "express";
import { permissionOverrideController } from "./permissionOverride.controller";
import {
  validate,
  ParamsId,
  ParamsUserId,
} from "../../middlewares/validate.middleware";
import {
  GrantPermissionOverrideSchema,
  RevokePermissionOverrideSchema,
} from "./permissionOverride.schema";
import protect from "../../middlewares/protect.middleware";
import restrictTo from "../../middlewares/restrictTo.middleware";
import { permissions } from "../../data/permission.data";

const router = Router();

router.post(
  "/grant",
  protect,
  restrictTo(permissions.rbac.overridesGrant),
  validate(GrantPermissionOverrideSchema),
  permissionOverrideController.grant
);

router.post(
  "/revoke",
  protect,
  restrictTo(permissions.rbac.overridesRevoke),
  validate(RevokePermissionOverrideSchema),
  permissionOverrideController.revoke
);

router.get(
  "/user/:userId",
  protect,
  restrictTo(permissions.rbac.overridesRead),
  validate(ParamsUserId, "params"),
  permissionOverrideController.listActiveForUser
);

router.delete(
  "/:id",
  protect,
  restrictTo(permissions.rbac.overridesRevoke),
  validate(ParamsId, "params"),
  permissionOverrideController.clear
);

export default router;
