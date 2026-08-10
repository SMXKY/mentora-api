import prisma from "../../config/database.config";
import { AppError } from "../../utils/AppError.util";
import { StatusCodes } from "http-status-codes";
import {
  BookingStatus,
  SubjectVerificationStatus,
  TeachingMode,
  SessionType,
  NotificationType,
  NotificationResourceType,
} from "../../generated/prisma";
import { ServiceContext } from "../../base/base.types";
import { AuditService } from "../../utils/logUserActivity.util";
import { NotificationService } from "../../services/notification/notification.service";
import {
  assertValidTransition,
  OCCUPYING_STATUSES,
} from "../../services/booking/bookingStateMachine";
import { bookingConfig } from "../../services/booking/bookingConfig";
import { AvailabilityService } from "../availability/availability.service";
import {
  timeStringToMinutes,
  minutesToTimeString,
  dbTimeToMinutes,
  minutesToDbTime,
  sessionStartAt,
  isWatPastMoment,
} from "../availability/availability.logic";
import {
  schedulePaymentWindowJobs,
  cancelScheduledJobsForBooking,
} from "../../services/booking/paymentWindow.processor";
import { computeParentCancellationOutcome } from "../../services/booking/cancellationPolicy";
import { MessagingService } from "../messaging/messaging.service";
import { EscrowService } from "../../services/payment/escrow.service";
import { CreateBookingRequestInput } from "./booking.types";
import { resolveStorageUrl } from "../../services/media";

const TUTOR_CANCELLATION_SIGNAL = "TUTOR_CANCELLED_PAID_BOOKING";

/** Shared by every read path that displays a booking to a user — the
 * write paths (accept/reject/checkout/etc.) don't need these joins since
 * their responses aren't rendered as a detail view. */
const DISPLAY_INCLUDE = {
  subject: { select: { id: true, name: true } },
  level: { select: { id: true, name: true } },
  tutorProfile: {
    select: {
      userId: true,
      user: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          profilePictureUrl: true,
        },
      },
    },
  },
  booker: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      profilePictureUrl: true,
    },
  },
} as const;

/** Tracks a paid-booking cancellation against the tutor's risk record and
 * flags them for admin review once they hit 3 in the trailing 30 days.
 * Deliberately scoring-neutral (pointsApplied 0) — the full risk-scoring
 * engine (Module 18) isn't built yet; this only feeds the count-based flag. */
async function recordTutorCancellationSignal(
  tutorUserId: string,
  bookingId: string
) {
  let riskScore = await prisma.riskScore.findUnique({
    where: { userId: tutorUserId },
  });
  if (!riskScore) {
    riskScore = await prisma.riskScore.create({
      data: { userId: tutorUserId },
    });
  }

  await prisma.riskSignal.create({
    data: {
      userId: tutorUserId,
      riskScoreId: riskScore.id,
      signalType: TUTOR_CANCELLATION_SIGNAL,
      pointsApplied: 0,
      scoreBefore: riskScore.currentScore,
      scoreAfter: riskScore.currentScore,
      stateBefore: riskScore.currentState,
      stateAfter: riskScore.currentState,
      sourceModule: "BOOKING",
      sourceRecordId: bookingId,
      sourceRecordType: "Booking",
    },
  });

  const windowStart = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const recentCount = await prisma.riskSignal.count({
    where: {
      userId: tutorUserId,
      signalType: TUTOR_CANCELLATION_SIGNAL,
      createdAt: { gte: windowStart },
    },
  });

  if (recentCount >= 3 && !riskScore.humanReviewDueAt) {
    await prisma.riskScore.update({
      where: { id: riskScore.id },
      data: { humanReviewDueAt: new Date() },
    });
  }
}

async function resolveStudentProfile(
  userId: string,
  studentProfileId?: string
) {
  if (studentProfileId) {
    const profile = await prisma.studentProfile.findFirst({
      where: { id: studentProfileId, deletedAt: null },
    });
    if (!profile) {
      throw new AppError(
        "booking/errors:studentProfileNotFound",
        StatusCodes.NOT_FOUND
      );
    }
    if (profile.userId !== userId && profile.guardianId !== userId) {
      throw new AppError(
        "booking/errors:notYourStudent",
        StatusCodes.FORBIDDEN
      );
    }
    return profile;
  }
  // No explicit studentProfileId — the caller must be booking for themselves.
  const own = await prisma.studentProfile.findFirst({
    where: { userId, deletedAt: null },
  });
  if (!own) {
    throw new AppError(
      "booking/errors:studentProfileRequired",
      StatusCodes.BAD_REQUEST
    );
  }
  return own;
}

