import prisma from "../../config/database.config";
import { AppError } from "../../utils/AppError.util";
import { StatusCodes } from "http-status-codes";
import {
  BookingStatus,
  DisputeStatus,
  DisputeEvidenceParty,
  EscrowStatus,
  NotificationType,
  NotificationResourceType,
} from "../../generated/prisma";
import { ServiceContext } from "../../base/base.types";
import { AuditService } from "../../utils/logUserActivity.util";
import { NotificationService } from "../../services/notification/notification.service";
import { assertValidTransition as assertValidBookingTransition } from "../../services/booking/bookingStateMachine";
import { assertValidTransition as assertValidDisputeTransition } from "../../services/dispute/disputeStateMachine";
import { disputeConfig } from "../../services/dispute/disputeConfig";
import { computeAutoResolutionRecommendation } from "../../services/dispute/autoResolution.util";
import { cancelConfirmationWindowJobs } from "../../services/dispute/confirmationWindow.processor";
import {
  scheduleDisputeResponseJobs,
  cancelDisputeResponseJobs,
} from "../../services/dispute/disputeSla.processor";
import { EscrowService } from "../../services/payment/escrow.service";
import { sessionStartAt, sessionEndAt } from "../availability/availability.logic";
import { OpenDisputeInput } from "./dispute.types";

async function getOrCreateRecommendation(bookingId: string, lessonConfirmationId: string) {
  const existing = await prisma.autoResolutionRecommendation.findUnique({ where: { bookingId } });
  if (existing) return existing;

  const booking = await prisma.booking.findUniqueOrThrow({ where: { id: bookingId } });
  const scheduledStartAt = sessionStartAt(booking);
  const scheduledEndAt = sessionEndAt(booking);

  const result = computeAutoResolutionRecommendation({
    scheduledStartAt,
    scheduledEndAt,
    tutorJoinedAt: booking.tutorCheckedInAt,
    tutorLeftAt: booking.tutorCheckedOutAt,
    studentJoinedAt: booking.bookerCheckedInAt,
    studentLeftAt: booking.bookerCheckedOutAt,
    severeConnectionEvents: false,
  });

  return prisma.autoResolutionRecommendation.create({
    data: {
      bookingId,
      lessonConfirmationId,
      recommendation: result.recommendation,
      overlapPercentage: result.overlapPercentage,
      tutorJoined: result.tutorJoined,
      studentJoined: result.studentJoined,
      tutorJoinDelayMinutes: result.tutorJoinDelayMinutes,
      severeConnectionEvents: result.severeConnectionEvents,
      sessionEndedEarly: result.sessionEndedEarly,
      reasoning: result.reasoning,
    },
  });
}

/** REQ-016-005 — read-only, permanent evidence package assembled once at dispute-open time. */
async function assembleEvidenceSnapshot(disputeId: string) {
  const startedAt = Date.now();

  const dispute = await prisma.dispute.findUniqueOrThrow({
    where: { id: disputeId },
    include: {
      booking: { include: { tutorProfile: { select: { userId: true } } } },
      lessonConfirmation: true,
      recommendation: true,
    },
  });

  const [conversation, liveRoom] = await Promise.all([
    prisma.conversation.findFirst({
      where: { bookingId: dispute.bookingId },
      include: { messages: { orderBy: { createdAt: "asc" } } },
    }),
    prisma.liveRoom.findUnique({
      where: { bookingId: dispute.bookingId },
      include: { chatMessages: { orderBy: { createdAt: "asc" } } },
    }),
  ]);

  const windowStart = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  const tutorUserId = dispute.booking.tutorProfile.userId;
  const parentUserId = dispute.booking.bookerId;

  const [tutorHistory, parentHistory] = await Promise.all([
    prisma.dispute.findMany({
      where: { booking: { tutorProfileId: dispute.booking.tutorProfileId }, openedAt: { gte: windowStart } },
      select: { id: true, status: true, reason: true, openedAt: true },
    }),
    parentUserId
      ? prisma.dispute.findMany({
          where: { booking: { bookerId: parentUserId }, openedAt: { gte: windowStart } },
          select: { id: true, status: true, reason: true, openedAt: true },
        })
      : Promise.resolve([]),
  ]);

  const snapshot = await prisma.disputeEvidenceSnapshot.create({
    data: {
      disputeId,
      bookingSnapshot: dispute.booking as any,
      sessionDataSnapshot: (dispute.lessonConfirmation?.sessionDataSnapshot ?? {}) as any,
      conversationSnapshot: (conversation?.messages ?? []) as any,
      sessionChatSnapshot: (liveRoom?.chatMessages ?? []) as any,
      recommendationSnapshot: (dispute.recommendation ?? {}) as any,
      tutorDisputeHistorySnapshot: {
        userId: tutorUserId,
        windowDays: 90,
        totalDisputes: tutorHistory.length,
        disputes: tutorHistory,
      } as any,
      parentDisputeHistorySnapshot: {
        userId: parentUserId,
        windowDays: 90,
        totalDisputes: parentHistory.length,
        disputes: parentHistory,
      } as any,
      assemblyDurationMs: Date.now() - startedAt,
    },
  });

  return snapshot;
}

