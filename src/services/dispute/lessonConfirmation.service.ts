import prisma from "../../config/database.config";
import { AppError } from "../../utils/AppError.util";
import { StatusCodes } from "http-status-codes";
import { BookingStatus, NotificationType, NotificationResourceType } from "../../generated/prisma";
import { NotificationService } from "../notification/notification.service";
import { assertValidTransition } from "../booking/bookingStateMachine";
import { EscrowService } from "../payment/escrow.service";
import { disputeConfig } from "./disputeConfig";
import { scheduleConfirmationWindowJobs, cancelConfirmationWindowJobs } from "./confirmationWindow.processor";

/**
 * Module 16 entry point triggered by a completed session — today that's
 * only Module 11's home-session checkout (see booking/checkin.service.ts).
 * Module 14's online-session-end trigger doesn't exist yet, so this is
 * only ever called from the home-checkout path for now.
 */
async function openConfirmationWindow(bookingId: string, sessionDataSnapshot: Record<string, any>) {
  const { confirmationWindowHours } = await disputeConfig.getAll();
  const windowOpenedAt = new Date();
  const windowClosesAt = new Date(windowOpenedAt.getTime() + confirmationWindowHours * 60 * 60 * 1000);

  const confirmation = await prisma.lessonConfirmation.create({
    data: {
      bookingId,
      windowOpenedAt,
      windowClosesAt,
      sessionDataSnapshot: sessionDataSnapshot as any,
    },
  });

  await scheduleConfirmationWindowJobs(bookingId, windowClosesAt);

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { tutorProfile: { select: { userId: true } } },
  });
  if (booking?.bookerId) {
    await NotificationService.send({
      type: NotificationType.LESSON_AWAITING_CONFIRMATION,
      target: { kind: "user", userId: booking.bookerId },
      resourceType: NotificationResourceType.BOOKING,
      resourceId: bookingId,
    });
  }

  return confirmation;
}

/** The booker proactively confirms a lesson happened as expected, before the 48h auto-release fires. */
async function confirmLesson(userId: string, bookingId: string) {
  const booking = await prisma.booking.findFirst({ where: { id: bookingId, deletedAt: null } });
  if (!booking) throw new AppError("booking/errors:bookingNotFound", StatusCodes.NOT_FOUND);
  if (booking.bookerId !== userId) throw new AppError("booking/errors:notYourBooking", StatusCodes.FORBIDDEN);
  if (booking.status !== BookingStatus.AWAITING_CONFIRMATION) {
    throw new AppError("dispute/errors:disputeWindowClosed", StatusCodes.CONFLICT);
  }

  const confirmation = await prisma.lessonConfirmation.findUnique({ where: { bookingId }, include: { dispute: true } });
  if (!confirmation || confirmation.dispute) {
    throw new AppError("dispute/errors:disputeWindowClosed", StatusCodes.CONFLICT);
  }

  assertValidTransition(booking.status, BookingStatus.CONFIRMED);

  await prisma.$transaction([
    prisma.lessonConfirmation.update({
      where: { id: confirmation.id },
      data: { action: "CONFIRMED", confirmedById: userId, confirmedAt: new Date() },
    }),
    prisma.booking.update({ where: { id: bookingId }, data: { status: BookingStatus.CONFIRMED } }),
  ]);

  await cancelConfirmationWindowJobs(bookingId);

  const escrowHold = await prisma.escrowHold.findFirst({ where: { bookingId, status: "HELD" } });
  if (escrowHold) await EscrowService.releaseEscrowToTutor(escrowHold.id, {});

  const { openReviewWindow } = await import("../review/reviewWindow.service");
  await openReviewWindow(bookingId).catch((err) =>
    console.error({ event: "review_window_open_failed", bookingId, error: err.message })
  );

  const { MessagingService } = await import("../../modules/messaging/messaging.service");
  await MessagingService.archiveForBooking(bookingId).catch((err) =>
    console.error({ event: "conversation_archive_failed", bookingId, error: err.message })
  );

  await NotificationService.send({
    type: NotificationType.LESSON_CONFIRMED,
    target: { kind: "user", userId },
    resourceType: NotificationResourceType.BOOKING,
    resourceId: bookingId,
  });

  return prisma.booking.findUniqueOrThrow({ where: { id: bookingId } });
}

export const LessonConfirmationService = { openConfirmationWindow, confirmLesson };
export default LessonConfirmationService;