async function assertBookableTutor(tutorProfileId: string) {
  const tutor = await prisma.tutorProfile.findFirst({
    where: { id: tutorProfileId, deletedAt: null },
  });
  if (
    !tutor ||
    tutor.kycStatus !== "ACTIVE" ||
    !tutor.introVideoVerified ||
    tutor.isPaymentOverdue
  ) {
    throw new AppError(
      "booking/errors:tutorNotBookable",
      StatusCodes.NOT_FOUND
    );
  }
  return tutor;
}

async function assertApprovedSubjectLevel(
  tutorProfileId: string,
  subjectId: string,
  levelId: string
) {
  const tutorSubject = await prisma.tutorSubject.findFirst({
    where: {
      tutorProfileId,
      subjectId,
      status: SubjectVerificationStatus.APPROVED,
    },
    select: {
      id: true,
      ratePerOnlineHourXaf: true,
      ratePerHomeHourXaf: true,
      isOpenForBooking: true,
      levels: { where: { levelId } },
    },
  });
  if (!tutorSubject || tutorSubject.levels.length === 0) {
    throw new AppError(
      "booking/errors:subjectLevelNotApproved",
      StatusCodes.BAD_REQUEST
    );
  }
  // Separate from the lookup above so a closed-but-approved subject gets an
  // accurate "not currently accepting bookings" message instead of the
  // generic "not approved" one.
  if (!tutorSubject.isOpenForBooking) {
    throw new AppError(
      "booking/errors:subjectNotOpenForBooking",
      StatusCodes.BAD_REQUEST
    );
  }
  return tutorSubject;
}

/** The tutor's hourly rate for the chosen session type (online vs. home —
 * always a distinct rate per mode, never a shared/ambiguous one), scaled to
 * the actual session length. Returns null if that mode's rate isn't set. */
function computeAgreedRateXaf(
  tutorSubject: {
    ratePerOnlineHourXaf: number | null;
    ratePerHomeHourXaf: number | null;
  },
  sessionType: SessionType,
  durationMinutes: number
) {
  const hourlyRate =
    sessionType === "ONLINE"
      ? tutorSubject.ratePerOnlineHourXaf
      : tutorSubject.ratePerHomeHourXaf;
  if (hourlyRate == null) return null;
  return Math.round((hourlyRate * durationMinutes) / 60);
}

function assertSessionTypeAllowed(
  teachingMode: TeachingMode,
  sessionType: SessionType
) {
  const allowed =
    teachingMode === "BOTH" ||
    (teachingMode === "ONLINE_ONLY" && sessionType === "ONLINE") ||
    (teachingMode === "HOME_ONLY" && sessionType === "HOME");
  if (!allowed) {
    throw new AppError(
      "booking/errors:sessionTypeNotOffered",
      StatusCodes.BAD_REQUEST
    );
  }
}

