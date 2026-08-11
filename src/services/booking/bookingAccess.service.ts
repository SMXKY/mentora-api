import prisma from "../../config/database.config";
import { BookingStatus } from "../../generated/prisma";
import { sessionStartAt, sessionEndAt } from "../../modules/availability/availability.logic";

// Only PAID and IN_PROGRESS can ever count — everything else (REQUESTED,
// ACCEPTED, AWAITING_CONFIRMATION, DISPUTED, CONFIRMED, AUTO_CONFIRMED, any
// terminal-cancelled/rejected state) is excluded from the query outright,
// not just at the time check below.
const CANDIDATE_STATUSES: BookingStatus[] = [BookingStatus.PAID, BookingStatus.IN_PROGRESS];

/**
 * "Do these two users currently have an active or upcoming booking between
 * them, right now?" — strictly time-windowed, computed live with no cron
 * dependency. The status field is never trusted on its own: a PAID booking
 * whose session start time has already passed doesn't count just because
 * nothing has flipped its status yet, and an IN_PROGRESS booking whose
 * session end time has already passed doesn't count just because checkout
 * never happened. No grace period either side — the window is exactly
 * [sessionStart, sessionEnd] for IN_PROGRESS, and "now <= sessionStart" for
 * PAID. Gates live messaging quota/media and materials FULL access.
 *
 * Direction-agnostic on purpose: a conversation's two participants are always
 * one tutor + one booker, but either one can be the caller's "self" side (a
 * tutor replying to a student is just as common as the reverse) — so this
 * resolves which of the two owns a TutorProfile itself rather than requiring
 * the caller to know which id is which.
 */
async function hasActiveOrUpcomingBookingAccess(
  userIdA: string,
  userIdB: string
): Promise<boolean> {
  const [profileA, profileB] = await Promise.all([
    prisma.tutorProfile.findUnique({ where: { userId: userIdA }, select: { id: true } }),
    prisma.tutorProfile.findUnique({ where: { userId: userIdB }, select: { id: true } }),
  ]);
  const tutorProfile = profileA ?? profileB;
  if (!tutorProfile) return false; // neither side is a tutor — not a valid tutor/booker pair

  const bookerUserId = profileA ? userIdB : userIdA;

  const candidates = await prisma.booking.findMany({
    where: {
      bookerId: bookerUserId,
      tutorProfileId: tutorProfile.id,
      deletedAt: null,
      status: { in: CANDIDATE_STATUSES },
    },
    select: { status: true, sessionDate: true, sessionStartTime: true, sessionEndTime: true },
  });

  const now = Date.now();
  return candidates.some((b) => {
    if (b.status === BookingStatus.PAID) {
      return now <= sessionStartAt(b).getTime();
    }
    // IN_PROGRESS
    return now >= sessionStartAt(b).getTime() && now <= sessionEndAt(b).getTime();
  });
}

export const BookingAccessService = { hasActiveOrUpcomingBookingAccess };
export default BookingAccessService;
