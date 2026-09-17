import prisma from "../../config/database.config";
import { AppError } from "../../utils/AppError.util";
import { StatusCodes } from "http-status-codes";
import {
  BookingStatus,
  NotificationType,
  NotificationResourceType,
  SafetyAlertType,
  SafetyAlertStatus,
} from "../../generated/prisma";
import { assertValidTransition } from "../../services/booking/bookingStateMachine";
import { NotificationService } from "../../services/notification/notification.service";
import { notifyEmergencyContact } from "../../services/notification/emergencyContact.channel";
import { LessonConfirmationService } from "../../services/dispute/lessonConfirmation.service";
import { bookingConfig } from "../../services/booking/bookingConfig";
import { sessionStartAt, sessionEndAt, watCalendarDate } from "../availability/availability.logic";
import { BookingService } from "./booking.service";
import { CheckInInput, CheckOutInput, TriggerSosInput } from "./booking.types";

const CHECKIN_OPENS_MINUTES_BEFORE = 15;
// Escalation step between the at-start reminder and the 30-min admin
// no-show flag (bookingConfig.homeNoShowGraceMinutes) — not itself
// admin-configurable, since it's just a nudge to the party, not a
// business-affecting threshold like the no-show flag is.
const CHECKIN_OVERDUE_GRACE_MINUTES = 10;

/** Great-circle distance in meters — used to flag a check-in/out location
 * against the HOME session's booked address rather than trust a bare
 * timestamp tap. Accurate enough at city scale; no need for anything more
 * precise here. */
function distanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function notifyAdmins(
  type: typeof NotificationType.SESSION_CHECKIN_SAFETY_FLAGGED
    | typeof NotificationType.SESSION_LOCATION_MISMATCH
    | typeof NotificationType.SESSION_SOS_TRIGGERED
    | typeof NotificationType.SESSION_CHECKOUT_ESCALATED,
  bookingId: string,
  data?: Record<string, unknown>
) {
  await NotificationService.send({
    type,
    target: { kind: "permission", permissionCode: "bookings.flagged.read" },
    resourceType: NotificationResourceType.BOOKING,
    resourceId: bookingId,
    data,
  });
}

/** Flags a location mismatch between a HOME session's booked address and a
 * check-in/out GPS reading — creates a SafetyAlert and notifies admins, but
 * never blocks the check-in/out itself. Silent no-op when either point is
 * missing (booking has no address, or the device didn't report a location). */
async function flagLocationMismatchIfAny(
  booking: { id: string; sessionType: string; sessionLatitude: unknown; sessionLongitude: unknown },
  userId: string,
  lat?: number,
  lng?: number
) {
  if (booking.sessionType !== "HOME") return;
  if (lat == null || lng == null) return;
  if (booking.sessionLatitude == null || booking.sessionLongitude == null) return;

  const { locationMismatchThresholdMeters } = await bookingConfig.getAll();
  const distance = distanceMeters(
    Number(booking.sessionLatitude),
    Number(booking.sessionLongitude),
    lat,
    lng
  );
  if (distance <= locationMismatchThresholdMeters) return;

  await prisma.safetyAlert.create({
    data: {
      bookingId: booking.id,
      alertType: SafetyAlertType.LOCATION_MISMATCH,
      triggeredById: userId,
      latitude: lat,
      longitude: lng,
      note: `${Math.round(distance)}m from booked session address`,
    },
  });
  await notifyAdmins(NotificationType.SESSION_LOCATION_MISMATCH, booking.id, {
    distanceMeters: Math.round(distance),
  });
}