function serializeBooking(booking: any) {
  return {
    id: booking.id,
    status: booking.status,
    bookerId: booking.bookerId,
    studentProfileId: booking.studentProfileId,
    tutorProfileId: booking.tutorProfileId,
    subjectId: booking.subjectId,
    levelId: booking.levelId,
    sessionType: booking.sessionType,
    durationMinutes: booking.durationMinutes,
    messageToTutor: booking.messageToTutor,
    sessionDate: booking.sessionDate.toISOString().slice(0, 10),
    sessionStartTime: minutesToTimeString(
      dbTimeToMinutes(booking.sessionStartTime)
    ),
    sessionEndTime: minutesToTimeString(
      dbTimeToMinutes(booking.sessionEndTime)
    ),
    paymentWindowExpiresAt: booking.paymentWindowExpiresAt,
    agreedRateXaf: booking.agreedRateXaf,
    commissionRatePercent: booking.commissionRatePercent,
    commissionAmountXaf: booking.commissionAmountXaf,
    netTutorAmountXaf: booking.netTutorAmountXaf,
    totalAmountXaf: booking.totalAmountXaf,
    rejectionReason: booking.rejectionReason,
    cancelledById: booking.cancelledById,
    cancelledAt: booking.cancelledAt,
    cancellationReason: booking.cancellationReason,
    tutorCheckedInAt: booking.tutorCheckedInAt,
    bookerCheckedInAt: booking.bookerCheckedInAt,
    tutorCheckedOutAt: booking.tutorCheckedOutAt,
    bookerCheckedOutAt: booking.bookerCheckedOutAt,
    isGroupSession: booking.isGroupSession,
    seriesId: booking.seriesId,
    createdAt: booking.createdAt,
    // Only present when the caller's query included these relations (detail/list
    // reads) — display-only, so absent-on-write-paths is an acceptable trade-off
    // rather than adding these joins to every mutation's return query.
    subject: booking.subject
      ? { id: booking.subject.id, name: booking.subject.name }
      : undefined,
    level: booking.level
      ? { id: booking.level.id, name: booking.level.name }
      : undefined,
    tutor: booking.tutorProfile?.user
      ? {
          tutorProfileId: booking.tutorProfileId,
          userId: booking.tutorProfile.user.id,
          firstName: booking.tutorProfile.user.firstName,
          lastName: booking.tutorProfile.user.lastName,
          profilePictureUrl: resolveStorageUrl(
            booking.tutorProfile.user.profilePictureUrl
          ),
        }
      : undefined,
    booker: booking.booker
      ? {
          id: booking.booker.id,
          firstName: booking.booker.firstName,
          lastName: booking.booker.lastName,
          profilePictureUrl: resolveStorageUrl(
            booking.booker.profilePictureUrl
          ),
        }
      : undefined,
  };
}

async function createBookingRequest(
  userId: string,
  input: CreateBookingRequestInput,
  ctx: ServiceContext
) {
  const [tutor, studentProfile] = await Promise.all([
    assertBookableTutor(input.tutorProfileId),
    resolveStudentProfile(userId, input.studentProfileId),
  ]);

  assertSessionTypeAllowed(tutor.teachingMode, input.sessionType);

  const tutorSubject = await assertApprovedSubjectLevel(
    input.tutorProfileId,
    input.subjectId,
    input.levelId
  );
  const agreedRateXaf = computeAgreedRateXaf(
    tutorSubject,
    input.sessionType,
    input.durationMinutes
  );
  if (!agreedRateXaf) {
    throw new AppError(
      "booking/errors:tutorRateNotSet",
      StatusCodes.BAD_REQUEST
    );
  }

  const startMinutes = timeStringToMinutes(input.sessionStartTime);
  const endMinutes = startMinutes + input.durationMinutes;
  if (endMinutes > 24 * 60) {
    throw new AppError(
      "booking/errors:sessionCrossesMidnight",
      StatusCodes.BAD_REQUEST
    );
  }
  const sessionEndTime = minutesToTimeString(endMinutes);

  // Checked explicitly (not just left to isWindowAvailable naturally
  // excluding elapsed slots) so the rejection reason is unambiguous rather
  // than the generic "not available" a stale client-side slot list would
  // otherwise surface.
  if (isWatPastMoment(input.sessionDate, input.sessionStartTime)) {
    throw new AppError(
      "booking/errors:sessionInPast",
      StatusCodes.BAD_REQUEST
    );
  }

  const available = await AvailabilityService.isWindowAvailable(
    input.tutorProfileId,
    input.sessionDate,
    input.sessionStartTime,
    sessionEndTime
  );
  if (!available) {
    throw new AppError("booking/errors:slotNotAvailable", StatusCodes.CONFLICT);
  }

  const booking = await prisma.booking.create({
    data: {
      bookerId: userId,
      studentProfileId: studentProfile.id,
      tutorProfileId: input.tutorProfileId,
      subjectId: input.subjectId,
      levelId: input.levelId,
      sessionType: input.sessionType,
      durationMinutes: input.durationMinutes,
      messageToTutor: input.messageToTutor,
      sessionDate: new Date(`${input.sessionDate}T00:00:00.000Z`),
      sessionStartTime: minutesToDbTime(startMinutes),
      sessionEndTime: minutesToDbTime(endMinutes),
      agreedRateXaf,
      status: BookingStatus.REQUESTED,
    },
  });

  AuditService.record(ctx, "bookings", {
    operation: "CREATE" as any,
    category: "WRITE" as any,
    recordId: booking.id,
    newState: booking,
    eventType: "booking_requested",
  });

  await NotificationService.send({
    type: NotificationType.BOOKING_REQUESTED,
    target: { kind: "user", userId: tutor.userId },
    resourceType: NotificationResourceType.BOOKING,
    resourceId: booking.id,
  });

  return serializeBooking(booking);
}

