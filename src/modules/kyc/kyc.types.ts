import { z } from "zod";
import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";

extendZodWithOpenApi(z);

// Cameroonian CNI numbers are commonly 9 digits, occasionally with a
// trailing letter on older cards — kept permissive rather than rejecting
// a genuine document over a format the spec doesn't pin down exactly.
const CNI_NUMBER_REGEX = /^[0-9]{6,9}[A-Za-z]?$/;

export const IdDocumentTypeEnum = z.enum(["ORIGINAL_CNI", "RECEIPT"]);
export const QualificationTypeEnum = z.enum([
  "BSC",
  "MSC",
  "PHD",
  "PGDE",
  "TEACHING_CERTIFICATE",
  "PROFESSIONAL_CERTIFICATION",
  "HND",
  "GCE_A_LEVEL",
  "GCE_O_LEVEL",
  "OTHER",
]);
export const KycRejectionFlagItemEnum = z.enum([
  "CNI_NUMBER_MISMATCH",
  "SELFIE_MISMATCH",
  "DOCUMENT_TYPE_MISMATCH",
  "DEGREE_FIELD_MISMATCH",
  "SUBJECT_NOT_SUPPORTED_BY_CREDENTIALS",
  "DOCUMENT_EXPIRED",
  "DOCUMENT_UNREADABLE",
  "SUSPICIOUS_DOCUMENT",
  "OTHER",
]);

// ── Step 1 — Identity ────────────────────────────────────────
export const KycStep1Schema = z
  .object({
    idDocumentType: IdDocumentTypeEnum,
    cniNumber: z
      .string()
      .regex(CNI_NUMBER_REGEX, "kyc/errors:invalidCniNumberFormat"),
    cniDateIssued: z.string().datetime().optional(),
    cniExpirationDate: z.string().datetime().optional(),
  })
  .openapi("KycStep1");
export type KycStep1Input = z.infer<typeof KycStep1Schema>;

// ── Step 2 — Background information ─────────────────────────
export const KycStep2Schema = z
  .object({
    fullLegalName: z.string().min(1, "kyc/errors:fieldRequired"),
    surname: z.string().min(1, "kyc/errors:fieldRequired"),
    dob: z.string().datetime(),
    gender: z.enum(["MALE", "FEMALE", "PREFER_NOT_TO_SAY"]),
    placeOfBirth: z.string().min(1, "kyc/errors:fieldRequired"),
    currentStreet: z.string().min(1, "kyc/errors:fieldRequired"),
    currentNeighbourhood: z.string().min(1, "kyc/errors:fieldRequired"),
    currentCityId: z.string().uuid(),
    currentRegionId: z.string().uuid(),
    cityOfOrigin: z.string().min(1, "kyc/errors:fieldRequired"),
    regionOfOrigin: z.string().min(1, "kyc/errors:fieldRequired"),
    emergencyContactName: z.string().min(1, "kyc/errors:fieldRequired"),
    emergencyContactPhone: z.string().min(1, "kyc/errors:fieldRequired"),
    selfDeclarationStatement: z.string().max(500).optional(),
  })
  .openapi("KycStep2");
export type KycStep2Input = z.infer<typeof KycStep2Schema>;

// ── Step 3 — Credentials ─────────────────────────────────────
export const CredentialInputSchema = z
  .object({
    institutionName: z.string().min(1, "kyc/errors:fieldRequired"),
    qualificationType: QualificationTypeEnum,
    fieldOfStudy: z.string().min(1, "kyc/errors:fieldRequired"),
    gradeOrClassification: z.string().optional(),
    yearAwarded: z.number().int().min(1950).max(new Date().getFullYear()),
    subjectIds: z
      .array(z.string().uuid())
      .min(1, "kyc/errors:credentialNeedsSubject"),
  })
  .openapi("CredentialInput");
export type CredentialInput = z.infer<typeof CredentialInputSchema>;

// ── Step 4 — Declaration & submit ───────────────────────────
export const KycDeclarationSchema = z
  .object({
    declarationAccepted: z.literal(true, {
      message: "kyc/errors:declarationRequired",
    }),
  })
  .openapi("KycDeclaration");
export type KycDeclarationInput = z.infer<typeof KycDeclarationSchema>;

