import prisma from "../../config/database.config";
import redis from "../../config/redis.config";
import { evaluateCompletion } from "../../services/accountCompletion/accountCompletion.service";
import NotificationService from "../../services/notification/notification.service";
import { KycAdminService } from "../kyc";
import { DashboardResponse } from "./dashboard.schema";

// Short TTL only — the spec calls stale-within-reason acceptable for
// everything except the live-updated counters, which mobile refreshes
// itself off the notification socket rather than by re-polling this.
const DASHBOARD_CACHE_TTL_SECONDS = 30;
const cacheKey = (userId: string) => `dashboard:${userId}`;

const ACTIVE_BOOKING_STATUSES = [
  "ACCEPTED",
  "PAID",
  "IN_PROGRESS",
  "AWAITING_CONFIRMATION",
  "CONFIRMED",
  "AUTO_CONFIRMED",
] as const;

const OPEN_DISPUTE_STATUSES = ["OPEN", "AWAITING_ADMIN", "UNDER_REVIEW", "ESCALATED"] as const;

function toBookingSummary(b: {
  id: string;
  sessionDate: Date;
  sessionStartTime: Date;
  sessionType: string;
  status: string;
  tutorProfile?: { user: { firstName: string | null; lastName: string | null } } | null;
  booker?: { firstName: string | null; lastName: string | null } | null;
  studentProfile?: { firstName: string } | null;
  subject: { name: string };
}) {
  const tutorName = b.tutorProfile
    ? [b.tutorProfile.user.firstName, b.tutorProfile.user.lastName].filter(Boolean).join(" ") || null
    : null;
  const studentName =
    b.studentProfile?.firstName ??
    (b.booker ? [b.booker.firstName, b.booker.lastName].filter(Boolean).join(" ") || null : null);

  return {
    id: b.id,
    tutorName,
    studentName,
    subject: b.subject?.name ?? null,
    sessionDate: b.sessionDate.toISOString(),
    sessionStartTime: b.sessionStartTime.toISOString(),
    sessionType: b.sessionType,
    status: b.status,
  };
}

async function resolvePrimaryRole(userId: string): Promise<string | null> {
  const userRole = await prisma.userRole.findFirst({
    where: { userId, isActive: true },
    select: { role: { select: { name: true } } },
  });
  return userRole?.role.name ?? null;
}

async function commonUnreadCounts(userId: string) {
  const [unreadNotifications, unreadAgg] = await Promise.all([
    NotificationService.getUnreadCount(userId),
    prisma.conversationParticipant.aggregate({
      where: { userId, removedAt: null },
      _sum: { unreadCount: true },
    }),
  ]);
  return {
    unreadNotifications,
    unreadMessages: unreadAgg._sum.unreadCount ?? 0,
  };
}

async function buildParentDashboard(userId: string): Promise<DashboardResponse> {
  const bookingInclude = {
    tutorProfile: { include: { user: { select: { firstName: true, lastName: true } } } },
    studentProfile: { select: { firstName: true } },
    subject: { select: { name: true } },
  };

  const [upcomingBookings, pendingBookingRequests, disputes, payments, studentProfiles, common] =
    await Promise.all([
      prisma.booking.findMany({
        where: { bookerId: userId, sessionDate: { gte: new Date() }, deletedAt: null },
        orderBy: { sessionDate: "asc" },
        take: 10,
        include: bookingInclude,
      }),
      prisma.booking.count({ where: { bookerId: userId, status: "REQUESTED", deletedAt: null } }),
      prisma.dispute.findMany({
        where: { booking: { bookerId: userId }, status: { in: [...OPEN_DISPUTE_STATUSES] } },
        orderBy: { openedAt: "desc" },
        take: 10,
      }),
      prisma.escrowHold.findMany({
        where: { payerId: userId },
        orderBy: { createdAt: "desc" },
        take: 5,
      }),
      prisma.studentProfile.findMany({
        where: { guardianId: userId, deletedAt: null },
        include: {
          level: { select: { name: true } },
          _count: {
            select: { bookings: { where: { status: { in: [...ACTIVE_BOOKING_STATUSES] } } } },
          },
        },
        orderBy: { createdAt: "asc" },
      }),
      commonUnreadCounts(userId),
    ]);

  return {
    role: "PARENT",
    ...common,
    upcomingBookings: upcomingBookings.map(toBookingSummary),
    pendingBookingRequests,
    activeDisputes: disputes.map((d) => ({
      id: d.id,
      bookingId: d.bookingId,
      status: d.status,
      reason: d.reason,
      updatedAt: (d.resolvedAt ?? d.escalatedAt ?? d.openedAt).toISOString(),
    })),
    recentPayments: payments.map((p) => ({
      id: p.id,
      grossAmountXaf: p.grossAmountXaf,
      status: p.status,
      createdAt: p.createdAt.toISOString(),
    })),
    studentProfiles: studentProfiles.map((s) => ({
      id: s.id,
      firstName: s.firstName,
      levelName: s.level?.name ?? null,
      activeBookingsCount: s._count.bookings,
    })),
  };
}

