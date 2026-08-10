import prisma from "../../config/database.config";
import { AppError } from "../../utils/AppError.util";
import { StatusCodes } from "http-status-codes";
import {
  ReviewAuthorRole,
  ReviewSubjectRole,
  ReviewStatus,
  ReportReason,
  ReviewReportStatus,
  IncidentReportType,
  IncidentReason,
  ReviewFraudSignalType,
  NotificationType,
  NotificationResourceType,
  BookingStatus,
} from "../../generated/prisma";
import { ServiceContext } from "../../base/base.types";
import { AuditService } from "../../utils/logUserActivity.util";
import { NotificationService } from "../../services/notification/notification.service";
import { TrustSafetyService } from "../trustSafety/trustSafety.service";
import { filterMessage } from "../../services/messaging/contentFilter";
import { tryRevealWindow } from "../../services/review/reviewWindow.service";
import { recomputeTutorRatingSnapshot } from "../../services/review/ratingSnapshot.service";
import { resolveStorageUrl } from "../../services/media";
import { SubmitReviewInput, ReviewSortOption } from "./review.types";

// Bookings in any of these statuses have had their session take place —
// mirrors dispute.service.ts's settledStatuses (checkParentDisputeRate),
// used there for the same "did a session actually happen" gate.
const SESSION_OCCURRED_STATUSES: BookingStatus[] = [
  BookingStatus.AWAITING_CONFIRMATION,
  BookingStatus.CONFIRMED,
  BookingStatus.AUTO_CONFIRMED,
  BookingStatus.DISPUTED,
  BookingStatus.RESOLVED_TUTOR_FAVOR,
  BookingStatus.RESOLVED_PARENT_FAVOR,
];

async function resolveRoleForUser(
  bookingId: string,
  userId: string,
  bookerId: string | null,
  tutorUserId: string
) {
  const isBooker = bookerId === userId;
  const isTutor = tutorUserId === userId;
  if (!isBooker && !isTutor) {
    throw new AppError("booking/errors:notYourBooking", StatusCodes.FORBIDDEN);
  }

  const isSelfRegisteredStudent = bookerId
    ? !!(await prisma.studentProfile.findFirst({ where: { userId: bookerId } }))
    : false;
  const bookerRole = isSelfRegisteredStudent ? "STUDENT" : "PARENT";

  if (isTutor) {
    return {
      authorRole: ReviewAuthorRole.TUTOR,
      subjectRole:
        bookerRole === "STUDENT"
          ? ReviewSubjectRole.STUDENT
          : ReviewSubjectRole.PARENT,
      subjectId: bookerId!,
      isBooker: false,
    };
  }
  return {
    authorRole:
      bookerRole === "STUDENT"
        ? ReviewAuthorRole.STUDENT
        : ReviewAuthorRole.PARENT,
    subjectRole: ReviewSubjectRole.TUTOR,
    subjectId: tutorUserId,
    isBooker: true,
  };
}

async function hasRecentSignal(userId: string, signalType: string, windowStart: Date) {
  const existing = await prisma.riskSignal.findFirst({
    where: { userId, signalType, createdAt: { gte: windowStart } },
  });
  return !!existing;
}

/** REQ-017-010 — run inline right after a review is created so the "within
 * 30 seconds" acceptance criteria are satisfied for free, no cron needed. */
