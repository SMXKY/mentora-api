import { Request, Response } from "express";
import { catchAsync } from "../../utils/catchAsync.util";
import { buildContext } from "../../utils/buildContext.util";
import { appResponder } from "../../utils/appResponder.util";
import { AppError } from "../../utils/AppError.util";
import { StatusCodes } from "http-status-codes";
import { NotificationRepository } from "./notification.repository";

const repository = new NotificationRepository();

export const notificationController = {
  list: catchAsync(async (req: Request, res: Response): Promise<void> => {
    const ctx = buildContext(req, res);
    const query = req.query as Record<string, any>;

    const result = await repository.findManyForUser(ctx.userId!, {
      status: (query.status as "read" | "unread" | "all") || "all",
      pagination: {
        page: query.page ? Number(query.page) : 1,
        limit: query.limit ? Number(query.limit) : 20,
        sortBy: "createdAt",
        sortOrder: "desc",
      },
    });

    appResponder(StatusCodes.OK, result.data, res, result.meta);
  }),

  getById: catchAsync(async (req: Request, res: Response): Promise<void> => {
    const ctx = buildContext(req, res);
    const notification = await repository.findOwnedByIdOrThrow(
      req.params.id,
      ctx.userId!
    );
    appResponder(StatusCodes.OK, notification as object, res);
  }),

  unreadCount: catchAsync(
    async (req: Request, res: Response): Promise<void> => {
      const ctx = buildContext(req, res);
      const count = await repository.countUnread(ctx.userId!);
      appResponder(StatusCodes.OK, { unread: count }, res);
    }
  ),

  markAsRead: catchAsync(async (req: Request, res: Response): Promise<void> => {
    const ctx = buildContext(req, res);
    const notification = await repository.markAsRead(
      req.params.id,
      ctx.userId!
    );
    appResponder(StatusCodes.OK, notification as object, res);
  }),

  markAllAsRead: catchAsync(
    async (req: Request, res: Response): Promise<void> => {
      const ctx = buildContext(req, res);
      const count = await repository.markAllAsRead(ctx.userId!);
      appResponder(StatusCodes.OK, { markedRead: count }, res);
    }
  ),

  dismiss: catchAsync(async (req: Request, res: Response): Promise<void> => {
    const ctx = buildContext(req, res);
    await repository.dismiss(req.params.id, ctx.userId!);
    appResponder(StatusCodes.OK, { dismissed: true }, res);
  }),

  dismissMany: catchAsync(
    async (req: Request, res: Response): Promise<void> => {
      const ctx = buildContext(req, res);
      const ids: string[] = req.body.ids;
      if (!Array.isArray(ids) || ids.length === 0) {
        throw new AppError(
          "notifications/errors:noIdsProvided",
          StatusCodes.BAD_REQUEST
        );
      }
      const count = await repository.dismissMany(ids, ctx.userId!);
      appResponder(StatusCodes.OK, { dismissed: count }, res);
    }
  ),
};

export default notificationController;