async function getBookingForUser(bookingId: string, userId: string) {
  const booking = await prisma.booking.findFirst({
    where: { id: bookingId, deletedAt: null },
    include: DISPLAY_INCLUDE,
  });
  if (!booking) {
    throw new AppError("booking/errors:bookingNotFound", StatusCodes.NOT_FOUND);
  }
  const isBooker = booking.bookerId === userId;
  const isTutor = booking.tutorProfile.userId === userId;
  if (!isBooker && !isTutor) {
    throw new AppError("booking/errors:notYourBooking", StatusCodes.FORBIDDEN);
  }
  return { booking, isBooker, isTutor };
}

async function acceptBooking(
  tutorUserId: string,
  bookingId: string,
  ctx: ServiceContext
) {
  const { booking, isTutor } = await getBookingForUser(bookingId, tutorUserId);
  if (!isTutor)
    throw new AppError("booking/errors:notYourBooking", StatusCodes.FORBIDDEN);
  assertValidTransition(booking.status, BookingStatus.ACCEPTED);

  const { paymentWindowHours } = await bookingConfig.getAll();
  const paymentWindowExpiresAt = new Date(
    Date.now() + paymentWindowHours * 60 * 60 * 1000
  );

  const updated = await prisma.booking.update({
    where: { id: bookingId },
    data: { status: BookingStatus.ACCEPTED, paymentWindowExpiresAt },
  });

  AuditService.record(ctx, "bookings", {
    operation: "UPDATE" as any,
    category: "WRITE" as any,
    recordId: booking.id,
    previousState: { status: booking.status },
    newState: { status: updated.status },
    eventType: "booking_accepted",
  });

  await schedulePaymentWindowJobs(bookingId, paymentWindowExpiresAt);

  if (booking.bookerId) {
    await NotificationService.send({
      type: NotificationType.BOOKING_ACCEPTED,
      target: { kind: "user", userId: booking.bookerId },
      resourceType: NotificationResourceType.BOOKING,
      resourceId: booking.id,
    });
  }

  return serializeBooking(updated);
}

async function rejectBooking(
  tutorUserId: string,
  bookingId: string,
  reason: string,
  ctx: ServiceContext
) {
  const { booking, isTutor } = await getBookingForUser(bookingId, tutorUserId);
  if (!isTutor)
    throw new AppError("booking/errors:notYourBooking", StatusCodes.FORBIDDEN);
  assertValidTransition(booking.status, BookingStatus.REJECTED);

  const updated = await prisma.booking.update({
    where: { id: bookingId },
    data: { status: BookingStatus.REJECTED, rejectionReason: reason },
  });

  AuditService.record(ctx, "bookings", {
    operation: "UPDATE" as any,
    category: "WRITE" as any,
    recordId: booking.id,
    previousState: { status: booking.status },
    newState: { status: updated.status, rejectionReason: reason },
    eventType: "booking_rejected",
  });

  if (booking.bookerId) {
    await NotificationService.send({
      type: NotificationType.BOOKING_REJECTED,
      target: { kind: "user", userId: booking.bookerId },
      resourceType: NotificationResourceType.BOOKING,
      resourceId: booking.id,
    });
  }

  return serializeBooking(updated);
}

