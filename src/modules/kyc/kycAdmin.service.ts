import prisma from "../../config/database.config";
import redis from "../../config/redis.config";
import { AppError } from "../../utils/AppError.util";
import { StatusCodes } from "http-status-codes";
import {
  KycStatus,
  CredentialStatus,
  SubjectVerificationStatus,
  BookingStatus,
  NotificationType,
  NotificationResourceType,
  SpotCheckVerdict,
  ConfigCategory,
  LogOperation,
  LogCategory,
} from "../../generated/prisma";
import { ServiceContext } from "../../base/base.types";
import { AuditService } from "../../utils/logUserActivity.util";
import { assertValidTransition } from "../../services/kyc/kycStateMachine";
import { scoreSubjectClaim } from "../../services/kyc/kycScoring";
import NotificationService from "../../services/notification/notification.service";
import { permissions } from "../../data/permission.data";
import AdminUserService from "../adminUser/adminUser.service";
import {
  KycChecklistInput,
  KycRejectInput,
  ApproveSubjectInput,
  ReviewCredentialInput,
  SpotCheckVerdictInput,
  KycSlaConfigInput,
} from "./kyc.types";

const REVIEW_OPEN_KEY_PREFIX = "kyc:review:opened:";
const REVIEW_OPEN_TTL_SECONDS = 60 * 60; // an admin has an hour to act after opening
const SPOT_CHECK_REVIEW_TIME_THRESHOLD_SECONDS = 90;
const BAD_APPROVAL_COUNTERSIGNATURE_THRESHOLD = 3;
const BAD_APPROVAL_WINDOW_DAYS = 30;

const SLA_TARGET_HOURS_KEY = "kyc.sla_target_hours";
const SLA_MAX_BUSINESS_DAYS_KEY = "kyc.sla_max_business_days";
const DEFAULT_SLA_TARGET_HOURS = 48;
const DEFAULT_SLA_MAX_BUSINESS_DAYS = 5;

function addBusinessDays(from: Date, days: number): Date {
  const result = new Date(from);
  let added = 0;
  while (added < days) {
    result.setDate(result.getDate() + 1);
    const day = result.getDay();
    if (day !== 0 && day !== 6) added++;
  }
  return result;
}

async function getSlaConfig(): Promise<{ targetHours: number; maxBusinessDays: number }> {
  const rows = await prisma.platformConfig.findMany({
    where: { key: { in: [SLA_TARGET_HOURS_KEY, SLA_MAX_BUSINESS_DAYS_KEY] } },
  });
  const targetHours =
    (rows.find((r) => r.key === SLA_TARGET_HOURS_KEY)?.value as number) ??
    DEFAULT_SLA_TARGET_HOURS;
  const maxBusinessDays =
    (rows.find((r) => r.key === SLA_MAX_BUSINESS_DAYS_KEY)?.value as number) ??
    DEFAULT_SLA_MAX_BUSINESS_DAYS;
  return { targetHours, maxBusinessDays };
}

async function findTutorProfileOrThrow(tutorProfileId: string) {
  const profile = await prisma.tutorProfile.findUnique({
    where: { id: tutorProfileId },
    select: { id: true, userId: true, kycStatus: true },
  });
  if (!profile) {
    throw new AppError("kyc/errors:tutorProfileNotFound", StatusCodes.NOT_FOUND);
  }
  return profile;
}

/**
 * Shared consequence of a tutor leaving the platform (ban or suspend):
 * hide the profile (kycStatus already does this wherever public queries
 * filter on it), auto-cancel unpaid pending bookings with a parent
 * notification, and flag already-paid bookings for manual admin handling
 * — no funds move automatically.
 */
