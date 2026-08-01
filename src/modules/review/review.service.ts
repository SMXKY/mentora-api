import prisma from "../../config/database.config";
import { AppError } from "../../utils/AppError.util";
import { StatusCodes } from "http-status-codes";
import {
  ReviewAuthorRole,
  ReviewSubjectRole,
  ReviewStatus,
} from "../../generated/prisma";
import { tryRevealWindow } from "../../services/review/reviewWindow.service";
import { SubmitReviewInput } from "./review.types";

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

  return prisma.review.findUniqueOrThrow({ where: { id: review.id } });
}

async function listTutorReviewsByProfile(
  tutorProfileId: string,
  cursor: string | undefined,
  limit: number
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
  return listTutorReviews(tutorProfile.userId, cursor, limit);
}

async function listTutorReviews(
  tutorUserId: string,
  cursor: string | undefined,
  limit: number
) {
  const rows = await prisma.review.findMany({
    where: {
      subjectId: tutorUserId,
      subjectRole: ReviewSubjectRole.TUTOR,
      status: ReviewStatus.REVEALED,
      deletedAt: null,
    },
    orderBy: [{ revealedAt: "desc" }, { id: "desc" }],
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
      author: {
        select: { firstName: true },
      },
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

  return prisma.review.update({
    where: { id: reviewId },
    data: { tutorResponse: response, tutorResponseAt: new Date() },
  });
}

export const ReviewService = {
  submitReview,
  listTutorReviews,
  listTutorReviewsByProfile,
  respondToReview,
};
export default ReviewService;