async function withdrawBooking(
  bookerId: string,
  bookingId: string,
  ctx: ServiceContext
) {
  const { booking, isBooker } = await getBookingForUser(bookingId, bookerId);
  if (!isBooker)
    throw new AppError("booking/errors:notYourBooking", StatusCodes.FORBIDDEN);
  assertValidTransition(booking.status, BookingStatus.CANCELLED_UNPAID);

  const updated = await prisma.booking.update({
    where: { id: bookingId },
    data: {
      status: BookingStatus.CANCELLED_UNPAID,
      cancelledById: bookerId,
      cancelledAt: new Date(),
      cancellationReason: "Withdrawn by booker before payment",
    },
  });

  await cancelScheduledJobsForBooking(bookingId);

  AuditService.record(ctx, "bookings", {
    operation: "UPDATE" as any,
    category: "WRITE" as any,
    recordId: booking.id,
    previousState: { status: booking.status },
    newState: { status: updated.status },
    eventType: "booking_withdrawn",
  });

  return serializeBooking(updated);
}

/** Tutor cancels a confirmed PAID booking: full refund to the parent, plus a tracked cancellation signal (3-in-30-days -> admin review flag). */
async function cancelByTutor(
  tutorUserId: string,
  bookingId: string,
  reason: string,
  ctx: ServiceContext
) {
  const { booking, isTutor } = await getBookingForUser(bookingId, tutorUserId);
  if (!isTutor)
    throw new AppError("booking/errors:notYourBooking", StatusCodes.FORBIDDEN);
  assertValidTransition(booking.status, BookingStatus.CANCELLED_BY_TUTOR);

  const escrowHold = await prisma.escrowHold.findFirst({
    where: { bookingId, status: "HELD" },
  });
  if (!escrowHold) {
    throw new AppError("payment/errors:escrowNotFound", StatusCodes.CONFLICT);
  }
  await EscrowService.refundEscrowToPayer(escrowHold.id);

  const updated = await prisma.booking.update({
    where: { id: bookingId },
    data: {
      status: BookingStatus.CANCELLED_BY_TUTOR,
      cancelledById: tutorUserId,
      cancelledAt: new Date(),
      cancellationReason: reason,
    },
  });

  await recordTutorCancellationSignal(tutorUserId, bookingId);

  AuditService.record(ctx, "bookings", {
    operation: "UPDATE" as any,
    category: "WRITE" as any,
    recordId: booking.id,
    previousState: { status: booking.status },
    newState: { status: updated.status, cancellationReason: reason },
    eventType: "booking_cancelled_by_tutor",
  });

  if (booking.bookerId) {
    await NotificationService.send({
      type: NotificationType.BOOKING_CANCELLED_BY_TUTOR,
      target: { kind: "user", userId: booking.bookerId },
      resourceType: NotificationResourceType.BOOKING,
      resourceId: booking.id,
    });
  }

  await MessagingService.archiveForBooking(booking.id).catch((err) =>
    console.error({
      event: "conversation_archive_failed",
      bookingId: booking.id,
      error: err.message,
    })
  );

  return serializeBooking(updated);
}

/** Parent cancels a PAID booking. 12h-threshold policy: full refund if
 * still ≥ threshold hours before the session, otherwise the funds release
 * to the tutor as if the session had happened. */
async function cancelByParent(
  bookerId: string,
  bookingId: string,
  reason: string,
  ctx: ServiceContext
) {
  const { booking, isBooker } = await getBookingForUser(bookingId, bookerId);
  if (!isBooker)
    throw new AppError("booking/errors:notYourBooking", StatusCodes.FORBIDDEN);
  assertValidTransition(booking.status, BookingStatus.CANCELLED_BY_PARENT);

  const escrowHold = await prisma.escrowHold.findFirst({
    where: { bookingId, status: "HELD" },
  });
  if (!escrowHold) {
    throw new AppError("payment/errors:escrowNotFound", StatusCodes.CONFLICT);
  }

  const { cancellationThresholdHours } = await bookingConfig.getAll();
  const outcome = computeParentCancellationOutcome(
    sessionStartAt(booking),
    new Date(),
    cancellationThresholdHours
  );

  if (outcome === "FULL_REFUND") {
    await EscrowService.refundEscrowToPayer(escrowHold.id);
  } else {
    await EscrowService.releaseEscrowAsForfeited(escrowHold.id);
  }

  const updated = await prisma.booking.update({
    where: { id: bookingId },
    data: {
      status: BookingStatus.CANCELLED_BY_PARENT,
      cancelledById: bookerId,
      cancelledAt: new Date(),
      cancellationReason: reason,
    },
  });

  AuditService.record(ctx, "bookings", {
    operation: "UPDATE" as any,
    category: "WRITE" as any,
    recordId: booking.id,
    previousState: { status: booking.status },
    newState: { status: updated.status, cancellationReason: reason, outcome },
    eventType: "booking_cancelled_by_parent",
  });

  await NotificationService.send({
    type: NotificationType.BOOKING_CANCELLED_BY_PARENT,
    target: { kind: "user", userId: booking.tutorProfile.userId },
    resourceType: NotificationResourceType.BOOKING,
    resourceId: booking.id,
  });

  await MessagingService.archiveForBooking(booking.id).catch((err) =>
    console.error({
      event: "conversation_archive_failed",
      bookingId: booking.id,
      error: err.message,
    })
  );

  return { ...serializeBooking(updated), refundOutcome: outcome };
}

