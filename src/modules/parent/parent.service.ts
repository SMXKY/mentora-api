import prisma from "../../config/database.config";
import { AppError } from "../../utils/AppError.util";
import { StatusCodes } from "http-status-codes";
import {
  CreateManagedStudentInput,
  UpdateManagedStudentInput,
} from "./parent.schema";

async function assertOwnedByGuardian(id: string, guardianId: string) {
  const profile = await prisma.studentProfile.findFirst({
    where: { id, guardianId, deletedAt: null },
  });
  if (!profile) {
    throw new AppError("parent/errors:studentNotFound", StatusCodes.NOT_FOUND);
  }
  return profile;
}

export const ParentService = {
  async listMyStudents(guardianId: string) {
    return prisma.studentProfile.findMany({
      where: { guardianId, deletedAt: null },
      include: { subjects: { include: { subject: true } }, level: true },
      orderBy: { createdAt: "asc" },
    });
  },

  /** A Parent-managed child has no login of their own — userId stays null,
   * distinguishing it from a self-registered Student's own profile. */
  async createManagedStudent(guardianId: string, data: CreateManagedStudentInput) {
    const { subjectIds, ...profileData } = data;

    const profile = await prisma.studentProfile.create({
      data: {
        ...profileData,
        dob: data.dob ? new Date(data.dob) : undefined,
        guardianId,
        userId: null,
      },
    });

    if (subjectIds && subjectIds.length > 0) {
      await prisma.studentProfileSubject.createMany({
        data: subjectIds.map((subjectId) => ({ studentProfileId: profile.id, subjectId })),
        skipDuplicates: true,
      });
    }

    return prisma.studentProfile.findUniqueOrThrow({
      where: { id: profile.id },
      include: { subjects: { include: { subject: true } }, level: true },
    });
  },

  async updateManagedStudent(
    guardianId: string,
    studentProfileId: string,
    data: UpdateManagedStudentInput
  ) {
    await assertOwnedByGuardian(studentProfileId, guardianId);
    const { subjectIds, ...profileData } = data;

    await prisma.studentProfile.update({
      where: { id: studentProfileId },
      data: { ...profileData, dob: data.dob ? new Date(data.dob) : undefined },
    });

    if (subjectIds) {
      await prisma.$transaction([
        prisma.studentProfileSubject.deleteMany({ where: { studentProfileId } }),
        prisma.studentProfileSubject.createMany({
          data: subjectIds.map((subjectId) => ({ studentProfileId, subjectId })),
          skipDuplicates: true,
        }),
      ]);
    }

    return prisma.studentProfile.findUniqueOrThrow({
      where: { id: studentProfileId },
      include: { subjects: { include: { subject: true } }, level: true },
    });
  },

  async removeManagedStudent(guardianId: string, studentProfileId: string) {
    await assertOwnedByGuardian(studentProfileId, guardianId);
    await prisma.studentProfile.update({
      where: { id: studentProfileId },
      data: { deletedAt: new Date() },
    });
  },
};

export default ParentService;
