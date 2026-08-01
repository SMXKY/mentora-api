import prisma from "../../config/database.config";
import { AppError } from "../../utils/AppError.util";
import { StatusCodes } from "http-status-codes";

/** Shared by every module that resolves a tutor's own profile from their userId (availability, booking, payment). */
export async function getTutorProfileOrThrow(userId: string) {
  const profile = await prisma.tutorProfile.findFirst({
    where: { userId, deletedAt: null },
  });
  if (!profile) {
    throw new AppError("tutor/errors:tutorProfileNotFound", StatusCodes.NOT_FOUND);
  }
  return profile;
}
