import prisma from "../../config/database.config";
import { AppError } from "../../utils/AppError.util";
import { StatusCodes } from "http-status-codes";
import { UpdateMyStudentProfileInput } from "./student.schema";

export const StudentService = {
  async getMyProfile(userId: string) {
    return prisma.studentProfile.findFirst({
      where: { userId, deletedAt: null },
      include: { subjects: { include: { subject: true } }, level: true },
    });
  },

  /** Create-or-update — a self-registered Student has no profile row yet
   * on first login, the same gap KYC's tutor wizard has for TutorProfile. */
  async upsertMyProfile(userId: string, data: UpdateMyStudentProfileInput) {
    const existing = await prisma.studentProfile.findFirst({
      where: { userId, deletedAt: null },
      select: { id: true },
    });

    const payload = { ...data, dob: data.dob ? new Date(data.dob) : undefined };

    if (existing) {
      return prisma.studentProfile.update({ where: { id: existing.id }, data: payload });
    }
    return prisma.studentProfile.create({ data: { ...payload, userId, firstName: data.firstName } });
  },

  async addSubjectOfInterest(userId: string, subjectId: string) {
    const profile = await prisma.studentProfile.findFirst({
      where: { userId, deletedAt: null },
      select: { id: true },
    });
    if (!profile) {
      throw new AppError("student/errors:profileNotFound", StatusCodes.NOT_FOUND);
    }

    const subject = await prisma.subject.findUnique({ where: { id: subjectId } });
    if (!subject) {
      throw new AppError("student/errors:subjectNotFound", StatusCodes.BAD_REQUEST);
    }

    return prisma.studentProfileSubject.upsert({
      where: { studentProfileId_subjectId: { studentProfileId: profile.id, subjectId } },
      create: { studentProfileId: profile.id, subjectId },
      update: {},
    });
  },

  async removeSubjectOfInterest(userId: string, subjectId: string) {
    const profile = await prisma.studentProfile.findFirst({
      where: { userId, deletedAt: null },
      select: { id: true },
    });
    if (!profile) {
      throw new AppError("student/errors:profileNotFound", StatusCodes.NOT_FOUND);
    }

    await prisma.studentProfileSubject.deleteMany({
      where: { studentProfileId: profile.id, subjectId },
    });
  },
};

export default StudentService;