const TUTOR_DISPUTE_SIGNAL = "DISPUTE_AGAINST_TUTOR";
const PARENT_DISPUTE_RATE_SIGNAL = "PARENT_HIGH_DISPUTE_RATE";

/** REQ-016-010a — 3+ disputes against a tutor in the trailing window flags them for KYC review. */
async function recordDisputeAgainstTutor(tutorUserId: string, disputeId: string) {
  const { tutorPatternThresholdCount, patternWindowDays } = await disputeConfig.getAll();

  let riskScore = await prisma.riskScore.findUnique({ where: { userId: tutorUserId } });
  if (!riskScore) riskScore = await prisma.riskScore.create({ data: { userId: tutorUserId } });

  await prisma.riskSignal.create({
    data: {
      userId: tutorUserId,
      riskScoreId: riskScore.id,
      signalType: TUTOR_DISPUTE_SIGNAL,
      pointsApplied: 0,
      scoreBefore: riskScore.currentScore,
      scoreAfter: riskScore.currentScore,
      stateBefore: riskScore.currentState,
      stateAfter: riskScore.currentState,
      sourceModule: "DISPUTE",
      sourceRecordId: disputeId,
      sourceRecordType: "Dispute",
    },
  });

  const windowStart = new Date(Date.now() - patternWindowDays * 24 * 60 * 60 * 1000);
  const recentCount = await prisma.riskSignal.count({
    where: { userId: tutorUserId, signalType: TUTOR_DISPUTE_SIGNAL, createdAt: { gte: windowStart } },
  });

  if (recentCount >= tutorPatternThresholdCount && !riskScore.humanReviewDueAt) {
    await prisma.riskScore.update({ where: { id: riskScore.id }, data: { humanReviewDueAt: new Date() } });
  }
}

/** REQ-016-010b — a parent whose dispute rate exceeds the configured threshold is flagged for Trust & Safety. */
async function checkParentDisputeRate(parentUserId: string) {
  const { parentPatternRatePercent, patternWindowDays } = await disputeConfig.getAll();
  const windowStart = new Date(Date.now() - patternWindowDays * 24 * 60 * 60 * 1000);
  const settledStatuses: BookingStatus[] = [
    BookingStatus.PAID,
    BookingStatus.IN_PROGRESS,
    BookingStatus.AWAITING_CONFIRMATION,
    BookingStatus.CONFIRMED,
    BookingStatus.AUTO_CONFIRMED,
    BookingStatus.DISPUTED,
    BookingStatus.RESOLVED_TUTOR_FAVOR,
    BookingStatus.RESOLVED_PARENT_FAVOR,
  ];

  const [totalCount, disputedCount] = await Promise.all([
    prisma.booking.count({ where: { bookerId: parentUserId, status: { in: settledStatuses }, createdAt: { gte: windowStart } } }),
    prisma.booking.count({
      where: {
        bookerId: parentUserId,
        status: { in: [BookingStatus.DISPUTED, BookingStatus.RESOLVED_TUTOR_FAVOR, BookingStatus.RESOLVED_PARENT_FAVOR] },
        createdAt: { gte: windowStart },
      },
    }),
  ]);

  // Require a minimum sample so one dispute out of one booking doesn't trip a "100% rate" flag.
  if (totalCount < 3) return;
  const ratePercent = (disputedCount / totalCount) * 100;
  if (ratePercent < parentPatternRatePercent) return;

  let riskScore = await prisma.riskScore.findUnique({ where: { userId: parentUserId } });
  if (!riskScore) riskScore = await prisma.riskScore.create({ data: { userId: parentUserId } });

  const alreadySignalledRecently = await prisma.riskSignal.findFirst({
    where: { userId: parentUserId, signalType: PARENT_DISPUTE_RATE_SIGNAL, createdAt: { gte: windowStart } },
  });
  if (alreadySignalledRecently) return;

  await prisma.riskSignal.create({
    data: {
      userId: parentUserId,
      riskScoreId: riskScore.id,
      signalType: PARENT_DISPUTE_RATE_SIGNAL,
      pointsApplied: 0,
      scoreBefore: riskScore.currentScore,
      scoreAfter: riskScore.currentScore,
      stateBefore: riskScore.currentState,
      stateAfter: riskScore.currentState,
      sourceModule: "DISPUTE",
      manualReason: `Dispute rate ${ratePercent.toFixed(1)}% over ${totalCount} bookings in the trailing ${patternWindowDays} days`,
    },
  });

  if (!riskScore.humanReviewDueAt) {
    await prisma.riskScore.update({ where: { id: riskScore.id }, data: { humanReviewDueAt: new Date() } });
  }
}

