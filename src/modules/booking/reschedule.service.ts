import prisma from "../../config/database.config";
import { AppError } from "../../utils/AppError.util";
import { StatusCodes } from "http-status-codes";
import { BookingStatus, RescheduleStatus, NotificationType, NotificationResourceType } from "../../generated/prisma";
import { ServiceContext } from "../../base/base.types";
import { NotificationService } from "../../services/notification/notification.service";
import { bookingConfig } from "../../services/booking/bookingConfig";
import { computeParentCancellationOutcome } from "../../services/booking/cancellationPolicy";
import { AvailabilityService } from "../availability/availability.service";
import {
  timeStringToMinutes,
  minutesToDbTime,
  dbTimeToMinutes,
  minutesToTimeString,
  sessionStartAt,
} from "../availability/availability.logic";
import { BookingService } from "./booking.service";

/** Matches BookingService.serializeBooking's date/time formatting — Prisma
 * returns raw Date objects for @db.Date/@db.Time columns, which would
 * otherwise round-trip to the client as full ISO datetimes instead of the
 * plain "YYYY-MM-DD"/"HH:mm" strings the rest of the API contract uses. */
function serializeRescheduleRequest(request: {
  id: string;
  bookingId: string;
  requestedById: string;
  proposedDate: Date;
  proposedStartTime: Date;
  proposedEndTime: Date;
  reason: string | null;
  status: RescheduleStatus;
  respondedById: string | null;
  respondedAt: Date | null;
  rejectionReason: string | null;
}) {
  return {
    id: request.id,
    bookingId: request.bookingId,
    requestedById: request.requestedById,
    proposedDate: request.proposedDate.toISOString().slice(0, 10),
    proposedStartTime: minutesToTimeString(dbTimeToMinutes(request.proposedStartTime)),
    proposedEndTime: minutesToTimeString(dbTimeToMinutes(request.proposedEndTime)),
    reason: request.reason,
    status: request.status,
    respondedById: request.respondedById,
    respondedAt: request.respondedAt,
    rejectionReason: request.rejectionReason,
  };
}

interface RequestRescheduleInput {
  proposedDate: string;
  proposedStartTime: string;
  proposedEndTime: string;
  reason?: string;
}

async function requestReschedule(userId: string, bookingId: string, input: RequestRescheduleInput, ctx: ServiceContext) {
  const { booking, isBooker, isTutor } = await BookingService.getBookingForUser(bookingId, userId);
  if (!isBooker && !isTutor) throw new AppError("booking/errors:notYourBooking", StatusCodes.FORBIDDEN);
  const reschedulableStatuses: BookingStatus[] = [BookingStatus.ACCEPTED, BookingStatus.PAID];
  if (!reschedulableStatuses.includes(booking.status)) {
    throw new AppError("booking/errors:cannotCancel", StatusCodes.CONFLICT);
  }

  // 12h-rule reuse: a parent may only freely reschedule a PAID booking
  // outside the same cancellation threshold — inside it, they must go
  // through cancel-by-parent instead, which carries the real financial
  // consequence rather than silently dodging it via a "reschedule".
  if (isBooker && booking.status === BookingStatus.PAID) {
    const { cancellationThresholdHours } = await bookingConfig.getAll();
    const outcome = computeParentCancellationOutcome(sessionStartAt(booking), new Date(), cancellationThresholdHours);
    if (outcome === "RELEASE_TO_TUTOR") {
      throw new AppError("booking/errors:rescheduleTooCloseToSession", StatusCodes.CONFLICT);
    }
  }

  const request = await prisma.rescheduleRequest.create({
    data: {
      bookingId,
      requestedById: userId,
      proposedDate: new Date(`${input.proposedDate}T00:00:00.000Z`),
      proposedStartTime: minutesToDbTime(timeStringToMinutes(input.proposedStartTime)),
      proposedEndTime: minutesToDbTime(timeStringToMinutes(input.proposedEndTime)),
      reason: input.reason,
      status: RescheduleStatus.PENDING,
    },
  });

  void ctx;
  const otherPartyUserId = isTutor ? booking.bookerId : booking.tutorProfile.userId;
  if (otherPartyUserId) {
    await NotificationService.send({
      type: NotificationType.RESCHEDULE_REQUESTED,
      target: { kind: "user", userId: otherPartyUserId },
      resourceType: NotificationResourceType.BOOKING,
      resourceId: bookingId,
    });
  }

  return serializeRescheduleRequest(request);
}