async function checkIn(userId: string, bookingId: string, input: CheckInInput = {}) {
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

  const locationData = isTutor
    ? { tutorCheckedInLat: input.latitude, tutorCheckedInLng: input.longitude }
    : { bookerCheckedInLat: input.latitude, bookerCheckedInLng: input.longitude };

  const updated = await prisma.booking.update({
    where: { id: bookingId },
    data: {
      ...(isTutor ? { tutorCheckedInAt: new Date() } : { bookerCheckedInAt: new Date() }),
      ...locationData,
      ...(input.safetyNote && { checkinSafetyNote: input.safetyNote }),
    },
  });

  if (updated.tutorCheckedInAt && updated.bookerCheckedInAt && updated.status === BookingStatus.PAID) {
    assertValidTransition(updated.status, BookingStatus.IN_PROGRESS);
    await prisma.booking.update({ where: { id: bookingId }, data: { status: BookingStatus.IN_PROGRESS } });
  }

  await flagLocationMismatchIfAny(booking, userId, input.latitude, input.longitude);

  if (input.safetyNote) {
    await prisma.safetyAlert.create({
      data: {
        bookingId,
        alertType: SafetyAlertType.CHECKIN_FLAGGED,
        triggeredById: userId,
        latitude: input.latitude,
        longitude: input.longitude,
        note: input.safetyNote,
      },
    });
    await notifyAdmins(NotificationType.SESSION_CHECKIN_SAFETY_FLAGGED, bookingId);
  }

  // Trusted-contact notify — on by default whenever the tutor checks in for
  // a HOME session, independent of whether anything was flagged. Best-effort:
  // failure never blocks check-in, and delivery isn't guaranteed (see
  // emergencyContact.channel.ts for why).
  if (isTutor) {
    const tutorProfile = await prisma.tutorProfile.findUnique({
      where: { id: booking.tutorProfileId },
      select: { emergencyContactPhone: true, user: { select: { firstName: true, lastName: true } } },
    });
    if (tutorProfile?.emergencyContactPhone) {
      const endTime = sessionEndAt(booking);
      notifyEmergencyContact({
        phone: tutorProfile.emergencyContactPhone,
        bodyText: `${tutorProfile.user.firstName} ${tutorProfile.user.lastName} just checked in for a Mentora home session at ${booking.sessionAddress ?? "the booked address"}. Expected to finish around ${endTime.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}.`,
      }).catch((err) => console.error({ event: "emergency_contact_checkin_notify_failed", bookingId, error: err?.message }));
    }
  }

  return BookingService.serializeBooking(await prisma.booking.findUniqueOrThrow({ where: { id: bookingId } }));
}