async function loadDisputableBooking(bookingId: string, userId: string) {
  const booking = await prisma.booking.findFirst({
    where: { id: bookingId, deletedAt: null },
    include: { tutorProfile: { select: { userId: true } } },
  });
  if (!booking) throw new AppError("booking/errors:bookingNotFound", StatusCodes.NOT_FOUND);

  const isBooker = booking.bookerId === userId;
  const isTutor = booking.tutorProfile.userId === userId;
  if (!isBooker && !isTutor) throw new AppError("booking/errors:notYourBooking", StatusCodes.FORBIDDEN);
  if (booking.status !== BookingStatus.AWAITING_CONFIRMATION) {
    throw new AppError("dispute/errors:disputeWindowClosed", StatusCodes.BAD_REQUEST);
  }
  return { booking, isBooker, isTutor };
}

async function openDispute(userId: string, bookingId: string, input: OpenDisputeInput, ctx: ServiceContext) {
  const { booking, isTutor } = await loadDisputableBooking(bookingId, userId);

  const { minDescriptionLength, maxDescriptionLength, tutorResponseWindowHours } = await disputeConfig.getAll();
  if (input.description.length < minDescriptionLength) {
    throw new AppError("dispute/errors:descriptionTooShort", StatusCodes.BAD_REQUEST, { minimum: minDescriptionLength });
  }
  if (input.description.length > maxDescriptionLength) {
    throw new AppError("dispute/errors:descriptionTooLong", StatusCodes.BAD_REQUEST, { maximum: maxDescriptionLength });
  }

  const existing = await prisma.dispute.findUnique({ where: { bookingId } });
  if (existing) throw new AppError("dispute/errors:disputeAlreadyExists", StatusCodes.CONFLICT);

  const lessonConfirmation = await prisma.lessonConfirmation.findUniqueOrThrow({ where: { bookingId } });
  const recommendation = await getOrCreateRecommendation(bookingId, lessonConfirmation.id);

  const tutorResponseDueAt = new Date(Date.now() + tutorResponseWindowHours * 60 * 60 * 1000);

  const dispute = await prisma.$transaction(async (tx) => {
    const created = await tx.dispute.create({
      data: {
        bookingId,
        lessonConfirmationId: lessonConfirmation.id,
        openedById: userId,
        reason: input.reason,
        description: input.description,
        status: DisputeStatus.OPEN,
        tutorResponseDueAt,
        recommendationId: recommendation.id,
      },
    });

    if (input.evidenceFileIds?.length) {
      await tx.disputeEvidenceFile.createMany({
        data: input.evidenceFileIds.map((fileId) => ({
          disputeId: created.id,
          fileId,
          uploadedById: userId,
          party: isTutor ? DisputeEvidenceParty.TUTOR : DisputeEvidenceParty.PARENT,
        })),
      });
    }

    assertValidBookingTransition(booking.status, BookingStatus.DISPUTED);
    await tx.booking.update({ where: { id: bookingId }, data: { status: BookingStatus.DISPUTED } });

    return created;
  });

  await EscrowService.freezeEscrowForBooking(bookingId);
  await cancelConfirmationWindowJobs(bookingId);
  await scheduleDisputeResponseJobs(dispute.id, tutorResponseDueAt);

  await assembleEvidenceSnapshot(dispute.id).catch((err) =>
    console.error({ event: "dispute_evidence_assembly_failed", disputeId: dispute.id, error: err.message })
  );

  AuditService.record(ctx, "disputes", {
    operation: "CREATE" as any,
    category: "WRITE" as any,
    recordId: dispute.id,
    newState: dispute,
    eventType: "dispute_opened",
  });

  const opener = await prisma.user.findUnique({
    where: { id: userId },
    select: { firstName: true, lastName: true },
  });
  const openerName = opener ? `${opener.firstName} ${opener.lastName}`.trim() : "";

  const otherPartyUserId = isTutor ? booking.bookerId : booking.tutorProfile.userId;
  const notifyTargets = [
    otherPartyUserId
      ? NotificationService.send({
          type: NotificationType.DISPUTE_OPENED,
          target: { kind: "user", userId: otherPartyUserId },
          resourceType: NotificationResourceType.DISPUTE,
          resourceId: dispute.id,
          data: { openerName },
        })
      : Promise.resolve(),
    NotificationService.send({
      type: NotificationType.DISPUTE_OPENED,
      target: { kind: "permission", permissionCode: "disputes.resolve" },
      resourceType: NotificationResourceType.DISPUTE,
      resourceId: dispute.id,
      data: { openerName },
    }),
  ];
  await Promise.all(notifyTargets);

  return dispute;
}