async function checkReviewFraudSignals(review: {
  id: string;
  subjectId: string;
  authorId: string;
  createdAt: Date;
}) {
  const dayStart = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const recentForSubject = await prisma.review.findMany({
    where: { subjectId: review.subjectId, createdAt: { gte: dayStart } },
    select: { id: true },
  });
  if (
    recentForSubject.length > 5 &&
    !(await hasRecentSignal(review.subjectId, "COORDINATED_REVIEW_PATTERN_DETECTED", dayStart))
  ) {
    await prisma.reviewFraudSignal.create({
      data: {
        signalType: ReviewFraudSignalType.COORDINATED_REVIEW_BURST,
        subjectUserId: review.subjectId,
        reviewIds: recentForSubject.map((r) => r.id),
        detectionWindowHours: 24,
      },
    });
    await TrustSafetyService.recordSignal({
      userId: review.subjectId,
      signalType: "COORDINATED_REVIEW_PATTERN_DETECTED",
      pointsApplied: 40,
      sourceModule: "REVIEWS",
      sourceRecordId: review.id,
      sourceRecordType: "Review",
      requiresHumanReview: true,
    });
  }

  // Zero-booking-history cluster: the author has never booked/been booked
  // before this review's booking, and their account is very new — a
  // pattern consistent with a throwaway account created just to review.
  const [bookingCount, author] = await Promise.all([
    prisma.booking.count({
      where: { OR: [{ bookerId: review.authorId }, { tutorProfile: { userId: review.authorId } }], deletedAt: null },
    }),
    prisma.user.findUnique({ where: { id: review.authorId }, select: { createdAt: true } }),
  ]);
  const accountAgeMs = author ? review.createdAt.getTime() - author.createdAt.getTime() : Infinity;
  const oneDayMs = 24 * 60 * 60 * 1000;
  if (
    bookingCount <= 1 &&
    accountAgeMs < oneDayMs &&
    !(await hasRecentSignal(review.authorId, "ZERO_BOOKING_HISTORY_CLUSTER", dayStart))
  ) {
    await prisma.reviewFraudSignal.create({
      data: {
        signalType: ReviewFraudSignalType.ZERO_BOOKING_HISTORY_CLUSTER,
        subjectUserId: review.authorId,
        reviewIds: [review.id],
        detectionWindowHours: 1,
      },
    });
    // Not given an exact point value in SRS REQ-018-003's table — a
    // reasoned default between the "report" (+15) and "burst" (+40) signals.
    await TrustSafetyService.recordSignal({
      userId: review.authorId,
      signalType: "ZERO_BOOKING_HISTORY_CLUSTER",
      pointsApplied: 25,
      sourceModule: "REVIEWS",
      sourceRecordId: review.id,
      sourceRecordType: "Review",
      requiresHumanReview: true,
    });
  }
}

async function submitReview(
  userId: string,
  bookingId: string,
  input: SubmitReviewInput
) {
  const booking = await prisma.booking.findFirst({
    where: { id: bookingId, deletedAt: null },
    include: { tutorProfile: { select: { userId: true } } },
  });
  if (!booking)
    throw new AppError("booking/errors:bookingNotFound", StatusCodes.NOT_FOUND);

  const window = await prisma.reviewWindow.findUnique({ where: { bookingId } });
  if (!window)
    throw new AppError("review/errors:windowNotOpen", StatusCodes.BAD_REQUEST);
  // A submission is accepted right up until the window is revealed (by
  // either both sides submitting, or the closesAt sweep) — closesAt alone
  // doesn't block a last-minute submission, only the reveal does.
  if (window.revealedAt) {
    throw new AppError("review/errors:windowClosed", StatusCodes.BAD_REQUEST);
  }

  const { authorRole, subjectRole, subjectId, isBooker } =
    await resolveRoleForUser(
      bookingId,
      userId,
      booking.bookerId,
      booking.tutorProfile.userId
    );

  const existing = await prisma.review.findUnique({
    where: { bookingId_authorId: { bookingId, authorId: userId } },
  });
  if (existing)
    throw new AppError("review/errors:alreadySubmitted", StatusCodes.CONFLICT);

  const review = await prisma.$transaction(async (tx) => {
    const created = await tx.review.create({
      data: {
        bookingId,
        reviewWindowId: window.id,
        authorId: userId,
        subjectId,
        authorRole,
        subjectRole,
        overallRating: input.overallRating,
        wouldRebook: input.wouldRebook,
        ratingSubjectKnowledge: input.ratingSubjectKnowledge,
        ratingCommunication: input.ratingCommunication,
        ratingPunctuality: input.ratingPunctuality,
        writtenReview: input.writtenReview,
        status: ReviewStatus.SUBMITTED,
      },
    });

    await tx.reviewWindow.update({
      where: { id: window.id },
      data: isBooker ? { authorSubmitted: true } : { subjectSubmitted: true },
    });

    return created;
  });

  await tryRevealWindow(window.id);
  await checkReviewFraudSignals(review);

  return prisma.review.findUniqueOrThrow({ where: { id: review.id } });
}

const SORT_ORDER_BY: Record<ReviewSortOption, any> = {
  newest: [{ revealedAt: "desc" }, { id: "desc" }],
  oldest: [{ revealedAt: "asc" }, { id: "asc" }],
  highest: [{ overallRating: "desc" }, { revealedAt: "desc" }, { id: "desc" }],
  lowest: [{ overallRating: "asc" }, { revealedAt: "desc" }, { id: "desc" }],
};

