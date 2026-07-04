import { Router } from "express";
import { notificationController } from "./notification.controller";
import {
  validate,
  ParamsId,
  PaginationQuery,
} from "../../middlewares/validate.middleware";
import { DismissManySchema } from "./notification.schema";
import protect from "../../middlewares/protect.middleware";

const router = Router();

router.use(protect);

router.get(
  "/",
  validate(PaginationQuery, "query"),
  notificationController.list
);

router.get("/unread-count", notificationController.unreadCount);

router.get(
  "/:id",
  validate(ParamsId, "params"),
  notificationController.getById
);

router.patch(
  "/:id/read",
  validate(ParamsId, "params"),
  notificationController.markAsRead
);

router.patch("/read-all", notificationController.markAllAsRead);

router.delete(
  "/:id",
  validate(ParamsId, "params"),
  notificationController.dismiss
);

router.post(
  "/dismiss-many",
  validate(DismissManySchema),
  notificationController.dismissMany
);

export default router;
