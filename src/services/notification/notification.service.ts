import prisma from "../../config/database.config";
import { AppError } from "../../utils/AppError.util";
import { StatusCodes } from "http-status-codes";
import {
  Notification,
  NotificationType,
  Prisma,
  UserStatus,
} from "../../generated/prisma";

import {
  notificationRegistry,
  NotificationTarget,
  CreateNotificationInput,
  NOTIFICATION_ERROR_KEYS,
} from "./notification.types";
import { queueChannelDelivery } from "./notification.queue";

const MAX_BATCH_SIZE = Number(process.env.NOTIFICATION_MAX_BATCH_SIZE) || 5000;
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 50;

async function resolveByUser(userId: string): Promise<string[]> {
  const user = await prisma.user.findFirst({
    where: { id: userId, status: UserStatus.ACTIVE, deletedAt: null },
    select: { id: true },
  });
  return user ? [user.id] : [];
}

async function resolveByUsers(userIds: string[]): Promise<string[]> {
  if (userIds.length === 0) return [];
  const users = await prisma.user.findMany({
    where: { id: { in: userIds }, status: UserStatus.ACTIVE, deletedAt: null },
    select: { id: true },
  });
  return users.map((u) => u.id);
}

async function resolveByRole(roleId: string): Promise<string[]> {
  const userRoles = await prisma.userRole.findMany({
    where: {
      roleId,
      isActive: true,
      user: { status: UserStatus.ACTIVE, deletedAt: null },
    },
    select: { userId: true },
  });
  return userRoles.map((ur) => ur.userId);
}

async function resolveByPermission(permissionCode: string): Promise<string[]> {
  const viaRole = await prisma.userRole.findMany({
    where: {
      isActive: true,
      user: { status: UserStatus.ACTIVE, deletedAt: null },
      role: {
        rolePermissions: { some: { permission: { code: permissionCode } } },
      },
    },
    select: { userId: true },
  });

  const now = new Date();
  const viaGrant = await prisma.permissionOverride.findMany({
    where: {
      grantType: "GRANT",
      permission: { code: permissionCode },
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      user: { status: UserStatus.ACTIVE, deletedAt: null },
    },
    select: { userId: true },
  });

  const viaRevoke = await prisma.permissionOverride.findMany({
    where: {
      grantType: "REVOKE",
      permission: { code: permissionCode },
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    },
    select: { userId: true },
  });

  const granted = new Set([
    ...viaRole.map((r) => r.userId),
    ...viaGrant.map((g) => g.userId),
  ]);
  for (const revoked of viaRevoke) granted.delete(revoked.userId);

  return Array.from(granted);
}

async function resolveAll(): Promise<string[]> {
  const users = await prisma.user.findMany({
    where: { status: UserStatus.ACTIVE, deletedAt: null },
    select: { id: true },
  });
  return users.map((u) => u.id);
}

async function resolveRecipients(
  target: NotificationTarget
): Promise<string[]> {
  switch (target.kind) {
    case "user":
      return resolveByUser(target.userId);
    case "users":
      return resolveByUsers(target.userIds);
    case "role":
      return resolveByRole(target.roleId);
    case "permission":
      return resolveByPermission(target.permissionCode);
    case "all":
      return resolveAll();
  }
}

// ── Send ──────────────────────────────────────────────────────
async function send(input: CreateNotificationInput): Promise<Notification[]> {
  const definition = notificationRegistry[input.type];
  if (!definition) {
    // Never silently drop — this is what the CI "unregistered type" check guards against.
    throw new AppError(
      NOTIFICATION_ERROR_KEYS.unregisteredType,
      StatusCodes.INTERNAL_SERVER_ERROR,
      { type: input.type }
    );
  }

  const recipientIds = (await resolveRecipients(input.target)).slice(
    0,
    MAX_BATCH_SIZE
  );
  if (recipientIds.length === 0) return [];

  // 1. Write in-app record synchronously — this write is guaranteed regardless
  //    of what happens to email/push/whatsapp/sms afterward.
  const notifications = await prisma.$transaction(
    recipientIds.map((recipientId) =>
      prisma.notification.create({
        data: {
          type: input.type,
          recipientId,
          titleCode: definition.titleCode,
          bodyCode: definition.bodyCode,
          data: input.data
            ? (input.data as Prisma.InputJsonValue)
            : Prisma.JsonNull,
          isTransactional: definition.isTransactional,
          resourceType: input.resourceType,
          resourceId: String(input.resourceId),
        },
      })
    )
  );

  // 2. Queue external channel delivery — never blocks the caller.
  for (const notification of notifications) {
    await queueChannelDelivery(notification.id);
  }

  return notifications;
}

// ── Reads ─────────────────────────────────────────────────────
async function getForUser(
  userId: string,
  options: { cursor?: string; limit?: number } = {}
) {
  const limit = Math.min(options.limit ?? DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);

  const notifications = await prisma.notification.findMany({
    where: {
      recipientId: userId,
      deletedAt: null,
      ...(options.cursor && { id: { lt: options.cursor } }),
    },
    orderBy: { createdAt: "desc" },
    take: limit + 1,
  });

  const hasMore = notifications.length > limit;
  const page = hasMore ? notifications.slice(0, limit) : notifications;
  const cursor = page.length > 0 ? page[page.length - 1].id : null;
  const unreadCount = await getUnreadCount(userId);

  return { notifications: page, cursor, hasMore, unreadCount };
}

async function getUnreadCount(userId: string): Promise<number> {
  return prisma.notification.count({
    where: { recipientId: userId, readAt: null, deletedAt: null },
  });
}

async function getSince(userId: string, since: Date): Promise<Notification[]> {
  return prisma.notification.findMany({
    where: { recipientId: userId, createdAt: { gt: since }, deletedAt: null },
    orderBy: { createdAt: "asc" },
  });
}

async function markAsRead(
  notificationId: string,
  userId: string
): Promise<Notification> {
  const notification = await prisma.notification.findFirst({
    where: { id: notificationId, recipientId: userId },
  });
  if (!notification) {
    throw new AppError(NOTIFICATION_ERROR_KEYS.notFound, StatusCodes.NOT_FOUND);
  }
  if (notification.readAt) return notification;

  return prisma.notification.update({
    where: { id: notificationId },
    data: { readAt: new Date() },
  });
}

async function markAllAsRead(userId: string): Promise<number> {
  const result = await prisma.notification.updateMany({
    where: { recipientId: userId, readAt: null },
    data: { readAt: new Date() },
  });
  return result.count;
}

async function cancelByType(
  type: NotificationType,
  dataMatch: Record<string, unknown>
) {
  // Used to cancel scheduled reminders tied to a booking, etc. Implemented at the
  // scheduled-notification level (see notification.scheduler in Module 12 reminders).
  void type;
  void dataMatch;
}

export const NotificationService = {
  resolveRecipients,
  send,
  getForUser,
  getUnreadCount,
  getSince,
  markAsRead,
  markAllAsRead,
  cancelByType,
};

export default NotificationService;