interface ListReviewsOptions {
  cursor?: string;
  limit: number;
  sort?: ReviewSortOption;
  rating?: number;
  wouldRebook?: boolean;
}

async function listTutorReviewsByProfile(
  tutorProfileId: string,
  options: ListReviewsOptions
) {
  const tutorProfile = await prisma.tutorProfile.findUnique({
    where: { id: tutorProfileId },
    select: { userId: true },
  });
  if (!tutorProfile)
    throw new AppError(
      "tutor/errors:tutorProfileNotFound",
      StatusCodes.NOT_FOUND
    );
  return listTutorReviews(tutorProfile.userId, options);
}

async function listTutorReviews(
  tutorUserId: string,
  options: ListReviewsOptions
) {
  return listReviewsForSubject(tutorUserId, ReviewSubjectRole.TUTOR, options);
}

/** Same revealed-only review listing as listTutorReviews, generalised to
 * any subject role — a student/parent's booking-gated profile reuses this
 * for reviews left about them, not just a tutor's public profile.
 *
 * Soft-removed reviews (deletedAt set, via a moderator's REMOVED report
 * action) deliberately stay IN this list rather than being filtered out —
 * REQ-017-008 requires a replacement notice in their place, not silent
 * disappearance. The rating snapshot's own query has a separate
 * deletedAt:null filter and is unaffected by this. */
async function listReviewsForSubject(
  subjectUserId: string,
  subjectRole: ReviewSubjectRole,
  options: ListReviewsOptions
) {
  const { cursor, limit, sort = "newest", rating, wouldRebook } = options;

  const where: any = {
    subjectId: subjectUserId,
    subjectRole,
    status: ReviewStatus.REVEALED,
  };
  if (rating !== undefined) where.overallRating = rating;
  if (wouldRebook !== undefined) where.wouldRebook = wouldRebook;

  const rows = await prisma.review.findMany({
    where,
    orderBy: SORT_ORDER_BY[sort],
    ...(cursor && { cursor: { id: cursor }, skip: 1 }),
    take: limit + 1,
    select: {
      id: true,
      overallRating: true,
      wouldRebook: true,
      ratingSubjectKnowledge: true,
      ratingCommunication: true,
      ratingPunctuality: true,
      writtenReview: true,
      authorRole: true,
      tutorResponse: true,
      tutorResponseAt: true,
      revealedAt: true,
      createdAt: true,
      deletedAt: true,
      author: {
        select: { firstName: true, profilePictureUrl: true },
      },
    },
  });

  const hasNextPage = rows.length > limit;
  const page = hasNextPage ? rows.slice(0, limit) : rows;

  const data = page.map(({ deletedAt, author, ...row }) => {
    const resolvedAuthor = author
      ? { firstName: author.firstName, profilePictureUrl: resolveStorageUrl(author.profilePictureUrl) }
      : null;
    return deletedAt
      ? { ...row, author: resolvedAuthor, writtenReview: null, tutorResponse: null, tutorResponseAt: null, removed: true }
      : { ...row, author: resolvedAuthor, removed: false };
  });

  return {
    data,
    meta: {
      nextCursor: hasNextPage ? page[page.length - 1].id : null,
      hasNextPage,
      limit,
    },
  };
}

async function respondToReview(
  tutorUserId: string,
  reviewId: string,
  response: string
) {
  const review = await prisma.review.findUnique({
    where: { id: reviewId, deletedAt: null },
  });
  if (!review)
    throw new AppError("review/errors:reviewNotFound", StatusCodes.NOT_FOUND);
  if (
    review.subjectId !== tutorUserId ||
    review.subjectRole !== ReviewSubjectRole.TUTOR
  ) {
    throw new AppError("review/errors:notYourReview", StatusCodes.FORBIDDEN);
  }
  if (review.tutorResponse)
    throw new AppError("review/errors:alreadyResponded", StatusCodes.CONFLICT);

  // REQ-017-007 — Module 15 Layer 1/2 content filter on review responses,
  // same as messaging (messaging.service.ts) — no Layer 3 intent-keyword
  // pass here (empty keyword list), that layer is specific to conversation
  // off-platform-contact patterns, not reviewer/tutor commentary.
  const outcome = filterMessage(response, []);
  if (outcome.result !== "CLEAN") {
    throw new AppError("review/errors:responseBlocked", StatusCodes.BAD_REQUEST, {
      result: outcome.result,
    });
  }

  return prisma.review.update({
    where: { id: reviewId },
    data: { tutorResponse: response, tutorResponseAt: new Date() },
  });
}

