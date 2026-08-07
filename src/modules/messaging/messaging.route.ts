import { Router } from "express";
import { z } from "zod";
import { messagingController } from "./messaging.controller";
import { validate } from "../../middlewares/validate.middleware";
import protect from "../../middlewares/protect.middleware";
import restrictTo from "../../middlewares/restrictTo.middleware";
import { permissions } from "../../data/permission.data";
import {
  StartConversationSchema,
  SendMessageSchema,
  ListConversationsQuerySchema,
  ListMessagesQuerySchema,
  MarkAsReadSchema,
  ReportUserSchema,
  FreezeConversationSchema,
  WarnParticipantSchema,
  ReviewModerationSchema,
  ListModerationQueueQuerySchema,
} from "./messaging.types";
import checkAccountCompletion from "../../middlewares/checkAccountCompletion.middleware";
import checkKyc from "../../middlewares/checkKyc.middleware";

const router = Router();
router.use(protect, checkAccountCompletion, checkKyc);

const ParamsConversationId = z.object({ id: z.string().uuid() });

router.post(
  "/start",
  validate(StartConversationSchema),
  messagingController.start
);
router.get("/unread-count", messagingController.getUnreadCount);
router.get(
  "/",
  validate(ListConversationsQuerySchema, "query"),
  messagingController.listConversations
);

router.get(
  "/:id/summary",
  validate(ParamsConversationId, "params"),
  messagingController.getSummary
);
router.get(
  "/:id/messages",
  validate(ParamsConversationId, "params"),
  validate(ListMessagesQuerySchema, "query"),
  messagingController.listMessages
);
router.post(
  "/:id/messages",
  validate(ParamsConversationId, "params"),
  validate(SendMessageSchema),
  messagingController.sendMessage
);
router.post(
  "/:id/read",
  validate(ParamsConversationId, "params"),
  validate(MarkAsReadSchema),
  messagingController.markAsRead
);
router.post(
  "/:id/report",
  validate(ParamsConversationId, "params"),
  validate(ReportUserSchema),
  messagingController.reportUser
);
// ── Admin/Moderator ──
router.post(
  "/:id/freeze",
  restrictTo(permissions.messaging.moderationFreeze),
  validate(ParamsConversationId, "params"),
  validate(FreezeConversationSchema),
  messagingController.freeze
);
router.post(
  "/:id/unfreeze",
  restrictTo(permissions.messaging.moderationFreeze),
  validate(ParamsConversationId, "params"),
  messagingController.unfreeze
);
router.post(
  "/:id/warn",
  restrictTo(permissions.messaging.moderationFreeze),
  validate(ParamsConversationId, "params"),
  validate(WarnParticipantSchema),
  messagingController.warn
);
router.delete(
  "/messages/:messageId",
  restrictTo(permissions.messaging.moderationDelete),
  validate(z.object({ messageId: z.string().uuid() }), "params"),
  messagingController.deleteMessage
);
router.get(
  "/:id",
  restrictTo(permissions.messaging.moderationRead),
  validate(ParamsConversationId, "params"),
  messagingController.getConversation
);

const adminRouter = Router();
adminRouter.use(protect);
adminRouter.get(
  "/moderation-queue",
  restrictTo(permissions.messaging.moderationRead),
  validate(ListModerationQueueQuerySchema, "query"),
  messagingController.listModerationQueue
);
adminRouter.post(
  "/moderation-queue/:id/review",
  restrictTo(permissions.messaging.moderationFreeze),
  validate(ParamsConversationId, "params"),
  validate(ReviewModerationSchema),
  messagingController.reviewModeration
);

export { adminRouter as messagingAdminRouter };
export default router;
