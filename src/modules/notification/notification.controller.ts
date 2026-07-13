import { Request, Response } from "express";
import { catchAsync } from "../../utils/catchAsync.util";
import { buildContext } from "../../utils/buildContext.util";
import { appResponder } from "../../utils/appResponder.util";
import { AppError } from "../../utils/AppError.util";
import { StatusCodes } from "http-status-codes";
import { Notification } from "../../generated/prisma";
import { NotificationRepository } from "./notification.repository";
import { resolveNotificationCopy } from "../../services/notification/notification.text";

const repository = new NotificationRepository();

/** Attaches rendered title/body to a raw row — titleCode/bodyCode are i18n keys, never display text on their own. */
function withResolvedCopy<T extends Notification>(
  notification: T,
  preferredLanguage?: string | null
): T & { title: string; body: string } {
  return { ...notification, ...resolveNotificationCopy(notification, preferredLanguage) };
}

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

    const data = result.data.map((n) => withResolvedCopy(n, ctx.preferredLanguage));
    appResponder(StatusCodes.OK, data, res, result.meta);
  }),

  getById: catchAsync(async (req: Request, res: Response): Promise<void> => {
    const ctx = buildContext(req, res);
    const notification = await repository.findOwnedByIdOrThrow(
      req.params.id,
      ctx.userId!
    );
    appResponder(
      StatusCodes.OK,
      withResolvedCopy(notification, ctx.preferredLanguage) as object,
      res
    );
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
    appResponder(
      StatusCodes.OK,
      withResolvedCopy(notification, ctx.preferredLanguage) as object,
      res
    );
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