// ── Additional-subject (post-approval lighter flow) ─────────
export const AdditionalSubjectSchema = CredentialInputSchema.extend({
  subjectIds: z
    .array(z.string().uuid())
    .length(1, "kyc/errors:additionalSubjectSingle"),
}).openapi("AdditionalSubject");
export type AdditionalSubjectInput = z.infer<typeof AdditionalSubjectSchema>;

// ── Admin: checklist + identity decision ────────────────────
export const KycChecklistSchema = z
  .object({
    cniNumberMatchesDocument: z.boolean(),
    selfieMatchesCniPhoto: z.boolean(),
    documentTypeMatchesDeclaration: z.boolean(),
    degreeMatchesFieldOfStudy: z.boolean(),
    subjectsSupportedByCredentials: z.boolean(),
  })
  .openapi("KycChecklist");
export type KycChecklistInput = z.infer<typeof KycChecklistSchema>;

export const KycApproveIdentitySchema = z
  .object({ checklist: KycChecklistSchema })
  .openapi("KycApproveIdentity");

export const KycRejectSchema = z
  .object({
    flags: z
      .array(
        z.object({
          flagItem: KycRejectionFlagItemEnum,
          reason: z.string().min(1, "kyc/errors:fieldRequired"),
          adminMessage: z.string().optional(),
        })
      )
      .min(1, "kyc/errors:atLeastOneFlagRequired"),
  })
  .openapi("KycReject");
export type KycRejectInput = z.infer<typeof KycRejectSchema>;

export const KycBanSchema = z
  .object({ reason: z.string().min(1, "kyc/errors:reasonRequired") })
  .openapi("KycBan");

export const KycSuspendTutorSchema = z
  .object({
    reason: z.string().min(20, "kyc/errors:suspendReasonTooShort"),
  })
  .openapi("KycSuspendTutor");

export const ApproveSubjectSchema = z
  .object({
    trainWeight: z.number().int().min(0).max(100).optional(),
  })
  .openapi("ApproveSubject");
export type ApproveSubjectInput = z.infer<typeof ApproveSubjectSchema>;

export const RejectSubjectSchema = z
  .object({ reason: z.string().min(1, "kyc/errors:reasonRequired") })
  .openapi("RejectSubject");

export const ReviewCredentialSchema = z
  .object({
    decision: z.enum(["APPROVED", "REJECTED"]),
    reason: z.string().optional(),
  })
  .refine((d) => d.decision !== "REJECTED" || !!d.reason, {
    message: "kyc/errors:reasonRequired",
    path: ["reason"],
  })
  .openapi("ReviewCredential");
export type ReviewCredentialInput = z.infer<typeof ReviewCredentialSchema>;

export const SpotCheckVerdictSchema = z
  .object({
    verdict: z.enum(["GOOD", "BAD"]),
    note: z.string().optional(),
  })
  .openapi("SpotCheckVerdict");
export type SpotCheckVerdictInput = z.infer<typeof SpotCheckVerdictSchema>;

export const KycSlaConfigSchema = z
  .object({
    targetHours: z.number().int().min(1),
    maxBusinessDays: z.number().int().min(1),
  })
  .openapi("KycSlaConfig");
export type KycSlaConfigInput = z.infer<typeof KycSlaConfigSchema>;

// ── Status check (lightweight, for UI gating) ────────────────
export const KycStepsProgressSchema = z
  .object({
    identity: z.boolean(),
    biography: z.boolean(),
    credentials: z.boolean(),
  })
  .openapi("KycStepsProgress");

export const KycRejectionFlagSummarySchema = z
  .object({
    flagItem: KycRejectionFlagItemEnum,
    reason: z.string(),
    adminMessage: z.string().nullable(),
  })
  .openapi("KycRejectionFlagSummary");

export const KycStatusResponseSchema = z
  .object({
    hasStarted: z.boolean(),
    kycStatus: z.string().nullable(),
    currentStep: z.string().nullable(),
    canEdit: z.boolean(),
    steps: KycStepsProgressSchema,
    rejectionFlags: z.array(KycRejectionFlagSummarySchema),
    isBanned: z.boolean(),
  })
  .openapi("KycStatusResponse");
export type KycStatusResponse = z.infer<typeof KycStatusResponseSchema>;