// ── REQ-017-008 — review reporting & moderation ──

async function reportReview(
  reporterId: string,
  reviewId: string,
  reason: ReportReason,
  description: string | undefined,
  ctx: ServiceContext
) {
  const review = await prisma.review.findUnique({ where: { id: reviewId } });
  if (!review)
    throw new AppError("review/errors:reviewNotFound", StatusCodes.NOT_FOUND);

  let report;
  try {
    report = await prisma.reviewReport.create({
      data: { reviewId, reportedById: reporterId, reason, description },
    });
  } catch (err: any) {
    if (err?.code === "P2002") {
      throw new AppError("review/errors:alreadyReported", StatusCodes.CONFLICT);
    }
    throw err;
  }

  AuditService.record(ctx, "review_reports", {
    operation: "CREATE" as any,
    category: "WRITE" as any,
    recordId: report.id,
    newState: { reviewId, reason },
    eventType: "review_reported",
  });

  // REQ-017-008 — a Tutor reporting more than 5 reviews in 30 days is
  // flagged in Trust & Safety. This platform has no single user.role field —
  // "is a tutor" is determined by TutorProfile existence, same check used
  // in user.service.ts's getBookerProfile.
  const reporterTutorProfile = await prisma.tutorProfile.findFirst({
    where: { userId: reporterId, deletedAt: null },
    select: { id: true },
  });
  if (reporterTutorProfile) {
    const windowStart = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const recentReportCount = await prisma.reviewReport.count({
      where: { reportedById: reporterId, createdAt: { gte: windowStart } },
    });
    if (
      recentReportCount > 5 &&
      !(await hasRecentSignal(reporterId, "TUTOR_REPORTING_EXCESSIVE_REVIEWS", windowStart))
    ) {
      await TrustSafetyService.recordSignal({
        userId: reporterId,
        signalType: "TUTOR_REPORTING_EXCESSIVE_REVIEWS",
        pointsApplied: 15,
        sourceModule: "REVIEWS",
        sourceRecordId: report.id,
        sourceRecordType: "ReviewReport",
        requiresHumanReview: true,
      });
    }
  }

  return { id: report.id };
}

async function listReviewReports(
  status: ReviewReportStatus | undefined,
  cursor: string | undefined,
  limit: number
) {
  const where: any = {};
  if (status) where.status = status;

  const rows = await prisma.reviewReport.findMany({
    where,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    ...(cursor && { cursor: { id: cursor }, skip: 1 }),
    take: limit + 1,
    include: {
      review: {
        select: {
          id: true,
          overallRating: true,
          writtenReview: true,
          deletedAt: true,
          author: { select: { id: true, firstName: true, lastName: true } },
          subject: { select: { id: true, firstName: true, lastName: true } },
        },
      },
      reportedBy: { select: { id: true, firstName: true, lastName: true } },
    },
  });

  const hasNextPage = rows.length > limit;
  const page = hasNextPage ? rows.slice(0, limit) : rows;

  return {
    data: page,
    meta: {
      nextCursor: hasNextPage ? page[page.length - 1].id : null,
      hasNextPage,
      limit,
    },
  };
}