async function checkOut(userId: string, bookingId: string, input: CheckOutInput = {}) {
  const { booking, isBooker, isTutor } = await BookingService.getBookingForUser(bookingId, userId);
  if (!isBooker && !isTutor) throw new AppError("booking/errors:notYourBooking", StatusCodes.FORBIDDEN);
  if (booking.sessionType !== "HOME") {
    throw new AppError("booking/errors:sessionTypeNotOffered", StatusCodes.BAD_REQUEST);
  }

  const alreadyCheckedOut = isTutor ? booking.tutorCheckedOutAt : booking.bookerCheckedOutAt;
  if (alreadyCheckedOut) {
    throw new AppError("booking/errors:alreadyCheckedIn", StatusCodes.CONFLICT);
  }

  const locationData = isTutor
    ? { tutorCheckedOutLat: input.latitude, tutorCheckedOutLng: input.longitude }
    : { bookerCheckedOutLat: input.latitude, bookerCheckedOutLng: input.longitude };

  const updated = await prisma.booking.update({
    where: { id: bookingId },
    data: {
      ...(isTutor ? { tutorCheckedOutAt: new Date() } : { bookerCheckedOutAt: new Date() }),
      ...locationData,
    },
  });

  await flagLocationMismatchIfAny(booking, userId, input.latitude, input.longitude);

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

/** Tutor- or booker-triggered panic signal during an active HOME session.
 * Always creates an OPEN SafetyAlert and always notifies admins — urgency
 * means this never gets deduped or rate-limited the way routine
 * notifications are. Also makes a best-effort attempt to reach the tutor's
 * emergency contact immediately, same as check-in, but unconditional on
 * outcome (see emergencyContact.channel.ts). */
async function triggerSos(userId: string, bookingId: string, input: TriggerSosInput = {}) {
  const { booking, isBooker, isTutor } = await BookingService.getBookingForUser(bookingId, userId);
  if (!isBooker && !isTutor) throw new AppError("booking/errors:notYourBooking", StatusCodes.FORBIDDEN);
  if (booking.sessionType !== "HOME" || booking.status !== BookingStatus.IN_PROGRESS) {
    throw new AppError("booking/errors:sosNotAvailable", StatusCodes.BAD_REQUEST);
  }

  const alert = await prisma.safetyAlert.create({
    data: {
      bookingId,
      alertType: SafetyAlertType.SOS,
      status: SafetyAlertStatus.OPEN,
      triggeredById: userId,
      latitude: input.latitude,
      longitude: input.longitude,
      note: input.note,
    },
  });

  await notifyAdmins(NotificationType.SESSION_SOS_TRIGGERED, bookingId, {
    triggeredByName: isTutor
      ? `${booking.tutorProfile.user.firstName} ${booking.tutorProfile.user.lastName}`.trim()
      : `${booking.booker?.firstName ?? ""} ${booking.booker?.lastName ?? ""}`.trim(),
  });

  const tutorProfile = await prisma.tutorProfile.findUnique({
    where: { id: booking.tutorProfileId },
    select: { emergencyContactPhone: true },
  });
  if (tutorProfile?.emergencyContactPhone) {
    const result = await notifyEmergencyContact({
      phone: tutorProfile.emergencyContactPhone,
      bodyText: `URGENT: SOS triggered on a Mentora home session at ${booking.sessionAddress ?? "an unconfirmed address"}. Please contact them now.`,
    }).catch((err) => {
      console.error({ event: "emergency_contact_sos_notify_failed", bookingId, error: err?.message });
      return { notified: false, channel: null };
    });
    await prisma.safetyAlert.update({
      where: { id: alert.id },
      data: {
        ...(result.notified && {
          emergencyContactNotifiedAt: new Date(),
          emergencyContactNotifiedChannel: result.channel,
        }),
      },
    });
  }

  return alert;
}

/** Sends type (REMINDER or OVERDUE) once per party who still hasn't checked
 * in for this booking — deduped per-recipient via a Notification existence
 * check, since (unlike the admin-facing no-show flag) this can legitimately
 * need to go to one party, the other, or both independently. */
async function sendPerPartyCheckinNotice(
  booking: {
    id: string;
    tutorCheckedInAt: Date | null;
    bookerCheckedInAt: Date | null;
    bookerId: string | null;
    tutorProfile: { userId: string };
  },
  type: typeof NotificationType.SESSION_CHECKIN_REMINDER | typeof NotificationType.SESSION_CHECKIN_OVERDUE
): Promise<number> {
  const pendingUserIds = [
    !booking.tutorCheckedInAt ? booking.tutorProfile.userId : null,
    !booking.bookerCheckedInAt ? booking.bookerId : null,
  ].filter((id): id is string => !!id);
  if (pendingUserIds.length === 0) return 0;

  let sent = 0;
  for (const userId of pendingUserIds) {
    const alreadyNotified = await prisma.notification.findFirst({
      where: { type, resourceId: booking.id, recipientId: userId },
    });
    if (alreadyNotified) continue;

    await NotificationService.send({
      type,
      target: { kind: "user", userId },
      resourceType: NotificationResourceType.BOOKING,
      resourceId: booking.id,
    });
    sent++;
  }
  return sent;
}

function findUncheckedInHomeBookingsToday() {
  return prisma.booking.findMany({
    where: {
      sessionType: "HOME",
      status: BookingStatus.PAID,
      sessionDate: watCalendarDate(),
      deletedAt: null,
      OR: [{ tutorCheckedInAt: null }, { bookerCheckedInAt: null }],
    },
    include: { tutorProfile: { select: { userId: true } } },
  });
}

/** Session start has arrived — nudge whichever party (tutor, booker, or
 * both) hasn't checked in yet. */
async function sweepCheckinReminders(): Promise<{ notified: number }> {
  const now = new Date();
  const candidates = await findUncheckedInHomeBookingsToday();

  let notified = 0;
  for (const booking of candidates) {
    if (sessionStartAt(booking) > now) continue;
    notified += await sendPerPartyCheckinNotice(booking, NotificationType.SESSION_CHECKIN_REMINDER);
  }
  return { notified };
}

/** A grace period past start has elapsed and someone still hasn't checked
 * in — a second, more urgent nudge ahead of the eventual admin no-show flag. */
async function sweepCheckinOverdue(): Promise<{ notified: number }> {
  const cutoff = new Date(Date.now() - CHECKIN_OVERDUE_GRACE_MINUTES * 60 * 1000);
  const candidates = await findUncheckedInHomeBookingsToday();

  let notified = 0;
  for (const booking of candidates) {
    if (sessionStartAt(booking) > cutoff) continue;
    notified += await sendPerPartyCheckinNotice(booking, NotificationType.SESSION_CHECKIN_OVERDUE);
  }
  return { notified };
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

/** HOME sessions that are IN_PROGRESS, past their scheduled end time, and
 * the tutor never checked out — nudges the tutor once ("are you clear?").
 * checkoutNudgeSentAt is set unconditionally on send so this sweep is
 * idempotent without a separate Notification lookup. */
async function sweepCheckoutNudge(): Promise<{ notified: number }> {
  const now = new Date();
  const candidates = await prisma.booking.findMany({
    where: {
      sessionType: "HOME",
      status: BookingStatus.IN_PROGRESS,
      tutorCheckedOutAt: null,
      checkoutNudgeSentAt: null,
      sessionDate: watCalendarDate(),
      deletedAt: null,
    },
    include: { tutorProfile: { select: { userId: true } } },
  });

  let notified = 0;
  for (const booking of candidates) {
    if (sessionEndAt(booking) > now) continue;

    await NotificationService.send({
      type: NotificationType.SESSION_CHECKOUT_NUDGE,
      target: { kind: "user", userId: booking.tutorProfile.userId },
      resourceType: NotificationResourceType.BOOKING,
      resourceId: booking.id,
    });
    await prisma.booking.update({ where: { id: booking.id }, data: { checkoutNudgeSentAt: now } });
    notified++;
  }
  return { notified };
}

/** Grace period past the checkout nudge has elapsed with still no checkout
 * — escalates to admin with an OPEN SafetyAlert and makes a best-effort
 * attempt to reach the tutor's emergency contact. checkoutEscalatedAt is
 * set unconditionally so this never re-fires for the same booking. */
async function sweepCheckoutEscalation(graceMinutes: number): Promise<{ escalated: number }> {
  const cutoff = new Date(Date.now() - graceMinutes * 60 * 1000);
  const candidates = await prisma.booking.findMany({
    where: {
      sessionType: "HOME",
      status: BookingStatus.IN_PROGRESS,
      tutorCheckedOutAt: null,
      checkoutEscalatedAt: null,
      checkoutNudgeSentAt: { not: null, lte: cutoff },
      deletedAt: null,
    },
    include: { tutorProfile: { select: { userId: true, emergencyContactPhone: true } } },
  });

  let escalated = 0;
  for (const booking of candidates) {
    await prisma.safetyAlert.create({
      data: {
        bookingId: booking.id,
        alertType: SafetyAlertType.CHECKOUT_ESCALATION,
        status: SafetyAlertStatus.OPEN,
        note: "No checkout and no response to the checkout-clear nudge.",
      },
    });
    await notifyAdmins(NotificationType.SESSION_CHECKOUT_ESCALATED, booking.id);
    await prisma.booking.update({ where: { id: booking.id }, data: { checkoutEscalatedAt: new Date() } });

    if (booking.tutorProfile.emergencyContactPhone) {
      await notifyEmergencyContact({
        phone: booking.tutorProfile.emergencyContactPhone,
        bodyText: `Mentora safety check: we haven't heard back after a home session should have ended. If you're able, please confirm they're safe.`,
      }).catch((err) => console.error({ event: "emergency_contact_checkout_escalation_failed", bookingId: booking.id, error: err?.message }));
    }
    escalated++;
  }
  return { escalated };
}

/** Admin oversight — gated by bookings.flagged.read at the route level. */
async function listSafetyAlerts(filters: { status?: SafetyAlertStatus; cursor?: string; limit: number }) {
  const where: any = {};
  if (filters.status) where.status = filters.status;

  const rows = await prisma.safetyAlert.findMany({
    where,
    include: {
      booking: { select: { id: true, sessionAddress: true, sessionDate: true, tutorProfileId: true } },
      triggeredBy: { select: { id: true, firstName: true, lastName: true } },
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    ...(filters.cursor && { cursor: { id: filters.cursor }, skip: 1 }),
    take: filters.limit + 1,
  });

  const hasNextPage = rows.length > filters.limit;
  const page = hasNextPage ? rows.slice(0, filters.limit) : rows;
  return {
    data: page,
    meta: { nextCursor: hasNextPage ? page[page.length - 1].id : null, hasNextPage, limit: filters.limit },
  };
}

async function resolveSafetyAlert(adminUserId: string, alertId: string, resolutionNote?: string) {
  const alert = await prisma.safetyAlert.findUnique({ where: { id: alertId } });
  if (!alert) throw new AppError("booking/errors:safetyAlertNotFound", StatusCodes.NOT_FOUND);

  const updated = await prisma.safetyAlert.update({
    where: { id: alertId },
    data: {
      status: SafetyAlertStatus.RESOLVED,
      resolvedById: adminUserId,
      resolvedAt: new Date(),
      resolutionNote,
    },
  });

  const booking = await prisma.booking.findUnique({
    where: { id: alert.bookingId },
    include: { tutorProfile: { select: { userId: true } } },
  });
  if (booking) {
    await NotificationService.send({
      type: NotificationType.SAFETY_ALERT_RESOLVED,
      target: { kind: "user", userId: booking.tutorProfile.userId },
      resourceType: NotificationResourceType.BOOKING,
      resourceId: booking.id,
    });
  }

  return updated;
}

let noShowInterval: NodeJS.Timeout | null = null;

export function startNoShowSweep(): void {
  if (noShowInterval) return;
  noShowInterval = setInterval(async () => {
    try {
      const { homeNoShowGraceMinutes, checkoutEscalationGraceMinutes } = await bookingConfig.getAll();
      await sweepCheckinReminders();
      await sweepCheckinOverdue();
      await sweepNoShows(homeNoShowGraceMinutes);
      await sweepCheckoutNudge();
      await sweepCheckoutEscalation(checkoutEscalationGraceMinutes);
    } catch (err: any) {
      console.error({ event: "no_show_sweep_failed", error: err.message });
    }
  }, 15 * 60 * 1000);
}

export function stopNoShowSweep(): void {
  if (noShowInterval) clearInterval(noShowInterval);
  noShowInterval = null;
}

export const CheckinService = {
  checkIn,
  checkOut,
  triggerSos,
  sweepNoShows,
  sweepCheckinReminders,
  sweepCheckinOverdue,
  sweepCheckoutNudge,
  sweepCheckoutEscalation,
  listSafetyAlerts,
  resolveSafetyAlert,
  startNoShowSweep,
  stopNoShowSweep,
};
export default CheckinService;
