import prisma from "../../config/database.config";
import { AppError } from "../../utils/AppError.util";
import { StatusCodes } from "http-status-codes";
import {
  KycStatus,
  KycStep,
  FileCategory,
  FileType,
  CredentialStatus,
} from "../../generated/prisma";
import { MediaService } from "../../services/media/media.service";
import { fileTypes, FileTypeSpec } from "../../services/media/media.types";
import { evaluateCompletion } from "../../services/accountCompletion/accountCompletion.service";
import { assertValidTransition } from "../../services/kyc/kycStateMachine";
import NotificationService from "../../services/notification/notification.service";
import {
  NotificationType,
  NotificationResourceType,
} from "../../generated/prisma";
import { permissions } from "../../data/permission.data";
import {
  KycStep1Input,
  KycStep2Input,
  CredentialInput,
  AdditionalSubjectInput,
} from "./kyc.types";

const IMAGE_TYPES: FileTypeSpec[] = [
  fileTypes.image.jpg,
  fileTypes.image.jpeg,
  fileTypes.image.png,
];
const PDF_TYPES: FileTypeSpec[] = [fileTypes.document.pdf];

async function getTutorProfileOrThrow(userId: string) {
  const profile = await prisma.tutorProfile.findFirst({
    where: { userId, deletedAt: null },
    select: { id: true, kycStatus: true, userId: true },
  });
  if (!profile) {
    throw new AppError(
      "kyc/errors:tutorProfileNotFound",
      StatusCodes.NOT_FOUND
    );
  }
  return profile;
}

/** Gate every KYC entry point behind full profile completion (Module 7). */
async function assertProfileComplete(userId: string): Promise<void> {
  const completion = await evaluateCompletion(userId);
  if (!completion.isComplete) {
    throw new AppError("kyc/errors:profileIncomplete", StatusCodes.FORBIDDEN, {
      redirect: "profile_completion",
      missing: completion.missing,
    });
  }
}

/**
 * Resolves the tutor's one "active" application — the latest version that
 * isn't itself in a terminal BANNED state. Creates version 1 on first
 * touch. A REJECTED latest version is still "active" for editing purposes;
 * resubmit() is what advances it to a new version.
 */
async function getOrCreateApplication(tutorProfileId: string) {
  const latest = await prisma.kycApplication.findFirst({
    where: { tutorProfileId, deletedAt: null },
    orderBy: { version: "desc" },
  });
  if (latest) return latest;

  return prisma.kycApplication.create({
    data: { tutorProfileId, version: 1, currentStep: KycStep.STEP_1_IDENTITY },
  });
}

async function assertEditable(applicationId: string, tutorProfileId: string) {
  const app = await prisma.kycApplication.findUnique({
    where: { id: applicationId },
    select: { currentStep: true },
  });
  const profile = await prisma.tutorProfile.findUnique({
    where: { id: tutorProfileId },
    select: { kycStatus: true },
  });
  // Once submitted, the form is read-only until a rejection re-opens it
  // (resubmit() creates a fresh editable version).
  if (
    app?.currentStep === KycStep.SUBMITTED &&
    profile?.kycStatus !== KycStatus.REJECTED
  ) {
    throw new AppError("kyc/errors:applicationReadOnly", StatusCodes.CONFLICT);
  }
}

async function uploadKycDoc(
  userId: string,
  file: Express.Multer.File,
  allowedTypes: FileTypeSpec[],
  maxSizeMB: number
): Promise<string> {
  const [uploaded] = await MediaService.upload(
    [{ tempFilePath: file.path, originalFileName: file.originalname }],
    {
      uploadedById: userId,
      fileCategory: FileCategory.KYC_DOCUMENT,
      fileType: allowedTypes === PDF_TYPES ? FileType.DOCUMENT : FileType.IMAGE,
      allowedTypes,
      maxSizeMB,
    }
  );
  return uploaded.fileId;
}

