import prisma from "../../config/database.config";
import { AppError } from "../../utils/AppError.util";
import { StatusCodes } from "http-status-codes";
import { BookingStatus, NotificationType, NotificationResourceType } from "../../generated/prisma";
import { assertValidTransition } from "../../services/booking/bookingStateMachine";
import { NotificationService } from "../../services/notification/notification.service";
import { LessonConfirmationService } from "../../services/dispute/lessonConfirmation.service";
import { bookingConfig } from "../../services/booking/bookingConfig";
import { sessionStartAt, watCalendarDate } from "../availability/availability.logic";
import { BookingService } from "./booking.service";

const CHECKIN_OPENS_MINUTES_BEFORE = 15;

async function checkIn(userId: string, bookingId: string) {
  const { booking, isBooker, isTutor } = await BookingService.getBookingForUser(bookingId, userId);
  if (!isBooker && !isTutor) throw new AppError("booking/errors:notYourBooking", StatusCodes.FORBIDDEN);
  if (booking.sessionType !== "HOME") {
    throw new AppError("booking/errors:sessionTypeNotOffered", StatusCodes.BAD_REQUEST);
  }
  if (booking.status !== BookingStatus.PAID && booking.status !== BookingStatus.IN_PROGRESS) {
    throw new AppError("booking/errors:notPaid", StatusCodes.CONFLICT);
  }

  const opensAt = new Date(sessionStartAt(booking).getTime() - CHECKIN_OPENS_MINUTES_BEFORE * 60 * 1000);
  if (new Date() < opensAt) {
    throw new AppError("booking/errors:checkinNotYetOpen", StatusCodes.CONFLICT);
  }

  const alreadyCheckedIn = isTutor ? booking.tutorCheckedInAt : booking.bookerCheckedInAt;
  if (alreadyCheckedIn) {
    throw new AppError("booking/errors:alreadyCheckedIn", StatusCodes.CONFLICT);
  }

  const updated = await prisma.booking.update({
    where: { id: bookingId },
    data: isTutor ? { tutorCheckedInAt: new Date() } : { bookerCheckedInAt: new Date() },
  });

  if (updated.tutorCheckedInAt && updated.bookerCheckedInAt && updated.status === BookingStatus.PAID) {
    assertValidTransition(updated.status, BookingStatus.IN_PROGRESS);
    await prisma.booking.update({ where: { id: bookingId }, data: { status: BookingStatus.IN_PROGRESS } });
  }

  return BookingService.serializeBooking(await prisma.booking.findUniqueOrThrow({ where: { id: bookingId } }));
}

async function checkOut(userId: string, bookingId: string) {
  const { booking, isBooker, isTutor } = await BookingService.getBookingForUser(bookingId, userId);
  if (!isBooker && !isTutor) throw new AppError("booking/errors:notYourBooking", StatusCodes.FORBIDDEN);
  if (booking.sessionType !== "HOME") {
    throw new AppError("booking/errors:sessionTypeNotOffered", StatusCodes.BAD_REQUEST);
  }

  const alreadyCheckedOut = isTutor ? booking.tutorCheckedOutAt : booking.bookerCheckedOutAt;
  if (alreadyCheckedOut) {
    throw new AppError("booking/errors:alreadyCheckedIn", StatusCodes.CONFLICT);
  }

  const updated = await prisma.booking.update({
    where: { id: bookingId },
    data: isTutor ? { tutorCheckedOutAt: new Date() } : { bookerCheckedOutAt: new Date() },
  });

  // Tutor checkout is the authoritative "session ended" signal for home
  // sessions — this is Module 16's trigger point (Module 14's online-
  // session-end trigger doesn't exist yet).
  if (isTutor && updated.status === BookingStatus.IN_PROGRESS) {
    assertValidTransition(updated.status, BookingStatus.AWAITING_CONFIRMATION);
    await prisma.booking.update({ where: { id: bookingId }, data: { status: BookingStatus.AWAITING_CONFIRMATION } });

    await LessonConfirmationService.openConfirmationWindow(bookingId, {
      sessionType: updated.sessionType,
      sessionDate: updated.sessionDate,
      sessionStartTime: updated.sessionStartTime,
      sessionEndTime: updated.sessionEndTime,
      tutorCheckedInAt: updated.tutorCheckedInAt,
      bookerCheckedInAt: updated.bookerCheckedInAt,
      tutorCheckedOutAt: updated.tutorCheckedOutAt,
      bookerCheckedOutAt: updated.bookerCheckedOutAt,
    });
  }

  return BookingService.serializeBooking(await prisma.booking.findUniqueOrThrow({ where: { id: bookingId } }));
}

/** Sweep: HOME sessions, 30+ min past start, nobody checked in — flagged for admin review. Notified once via a Notification existence check (no dedicated "flag" column on Booking). */
async function sweepNoShows(graceMinutes: number): Promise<{ flagged: number }> {
  const cutoff = new Date(Date.now() - graceMinutes * 60 * 1000);
  const today = watCalendarDate();

  const candidates = await prisma.booking.findMany({
    where: {
      sessionType: "HOME",
      status: BookingStatus.PAID,
      sessionDate: today,
      tutorCheckedInAt: null,
      bookerCheckedInAt: null,
      deletedAt: null,
    },
    include: { tutorProfile: { select: { userId: true } } },
  });

  let flagged = 0;
  for (const booking of candidates) {
    if (sessionStartAt(booking) > cutoff) continue;

    const alreadyNotified = await prisma.notification.findFirst({
      where: { type: NotificationType.SESSION_NO_SHOW, resourceId: booking.id },
    });
    if (alreadyNotified) continue;

    await NotificationService.send({
      type: NotificationType.SESSION_NO_SHOW,
      target: { kind: "permission", permissionCode: "bookings.flagged.read" },
      resourceType: NotificationResourceType.BOOKING,
      resourceId: booking.id,
    });
    flagged++;
  }
  return { flagged };
}

let noShowInterval: NodeJS.Timeout | null = null;

export function startNoShowSweep(): void {
  if (noShowInterval) return;
  noShowInterval = setInterval(async () => {
    try {
      const { homeNoShowGraceMinutes } = await bookingConfig.getAll();
      await sweepNoShows(homeNoShowGraceMinutes);
    } catch (err: any) {
      console.error({ event: "no_show_sweep_failed", error: err.message });
    }
  }, 15 * 60 * 1000);
}

export function stopNoShowSweep(): void {
  if (noShowInterval) clearInterval(noShowInterval);
  noShowInterval = null;
}

export const CheckinService = { checkIn, checkOut, sweepNoShows, startNoShowSweep, stopNoShowSweep };
export default CheckinService;