async function buildStudentDashboard(userId: string): Promise<DashboardResponse> {
  const bookingInclude = {
    tutorProfile: { include: { user: { select: { firstName: true, lastName: true } } } },
    subject: { select: { name: true } },
  };

  const [profile, upcomingLessons, pastBookings, myReviews, common] = await Promise.all([
    prisma.studentProfile.findFirst({
      where: { userId, deletedAt: null },
      include: { level: { select: { name: true } }, subjects: { include: { subject: { select: { name: true } } } } },
    }),
    prisma.booking.findMany({
      where: { bookerId: userId, sessionDate: { gte: new Date() }, deletedAt: null },
      orderBy: { sessionDate: "asc" },
      take: 10,
      include: bookingInclude,
    }),
    prisma.booking.findMany({
      where: {
        bookerId: userId,
        status: { in: ["RESOLVED_TUTOR_FAVOR", "RESOLVED_PARENT_FAVOR", "AUTO_CONFIRMED", "CONFIRMED"] },
        deletedAt: null,
      },
      orderBy: { sessionDate: "desc" },
      take: 10,
      include: bookingInclude,
    }),
    prisma.review.findMany({ where: { authorId: userId }, select: { bookingId: true, overallRating: true } }),
    commonUnreadCounts(userId),
  ]);

  const ratingByBooking = new Map(myReviews.map((r) => [r.bookingId, r.overallRating]));

  // Materials module doesn't exist yet (no write path) — correctly empty
  // until Module 11 is built, per the same "query the real table" approach
  // used for bookings/disputes above.
  const recentMaterials: { id: string; title: string; uploadedAt: string }[] = [];

  return {
    role: "STUDENT",
    ...common,
    upcomingLessons: upcomingLessons.map(toBookingSummary),
    recentMaterials,
    pastSessions: pastBookings.map((b) => ({
      ...toBookingSummary(b),
      myRating: ratingByBooking.get(b.id) ?? null,
    })),
    currentLevelName: profile?.level?.name ?? null,
    currentSubjects: profile?.subjects.map((s) => s.subject.name) ?? [],
  };
}

