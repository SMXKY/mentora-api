import prisma from "../../config/database.config";
import { ReviewStatus } from "../../generated/prisma";
import { NotificationType, NotificationResourceType } from "../../generated/prisma";
import { NotificationService } from "../notification/notification.service";
import { recomputeTutorRatingSnapshot } from "./ratingSnapshot.service";

const REVIEW_WINDOW_DAYS = 14;

/** Opens once a booking finalises (confirmed/auto-confirmed/dispute-resolved) — the trigger point for both sides to review each other. */
export async function openReviewWindow(bookingId: string): Promise<void> {
  const existing = await prisma.reviewWindow.findUnique({ where: { bookingId } });
  if (existing) return;

  const booking = await prisma.booking.findUniqueOrThrow({
    where: { id: bookingId },
    include: { tutorProfile: { select: { userId: true } } },
  });

  const closesAt = new Date(Date.now() + REVIEW_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  await prisma.reviewWindow.create({ data: { bookingId, closesAt } });

  const recipients = [booking.bookerId, booking.tutorProfile.userId].filter(Boolean) as string[];
  await Promise.all(
    recipients.map((userId) =>
      NotificationService.send({
        type: NotificationType.REVIEW_WINDOW_OPENED,
        target: { kind: "user", userId },
        resourceType: NotificationResourceType.BOOKING,
        resourceId: bookingId,
      })
    )
  );
}

/** Reveals both sides' reviews (whatever exists) once both have submitted, or the window has closed. */
export async function tryRevealWindow(reviewWindowId: string): Promise<void> {
  const window = await prisma.reviewWindow.findUniqueOrThrow({ where: { id: reviewWindowId } });
  if (window.revealedAt) return;

  const bothSubmitted = window.authorSubmitted && window.subjectSubmitted;
  const windowClosed = window.closesAt < new Date();
  if (!bothSubmitted && !windowClosed) return;

  const reviews = await prisma.review.findMany({ where: { reviewWindowId, status: ReviewStatus.SUBMITTED } });
  if (reviews.length === 0) {
    await prisma.reviewWindow.update({ where: { id: reviewWindowId }, data: { revealedAt: new Date() } });
    return;
  }

  await prisma.$transaction([
    prisma.reviewWindow.update({ where: { id: reviewWindowId }, data: { revealedAt: new Date() } }),
    ...reviews.map((r) => prisma.review.update({ where: { id: r.id }, data: { status: ReviewStatus.REVEALED, revealedAt: new Date() } })),
  ]);

  await Promise.all(
    reviews
      .filter((r) => r.subjectRole === "TUTOR")
      .map(async (r) => {
        await recomputeTutorRatingSnapshot(r.subjectId);
        const author = await prisma.user.findUnique({
          where: { id: r.authorId },
          select: { firstName: true, lastName: true },
        });
        await NotificationService.send({
          type: NotificationType.REVIEW_RECEIVED,
          target: { kind: "user", userId: r.subjectId },
          resourceType: NotificationResourceType.REVIEW,
          resourceId: r.id,
          data: {
            authorName: author
              ? `${author.firstName} ${author.lastName}`.trim()
              : "",
          },
        });
      })
  );
}

/** Daily sweep — closes windows past their deadline that never got a full reveal. */
export async function sweepExpiredReviewWindows(): Promise<{ closed: number }> {
  const expired = await prisma.reviewWindow.findMany({
    where: { revealedAt: null, closesAt: { lt: new Date() } },
    select: { id: true },
  });
  for (const w of expired) await tryRevealWindow(w.id);
  return { closed: expired.length };
}