async function handleTutorRemovalFromPlatform(
  tutorProfileId: string,
  ctx: ServiceContext
): Promise<void> {
  const pendingBookings = await prisma.booking.findMany({
    where: {
      tutorProfileId,
      status: { in: [BookingStatus.REQUESTED, BookingStatus.ACCEPTED] },
    },
    select: { id: true, bookerId: true },
  });

  for (const booking of pendingBookings) {
    await prisma.booking.update({
      where: { id: booking.id },
      data: {
        status: BookingStatus.CANCELLED_BY_TUTOR,
        cancelledById: ctx.userId,
        cancelledAt: new Date(),
        cancellationReason: "Tutor removed from platform",
      },
    });
    if (booking.bookerId) {
      await NotificationService.send({
        type: NotificationType.BOOKING_CANCELLED_BY_TUTOR,
        target: { kind: "user", userId: booking.bookerId },
        resourceType: NotificationResourceType.BOOKING,
        resourceId: booking.id,
      }).catch(() => {});
    }
  }

  const paidBookings = await prisma.booking.findMany({
    where: {
      tutorProfileId,
      status: {
        in: [
          BookingStatus.PAID,
          BookingStatus.IN_PROGRESS,
          BookingStatus.AWAITING_CONFIRMATION,
          BookingStatus.CONFIRMED,
        ],
      },
    },
    select: { id: true },
  });

  if (paidBookings.length > 0) {
    await NotificationService.send({
      type: NotificationType.ADMIN_REVIEW_REQUIRED,
      target: { kind: "permission", permissionCode: permissions.bookings.manage },
      resourceType: NotificationResourceType.BOOKING,
      data: {
        reviewReason: "tutor_removed_with_paid_bookings",
        tutorProfileId,
        bookingIds: paidBookings.map((b) => b.id),
      },
    }).catch(() => {});
  }
}