async function buildTutorDashboard(userId: string): Promise<DashboardResponse> {
  const tutorProfile = await prisma.tutorProfile.findFirst({
    where: { userId, deletedAt: null },
    select: { id: true, kycStatus: true, kycRejectionReason: true },
  });

  if (!tutorProfile) {
    // Tutor hasn't created a TutorProfile yet (still on profile-setup step) —
    // return an all-empty shape rather than 404: the dashboard is meant to
    // render "even if empty", not block on a form that isn't the dashboard's job.
    const [completion, common] = await Promise.all([evaluateCompletion(userId), commonUnreadCounts(userId)]);
    return {
      role: "TUTOR",
      ...common,
      pendingBookingRequests: [],
      upcomingConfirmedSessions: [],
      earnings: { totalEarnedXaf: 0, pendingEscrowXaf: 0, balanceXaf: 0, monthlyEarnedXaf: 0 },
      nextPayout: null,
      kycStatus: null,
      kycRejectionReason: null,
      profileCompletionPercent: completion.percent,
      recentReviews: [],
      materialsUploadedCount: 0,
    };
  }

  const bookingInclude = {
    booker: { select: { firstName: true, lastName: true } },
    studentProfile: { select: { firstName: true } },
    subject: { select: { name: true } },
  };
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const [pending, upcoming, wallet, nextPayout, completion, monthEscrow, reviews, common] = await Promise.all([
    prisma.booking.findMany({
      where: { tutorProfileId: tutorProfile.id, status: "REQUESTED", deletedAt: null },
      orderBy: { createdAt: "asc" },
      take: 20,
      include: bookingInclude,
    }),
    prisma.booking.findMany({
      where: {
        tutorProfileId: tutorProfile.id,
        status: { in: [...ACTIVE_BOOKING_STATUSES] },
        sessionDate: { gte: new Date() },
        deletedAt: null,
      },
      orderBy: { sessionDate: "asc" },
      take: 10,
      include: bookingInclude,
    }),
    prisma.wallet.findUnique({ where: { userId } }),
    prisma.payoutQueue.findFirst({
      where: { userId, status: { in: ["PENDING", "PROCESSING", "WAITING_ON_FLOAT"] } },
      orderBy: { createdAt: "desc" },
    }),
    evaluateCompletion(userId),
    prisma.escrowHold.aggregate({
      where: { tutorId: userId, releasedAt: { gte: startOfMonth } },
      _sum: { netTutorAmountXaf: true },
    }),
    prisma.review.findMany({
      where: { subjectId: userId, subjectRole: "TUTOR", status: { in: ["SUBMITTED", "REVEALED"] } },
      orderBy: { createdAt: "desc" },
      take: 3,
    }),
    commonUnreadCounts(userId),
  ]);

  return {
    role: "TUTOR",
    ...common,
    pendingBookingRequests: pending.map(toBookingSummary),
    upcomingConfirmedSessions: upcoming.map(toBookingSummary),
    earnings: {
      totalEarnedXaf: wallet?.totalEarnedXaf ?? 0,
      pendingEscrowXaf: wallet?.pendingEscrowXaf ?? 0,
      balanceXaf: wallet?.balanceXaf ?? 0,
      monthlyEarnedXaf: monthEscrow._sum.netTutorAmountXaf ?? 0,
    },
    nextPayout: nextPayout
      ? { netAmountXaf: nextPayout.netAmountXaf, status: nextPayout.status, expectedAt: nextPayout.nextRetryAt?.toISOString() ?? null }
      : null,
    kycStatus: tutorProfile.kycStatus,
    kycRejectionReason: tutorProfile.kycRejectionReason,
    profileCompletionPercent: completion.percent,
    recentReviews: reviews.map((r) => ({
      id: r.id,
      overallRating: r.overallRating,
      writtenReview: r.writtenReview,
      createdAt: r.createdAt.toISOString(),
    })),
    // Materials module doesn't exist yet — correctly 0 until Module 11 is built.
    materialsUploadedCount: 0,
  };
}

