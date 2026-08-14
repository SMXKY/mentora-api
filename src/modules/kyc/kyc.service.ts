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
import { SubjectVerificationStatus } from "../../generated/prisma";
import {
  KycStep1Input,
  KycStep2Input,
  CredentialInput,
  AdditionalSubjectInput,
  UpdateSubjectLevelsInput,
  NewSubjectProposalInput,
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
 * Resolves a tutor's proposal for a subject that isn't in the taxonomy yet
 * into a usable subjectId — reused by both the initial KYC credentials step
 * (addCredential) and the post-approval "apply for a new subject" flow
 * (addAdditionalSubject), so a subject proposed either way goes through the
 * exact same near-duplicate check and lands in the same admin review queue.
 * Checked for a near-duplicate first so the taxonomy doesn't fill up with
 * copies of the same subject under slightly different casing/domain choices.
 */
async function resolveNewSubjectProposal(
  userId: string,
  proposal: NewSubjectProposalInput
): Promise<{ id: string; name: string }> {
  const existingMatch = await prisma.subject.findFirst({
    where: {
      domainId: proposal.domainId,
      name: { equals: proposal.name, mode: "insensitive" },
      status: SubjectVerificationStatus.APPROVED,
      isActive: true,
    },
    select: { id: true, name: true },
  });
  if (existingMatch) return existingMatch;

  const domain = await prisma.subjectDomain.findUnique({
    where: { id: proposal.domainId },
    select: { id: true },
  });
  if (!domain) {
    throw new AppError(
      "kyc/errors:invalidSubjectDomain",
      StatusCodes.BAD_REQUEST
    );
  }

  return prisma.subject.create({
    data: {
      name: proposal.name,
      description: proposal.description,
      domainId: proposal.domainId,
      status: SubjectVerificationStatus.PENDING,
      isActive: false,
      submittedById: userId,
    },
    select: { id: true, name: true },
  });
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
      include: {
        subjectLinks: {
          include: {
            subject: {
              include: {
                // Scoped to this tutor — levels live on TutorSubject (a
                // de-duplicated tutor+subject pairing), not on the credential
                // or the link itself, since the same subject can accumulate
                // levels across multiple credentials over time.
                tutorSubjects: {
                  where: { tutorProfileId: profile.id },
                  include: { levels: { include: { level: true } } },
                },
              },
            },
          },
        },
      },
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
      // The frontend's KycApplication type expects a flat shape (see
      // services/kyc.ts) — nest under `application` here and every consumer
      // (Step 1/2 resume-prefill, Step 4 review) silently reads undefined.
      ...application,
      status: profile.kycStatus,
      credentials: credentials.map((cr) => ({
        id: cr.id,
        institutionName: cr.institutionName,
        qualificationType: cr.qualificationType,
        fieldOfStudy: cr.fieldOfStudy,
        gradeOrClassification: cr.gradeOrClassification,
        yearAwarded: cr.yearAwarded,
        status: cr.status,
        subjects: cr.subjectLinks.map((link) => ({
          id: link.subject.id,
          name: link.subject.name,
          levels: (link.subject.tutorSubjects[0]?.levels ?? []).map((lv) => ({
            id: lv.level.id,
            name: lv.level.name,
          })),
        })),
      })),
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

    // Each subject entry is either an existing catalog subjectId, or a
    // proposal for a subject not yet on the platform — resolved via the same
    // helper the post-approval "apply for a new subject" flow uses, so a
    // tutor whose subject simply isn't listed yet isn't blocked from
    // finishing KYC over it.
    const existingSubjectIds = data.subjects
      .filter((s) => s.subjectId)
      .map((s) => s.subjectId!);
    const existingSubjects = existingSubjectIds.length
      ? await prisma.subject.findMany({
          where: { id: { in: existingSubjectIds } },
          select: { id: true, name: true },
        })
      : [];
    const existingSubjectById = new Map(existingSubjects.map((s) => [s.id, s]));
    if (existingSubjects.length !== new Set(existingSubjectIds).size) {
      throw new AppError("kyc/errors:invalidSubject", StatusCodes.BAD_REQUEST);
    }

    // A tutor might select an existing subject AND propose a near-duplicate
    // that resolves to that same existing subject — merge by resolved id so
    // the credential doesn't try to link the same subject twice.
    const bySubjectId = new Map<
      string,
      { id: string; name: string; levelIds: Set<string> }
    >();
    for (const entry of data.subjects) {
      const resolved = entry.subjectId
        ? existingSubjectById.get(entry.subjectId)!
        : await resolveNewSubjectProposal(userId, entry.newSubject!);
      const existing = bySubjectId.get(resolved.id);
      if (existing) {
        entry.levelIds.forEach((id) => existing.levelIds.add(id));
      } else {
        bySubjectId.set(resolved.id, {
          id: resolved.id,
          name: resolved.name,
          levelIds: new Set(entry.levelIds),
        });
      }
    }
    const resolvedSubjects = Array.from(bySubjectId.values());

    const allLevelIds = Array.from(
      new Set(resolvedSubjects.flatMap((s) => Array.from(s.levelIds)))
    );
    const levels = await prisma.level.findMany({
      where: { id: { in: allLevelIds }, isActive: true },
      select: { id: true, name: true },
    });
    if (levels.length !== allLevelIds.length) {
      throw new AppError("kyc/errors:invalidLevel", StatusCodes.BAD_REQUEST);
    }
    const levelById = new Map(levels.map((l) => [l.id, l]));

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

    const credential = await prisma.$transaction(async (tx) => {
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
        data: resolvedSubjects.map((s) => ({
          credentialId: credential.id,
          subjectId: s.id,
        })),
      });

      for (const s of resolvedSubjects) {
        const tutorSubject = await tx.tutorSubject.upsert({
          where: {
            tutorProfileId_subjectId: {
              tutorProfileId: profile.id,
              subjectId: s.id,
            },
          },
          create: { tutorProfileId: profile.id, subjectId: s.id },
          update: {},
        });
        await tx.tutorSubjectLevel.createMany({
          data: Array.from(s.levelIds).map((levelId) => ({
            tutorSubjectId: tutorSubject.id,
            levelId,
          })),
          skipDuplicates: true,
        });
      }

      return credential;
    });

    return {
      ...credential,
      subjects: resolvedSubjects.map((s) => ({
        id: s.id,
        name: s.name,
        levels: Array.from(s.levelIds).map((levelId) => levelById.get(levelId)!),
      })),
    };
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

    // KYC_SUBMITTED and ADMIN_REVIEW_REQUIRED are both transactional (see
    // notification.types.ts) — they bypass notificationsMuted and fire real
    // email whenever NODE_ENV=production. ADMIN_REVIEW_REQUIRED in
    // particular fans out to every real reviewer account, not just this
    // submitter, so a staging-seeded tutor submitting KYC must never reach
    // either send — see the isStagingSeed comment on the User model.
    const submitter = await prisma.user.findUnique({
      where: { id: userId },
      select: { isStagingSeed: true },
    });

    if (!submitter?.isStagingSeed) {
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
    }

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

    const levels = await prisma.level.findMany({
      where: { id: { in: data.levelIds }, isActive: true },
      select: { id: true },
    });
    if (levels.length !== data.levelIds.length) {
      throw new AppError("kyc/errors:invalidLevel", StatusCodes.BAD_REQUEST);
    }

    // Resolve the subject: either an existing, approved one, or a brand-new
    // proposal the tutor is submitting for admin review.
    let subjectId: string;
    if (data.subjectId) {
      const subject = await prisma.subject.findFirst({
        where: {
          id: data.subjectId,
          isActive: true,
          status: SubjectVerificationStatus.APPROVED,
        },
        select: { id: true },
      });
      if (!subject) {
        throw new AppError("kyc/errors:invalidSubject", StatusCodes.BAD_REQUEST);
      }
      subjectId = subject.id;
    } else {
      subjectId = (await resolveNewSubjectProposal(userId, data.newSubject!))
        .id;
    }

    const existingClaim = await prisma.tutorSubject.findUnique({
      where: {
        tutorProfileId_subjectId: { tutorProfileId: profile.id, subjectId },
      },
      select: { id: true },
    });
    if (existingClaim) {
      throw new AppError(
        "kyc/errors:subjectAlreadyClaimed",
        StatusCodes.CONFLICT
      );
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

    const { credential, tutorSubject } = await prisma.$transaction(
      async (tx) => {
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

        await tx.credentialSubjectLink.create({
          data: { credentialId: credential.id, subjectId },
        });

        const tutorSubject = await tx.tutorSubject.upsert({
          where: {
            tutorProfileId_subjectId: {
              tutorProfileId: profile.id,
              subjectId,
            },
          },
          create: { tutorProfileId: profile.id, subjectId },
          update: {},
        });

        await tx.tutorSubjectLevel.createMany({
          data: data.levelIds.map((levelId) => ({
            tutorSubjectId: tutorSubject.id,
            levelId,
          })),
          skipDuplicates: true,
        });

        return { credential, tutorSubject };
      }
    );

    await NotificationService.send({
      type: NotificationType.ADMIN_REVIEW_REQUIRED,
      target: { kind: "permission", permissionCode: permissions.kyc.queueRead },
      resourceType: NotificationResourceType.TUTOR_SUBJECT,
      resourceId: tutorSubject.id,
      data: {
        reviewReason: data.subjectId
          ? "additional_subject_claim"
          : "new_subject_proposal",
        tutorProfileId: profile.id,
      },
    }).catch(() => {});

    return { credential, tutorSubject };
  },

  async getMySubjects(userId: string) {
    const profile = await getTutorProfileOrThrow(userId);
    return prisma.tutorSubject.findMany({
      where: { tutorProfileId: profile.id },
      include: {
        subject: { select: { id: true, name: true, status: true } },
        levels: { include: { level: true } },
      },
      orderBy: { createdAt: "asc" },
    });
  },

  async updateSubjectLevels(
    userId: string,
    tutorSubjectId: string,
    data: UpdateSubjectLevelsInput
  ) {
    const profile = await getTutorProfileOrThrow(userId);
    const tutorSubject = await prisma.tutorSubject.findFirst({
      where: { id: tutorSubjectId, tutorProfileId: profile.id },
    });
    if (!tutorSubject) {
      throw new AppError("kyc/errors:subjectNotFound", StatusCodes.NOT_FOUND);
    }

    const levels = await prisma.level.findMany({
      where: { id: { in: data.levelIds }, isActive: true },
      select: { id: true },
    });
    if (levels.length !== data.levelIds.length) {
      throw new AppError("kyc/errors:invalidLevel", StatusCodes.BAD_REQUEST);
    }

    await prisma.$transaction([
      prisma.tutorSubjectLevel.deleteMany({ where: { tutorSubjectId } }),
      prisma.tutorSubjectLevel.createMany({
        data: data.levelIds.map((levelId) => ({ tutorSubjectId, levelId })),
        skipDuplicates: true,
      }),
    ]);

    return prisma.tutorSubject.findUniqueOrThrow({
      where: { id: tutorSubjectId },
      include: { levels: { include: { level: true } } },
    });
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