export const KycService = {
  async getMyApplication(userId: string) {
    await assertProfileComplete(userId);
    const profile = await getTutorProfileOrThrow(userId);
    const application = await getOrCreateApplication(profile.id);
    const credentials = await prisma.tutorCredential.findMany({
      where: { tutorProfileId: profile.id },
      include: { subjectLinks: { include: { subject: true } } },
      orderBy: { createdAt: "asc" },
    });
    const rejectionFlags =
      profile.kycStatus === KycStatus.REJECTED
        ? await prisma.kycRejectionFlag.findMany({
            where: { kycApplicationId: application.id },
            orderBy: { createdAt: "desc" },
          })
        : [];

    return {
      application,
      credentials,
      kycStatus: profile.kycStatus,
      rejectionFlags,
    };
  },

  async saveStep1(
    userId: string,
    data: KycStep1Input,
    files: {
      cniFront: Express.Multer.File;
      cniBack: Express.Multer.File;
      selfie: Express.Multer.File;
      nonConvictionCertificate: Express.Multer.File;
    }
  ) {
    await assertProfileComplete(userId);
    const profile = await getTutorProfileOrThrow(userId);
    const application = await getOrCreateApplication(profile.id);
    await assertEditable(application.id, profile.id);

    if (
      !files.cniFront ||
      !files.cniBack ||
      !files.selfie ||
      !files.nonConvictionCertificate
    ) {
      throw new AppError(
        "kyc/errors:step1FilesRequired",
        StatusCodes.BAD_REQUEST
      );
    }

    // Sequential, not Promise.all — each upload opens its own FTP connection
    // in production (ftp.storage.ts has no connection pooling), and shared
    // FTP hosting (Interserver) commonly caps simultaneous connections per
    // account well below 4. Running these concurrently intermittently/
    // consistently fails step 1 specifically, since every other upload path
    // in the app only ever uploads one file at a time.
    const cniFrontPhotoId = await uploadKycDoc(userId, files.cniFront, IMAGE_TYPES, 5);
    const cniBackPhotoId = await uploadKycDoc(userId, files.cniBack, IMAGE_TYPES, 5);
    const selfieWithCniId = await uploadKycDoc(userId, files.selfie, IMAGE_TYPES, 5);
    const nonConvictionCertificateId = await uploadKycDoc(
      userId,
      files.nonConvictionCertificate,
      PDF_TYPES,
      5
    );

    return prisma.kycApplication.update({
      where: { id: application.id },
      data: {
        idDocumentType: data.idDocumentType,
        cniNumber: data.cniNumber,
        cniDateIssued: data.cniDateIssued
          ? new Date(data.cniDateIssued)
          : undefined,
        cniExpirationDate: data.cniExpirationDate
          ? new Date(data.cniExpirationDate)
          : undefined,
        cniFrontPhotoId,
        cniBackPhotoId,
        selfieWithCniId,
        nonConvictionCertificateId,
        currentStep: KycStep.STEP_2_BIOGRAPHY,
      },
    });
  },

  async saveStep2(userId: string, data: KycStep2Input) {
    await assertProfileComplete(userId);
    const profile = await getTutorProfileOrThrow(userId);
    const application = await getOrCreateApplication(profile.id);
    await assertEditable(application.id, profile.id);

    if (!application.cniFrontPhotoId) {
      throw new AppError(
        "kyc/errors:step1NotComplete",
        StatusCodes.BAD_REQUEST
      );
    }

    return prisma.kycApplication.update({
      where: { id: application.id },
      data: {
        ...data,
        dob: new Date(data.dob),
        currentStep: KycStep.STEP_3_CREDENTIALS,
      },
    });
  },

  async addCredential(
    userId: string,
    data: CredentialInput,
    file: Express.Multer.File
  ) {
    await assertProfileComplete(userId);
    const profile = await getTutorProfileOrThrow(userId);
    const application = await getOrCreateApplication(profile.id);
    await assertEditable(application.id, profile.id);

    if (!file) {
      throw new AppError(
        "kyc/errors:credentialDocumentRequired",
        StatusCodes.BAD_REQUEST
      );
    }

    const subjects = await prisma.subject.findMany({
      where: { id: { in: data.subjectIds } },
      select: { id: true },
    });
    if (subjects.length !== data.subjectIds.length) {
      throw new AppError("kyc/errors:invalidSubject", StatusCodes.BAD_REQUEST);
    }

    const [uploaded] = await MediaService.upload(
      [{ tempFilePath: file.path, originalFileName: file.originalname }],
      {
        uploadedById: userId,
        fileCategory: FileCategory.KYC_DOCUMENT,
        fileType:
          file.mimetype === "application/pdf"
            ? FileType.DOCUMENT
            : FileType.IMAGE,
        allowedTypes: [...IMAGE_TYPES, ...PDF_TYPES],
        maxSizeMB: 10,
      }
    );

    return prisma.$transaction(async (tx) => {
      const credential = await tx.tutorCredential.create({
        data: {
          tutorProfileId: profile.id,
          institutionName: data.institutionName,
          qualificationType: data.qualificationType,
          fieldOfStudy: data.fieldOfStudy,
          gradeOrClassification: data.gradeOrClassification,
          yearAwarded: data.yearAwarded,
          documentUrl: uploaded.storagePath,
          status: CredentialStatus.PENDING,
        },
      });

      await tx.credentialSubjectLink.createMany({
        data: data.subjectIds.map((subjectId) => ({
          credentialId: credential.id,
          subjectId,
        })),
      });

      for (const subjectId of data.subjectIds) {
        await tx.tutorSubject.upsert({
          where: {
            tutorProfileId_subjectId: { tutorProfileId: profile.id, subjectId },
          },
          create: { tutorProfileId: profile.id, subjectId },
          update: {},
        });
      }

      return credential;
    });
  },

  async removeCredential(userId: string, credentialId: string) {
    const profile = await getTutorProfileOrThrow(userId);
    const application = await getOrCreateApplication(profile.id);
    await assertEditable(application.id, profile.id);

    const credential = await prisma.tutorCredential.findFirst({
      where: { id: credentialId, tutorProfileId: profile.id },
    });
    if (!credential) {
      throw new AppError(
        "kyc/errors:credentialNotFound",
        StatusCodes.NOT_FOUND
      );
    }
    if (credential.status !== CredentialStatus.PENDING) {
      throw new AppError(
        "kyc/errors:credentialNotEditable",
        StatusCodes.CONFLICT
      );
    }

    await prisma.credentialSubjectLink.deleteMany({ where: { credentialId } });
    await prisma.tutorCredential.delete({ where: { id: credentialId } });
  },

  async uploadCv(userId: string, file: Express.Multer.File) {
    const profile = await getTutorProfileOrThrow(userId);
    const application = await getOrCreateApplication(profile.id);
    await assertEditable(application.id, profile.id);

    const cvFileId = await uploadKycDoc(userId, file, PDF_TYPES, 10);
    return prisma.kycApplication.update({
      where: { id: application.id },
      data: { cvFileId },
    });
  },

  /** Step 4 — validates every prior step is genuinely complete, then submits. */
  async submitApplication(userId: string) {
    await assertProfileComplete(userId);
    const profile = await getTutorProfileOrThrow(userId);
    const application = await getOrCreateApplication(profile.id);
    await assertEditable(application.id, profile.id);

    const step1Complete =
      !!application.idDocumentType &&
      !!application.cniNumber &&
      !!application.cniFrontPhotoId &&
      !!application.cniBackPhotoId &&
      !!application.selfieWithCniId &&
      !!application.nonConvictionCertificateId;
    if (!step1Complete) {
      throw new AppError(
        "kyc/errors:step1NotComplete",
        StatusCodes.BAD_REQUEST
      );
    }

    const step2Complete =
      !!application.fullLegalName &&
      !!application.surname &&
      !!application.dob &&
      !!application.gender &&
      !!application.currentStreet &&
      !!application.currentNeighbourhood &&
      !!application.currentCityId &&
      !!application.currentRegionId &&
      !!application.cityOfOrigin &&
      !!application.regionOfOrigin &&
      !!application.emergencyContactName &&
      !!application.emergencyContactPhone;
    if (!step2Complete) {
      throw new AppError(
        "kyc/errors:step2NotComplete",
        StatusCodes.BAD_REQUEST
      );
    }

    const credentialCount = await prisma.tutorCredential.count({
      where: {
        tutorProfileId: profile.id,
        subjectLinks: { some: {} },
      },
    });
    if (credentialCount === 0) {
      throw new AppError(
        "kyc/errors:step3NotComplete",
        StatusCodes.BAD_REQUEST
      );
    }

    const fromStatus =
      profile.kycStatus === KycStatus.REJECTED
        ? KycStatus.REJECTED
        : KycStatus.INCOMPLETE;
    assertValidTransition(fromStatus, KycStatus.PENDING);

    const isResubmission = profile.kycStatus === KycStatus.REJECTED;

    await prisma.$transaction([
      prisma.kycApplication.update({
        where: { id: application.id },
        data: {
          declarationAccepted: true,
          declarationAcceptedAt: new Date(),
          currentStep: KycStep.SUBMITTED,
        },
      }),
      prisma.tutorProfile.update({
        where: { id: profile.id },
        data: { kycStatus: KycStatus.PENDING, kycSubmittedAt: new Date() },
      }),
      prisma.kycStatusHistory.create({
        data: {
          kycApplicationId: application.id,
          tutorProfileId: profile.id,
          previousStatus:
            fromStatus === KycStatus.INCOMPLETE ? null : fromStatus,
          newStatus: KycStatus.PENDING,
          changedById: userId,
          reason: isResubmission ? "Tutor resubmission" : "Initial submission",
        },
      }),
    ]);

    await NotificationService.send({
      type: NotificationType.KYC_SUBMITTED,
      target: { kind: "user", userId },
      resourceType: NotificationResourceType.KYC,
      resourceId: application.id,
    }).catch(() => {});

    await NotificationService.send({
      type: NotificationType.ADMIN_REVIEW_REQUIRED,
      target: { kind: "permission", permissionCode: permissions.kyc.queueRead },
      resourceType: NotificationResourceType.KYC,
      resourceId: application.id,
      data: {
        reviewReason: isResubmission
          ? "kyc_resubmission"
          : "new_kyc_application",
        tutorProfileId: profile.id,
      },
    }).catch(() => {});

    return { applicationId: application.id, status: "PENDING" as const };
  },

  /** Opens a new editable version after a rejection, carrying forward every field. */
  async resubmit(userId: string) {
    const profile = await getTutorProfileOrThrow(userId);
    if (profile.kycStatus !== KycStatus.REJECTED) {
      throw new AppError("kyc/errors:notRejected", StatusCodes.CONFLICT);
    }
    const latest = await prisma.kycApplication.findFirst({
      where: { tutorProfileId: profile.id, deletedAt: null },
      orderBy: { version: "desc" },
    });
    if (!latest) {
      throw new AppError(
        "kyc/errors:tutorProfileNotFound",
        StatusCodes.NOT_FOUND
      );
    }

    const { id, createdAt, updatedAt, version, currentStep, ...carryForward } =
      latest;
    return prisma.kycApplication.create({
      data: {
        ...carryForward,
        tutorProfileId: profile.id,
        version: version + 1,
        currentStep: KycStep.STEP_4_REVIEW,
        declarationAccepted: false,
        declarationAcceptedAt: null,
      },
    });
  },

  async addAdditionalSubject(
    userId: string,
    data: AdditionalSubjectInput,
    file: Express.Multer.File
  ) {
    const profile = await getTutorProfileOrThrow(userId);
    if (profile.kycStatus !== KycStatus.ACTIVE) {
      throw new AppError(
        "kyc/errors:mustBeActiveForAdditionalSubject",
        StatusCodes.CONFLICT
      );
    }
    if (!file) {
      throw new AppError(
        "kyc/errors:credentialDocumentRequired",
        StatusCodes.BAD_REQUEST
      );
    }
    // Reuses the exact same credential-creation path — the "lighter flow"
    // is entirely about which admin queue it lands in (see kycAdmin.service),
    // not a different tutor-facing code path.
    return KycService.addCredential(userId, data, file);
  },

  // kyc.service.ts — add to KycService

  async getStatus(userId: string) {
    const profile = await prisma.tutorProfile.findFirst({
      where: { userId, deletedAt: null },
      select: { id: true, kycStatus: true },
    });

    if (!profile) {
      return {
        hasStarted: false,
        kycStatus: null,
        currentStep: null,
        canEdit: false,
        steps: { identity: false, biography: false, credentials: false },
        rejectionFlags: [] as {
          flagItem: string;
          reason: string;
          adminMessage: string | null;
        }[],
        isBanned: false,
      };
    }

    const ban = await prisma.kycBan.findUnique({
      where: { tutorProfileId: profile.id },
      select: { reason: true, createdAt: true },
    });

    const application = await prisma.kycApplication.findFirst({
      where: { tutorProfileId: profile.id, deletedAt: null },
      orderBy: { version: "desc" },
    });

    if (!application) {
      return {
        hasStarted: false,
        kycStatus: profile.kycStatus,
        currentStep: null,
        canEdit: !ban,
        steps: { identity: false, biography: false, credentials: false },
        rejectionFlags: [],
        isBanned: !!ban,
      };
    }

    const step1Complete =
      !!application.idDocumentType &&
      !!application.cniNumber &&
      !!application.cniFrontPhotoId &&
      !!application.cniBackPhotoId &&
      !!application.selfieWithCniId &&
      !!application.nonConvictionCertificateId;

    const step2Complete =
      !!application.fullLegalName &&
      !!application.surname &&
      !!application.dob &&
      !!application.gender &&
      !!application.currentStreet &&
      !!application.currentNeighbourhood &&
      !!application.currentCityId &&
      !!application.currentRegionId &&
      !!application.cityOfOrigin &&
      !!application.regionOfOrigin &&
      !!application.emergencyContactName &&
      !!application.emergencyContactPhone;

    const credentialCount = await prisma.tutorCredential.count({
      where: { tutorProfileId: profile.id, subjectLinks: { some: {} } },
    });
    const step3Complete = credentialCount > 0;

    // Mirrors assertEditable's rule: read-only once submitted, unless rejected.
    const canEdit =
      !ban &&
      (application.currentStep !== KycStep.SUBMITTED ||
        profile.kycStatus === KycStatus.REJECTED);

    const rejectionFlags =
      profile.kycStatus === KycStatus.REJECTED
        ? await prisma.kycRejectionFlag.findMany({
            where: { kycApplicationId: application.id },
            orderBy: { createdAt: "desc" },
            select: { flagItem: true, reason: true, adminMessage: true },
          })
        : [];

    return {
      hasStarted: true,
      kycStatus: profile.kycStatus,
      currentStep: application.currentStep,
      canEdit,
      steps: {
        identity: step1Complete,
        biography: step2Complete,
        credentials: step3Complete,
      },
      rejectionFlags,
      isBanned: !!ban,
    };
  },
};

export default KycService;