async function buildAdminDashboard(role: "ADMIN" | "SUPER_ADMIN"): Promise<DashboardResponse> {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const startOfWeek = new Date(startOfToday);
  startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
  const startOfMonth = new Date(startOfToday);
  startOfMonth.setDate(1);

  const [
    kycStats,
    oldestPending,
    openDisputesCount,
    oldestDispute,
    flaggedAccounts,
    revenueToday,
    revenueWeek,
    revenueMonth,
    escrowHeld,
    pendingPayoutsCount,
    newUsersToday,
    recentAuditLog,
    dbHealth,
    redisHealth,
    activeSessions,
  ] = await Promise.all([
    KycAdminService.getQueueStats(),
    prisma.tutorProfile.findFirst({
      where: { kycStatus: "PENDING" },
      orderBy: { kycSubmittedAt: "asc" },
      select: { kycSubmittedAt: true },
    }),
    prisma.dispute.count({ where: { status: { in: [...OPEN_DISPUTE_STATUSES] } } }),
    prisma.dispute.findFirst({
      where: { status: { in: [...OPEN_DISPUTE_STATUSES] } },
      orderBy: { openedAt: "asc" },
      select: { openedAt: true },
    }),
    prisma.user.count({ where: { OR: [{ escrowReviewRequired: true }, { kycCountersignatureRequired: true }] } }),
    prisma.escrowHold.aggregate({ where: { releasedAt: { gte: startOfToday } }, _sum: { commissionAmountXaf: true } }),
    prisma.escrowHold.aggregate({ where: { releasedAt: { gte: startOfWeek } }, _sum: { commissionAmountXaf: true } }),
    prisma.escrowHold.aggregate({ where: { releasedAt: { gte: startOfMonth } }, _sum: { commissionAmountXaf: true } }),
    prisma.escrowHold.aggregate({ where: { status: "HELD" }, _sum: { grossAmountXaf: true } }),
    prisma.payoutQueue.count({ where: { status: "PENDING" } }),
    prisma.userRole.groupBy({
      by: ["roleId"],
      where: { createdAt: { gte: startOfToday } },
      _count: { _all: true },
    }),
    prisma.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 10 }),
    prisma.$queryRaw`SELECT 1`.then(() => "ok" as const).catch(() => "down" as const),
    redis.ping().then(() => "ok" as const).catch(() => "down" as const),
    role === "SUPER_ADMIN"
      ? prisma.userSession.count({ where: { isActive: true, expiresAt: { gt: new Date() } } })
      : Promise.resolve(undefined),
  ]);

  const roleNames =
    newUsersToday.length > 0
      ? await prisma.role.findMany({
          where: { id: { in: newUsersToday.map((r) => r.roleId) } },
          select: { id: true, name: true },
        })
      : [];
  const roleNameById = new Map(roleNames.map((r) => [r.id, r.name]));
  const newRegistrationsToday = Object.fromEntries(
    newUsersToday.map((r) => [roleNameById.get(r.roleId) ?? r.roleId, r._count._all])
  );

  const hoursSince = (d: Date | null | undefined) => (d ? Math.round((Date.now() - d.getTime()) / 36e5) : null);

  return {
    role,
    kycQueue: {
      pendingCount: kycStats.byStatus["PENDING"] ?? 0,
      oldestPendingAgeHours: hoursSince(oldestPending?.kycSubmittedAt),
    },
    openDisputes: { count: openDisputesCount, oldestUnresolvedAgeHours: hoursSince(oldestDispute?.openedAt) },
    flaggedAccounts,
    revenue: {
      today: revenueToday._sum.commissionAmountXaf ?? 0,
      thisWeek: revenueWeek._sum.commissionAmountXaf ?? 0,
      thisMonth: revenueMonth._sum.commissionAmountXaf ?? 0,
    },
    escrowBalanceXaf: escrowHeld._sum.grossAmountXaf ?? 0,
    pendingPayoutsCount,
    newRegistrationsToday,
    recentAuditLog: recentAuditLog.map((a) => ({
      id: a.id,
      actorEmail: a.actorEmail,
      eventType: a.eventType,
      operation: a.operation,
      tableName: a.tableName,
      createdAt: a.createdAt.toISOString(),
    })),
    // Job-heartbeat/error-rate observability isn't wired up anywhere in this
    // codebase yet (JobHeartbeatRegistry is schema-only) — DB/Redis reachability
    // is the honest scope for "system health" today.
    systemHealth: { database: dbHealth, redis: redisHealth },
    ...(activeSessions !== undefined ? { activeSessions } : {}),
  };
}

async function getForUser(userId: string, options: { fresh?: boolean } = {}): Promise<DashboardResponse> {
  const key = cacheKey(userId);

  if (!options.fresh) {
    const cached = await redis.get(key);
    if (cached) return JSON.parse(cached) as DashboardResponse;
  }

  const role = await resolvePrimaryRole(userId);
  let dashboard: DashboardResponse;

  switch (role) {
    case "Parent":
      dashboard = await buildParentDashboard(userId);
      break;
    case "Student":
      dashboard = await buildStudentDashboard(userId);
      break;
    case "Tutor":
      dashboard = await buildTutorDashboard(userId);
      break;
    case "Super Admin":
      dashboard = await buildAdminDashboard("SUPER_ADMIN");
      break;
    default:
      // Admin, Moderator, Support Agent, or any future staff role — same
      // operational at-a-glance view; finer-grained permissions still gate
      // the actual actions once they navigate into a specific queue.
      dashboard = await buildAdminDashboard("ADMIN");
  }

  await redis.set(key, JSON.stringify(dashboard), { EX: DASHBOARD_CACHE_TTL_SECONDS });
  return dashboard;
}

export const DashboardService = { getForUser };
export default DashboardService;
