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
    return prisma.studentProfile.create({
      data: {
        ...data,
        dob: data.dob ? new Date(data.dob) : undefined,
        guardianId,
        userId: null,
      },
    });
  },

  async updateManagedStudent(
    guardianId: string,
    studentProfileId: string,
    data: UpdateManagedStudentInput
  ) {
    await assertOwnedByGuardian(studentProfileId, guardianId);
    return prisma.studentProfile.update({
      where: { id: studentProfileId },
      data: { ...data, dob: data.dob ? new Date(data.dob) : undefined },
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
