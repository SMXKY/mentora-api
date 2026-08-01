import { Request, Response } from "express";
import fs from "fs";
import { catchAsync } from "../../utils/catchAsync.util";
import { buildContext } from "../../utils/buildContext.util";
import { appResponder } from "../../utils/appResponder.util";
import { AppError } from "../../utils/AppError.util";
import { StatusCodes } from "http-status-codes";
import { MEDIA_ERROR_KEYS } from "../../services/media/media.types";
import { LiveSessionService } from "./liveSession.service";
import { ConnectionQuality } from "../../generated/prisma";

async function cleanupTemp(file?: Express.Multer.File): Promise<void> {
  if (!file) return;
  await fs.promises.unlink(file.path).catch(() => undefined);
}

export const liveSessionController = {
  generateToken: catchAsync(async (req: Request, res: Response): Promise<void> => {
    const ctx = buildContext(req, res);
    const result = await LiveSessionService.generateToken(ctx.userId!, req.params.bookingId, req.body, {
      userAgent: req.headers["user-agent"],
    });
    appResponder(StatusCodes.OK, result, res);
  }),

  generateObserverToken: catchAsync(async (req: Request, res: Response): Promise<void> => {
    const ctx = buildContext(req, res);
    const result = await LiveSessionService.generateObserverToken(ctx, req.params.bookingId);
    appResponder(StatusCodes.OK, result, res);
  }),

  mute: catchAsync(async (req: Request, res: Response): Promise<void> => {
    const ctx = buildContext(req, res);
    const result = await LiveSessionService.muteParticipant(ctx.userId!, req.params.bookingId, req.body.targetUserId, ctx);
    appResponder(StatusCodes.OK, result, res);
  }),

  remove: catchAsync(async (req: Request, res: Response): Promise<void> => {
    const ctx = buildContext(req, res);
    const result = await LiveSessionService.removeParticipant(
      ctx.userId!,
      req.params.bookingId,
      req.body.targetUserId,
      ctx
    );
    appResponder(StatusCodes.OK, result, res);
  }),

  lock: catchAsync(async (req: Request, res: Response): Promise<void> => {
    const ctx = buildContext(req, res);
    const result = await LiveSessionService.lockRoom(ctx.userId!, req.params.bookingId, ctx);
    appResponder(StatusCodes.OK, result, res);
  }),

  end: catchAsync(async (req: Request, res: Response): Promise<void> => {
    const ctx = buildContext(req, res);
    const result = await LiveSessionService.endSession(ctx.userId!, req.params.bookingId, ctx);
    appResponder(StatusCodes.OK, result, res);
  }),

  muteAll: catchAsync(async (req: Request, res: Response): Promise<void> => {
    const ctx = buildContext(req, res);
    const result = await LiveSessionService.muteAll(ctx.userId!, req.params.bookingId, ctx);
    appResponder(StatusCodes.OK, result, res);
  }),

  grantScreenShare: catchAsync(async (req: Request, res: Response): Promise<void> => {
    const ctx = buildContext(req, res);
    const result = await LiveSessionService.grantScreenShare(
      ctx.userId!,
      req.params.bookingId,
      req.body.targetUserId,
      ctx
    );
    appResponder(StatusCodes.OK, result, res);
  }),

  recordConnectionQuality: catchAsync(async (req: Request, res: Response): Promise<void> => {
    const ctx = buildContext(req, res);
    const result = await LiveSessionService.recordConnectionQuality(
      ctx.userId!,
      req.params.bookingId,
      req.body.quality as ConnectionQuality,
      req.body.durationSeconds
    );
    appResponder(StatusCodes.OK, result, res);
  }),

  listChat: catchAsync(async (req: Request, res: Response): Promise<void> => {
    const ctx = buildContext(req, res);
    const messages = await LiveSessionService.listChat(ctx.userId!, req.params.bookingId, req.query as any);
    appResponder(StatusCodes.OK, { messages }, res);
  }),

  postChat: catchAsync(async (req: Request, res: Response): Promise<void> => {
    const ctx = buildContext(req, res);
    const message = await LiveSessionService.postChatMessage(
      ctx.userId!,
      req.params.bookingId,
      req.body.content,
      req.body.replyToId
    );
    appResponder(StatusCodes.CREATED, { message }, res);
  }),

  exportWhiteboard: catchAsync(async (req: Request, res: Response): Promise<void> => {
    const ctx = buildContext(req, res);
    if (!req.file) throw new AppError(MEDIA_ERROR_KEYS.noFileProvided, StatusCodes.BAD_REQUEST);
    try {
      const result = await LiveSessionService.exportWhiteboard(ctx.userId!, req.params.bookingId, {
        tempFilePath: req.file.path,
        originalFileName: req.file.originalname,
      });
      appResponder(StatusCodes.OK, result, res);
    } finally {
      await cleanupTemp(req.file);
    }
  }),

  getAdminAudit: catchAsync(async (req: Request, res: Response): Promise<void> => {
    const liveRoom = await LiveSessionService.getAdminAudit(req.params.bookingId);
    appResponder(StatusCodes.OK, { liveRoom }, res);
  }),
};

export default liveSessionController;