async function recomputeCountersignatureRequirement(adminId: string): Promise<void> {
  const since = new Date(Date.now() - BAD_APPROVAL_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const badCount = await prisma.kycSpotCheckReview.count({
    where: {
      verdict: SpotCheckVerdict.BAD,
      reviewedAt: { gte: since },
      kycStatusHistory: { changedById: adminId },
    },
  });

  const requiresCountersignature = badCount > BAD_APPROVAL_COUNTERSIGNATURE_THRESHOLD;
  const admin = await prisma.user.findUnique({
    where: { id: adminId },
    select: { kycCountersignatureRequired: true },
  });

  if (admin && admin.kycCountersignatureRequired !== requiresCountersignature) {
    await prisma.user.update({
      where: { id: adminId },
      data: { kycCountersignatureRequired: requiresCountersignature },
    });
    if (requiresCountersignature) {
      await NotificationService.send({
        type: NotificationType.ACCOUNT_FLAGGED,
        target: { kind: "user", userId: adminId },
        data: { reason: "kyc_bad_approvals_threshold_exceeded", badCount },
      }).catch(() => {});
    }
  }
}

export const KycAdminService = {
  async getQueue() {
    const { maxBusinessDays } = await getSlaConfig();
    const applications = await prisma.kycApplication.findMany({
      where: {
        deletedAt: null,
        tutorProfile: { kycStatus: KycStatus.PENDING },
        currentStep: "SUBMITTED",
      },
      include: { tutorProfile: { select: { id: true, kycSubmittedAt: true, userId: true } } },
      orderBy: { updatedAt: "asc" },
    });

    return applications.map((app) => {
      const submittedAt = app.tutorProfile.kycSubmittedAt ?? app.updatedAt;
      const escalationDeadline = addBusinessDays(submittedAt, maxBusinessDays);
      return {
        ...app,
        isEscalated: new Date() > escalationDeadline,
        escalationDeadline,
      };
    });
  },

  /** Records when an admin first opens this application — the clock the
   * 60-second-disabled-approve-button and review-duration governance both
   * run against. Idempotent: only the first open per application counts. */
  async recordReviewOpened(applicationId: string, adminId: string): Promise<void> {
    const key = `${REVIEW_OPEN_KEY_PREFIX}${applicationId}:${adminId}`;
    const existing = await redis.get(key);
    if (!existing) {
      await redis.set(key, String(Date.now()), { EX: REVIEW_OPEN_TTL_SECONDS });
    }
  },

  async getApplicationDetail(applicationId: string, adminId: string) {
    const application = await prisma.kycApplication.findUnique({
      where: { id: applicationId },
      include: {
        cniFrontPhoto: true,
        cniBackPhoto: true,
        selfieWithCni: true,
        nonConvictionCertificate: true,
        cvFile: true,
        currentCity: true,
        currentRegion: true,
        tutorProfile: { select: { id: true, kycStatus: true, userId: true } },
      },
    });
    if (!application) {
      throw new AppError("kyc/errors:applicationNotFound", StatusCodes.NOT_FOUND);
    }

    await KycAdminService.recordReviewOpened(applicationId, adminId);

    const credentials = await prisma.tutorCredential.findMany({
      where: { tutorProfileId: application.tutorProfileId },
      include: { subjectLinks: { include: { subject: true } } },
    });

    const previousRejections = await prisma.kycRejectionFlag.findMany({
      where: { kycApplication: { tutorProfileId: application.tutorProfileId } },
      orderBy: { createdAt: "desc" },
    });

    return { application, credentials, previousRejections };
  },

  async approveIdentity(
    applicationId: string,
    adminId: string,
    checklist: KycChecklistInput,
    ctx: ServiceContext
  ) {
    const allChecked = Object.values(checklist).every(Boolean);
    if (!allChecked) {
      throw new AppError("kyc/errors:checklistIncomplete", StatusCodes.BAD_REQUEST);
    }

    const application = await prisma.kycApplication.findUnique({
      where: { id: applicationId },
      include: { tutorProfile: { select: { id: true, kycStatus: true, userId: true } } },
    });
    if (!application) {
      throw new AppError("kyc/errors:applicationNotFound", StatusCodes.NOT_FOUND);
    }
    assertValidTransition(application.tutorProfile.kycStatus, KycStatus.IDENTITY_APPROVED);

    const reviewDurationSeconds = await KycAdminService.computeReviewDuration(
      applicationId,
      adminId
    );
    const flaggedForSpotCheck =
      reviewDurationSeconds < SPOT_CHECK_REVIEW_TIME_THRESHOLD_SECONDS;

    const history = await prisma.$transaction(async (tx) => {
      const historyRow = await tx.kycStatusHistory.create({
        data: {
          kycApplicationId: applicationId,
          tutorProfileId: application.tutorProfileId,
          previousStatus: application.tutorProfile.kycStatus,
          newStatus: KycStatus.IDENTITY_APPROVED,
          changedById: adminId,
          reviewDurationSeconds,
          checklistCompleted: true,
          flaggedForSpotCheck,
        },
      });

      await tx.kycChecklistSubmission.create({
        data: {
          kycApplicationId: applicationId,
          kycStatusHistoryId: historyRow.id,
          reviewedById: adminId,
          ...checklist,
          reviewOpenedAt: new Date(Date.now() - reviewDurationSeconds * 1000),
        },
      });

      await tx.tutorProfile.update({
        where: { id: application.tutorProfileId },
        data: { kycStatus: KycStatus.IDENTITY_APPROVED, kycApprovedAt: new Date() },
      });

      return historyRow;
    });

    AuditService.record(ctx, "tutor_profiles", {
      operation: LogOperation.APPROVE,
      category: LogCategory.SENSITIVE_READ,
      recordId: application.tutorProfileId,
      newState: { kycStatus: "IDENTITY_APPROVED" },
      changedFields: ["kycStatus"],
      eventType: "kyc.identity_approved",
    });

    await NotificationService.send({
      type: NotificationType.KYC_IDENTITY_APPROVED,
      target: { kind: "user", userId: application.tutorProfile.userId },
      resourceType: NotificationResourceType.KYC,
      resourceId: applicationId,
    }).catch(() => {});

    return history;
  },

  async rejectApplication(
    applicationId: string,
    adminId: string,
    input: KycRejectInput,
    ctx: ServiceContext
  ) {
    const application = await prisma.kycApplication.findUnique({
      where: { id: applicationId },
      include: { tutorProfile: { select: { id: true, kycStatus: true, userId: true } } },
    });
    if (!application) {
      throw new AppError("kyc/errors:applicationNotFound", StatusCodes.NOT_FOUND);
    }
    assertValidTransition(application.tutorProfile.kycStatus, KycStatus.REJECTED);

    const reviewDurationSeconds = await KycAdminService.computeReviewDuration(
      applicationId,
      adminId
    );

    const history = await prisma.$transaction(async (tx) => {
      const historyRow = await tx.kycStatusHistory.create({
        data: {
          kycApplicationId: applicationId,
          tutorProfileId: application.tutorProfileId,
          previousStatus: application.tutorProfile.kycStatus,
          newStatus: KycStatus.REJECTED,
          changedById: adminId,
          reviewDurationSeconds,
        },
      });

      await tx.kycRejectionFlag.createMany({
        data: input.flags.map((flag) => ({
          kycApplicationId: applicationId,
          kycStatusHistoryId: historyRow.id,
          flagItem: flag.flagItem,
          reason: flag.reason,
          adminMessage: flag.adminMessage,
        })),
      });

      await tx.tutorProfile.update({
        where: { id: application.tutorProfileId },
        data: {
          kycStatus: KycStatus.REJECTED,
          kycRejectedAt: new Date(),
          kycRejectionReason: input.flags.map((f) => f.reason).join("; "),
        },
      });

      return historyRow;
    });

    AuditService.record(ctx, "tutor_profiles", {
      operation: LogOperation.REJECT,
      category: LogCategory.SENSITIVE_READ,
      recordId: application.tutorProfileId,
      newState: { kycStatus: "REJECTED" },
      changedFields: ["kycStatus"],
      eventType: "kyc.rejected",
    });

    await NotificationService.send({
      type: NotificationType.KYC_REJECTED,
      target: { kind: "user", userId: application.tutorProfile.userId },
      resourceType: NotificationResourceType.KYC,
      resourceId: applicationId,
      data: { flags: input.flags },
    }).catch(() => {});

    return history;
  },

  async computeReviewDuration(applicationId: string, adminId: string): Promise<number> {
    const key = `${REVIEW_OPEN_KEY_PREFIX}${applicationId}:${adminId}`;
    const openedAtRaw = await redis.get(key);
    if (!openedAtRaw) return 0;
    return Math.max(0, Math.round((Date.now() - Number(openedAtRaw)) / 1000));
  },

  // ── Subjects ────────────────────────────────────────────────

  async getSubjectQueue() {
    const subjects = await prisma.tutorSubject.findMany({
      where: { status: SubjectVerificationStatus.PENDING },
      include: {
        subject: true,
        tutorProfile: { select: { id: true, userId: true } },
      },
      orderBy: { createdAt: "asc" },
    });

    const weights = await prisma.subjectRelationshipWeight.findMany();

    const scored = await Promise.all(
      subjects.map(async (ts) => {
        const credentials = await prisma.tutorCredential.findMany({
          where: {
            tutorProfileId: ts.tutorProfileId,
            subjectLinks: { some: { subjectId: ts.subjectId } },
          },
          select: { qualificationType: true, fieldOfStudy: true },
        });

        const result = scoreSubjectClaim(
          credentials,
          weights
            .filter((w) => w.subjectId === ts.subjectId)
            .map((w) => ({
              qualificationType: w.qualificationType,
              fieldOfStudy: w.fieldOfStudy,
              confidenceWeight: w.confidenceWeight,
            }))
        );

        return { tutorSubject: ts, ...result };
      })
    );

    return {
      recommendApprove: scored.filter((s) => s.section === "RECOMMEND_APPROVE"),
      recommendReview: scored.filter((s) => s.section === "RECOMMEND_REVIEW"),
      newDocumentationRequired: scored.filter(
        (s) => s.section === "NEW_DOCUMENTATION_REQUIRED"
      ),
    };
  },

  async approveSubject(
    tutorSubjectId: string,
    adminId: string,
    input: ApproveSubjectInput,
    ctx: ServiceContext
  ) {
    const tutorSubject = await prisma.tutorSubject.findUnique({
      where: { id: tutorSubjectId },
      include: { tutorProfile: { select: { id: true, userId: true, kycStatus: true } } },
    });
    if (!tutorSubject) {
      throw new AppError("kyc/errors:subjectNotFound", StatusCodes.NOT_FOUND);
    }

    await prisma.tutorSubject.update({
      where: { id: tutorSubjectId },
      data: {
        status: SubjectVerificationStatus.APPROVED,
        approvedById: adminId,
        approvedAt: new Date(),
      },
    });

    // Train the inference engine when an admin approves a below-threshold
    // (or previously-untrained) match — this is what teaches the scoring
    // engine for the next tutor with the same credential/subject pairing.
    if (input.trainWeight !== undefined) {
      const credential = await prisma.tutorCredential.findFirst({
        where: {
          tutorProfileId: tutorSubject.tutorProfileId,
          subjectLinks: { some: { subjectId: tutorSubject.subjectId } },
        },
        select: { qualificationType: true, fieldOfStudy: true },
      });
      if (credential) {
        await prisma.subjectRelationshipWeight.upsert({
          where: {
            qualificationType_fieldOfStudy_subjectId: {
              qualificationType: credential.qualificationType,
              fieldOfStudy: credential.fieldOfStudy,
              subjectId: tutorSubject.subjectId,
            },
          },
          create: {
            qualificationType: credential.qualificationType,
            fieldOfStudy: credential.fieldOfStudy,
            subjectId: tutorSubject.subjectId,
            confidenceWeight: input.trainWeight,
            setById: adminId,
          },
          update: { confidenceWeight: input.trainWeight, setById: adminId, setAt: new Date() },
        });

        AuditService.record(ctx, "subject_relationship_weights", {
          operation: LogOperation.UPDATE,
          category: LogCategory.WRITE,
          recordId: tutorSubject.subjectId,
          newState: { confidenceWeight: input.trainWeight },
          changedFields: ["confidenceWeight"],
          eventType: "kyc.inference_weight_trained",
        });
      }
    }

    // First approved subject while identity is already approved activates
    // the tutor — subject approvals never affect an already-ACTIVE tutor.
    if (tutorSubject.tutorProfile.kycStatus === KycStatus.IDENTITY_APPROVED) {
      assertValidTransition(KycStatus.IDENTITY_APPROVED, KycStatus.ACTIVE);
      await prisma.tutorProfile.update({
        where: { id: tutorSubject.tutorProfileId },
        data: { kycStatus: KycStatus.ACTIVE },
      });
      await NotificationService.send({
        type: NotificationType.KYC_APPROVED,
        target: { kind: "user", userId: tutorSubject.tutorProfile.userId },
        resourceType: NotificationResourceType.KYC,
      }).catch(() => {});
    }

    AuditService.record(ctx, "tutor_subjects", {
      operation: LogOperation.APPROVE,
      category: LogCategory.WRITE,
      recordId: tutorSubjectId,
      newState: { status: "APPROVED" },
      changedFields: ["status"],
      eventType: "kyc.subject_approved",
    });

    return prisma.tutorSubject.findUniqueOrThrow({ where: { id: tutorSubjectId } });
  },

  async rejectSubject(
    tutorSubjectId: string,
    adminId: string,
    reason: string,
    ctx: ServiceContext
  ) {
    const tutorSubject = await prisma.tutorSubject.findUnique({
      where: { id: tutorSubjectId },
      include: { tutorProfile: { select: { userId: true } } },
    });
    if (!tutorSubject) {
      throw new AppError("kyc/errors:subjectNotFound", StatusCodes.NOT_FOUND);
    }

    // Rejecting one subject never touches any other subject's status —
    // this is a single-row update, no cascading changes to siblings.
    await prisma.tutorSubject.update({
      where: { id: tutorSubjectId },
      data: { status: SubjectVerificationStatus.REJECTED, rejectedReason: reason },
    });

    AuditService.record(ctx, "tutor_subjects", {
      operation: LogOperation.REJECT,
      category: LogCategory.WRITE,
      recordId: tutorSubjectId,
      newState: { status: "REJECTED", reason },
      changedFields: ["status"],
      eventType: "kyc.subject_rejected",
    });

    await NotificationService.send({
      type: NotificationType.KYC_REJECTED,
      target: { kind: "user", userId: tutorSubject.tutorProfile.userId },
      resourceType: NotificationResourceType.KYC,
      data: { subjectRejection: true, reason },
    }).catch(() => {});

    return tutorSubject;
  },

  async reviewCredential(
    credentialId: string,
    adminId: string,
    input: ReviewCredentialInput,
    ctx: ServiceContext
  ) {
    const credential = await prisma.tutorCredential.findUnique({
      where: { id: credentialId },
      include: { subjectLinks: true },
    });
    if (!credential) {
      throw new AppError("kyc/errors:credentialNotFound", StatusCodes.NOT_FOUND);
    }

    const isRevocation =
      credential.status === CredentialStatus.APPROVED &&
      input.decision === CredentialStatus.REJECTED;

    await prisma.tutorCredential.update({
      where: { id: credentialId },
      data: {
        status: input.decision,
        reviewedById: adminId,
        reviewedAt: new Date(),
        rejectionReason: input.decision === "REJECTED" ? input.reason : null,
      },
    });

    if (isRevocation) {
      // "Subjects backed SOLELY by this credential" — demote only the
      // subjects that have no other approved credential still covering them.
      for (const link of credential.subjectLinks) {
        const stillCovered = await prisma.credentialSubjectLink.findFirst({
          where: {
            subjectId: link.subjectId,
            credentialId: { not: credentialId },
            credential: {
              tutorProfileId: credential.tutorProfileId,
              status: CredentialStatus.APPROVED,
            },
          },
        });
        if (!stillCovered) {
          await prisma.tutorSubject.updateMany({
            where: { tutorProfileId: credential.tutorProfileId, subjectId: link.subjectId },
            data: {
              status: SubjectVerificationStatus.PENDING,
              approvedById: null,
              approvedAt: null,
            },
          });
        }
      }
    }

    AuditService.record(ctx, "tutor_credentials", {
      operation: input.decision === "APPROVED" ? LogOperation.APPROVE : LogOperation.REJECT,
      category: LogCategory.WRITE,
      recordId: credentialId,
      newState: { status: input.decision },
      changedFields: ["status"],
      eventType: isRevocation ? "kyc.credential_revoked" : "kyc.credential_reviewed",
    });

    return prisma.tutorCredential.findUniqueOrThrow({ where: { id: credentialId } });
  },

  // ── Ban / suspend ────────────────────────────────────────────

  async banTutor(tutorProfileId: string, reason: string, ctx: ServiceContext) {
    const profile = await findTutorProfileOrThrow(tutorProfileId);
    assertValidTransition(profile.kycStatus, KycStatus.BANNED);

    await prisma.$transaction([
      prisma.kycBan.create({
        data: { tutorProfileId, bannedById: ctx.userId!, reason },
      }),
      prisma.tutorProfile.update({
        where: { id: tutorProfileId },
        data: { kycStatus: KycStatus.BANNED },
      }),
      prisma.kycStatusHistory.create({
        data: {
          kycApplicationId: (await prisma.kycApplication.findFirstOrThrow({
            where: { tutorProfileId },
            orderBy: { version: "desc" },
            select: { id: true },
          })).id,
          tutorProfileId,
          previousStatus: profile.kycStatus,
          newStatus: KycStatus.BANNED,
          changedById: ctx.userId!,
          reason,
        },
      }),
    ]);

    await AdminUserService.suspendUser(profile.userId, reason, ctx).catch(() => {});
    await handleTutorRemovalFromPlatform(tutorProfileId, ctx);

    AuditService.record(ctx, "tutor_profiles", {
      operation: LogOperation.BAN,
      category: LogCategory.SENSITIVE_READ,
      recordId: tutorProfileId,
      newState: { kycStatus: "BANNED", reason },
      changedFields: ["kycStatus"],
      eventType: "kyc.banned",
    });

    await NotificationService.send({
      type: NotificationType.KYC_BANNED,
      target: { kind: "user", userId: profile.userId },
      resourceType: NotificationResourceType.KYC,
      data: { reason },
    }).catch(() => {});
  },

  async suspendTutor(tutorProfileId: string, reason: string, ctx: ServiceContext) {
    const profile = await findTutorProfileOrThrow(tutorProfileId);
    if (profile.kycStatus !== KycStatus.ACTIVE) {
      throw new AppError("kyc/errors:onlyActiveCanBeSuspended", StatusCodes.CONFLICT);
    }
    assertValidTransition(profile.kycStatus, KycStatus.SUSPENDED);

    const latestApplication = await prisma.kycApplication.findFirstOrThrow({
      where: { tutorProfileId },
      orderBy: { version: "desc" },
      select: { id: true },
    });

    await prisma.$transaction([
      prisma.tutorProfile.update({
        where: { id: tutorProfileId },
        data: { kycStatus: KycStatus.SUSPENDED },
      }),
      prisma.kycStatusHistory.create({
        data: {
          kycApplicationId: latestApplication.id,
          tutorProfileId,
          previousStatus: KycStatus.ACTIVE,
          newStatus: KycStatus.SUSPENDED,
          changedById: ctx.userId!,
          reason,
        },
      }),
    ]);

    await AdminUserService.suspendUser(profile.userId, reason, ctx).catch(() => {});
    await handleTutorRemovalFromPlatform(tutorProfileId, ctx);

    AuditService.record(ctx, "tutor_profiles", {
      operation: LogOperation.SUSPEND,
      category: LogCategory.SENSITIVE_READ,
      recordId: tutorProfileId,
      newState: { kycStatus: "SUSPENDED", reason },
      changedFields: ["kycStatus"],
      eventType: "kyc.suspended",
    });
  },

  async unsuspendTutor(tutorProfileId: string, ctx: ServiceContext) {
    const profile = await findTutorProfileOrThrow(tutorProfileId);
    assertValidTransition(profile.kycStatus, KycStatus.ACTIVE);

    await prisma.tutorProfile.update({
      where: { id: tutorProfileId },
      data: { kycStatus: KycStatus.ACTIVE },
    });

    await AdminUserService.unsuspendUser(profile.userId, ctx).catch(() => {});

    AuditService.record(ctx, "tutor_profiles", {
      operation: LogOperation.UNSUSPEND,
      category: LogCategory.SENSITIVE_READ,
      recordId: tutorProfileId,
      newState: { kycStatus: "ACTIVE" },
      changedFields: ["kycStatus"],
      eventType: "kyc.unsuspended",
    });
  },

  // ── Governance ───────────────────────────────────────────────

  async getSpotCheckQueue(sampleSize = 20) {
    return prisma.kycStatusHistory.findMany({
      where: { flaggedForSpotCheck: true, spotCheckReview: null, newStatus: KycStatus.IDENTITY_APPROVED },
      include: { changedBy: { select: { id: true, email: true, firstName: true, lastName: true } } },
      orderBy: { createdAt: "desc" },
      take: sampleSize,
    });
  },

  async submitSpotCheckVerdict(
    kycStatusHistoryId: string,
    superAdminId: string,
    input: SpotCheckVerdictInput,
    ctx: ServiceContext
  ) {
    const history = await prisma.kycStatusHistory.findUnique({
      where: { id: kycStatusHistoryId },
      select: { changedById: true },
    });
    if (!history) {
      throw new AppError("kyc/errors:statusHistoryNotFound", StatusCodes.NOT_FOUND);
    }

    await prisma.kycSpotCheckReview.create({
      data: {
        kycStatusHistoryId,
        reviewedById: superAdminId,
        verdict: input.verdict,
        note: input.note,
      },
    });

    if (input.verdict === SpotCheckVerdict.BAD) {
      await recomputeCountersignatureRequirement(history.changedById);
    }

    AuditService.record(ctx, "kyc_status_history", {
      operation: LogOperation.UPDATE,
      category: LogCategory.SENSITIVE_READ,
      recordId: kycStatusHistoryId,
      newState: { spotCheckVerdict: input.verdict },
      changedFields: ["spotCheckVerdict"],
      eventType: "kyc.spot_check_verdict",
    });
  },

  async getAdminStats(adminId: string, windowDays = 30) {
    const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);
    const decisions = await prisma.kycStatusHistory.findMany({
      where: {
        changedById: adminId,
        createdAt: { gte: since },
        newStatus: { in: [KycStatus.IDENTITY_APPROVED, KycStatus.REJECTED] },
      },
      select: { newStatus: true, reviewDurationSeconds: true },
    });

    const totalReviewed = decisions.length;
    const rejected = decisions.filter((d) => d.newStatus === KycStatus.REJECTED).length;
    const durations = decisions
      .map((d) => d.reviewDurationSeconds)
      .filter((d): d is number => d !== null);
    const avgReviewDurationSeconds =
      durations.length > 0
        ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
        : 0;

    const flaggedApprovals = await prisma.kycStatusHistory.count({
      where: { changedById: adminId, createdAt: { gte: since }, flaggedForSpotCheck: true },
    });

    return {
      totalReviewed,
      rejectionRate: totalReviewed === 0 ? 0 : Math.round((rejected / totalReviewed) * 100),
      avgReviewDurationSeconds,
      flaggedApprovals,
    };
  },

  async getSlaConfig() {
    return getSlaConfig();
  },

  async updateSlaConfig(input: KycSlaConfigInput, ctx: ServiceContext) {
    await prisma.$transaction([
      prisma.platformConfig.upsert({
        where: { key: SLA_TARGET_HOURS_KEY },
        create: {
          key: SLA_TARGET_HOURS_KEY,
          value: input.targetHours,
          category: ConfigCategory.SECURITY,
          description: "Target hours to review a KYC application",
          defaultValue: DEFAULT_SLA_TARGET_HOURS,
          updatedById: ctx.userId!,
        },
        update: { value: input.targetHours, updatedById: ctx.userId! },
      }),
      prisma.platformConfig.upsert({
        where: { key: SLA_MAX_BUSINESS_DAYS_KEY },
        create: {
          key: SLA_MAX_BUSINESS_DAYS_KEY,
          value: input.maxBusinessDays,
          category: ConfigCategory.SECURITY,
          description: "Maximum business days before a KYC application escalates",
          defaultValue: DEFAULT_SLA_MAX_BUSINESS_DAYS,
          updatedById: ctx.userId!,
        },
        update: { value: input.maxBusinessDays, updatedById: ctx.userId! },
      }),
    ]);
    return getSlaConfig();
  },
};

export default KycAdminService;