async function respondToDispute(tutorUserId: string, disputeId: string, statement: string, evidenceFileIds: string[] | undefined, ctx: ServiceContext) {
  const dispute = await prisma.dispute.findUnique({
    where: { id: disputeId },
    include: { booking: { include: { tutorProfile: { select: { userId: true } } } } },
  });
  if (!dispute) throw new AppError("dispute/errors:disputeNotFound", StatusCodes.NOT_FOUND);
  if (dispute.booking.tutorProfile.userId !== tutorUserId) {
    throw new AppError("dispute/errors:notYourDispute", StatusCodes.FORBIDDEN);
  }
  assertValidDisputeTransition(dispute.status, DisputeStatus.AWAITING_ADMIN);

  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.dispute.update({
      where: { id: disputeId },
      data: {
        tutorRespondedAt: new Date(),
        tutorResponseStatement: statement,
        status: DisputeStatus.AWAITING_ADMIN,
      },
    });
    if (evidenceFileIds?.length) {
      await tx.disputeEvidenceFile.createMany({
        data: evidenceFileIds.map((fileId) => ({
          disputeId,
          fileId,
          uploadedById: tutorUserId,
          party: DisputeEvidenceParty.TUTOR,
        })),
      });
    }
    return result;
  });

  await cancelDisputeResponseJobs(disputeId);

  AuditService.record(ctx, "disputes", {
    operation: "UPDATE" as any,
    category: "WRITE" as any,
    recordId: disputeId,
    previousState: { status: dispute.status },
    newState: { status: updated.status },
    eventType: "dispute_tutor_responded",
  });

  return updated;
}

async function resolveDispute(
  adminUserId: string,
  disputeId: string,
  resolution: "TUTOR_FAVOR" | "PARENT_FAVOR",
  reason: string,
  ctx: ServiceContext
) {
  const dispute = await prisma.dispute.findUnique({
    where: { id: disputeId },
    include: { booking: { include: { tutorProfile: { select: { userId: true } } } } },
  });
  if (!dispute) throw new AppError("dispute/errors:disputeNotFound", StatusCodes.NOT_FOUND);

  const newDisputeStatus =
    resolution === "TUTOR_FAVOR" ? DisputeStatus.RESOLVED_TUTOR_FAVOR : DisputeStatus.RESOLVED_PARENT_FAVOR;
  const newBookingStatus =
    resolution === "TUTOR_FAVOR" ? BookingStatus.RESOLVED_TUTOR_FAVOR : BookingStatus.RESOLVED_PARENT_FAVOR;

  assertValidDisputeTransition(dispute.status, newDisputeStatus);
  assertValidBookingTransition(dispute.booking.status, newBookingStatus);

  const escrowHold = await prisma.escrowHold.findFirst({
    where: { bookingId: dispute.bookingId, status: EscrowStatus.FROZEN },
  });
  if (escrowHold) {
    await EscrowService.unfreezeEscrowForBooking(dispute.bookingId);
    if (resolution === "TUTOR_FAVOR") {
      await EscrowService.releaseEscrowToTutor(escrowHold.id, { disputeId });
    } else {
      await EscrowService.refundEscrowToPayer(escrowHold.id);
    }
  }

  const [updated] = await prisma.$transaction([
    prisma.dispute.update({
      where: { id: disputeId },
      data: {
        status: newDisputeStatus,
        resolvedById: adminUserId,
        resolvedAt: new Date(),
        resolutionReason: reason,
      },
    }),
    prisma.booking.update({ where: { id: dispute.bookingId }, data: { status: newBookingStatus } }),
  ]);

  await cancelDisputeResponseJobs(disputeId);

  const { openReviewWindow } = await import("../../services/review/reviewWindow.service");
  await openReviewWindow(dispute.bookingId).catch((err) =>
    console.error({ event: "review_window_open_failed", bookingId: dispute.bookingId, error: err.message })
  );

  const { MessagingService } = await import("../messaging/messaging.service");
  await MessagingService.archiveForBooking(dispute.bookingId).catch((err) =>
    console.error({ event: "conversation_archive_failed", bookingId: dispute.bookingId, error: err.message })
  );

  const tutorUserId = dispute.booking.tutorProfile.userId;
  await recordDisputeAgainstTutor(tutorUserId, disputeId);
  if (dispute.booking.bookerId) {
    await checkParentDisputeRate(dispute.booking.bookerId);
  }

  AuditService.record(ctx, "disputes", {
    operation: "UPDATE" as any,
    category: "WRITE" as any,
    recordId: disputeId,
    previousState: { status: dispute.status },
    newState: { status: updated.status, resolution, reason },
    eventType: "dispute_resolved",
  });

  const notifyUserIds = [tutorUserId, dispute.booking.bookerId].filter(Boolean) as string[];
  await Promise.all(
    notifyUserIds.map((userId) =>
      NotificationService.send({
        type: NotificationType.DISPUTE_RESOLVED,
        target: { kind: "user", userId },
        resourceType: NotificationResourceType.DISPUTE,
        resourceId: disputeId,
      })
    )
  );

  return updated;
}

