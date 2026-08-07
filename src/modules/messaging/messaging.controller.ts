import { Request, Response } from "express";
import { catchAsync } from "../../utils/catchAsync.util";
import { buildContext } from "../../utils/buildContext.util";
import { appResponder } from "../../utils/appResponder.util";
import { StatusCodes } from "http-status-codes";
import { MessagingService } from "./messaging.service";

export const messagingController = {
  start: catchAsync(async (req: Request, res: Response): Promise<void> => {
    const ctx = buildContext(req, res);
    const conversation = await MessagingService.startConversation(ctx.userId!, req.body.tutorProfileId, ctx);
    appResponder(StatusCodes.CREATED, { conversation }, res);
  }),

  listConversations: catchAsync(async (req: Request, res: Response): Promise<void> => {
    const ctx = buildContext(req, res);
    const { tab, cursor, limit } = req.query as any;
    const result = await MessagingService.listConversations(ctx.userId!, tab, cursor, limit);
    appResponder(StatusCodes.OK, result.data, res, result.meta);
  }),

  getSummary: catchAsync(async (req: Request, res: Response): Promise<void> => {
    const ctx = buildContext(req, res);
    const summary = await MessagingService.getConversationSummaryForUser(req.params.id, ctx.userId!);
    appResponder(StatusCodes.OK, summary, res);
  }),

  listMessages: catchAsync(async (req: Request, res: Response): Promise<void> => {
    const ctx = buildContext(req, res);
    const { cursor, limit } = req.query as any;
    const result = await MessagingService.listMessages(req.params.id, ctx.userId!, cursor, limit);
    appResponder(StatusCodes.OK, result.data, res, result.meta);
  }),

  sendMessage: catchAsync(async (req: Request, res: Response): Promise<void> => {
    const ctx = buildContext(req, res);
    const message = await MessagingService.sendMessage(ctx.userId!, req.params.id, req.body.content, ctx, req.body.replyToId, req.body.attachmentFileId);
    appResponder(StatusCodes.CREATED, { message }, res);
  }),

  markAsRead: catchAsync(async (req: Request, res: Response): Promise<void> => {
    const ctx = buildContext(req, res);
    const result = await MessagingService.markAsRead(req.params.id, ctx.userId!, req.body.messageIds);
    appResponder(StatusCodes.OK, result, res);
  }),

  getUnreadCount: catchAsync(async (req: Request, res: Response): Promise<void> => {
    const ctx = buildContext(req, res);
    const unreadCount = await MessagingService.getUnreadCount(ctx.userId!);
    appResponder(StatusCodes.OK, { unreadCount }, res);
  }),

  reportUser: catchAsync(async (req: Request, res: Response): Promise<void> => {
    const ctx = buildContext(req, res);
    const result = await MessagingService.reportUser(ctx.userId!, req.params.id, req.body.category, req.body.note, ctx);
    appResponder(StatusCodes.CREATED, result, res);
  }),

  // ── Admin/Moderator ──
  freeze: catchAsync(async (req: Request, res: Response): Promise<void> => {
    const ctx = buildContext(req, res);
    const conversation = await MessagingService.freezeConversation(req.params.id, ctx.userId!, req.body.reason, ctx);
    appResponder(StatusCodes.OK, { conversation }, res);
  }),

  unfreeze: catchAsync(async (req: Request, res: Response): Promise<void> => {
    const ctx = buildContext(req, res);
    const conversation = await MessagingService.unfreezeConversation(req.params.id, ctx.userId!, ctx);
    appResponder(StatusCodes.OK, { conversation }, res);
  }),

  warn: catchAsync(async (req: Request, res: Response): Promise<void> => {
    const ctx = buildContext(req, res);
    const result = await MessagingService.warnParticipant(req.params.id, ctx.userId!, req.body.note, ctx);
    appResponder(StatusCodes.OK, result, res);
  }),

  deleteMessage: catchAsync(async (req: Request, res: Response): Promise<void> => {
    const ctx = buildContext(req, res);
    const message = await MessagingService.deleteMessage(req.params.messageId, ctx.userId!, ctx);
    appResponder(StatusCodes.OK, { message }, res);
  }),

  getConversation: catchAsync(async (req: Request, res: Response): Promise<void> => {
    const conversation = await MessagingService.getConversationForAdmin(req.params.id);
    appResponder(StatusCodes.OK, { conversation }, res);
  }),

  listModerationQueue: catchAsync(async (req: Request, res: Response): Promise<void> => {
    const { status, cursor, limit } = req.query as any;
    const result = await MessagingService.listModerationQueue(status, cursor, limit);
    appResponder(StatusCodes.OK, result.data, res, result.meta);
  }),

  reviewModeration: catchAsync(async (req: Request, res: Response): Promise<void> => {
    const ctx = buildContext(req, res);
    const review = await MessagingService.reviewModerationItem(req.params.id, ctx.userId!, req.body.status, req.body.reviewNote, ctx);
    appResponder(StatusCodes.OK, { review }, res);
  }),
};

export default messagingController;
