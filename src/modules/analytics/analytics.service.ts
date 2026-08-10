import prisma from "../../config/database.config";
import { BookingStatus, ParticipantRole, SessionType } from "../../generated/prisma";
import { watCalendarDate, sessionStartAt, sessionEndAt } from "../availability/availability.logic";
import { AnalyticsRange } from "./analytics.types";

// A session actually happened — same "real engagement" bar used elsewhere
// (materials.service.ts, user.service.ts) for content/history access.
const COMPLETED_BOOKING_STATUSES: BookingStatus[] = [
  BookingStatus.CONFIRMED,
  BookingStatus.AUTO_CONFIRMED,
  BookingStatus.RESOLVED_TUTOR_FAVOR,
  BookingStatus.RESOLVED_PARENT_FAVOR,
];

const TUTOR_PARTICIPANT_SELECT = {
  where: { participantRole: ParticipantRole.TUTOR },
  select: { firstJoinedAt: true, lastLeftAt: true, totalTimeSeconds: true },
} as const;

interface BookingForTiming {
  sessionType: SessionType;
  tutorCheckedInAt: Date | null;
  tutorCheckedOutAt: Date | null;
  liveRoom: { participants: { firstJoinedAt: Date | null; lastLeftAt: Date | null; totalTimeSeconds: number | null }[] } | null;
}

/** `sessionDate` is stored as a `@db.Date` value (UTC-midnight anchored to
 * the WAT calendar day, see watCalendarDate's doc comment) — this buckets
 * it into its containing week using the same Sunday-start convention as
 * `watStartOfWeek`, but purely in the date-only domain, since watStartOfWeek
 * itself converts a wall-clock instant and isn't the right tool here. */
function weekStartDateOnly(sessionDate: Date): Date {
  const dow = sessionDate.getUTCDay();
  return new Date(Date.UTC(sessionDate.getUTCFullYear(), sessionDate.getUTCMonth(), sessionDate.getUTCDate() - dow));
}

function rangeToSinceDate(range: AnalyticsRange, now: Date): Date | null {
  const today = watCalendarDate(now);
  switch (range) {
    case "4w":
      return new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - 28));
    case "3m":
      return new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 3, today.getUTCDate()));
    case "12m":
      return new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 12, today.getUTCDate()));
    case "all":
      return null;
  }
}

/** Actual join/leave/duration for a completed booking — HOME sessions use
 * the tutor's own check-in/check-out timestamps; ONLINE sessions use the
 * TUTOR participant's LiveRoom attendance (preferring totalTimeSeconds,
 * which stays accurate across reconnects, over a raw join/leave diff). */
function deriveActualTiming(booking: BookingForTiming): {
  joinAt: Date | null;
  leaveAt: Date | null;
  durationMinutes: number | null;
} {
  if (booking.sessionType === SessionType.HOME) {
    const joinAt = booking.tutorCheckedInAt;
    const leaveAt = booking.tutorCheckedOutAt;
    const durationMinutes =
      joinAt && leaveAt ? Math.round((leaveAt.getTime() - joinAt.getTime()) / 60000) : null;
    return { joinAt, leaveAt, durationMinutes };
  }

  const participant = booking.liveRoom?.participants[0] ?? null;
  const joinAt = participant?.firstJoinedAt ?? null;
  const leaveAt = participant?.lastLeftAt ?? null;
  const durationMinutes =
    participant?.totalTimeSeconds != null
      ? Math.round(participant.totalTimeSeconds / 60)
      : joinAt && leaveAt
        ? Math.round((leaveAt.getTime() - joinAt.getTime()) / 60000)
        : null;
  return { joinAt, leaveAt, durationMinutes };
}

function emptyAnalytics(range: AnalyticsRange) {
  return {
    range,
    sessionsCount: 0,
    financials: { totalEarnedXaf: 0, averagePerSessionXaf: 0 },
    sessionTypeBreakdown: {
      online: { count: 0, earningsXaf: 0 },
      home: { count: 0, earningsXaf: 0 },
    },
    weeklyTrend: [] as { weekStart: string; sessionsCount: number }[],
    timing: {
      online: { avgJoinDelayMinutes: null, avgActualDurationMinutes: null, sampledSessionsCount: 0 },
      home: { avgCheckInDelayMinutes: null, avgActualDurationMinutes: null, sampledSessionsCount: 0 },
    },
  };
}