async function getDisputeForUser(disputeId: string, userId: string, isAdminReader = false) {
  const dispute = await prisma.dispute.findUnique({
    where: { id: disputeId },
    include: { booking: { include: { tutorProfile: { select: { userId: true } } } } },
  });
  if (!dispute) throw new AppError("dispute/errors:disputeNotFound", StatusCodes.NOT_FOUND);
  const isParty = dispute.openedById === userId || dispute.booking.bookerId === userId || dispute.booking.tutorProfile.userId === userId;
  if (!isParty && !isAdminReader) throw new AppError("dispute/errors:notYourDispute", StatusCodes.FORBIDDEN);
  return dispute;
}

/** Null (not 404) when the booking simply has no dispute — this is a normal, expected state for most bookings. */
async function getDisputeForBooking(bookingId: string, userId: string, isAdminReader = false) {
  const dispute = await prisma.dispute.findUnique({
    where: { bookingId },
    include: { booking: { include: { tutorProfile: { select: { userId: true } } } } },
  });
  if (!dispute) return null;
  const isParty = dispute.openedById === userId || dispute.booking.bookerId === userId || dispute.booking.tutorProfile.userId === userId;
  if (!isParty && !isAdminReader) throw new AppError("dispute/errors:notYourDispute", StatusCodes.FORBIDDEN);
  return dispute;
}

async function getEvidenceSnapshot(disputeId: string) {
  const snapshot = await prisma.disputeEvidenceSnapshot.findUnique({ where: { disputeId } });
  if (!snapshot) throw new AppError("dispute/errors:evidenceNotFound", StatusCodes.NOT_FOUND);
  return snapshot;
}

async function listAdminDisputes(filters: { status?: string; cursor?: string; limit: number }) {
  const { escalationHighlightHours } = await disputeConfig.getAll();
  const where: any = {};
  if (filters.status) where.status = filters.status;

  const rows = await prisma.dispute.findMany({
    where,
    orderBy: [{ openedAt: "desc" }, { id: "desc" }],
    ...(filters.cursor && { cursor: { id: filters.cursor }, skip: 1 }),
    take: filters.limit + 1,
  });

  const hasNextPage = rows.length > filters.limit;
  const page = hasNextPage ? rows.slice(0, filters.limit) : rows;
  const highlightCutoff = Date.now() - escalationHighlightHours * 60 * 60 * 1000;

  return {
    data: page.map((d) => ({ ...d, isOverdueForHighlight: d.openedAt.getTime() < highlightCutoff && !d.resolvedAt })),
    meta: { nextCursor: hasNextPage ? page[page.length - 1].id : null, hasNextPage, limit: filters.limit },
  };
}

export const DisputeService = {
  openDispute,
  respondToDispute,
  resolveDispute,
  getDisputeForUser,
  getDisputeForBooking,
  getEvidenceSnapshot,
  listAdminDisputes,
  assembleEvidenceSnapshot,
  getOrCreateRecommendation,
};

export default DisputeService;