/** The latest still-open reschedule proposal for a booking — null is the normal, common case. */
async function getPendingRescheduleForBooking(userId: string, bookingId: string) {
  await BookingService.getBookingForUser(bookingId, userId); // throws if not a party to the booking

  const request = await prisma.rescheduleRequest.findFirst({
    where: { bookingId, status: RescheduleStatus.PENDING },
    orderBy: { createdAt: "desc" },
  });
  return request ? serializeRescheduleRequest(request) : null;
}

async function respondToReschedule(
  userId: string,
  requestId: string,
  accept: boolean,
  rejectionReason: string | undefined,
  ctx: ServiceContext
) {
  const request = await prisma.rescheduleRequest.findUnique({
    where: { id: requestId },
    include: { booking: { include: { tutorProfile: { select: { userId: true } } } } },
  });
  if (!request) throw new AppError("booking/errors:rescheduleNotFound", StatusCodes.NOT_FOUND);
  if (request.status !== RescheduleStatus.PENDING) {
    throw new AppError("booking/errors:rescheduleAlreadyResolved", StatusCodes.CONFLICT);
  }

  const isTutor = request.booking.tutorProfile.userId === userId;
  const isBooker = request.booking.bookerId === userId;
  if ((!isTutor && !isBooker) || userId === request.requestedById) {
    throw new AppError("booking/errors:notYourReschedule", StatusCodes.FORBIDDEN);
  }
  void ctx;

  if (!accept) {
    const updated = await prisma.rescheduleRequest.update({
      where: { id: requestId },
      data: { status: RescheduleStatus.REJECTED, respondedById: userId, respondedAt: new Date(), rejectionReason },
    });
    await NotificationService.send({
      type: NotificationType.RESCHEDULE_REJECTED,
      target: { kind: "user", userId: request.requestedById },
      resourceType: NotificationResourceType.BOOKING,
      resourceId: request.bookingId,
    });
    return serializeRescheduleRequest(updated);
  }

  const proposedDateStr = request.proposedDate.toISOString().slice(0, 10);
  const startMinutes = dbTimeToMinutes(request.proposedStartTime);
  const endMinutes = dbTimeToMinutes(request.proposedEndTime);
  const available = await AvailabilityService.isWindowAvailable(
    request.booking.tutorProfileId,
    proposedDateStr,
    minutesToTimeString(startMinutes),
    minutesToTimeString(endMinutes)
  );
  if (!available) {
    throw new AppError("booking/errors:slotNotAvailable", StatusCodes.CONFLICT);
  }

  const [updatedRequest] = await prisma.$transaction([
    prisma.rescheduleRequest.update({
      where: { id: requestId },
      data: { status: RescheduleStatus.ACCEPTED, respondedById: userId, respondedAt: new Date() },
    }),
    prisma.booking.update({
      where: { id: request.bookingId },
      data: {
        sessionDate: request.proposedDate,
        sessionStartTime: request.proposedStartTime,
        sessionEndTime: request.proposedEndTime,
      },
    }),
  ]);

  await NotificationService.send({
    type: NotificationType.RESCHEDULE_ACCEPTED,
    target: { kind: "user", userId: request.requestedById },
    resourceType: NotificationResourceType.BOOKING,
    resourceId: request.bookingId,
  });

  return serializeRescheduleRequest(updatedRequest);
}

export const RescheduleService = { requestReschedule, respondToReschedule, getPendingRescheduleForBooking };
export default RescheduleService;