async function getTutorAnalytics(userId: string, range: AnalyticsRange) {
  const tutorProfile = await prisma.tutorProfile.findFirst({
    where: { userId, deletedAt: null },
    select: { id: true },
  });
  if (!tutorProfile) return emptyAnalytics(range);

  const since = rangeToSinceDate(range, new Date());
  const bookings = await prisma.booking.findMany({
    where: {
      tutorProfileId: tutorProfile.id,
      status: { in: COMPLETED_BOOKING_STATUSES },
      deletedAt: null,
      ...(since && { sessionDate: { gte: since } }),
    },
    select: {
      sessionDate: true,
      sessionType: true,
      sessionStartTime: true,
      sessionEndTime: true,
      netTutorAmountXaf: true,
      tutorCheckedInAt: true,
      tutorCheckedOutAt: true,
      liveRoom: { select: { participants: TUTOR_PARTICIPANT_SELECT } },
    },
  });

  if (bookings.length === 0) return emptyAnalytics(range);

  let totalEarnedXaf = 0;
  const sessionTypeBreakdown = {
    online: { count: 0, earningsXaf: 0 },
    home: { count: 0, earningsXaf: 0 },
  };
  const weekBuckets = new Map<string, number>();
  const timingAccum = {
    online: { joinDelaySum: 0, joinDelayCount: 0, durationSum: 0, durationCount: 0 },
    home: { joinDelaySum: 0, joinDelayCount: 0, durationSum: 0, durationCount: 0 },
  };

  for (const booking of bookings) {
    const earnings = booking.netTutorAmountXaf ?? 0;
    totalEarnedXaf += earnings;

    const typeKey = booking.sessionType === SessionType.HOME ? "home" : "online";
    sessionTypeBreakdown[typeKey].count += 1;
    sessionTypeBreakdown[typeKey].earningsXaf += earnings;

    const weekKey = weekStartDateOnly(booking.sessionDate).toISOString().slice(0, 10);
    weekBuckets.set(weekKey, (weekBuckets.get(weekKey) ?? 0) + 1);

    const { joinAt, durationMinutes } = deriveActualTiming(booking);
    const accum = timingAccum[typeKey];
    if (joinAt) {
      const scheduledStart = sessionStartAt(booking);
      const delayMinutes = Math.max(0, Math.round((joinAt.getTime() - scheduledStart.getTime()) / 60000));
      accum.joinDelaySum += delayMinutes;
      accum.joinDelayCount += 1;
    }
    if (durationMinutes != null) {
      accum.durationSum += durationMinutes;
      accum.durationCount += 1;
    }
  }

  const weeklyTrend = Array.from(weekBuckets.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([weekStart, sessionsCount]) => ({ weekStart, sessionsCount }));

  const avg = (sum: number, count: number) => (count > 0 ? Math.round(sum / count) : null);

  return {
    range,
    sessionsCount: bookings.length,
    financials: {
      totalEarnedXaf,
      averagePerSessionXaf: Math.round(totalEarnedXaf / bookings.length),
    },
    sessionTypeBreakdown,
    weeklyTrend,
    timing: {
      online: {
        avgJoinDelayMinutes: avg(timingAccum.online.joinDelaySum, timingAccum.online.joinDelayCount),
        avgActualDurationMinutes: avg(timingAccum.online.durationSum, timingAccum.online.durationCount),
        // Sessions that actually have measurable timing data — not just
        // sessions of this type, since a completed booking can still be
        // missing LiveRoom/check-in data (e.g. a no-show or a tech issue).
        sampledSessionsCount: Math.max(timingAccum.online.joinDelayCount, timingAccum.online.durationCount),
      },
      home: {
        avgCheckInDelayMinutes: avg(timingAccum.home.joinDelaySum, timingAccum.home.joinDelayCount),
        avgActualDurationMinutes: avg(timingAccum.home.durationSum, timingAccum.home.durationCount),
        sampledSessionsCount: Math.max(timingAccum.home.joinDelayCount, timingAccum.home.durationCount),
      },
    },
  };
}

async function listAnalyticsSessions(
  userId: string,
  range: AnalyticsRange,
  cursor: string | undefined,
  limit: number
) {
  const tutorProfile = await prisma.tutorProfile.findFirst({
    where: { userId, deletedAt: null },
    select: { id: true },
  });
  if (!tutorProfile) return { data: [], meta: { nextCursor: null, hasNextPage: false, limit } };

  const since = rangeToSinceDate(range, new Date());
  const rows = await prisma.booking.findMany({
    where: {
      tutorProfileId: tutorProfile.id,
      status: { in: COMPLETED_BOOKING_STATUSES },
      deletedAt: null,
      ...(since && { sessionDate: { gte: since } }),
    },
    orderBy: [{ sessionDate: "desc" }, { id: "desc" }],
    ...(cursor && { cursor: { id: cursor }, skip: 1 }),
    take: limit + 1,
    select: {
      id: true,
      sessionDate: true,
      sessionType: true,
      sessionStartTime: true,
      sessionEndTime: true,
      durationMinutes: true,
      netTutorAmountXaf: true,
      tutorCheckedInAt: true,
      tutorCheckedOutAt: true,
      subject: { select: { name: true } },
      booker: { select: { firstName: true, lastName: true } },
      studentProfile: { select: { firstName: true } },
      liveRoom: { select: { participants: TUTOR_PARTICIPANT_SELECT } },
    },
  });

  const hasNextPage = rows.length > limit;
  const page = hasNextPage ? rows.slice(0, limit) : rows;

  const data = page.map((booking) => {
    const { joinAt, leaveAt, durationMinutes } = deriveActualTiming(booking);
    const studentName =
      booking.studentProfile?.firstName ??
      ([booking.booker?.firstName, booking.booker?.lastName].filter(Boolean).join(" ") || null);

    return {
      bookingId: booking.id,
      sessionDate: booking.sessionDate,
      sessionType: booking.sessionType,
      subjectName: booking.subject.name,
      studentName,
      scheduledStartAt: sessionStartAt(booking),
      scheduledEndAt: sessionEndAt(booking),
      scheduledDurationMinutes: booking.durationMinutes,
      actualJoinAt: joinAt,
      actualLeaveAt: leaveAt,
      actualDurationMinutes: durationMinutes,
      earningsXaf: booking.netTutorAmountXaf,
    };
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

export const AnalyticsService = { getTutorAnalytics, listAnalyticsSessions };
export default AnalyticsService;