async function reviewReportAction(
  reportId: string,
  moderatorId: string,
  status: "DISMISSED" | "REMOVED" | "ESCALATED",
  reviewNote: string | undefined,
  ctx: ServiceContext
) {
  const report = await prisma.reviewReport.findUnique({
    where: { id: reportId },
    include: { review: true },
  });
  if (!report)
    throw new AppError("review/errors:reportNotFound", StatusCodes.NOT_FOUND);

  const updated = await prisma.reviewReport.update({
    where: { id: reportId },
    data: { status, reviewedById: moderatorId, reviewedAt: new Date(), reviewNote },
  });

  if (status === "REMOVED" && !report.review.deletedAt) {
    await prisma.review.update({
      where: { id: report.reviewId },
      data: {
        deletedAt: new Date(),
        deletedById: moderatorId,
        deletionReason: reviewNote ?? "Removed by moderator",
      },
    });

    if (report.review.subjectRole === ReviewSubjectRole.TUTOR) {
      await recomputeTutorRatingSnapshot(report.review.subjectId);
    }

    await NotificationService.send({
      type: NotificationType.REVIEW_REMOVED,
      target: { kind: "user", userId: report.review.authorId },
      resourceType: NotificationResourceType.REVIEW,
      resourceId: report.review.id,
    });

    await TrustSafetyService.recordSignal({
      userId: report.review.authorId,
      signalType: "REVIEW_REMOVED_BY_MODERATOR",
      pointsApplied: 20,
      sourceModule: "REVIEWS",
      sourceRecordId: report.review.id,
      sourceRecordType: "Review",
      performedById: moderatorId,
    });

    // REQ-017-010 — a 3rd+ review removal for the same account is its own,
    // separate fraud cluster signal on top of the flat per-removal one above.
    const removalCount = await prisma.review.count({
      where: { authorId: report.review.authorId, deletedAt: { not: null } },
    });
    if (removalCount >= 3) {
      const alreadyFlagged = await prisma.reviewFraudSignal.findFirst({
        where: { subjectUserId: report.review.authorId, signalType: ReviewFraudSignalType.EXCESSIVE_REMOVALS_BY_ACCOUNT },
      });
      if (!alreadyFlagged) {
        await prisma.reviewFraudSignal.create({
          data: {
            signalType: ReviewFraudSignalType.EXCESSIVE_REMOVALS_BY_ACCOUNT,
            subjectUserId: report.review.authorId,
            reviewIds: [report.review.id],
            detectionWindowHours: 0,
          },
        });
        // Reasoned default — SRS's point table doesn't give this specific
        // cluster case a number; set above the flat per-removal signal
        // since it reflects a repeated pattern, below the 24h burst signal.
        await TrustSafetyService.recordSignal({
          userId: report.review.authorId,
          signalType: "EXCESSIVE_REMOVALS_BY_ACCOUNT",
          pointsApplied: 30,
          sourceModule: "REVIEWS",
          sourceRecordId: report.review.id,
          sourceRecordType: "Review",
          requiresHumanReview: true,
        });
      }
    }
  }

  AuditService.record(ctx, "review_reports", {
    operation: "UPDATE" as any,
    category: "WRITE" as any,
    recordId: reportId,
    previousState: { status: report.status },
    newState: { status: updated.status },
    eventType: "review_report_reviewed",
  });

  return updated;
}

// ── REQ-017-009 — incident reporting ──

/** Read-only, permanent evidence package assembled once at incident-report
 * creation time — mirrors dispute.service.ts's assembleEvidenceSnapshot,
 * minus the dispute-only recommendation/history fields. */
async function assembleIncidentEvidenceSnapshot(bookingId: string) {
  const startedAt = Date.now();

  const [booking, conversation, liveRoom, lessonConfirmation] = await Promise.all([
    prisma.booking.findUniqueOrThrow({ where: { id: bookingId } }),
    prisma.conversation.findFirst({
      where: { bookingId },
      include: { messages: { orderBy: { createdAt: "asc" } } },
    }),
    prisma.liveRoom.findUnique({
      where: { bookingId },
      include: { chatMessages: { orderBy: { createdAt: "asc" } } },
    }),
    prisma.lessonConfirmation.findUnique({ where: { bookingId } }),
  ]);

  return {
    bookingSnapshot: booking as any,
    sessionDataSnapshot: (lessonConfirmation?.sessionDataSnapshot ?? {}) as any,
    conversationSnapshot: (conversation?.messages ?? []) as any,
    sessionChatSnapshot: (liveRoom?.chatMessages ?? []) as any,
    assemblyDurationMs: Date.now() - startedAt,
  };
}