async function listMyBookings(
  userId: string,
  role: "BOOKER" | "TUTOR",
  filters: {
    status?: string;
    cursor?: string;
    limit: number;
    dateFrom?: string;
    dateTo?: string;
  }
) {
  const where: any =
    role === "TUTOR" ? { tutorProfile: { userId } } : { bookerId: userId };
  where.deletedAt = null;
  if (filters.status) where.status = filters.status;
  if (filters.dateFrom || filters.dateTo) {
    where.sessionDate = {
      ...(filters.dateFrom && {
        gte: new Date(`${filters.dateFrom}T00:00:00.000Z`),
      }),
      ...(filters.dateTo && {
        lte: new Date(`${filters.dateTo}T00:00:00.000Z`),
      }),
    };
  }

  const rows = await prisma.booking.findMany({
    where,
    include: DISPLAY_INCLUDE,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    ...(filters.cursor && { cursor: { id: filters.cursor }, skip: 1 }),
    take: filters.limit + 1,
  });

  const hasNextPage = rows.length > filters.limit;
  const page = hasNextPage ? rows.slice(0, filters.limit) : rows;
  const nextCursor = page.length > 0 ? page[page.length - 1].id : null;

  return {
    data: page.map(serializeBooking),
    meta: {
      nextCursor: hasNextPage ? nextCursor : null,
      hasNextPage,
      limit: filters.limit,
    },
  };
}

/** Admin oversight — no ownership check, gated by bookings.read_all at the route level instead. */
async function listAdminBookings(filters: {
  status?: string;
  cursor?: string;
  limit: number;
}) {
  const where: any = { deletedAt: null };
  if (filters.status) where.status = filters.status;

  const rows = await prisma.booking.findMany({
    where,
    include: DISPLAY_INCLUDE,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    ...(filters.cursor && { cursor: { id: filters.cursor }, skip: 1 }),
    take: filters.limit + 1,
  });

  const hasNextPage = rows.length > filters.limit;
  const page = hasNextPage ? rows.slice(0, filters.limit) : rows;

  return {
    data: page.map(serializeBooking),
    meta: {
      nextCursor: hasNextPage ? page[page.length - 1].id : null,
      hasNextPage,
      limit: filters.limit,
    },
  };
}

async function getAdminBooking(bookingId: string) {
  const booking = await prisma.booking.findFirst({
    where: { id: bookingId, deletedAt: null },
    include: DISPLAY_INCLUDE,
  });
  if (!booking)
    throw new AppError("booking/errors:bookingNotFound", StatusCodes.NOT_FOUND);
  return serializeBooking(booking);
}

export const BookingService = {
  createBookingRequest,
  acceptBooking,
  rejectBooking,
  withdrawBooking,
  cancelByTutor,
  cancelByParent,
  getBookingForUser,
  listMyBookings,
  serializeBooking,
  assertBookableTutor,
  assertApprovedSubjectLevel,
  assertSessionTypeAllowed,
  computeAgreedRateXaf,
  resolveStudentProfile,
  OCCUPYING_STATUSES,
  listAdminBookings,
  getAdminBooking,
};

export default BookingService;
