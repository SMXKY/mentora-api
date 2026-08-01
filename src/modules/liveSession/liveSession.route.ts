import { Router } from "express";
import multer from "multer";
import os from "os";
import path from "path";
import { randomUUID } from "crypto";
import { liveSessionController } from "./liveSession.controller";
import { validate } from "../../middlewares/validate.middleware";
import protect from "../../middlewares/protect.middleware";
import restrictTo from "../../middlewares/restrictTo.middleware";
import { permissions } from "../../data/permission.data";
import {
  ParamsBookingId,
  GenerateTokenSchema,
  MuteParticipantSchema,
  RemoveParticipantSchema,
  GrantScreenShareSchema,
  SendChatMessageSchema,
  ListChatQuerySchema,
  RecordConnectionQualitySchema,
} from "./liveSession.types";
import checkAccountCompletion from "../../middlewares/checkAccountCompletion.middleware";
import checkKyc from "../../middlewares/checkKyc.middleware";

const upload = multer({
  storage: multer.diskStorage({
    destination: os.tmpdir(),
    filename: (_req, file, cb) =>
      cb(
        null,
        `${randomUUID()}${path.extname(file.originalname).toLowerCase()}`
      ),
  }),
  limits: { fileSize: 20 * 1024 * 1024, files: 1 },
});

const router = Router();
router.use(protect, checkAccountCompletion, checkKyc);

const bookingIdParams = validate(ParamsBookingId, "params");

router.post(
  "/:bookingId/token",
  bookingIdParams,
  restrictTo(permissions.liveSessions.tokensGenerate),
  validate(GenerateTokenSchema),
  liveSessionController.generateToken
);

router.post(
  "/:bookingId/mute",
  bookingIdParams,
  validate(MuteParticipantSchema),
  liveSessionController.mute
);
router.post(
  "/:bookingId/remove",
  bookingIdParams,
  validate(RemoveParticipantSchema),
  liveSessionController.remove
);
router.post("/:bookingId/lock", bookingIdParams, liveSessionController.lock);
router.post("/:bookingId/end", bookingIdParams, liveSessionController.end);
router.post(
  "/:bookingId/mute-all",
  bookingIdParams,
  liveSessionController.muteAll
);
router.post(
  "/:bookingId/grant-screen-share",
  bookingIdParams,
  validate(GrantScreenShareSchema),
  liveSessionController.grantScreenShare
);

router.post(
  "/:bookingId/connection-quality",
  bookingIdParams,
  validate(RecordConnectionQualitySchema),
  liveSessionController.recordConnectionQuality
);

router.get(
  "/:bookingId/chat",
  bookingIdParams,
  restrictTo(permissions.liveSessions.chatRead),
  validate(ListChatQuerySchema, "query"),
  liveSessionController.listChat
);
router.post(
  "/:bookingId/chat",
  bookingIdParams,
  restrictTo(permissions.liveSessions.chatRead),
  validate(SendChatMessageSchema),
  liveSessionController.postChat
);

router.post(
  "/:bookingId/whiteboard",
  bookingIdParams,
  upload.single("file"),
  liveSessionController.exportWhiteboard
);

// ── Admin ────────────────────────────────────────────────────
const adminRouter = Router();
adminRouter.use(protect);

adminRouter.get(
  "/:bookingId",
  bookingIdParams,
  restrictTo(permissions.liveSessions.roomsRead),
  liveSessionController.getAdminAudit
);
adminRouter.post(
  "/:bookingId/observer-token",
  bookingIdParams,
  restrictTo(permissions.liveSessions.observe),
  liveSessionController.generateObserverToken
);

export { adminRouter as liveSessionAdminRouter };
export default router;
