import { Request, Response } from "express";
import { catchAsync } from "../../utils/catchAsync.util";
import { buildContext } from "../../utils/buildContext.util";
import { appResponder } from "../../utils/appResponder.util";
import { StatusCodes } from "http-status-codes";
import { LiveSessionService } from "./liveSession.service";
import { ConnectionQuality } from "../../generated/prisma";

export const liveSessionController = {
  listActive: catchAsync(async (req: Request, res: Response): Promise<void> => {
    const ctx = buildContext(req, res);
    const sessions = await LiveSessionService.listActiveSessionsForUser(ctx.userId!);
    appResponder(StatusCodes.OK, { sessions }, res);
  }),

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

  getAdminAudit: catchAsync(async (req: Request, res: Response): Promise<void> => {
    const liveRoom = await LiveSessionService.getAdminAudit(req.params.bookingId);
    appResponder(StatusCodes.OK, { liveRoom }, res);
  }),
};

export default liveSessionController;