async function submitIncidentReport(
  reporterId: string,
  bookingId: string,
  reason: IncidentReason,
  description: string,
  ctx: ServiceContext
) {
  const booking = await prisma.booking.findFirst({
    where: { id: bookingId, deletedAt: null },
    include: { tutorProfile: { select: { userId: true } } },
  });
  if (!booking)
    throw new AppError("booking/errors:bookingNotFound", StatusCodes.NOT_FOUND);
  if (!SESSION_OCCURRED_STATUSES.includes(booking.status)) {
    throw new AppError("review/errors:notEligibleForIncidentReport", StatusCodes.BAD_REQUEST);
  }

  const { subjectId, subjectRole, isBooker } = await resolveRoleForUser(
    bookingId,
    reporterId,
    booking.bookerId,
    booking.tutorProfile.userId
  );

  // The IncidentReportType enum only distinguishes the booker->tutor
  // direction once (PARENT_REPORTING_TUTOR covers both a parent and a
  // self-registered student reporting a tutor); the tutor->booker
  // direction is the one that sub-divides by the booker's role.
  const reportType = isBooker
    ? IncidentReportType.PARENT_REPORTING_TUTOR
    : subjectRole === ReviewSubjectRole.STUDENT
      ? IncidentReportType.TUTOR_REPORTING_STUDENT
      : IncidentReportType.TUTOR_REPORTING_PARENT;

  const snapshot = await assembleIncidentEvidenceSnapshot(bookingId);

  const report = await prisma.$transaction(async (tx) => {
    const created = await tx.incidentReport.create({
      data: {
        bookingId,
        reportedById: reporterId,
        reportedAgainstId: subjectId,
        reportType,
        reason,
        description,
      },
    });
    await tx.incidentReportEvidenceSnapshot.create({
      data: { incidentReportId: created.id, ...snapshot },
    });
    return created;
  });

  // REQ-017-009 explicitly does not freeze escrow or touch booking.status —
  // no EscrowService import/call anywhere in this module by design.
  await TrustSafetyService.recordSignal({
    userId: subjectId,
    signalType: "INCIDENT_REPORT_FILED_AGAINST_ACCOUNT",
    pointsApplied: 15,
    sourceModule: "REVIEWS",
    sourceRecordId: report.id,
    sourceRecordType: "IncidentReport",
  });

  AuditService.record(ctx, "incident_reports", {
    operation: "CREATE" as any,
    category: "WRITE" as any,
    recordId: report.id,
    newState: { bookingId, reportType, reason },
    eventType: "incident_report_filed",
  });

  return report;
}

async function listIncidentReports(
  bookingId: string | undefined,
  reviewed: boolean | undefined,
  cursor: string | undefined,
  limit: number
) {
  const where: any = {};
  if (bookingId) where.bookingId = bookingId;
  if (reviewed !== undefined) where.reviewedAt = reviewed ? { not: null } : null;

  const rows = await prisma.incidentReport.findMany({
    where,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    ...(cursor && { cursor: { id: cursor }, skip: 1 }),
    take: limit + 1,
    include: {
      booking: { select: { id: true, sessionDate: true, status: true } },
      reportedBy: { select: { id: true, firstName: true, lastName: true } },
      reportedAgainst: { select: { id: true, firstName: true, lastName: true } },
    },
  });

  const hasNextPage = rows.length > limit;
  const page = hasNextPage ? rows.slice(0, limit) : rows;

  return {
    data: page,
    meta: {
      nextCursor: hasNextPage ? page[page.length - 1].id : null,
      hasNextPage,
      limit,
    },
  };
}

async function getIncidentReportDetail(id: string) {
  const report = await prisma.incidentReport.findUnique({
    where: { id },
    include: {
      booking: true,
      reportedBy: { select: { id: true, firstName: true, lastName: true } },
      reportedAgainst: { select: { id: true, firstName: true, lastName: true } },
      reviewedBy: { select: { id: true, firstName: true, lastName: true } },
      evidenceSnapshot: true,
    },
  });
  if (!report)
    throw new AppError("review/errors:incidentNotFound", StatusCodes.NOT_FOUND);
  return report;
}

async function reviewIncidentReport(
  id: string,
  moderatorId: string,
  reviewNote: string | undefined,
  actionTaken: string | undefined,
  ctx: ServiceContext
) {
  const report = await prisma.incidentReport.findUnique({ where: { id } });
  if (!report)
    throw new AppError("review/errors:incidentNotFound", StatusCodes.NOT_FOUND);

  const updated = await prisma.incidentReport.update({
    where: { id },
    data: { reviewedById: moderatorId, reviewedAt: new Date(), reviewNote, actionTaken },
  });

  AuditService.record(ctx, "incident_reports", {
    operation: "UPDATE" as any,
    category: "WRITE" as any,
    recordId: id,
    previousState: { reviewedAt: report.reviewedAt },
    newState: { reviewedAt: updated.reviewedAt, actionTaken },
    eventType: "incident_report_reviewed",
  });

  return updated;
}

// Exported individually (alongside the aggregate ReviewService below) so
// unit tests can exercise the fraud-detection counting logic directly
// without going through the full submitReview pipeline.
export { checkReviewFraudSignals };

export const ReviewService = {
  submitReview,
  listTutorReviews,
  listTutorReviewsByProfile,
  listReviewsForSubject,
  respondToReview,
  reportReview,
  listReviewReports,
  reviewReportAction,
  submitIncidentReport,
  listIncidentReports,
  getIncidentReportDetail,
  reviewIncidentReport,
};
export default ReviewService;
