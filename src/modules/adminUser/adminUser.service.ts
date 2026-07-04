import prisma from "../../config/database.config";
import { AppError } from "../../utils/AppError.util";
import { StatusCodes } from "http-status-codes";
import {
  UserStatus,
  SuspensionType,
  BookingStatus,
  NotificationType,
  LogOperation,
  LogCategory,
} from "../../generated/prisma";
import { ServiceContext } from "../../base/base.types";
import { AuditService } from "../../utils/logUserActivity.util";
import { invalidateAllSessions } from "../auth/utils/session.util";
import NotificationService from "../../services/notification/notification.service";
import { permissions } from "../../data/permission.data";

const ACTIVE_BOOKING_STATUSES: BookingStatus[] = [
  BookingStatus.ACCEPTED,
  BookingStatus.PAID,
  BookingStatus.IN_PROGRESS,
  BookingStatus.AWAITING_CONFIRMATION,
  BookingStatus.CONFIRMED,
];

async function countActiveBookings(userId: string): Promise<number> {
  return prisma.booking.count({
    where: {
      status: { in: ACTIVE_BOOKING_STATUSES },
      OR: [
        { bookerId: userId },
        { tutorProfile: { userId } },
        { studentProfile: { userId } },
      ],
    },
  });
}

async function hasPendingEscrow(userId: string): Promise<boolean> {
  const wallet = await prisma.wallet.findUnique({
    where: { userId },
    select: { pendingEscrowXaf: true },
  });
  return (wallet?.pendingEscrowXaf ?? 0) > 0;
}

export const AdminUserService = {
  async suspendUser(
    targetUserId: string,
    reason: string,
    ctx: ServiceContext
  ): Promise<{ userId: string; status: string; reason: string }> {
    const target = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: { id: true, status: true },
    });
    if (!target) {
      throw new AppError("adminUser/errors:userNotFound", StatusCodes.NOT_FOUND);
    }
    if (target.status === UserStatus.SUSPENDED) {
      throw new AppError(
        "adminUser/errors:alreadySuspended",
        StatusCodes.CONFLICT
      );
    }
    if (target.status === UserStatus.BANNED) {
      throw new AppError(
        "adminUser/errors:cannotSuspendBanned",
        StatusCodes.CONFLICT
      );
    }

    await prisma.$transaction([
      prisma.user.update({
        where: { id: targetUserId },
        data: { status: UserStatus.SUSPENDED },
      }),
      prisma.accountSuspension.create({
        data: {
          userId: targetUserId,
          suspensionType: SuspensionType.SUSPENSION,
          reason,
          createdById: ctx.userId!,
        },
      }),
    ]);

    // Every currently-valid token for this account stops working on its
    // very next request — no waiting for natural JWT expiry.
    await invalidateAllSessions(targetUserId, ctx.userId);

    await NotificationService.send({
      type: NotificationType.ACCOUNT_SUSPENDED,
      target: { kind: "user", userId: targetUserId },
      data: { reason },
    }).catch(() => {});

    const [activeBookings, escrowPending] = await Promise.all([
      countActiveBookings(targetUserId),
      hasPendingEscrow(targetUserId),
    ]);

    if (activeBookings > 0) {
      await NotificationService.send({
        type: NotificationType.ADMIN_REVIEW_REQUIRED,
        target: { kind: "permission", permissionCode: permissions.users.manage },
        data: {
          reviewReason: "active_bookings",
          suspendedUserId: targetUserId,
          activeBookingCount: activeBookings,
        },
      }).catch(() => {});
    }

    if (escrowPending) {
      await prisma.user.update({
        where: { id: targetUserId },
        data: {
          escrowReviewRequired: true,
          escrowReviewRequiredAt: new Date(),
        },
      });
      await NotificationService.send({
        type: NotificationType.ADMIN_REVIEW_REQUIRED,
        target: { kind: "permission", permissionCode: permissions.users.manage },
        data: { reviewReason: "pending_escrow", suspendedUserId: targetUserId },
      }).catch(() => {});
    }

    AuditService.record(ctx, "users", {
      operation: LogOperation.SUSPEND,
      category: LogCategory.SENSITIVE_READ,
      recordId: targetUserId,
      newState: { status: "SUSPENDED", reason },
      changedFields: ["status"],
      eventType: "user.suspended",
    });

    return { userId: targetUserId, status: "SUSPENDED", reason };
  },

  async unsuspendUser(
    targetUserId: string,
    ctx: ServiceContext
  ): Promise<{ userId: string; status: string }> {
    const target = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: { id: true, status: true },
    });
    if (!target) {
      throw new AppError("adminUser/errors:userNotFound", StatusCodes.NOT_FOUND);
    }
    if (target.status !== UserStatus.SUSPENDED) {
      throw new AppError("adminUser/errors:notSuspended", StatusCodes.CONFLICT);
    }

    const activeSuspension = await prisma.accountSuspension.findFirst({
      where: { userId: targetUserId, liftedAt: null },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    });

    await prisma.$transaction([
      prisma.user.update({
        where: { id: targetUserId },
        data: { status: UserStatus.ACTIVE },
      }),
      ...(activeSuspension
        ? [
            prisma.accountSuspension.update({
              where: { id: activeSuspension.id },
              data: { liftedAt: new Date(), liftedById: ctx.userId! },
            }),
          ]
        : []),
    ]);

    await NotificationService.send({
      type: NotificationType.ACCOUNT_UNSUSPENDED,
      target: { kind: "user", userId: targetUserId },
    }).catch(() => {});

    AuditService.record(ctx, "users", {
      operation: LogOperation.UNSUSPEND,
      category: LogCategory.SENSITIVE_READ,
      recordId: targetUserId,
      newState: { status: "ACTIVE" },
      changedFields: ["status"],
      eventType: "user.unsuspended",
    });

    return { userId: targetUserId, status: "ACTIVE" };
  },
};

export default AdminUserService;
