import { Request, Response } from "express";
import { catchAsync } from "../../utils/catchAsync.util";
import { buildContext } from "../../utils/buildContext.util";
import { appResponder } from "../../utils/appResponder.util";
import { AppError } from "../../utils/AppError.util";
import { StatusCodes } from "http-status-codes";
import { KycService } from "./kyc.service";
import { CredentialInputSchema, AdditionalSubjectSchema } from "./kyc.types";

/** Multipart text fields arrive as strings; numeric/array fields need
 * coercion before Zod validation, which JSON body routes get for free. */
function parseCredentialBody(body: Record<string, any>) {
  let subjects: {
    subjectId?: string;
    newSubject?: Record<string, any>;
    levelIds: string[];
  }[];
  try {
    subjects = Array.isArray(body.subjects)
      ? body.subjects
      : JSON.parse(body.subjects ?? "[]");
  } catch {
    throw new AppError(
      "kyc/errors:invalidSubjectIdsFormat",
      StatusCodes.BAD_REQUEST
    );
  }
  return {
    institutionName: body.institutionName,
    qualificationType: body.qualificationType,
    fieldOfStudy: body.fieldOfStudy,
    gradeOrClassification: body.gradeOrClassification || undefined,
    yearAwarded: Number(body.yearAwarded),
    subjects,
  };
}

/** Same multipart-coercion problem as parseCredentialBody, but this body
 * shape has a singular subjectId XOR a nested newSubject object, plus a
 * levelIds array. */
function parseAdditionalSubjectBody(body: Record<string, any>) {
  let newSubject: Record<string, any> | undefined;
  let levelIds: string[];
  try {
    newSubject = body.newSubject
      ? typeof body.newSubject === "string"
        ? JSON.parse(body.newSubject)
        : body.newSubject
      : undefined;
    levelIds = Array.isArray(body.levelIds)
      ? body.levelIds
      : JSON.parse(body.levelIds ?? "[]");
  } catch {
    throw new AppError(
      "kyc/errors:invalidSubjectIdsFormat",
      StatusCodes.BAD_REQUEST
    );
  }
  return {
    institutionName: body.institutionName,
    qualificationType: body.qualificationType,
    fieldOfStudy: body.fieldOfStudy,
    gradeOrClassification: body.gradeOrClassification || undefined,
    yearAwarded: Number(body.yearAwarded),
    subjectId: body.subjectId || undefined,
    newSubject,
    levelIds,
  };
}

const filesFrom = (req: Request) =>
  req.files as Record<string, Express.Multer.File[]>;

export const kycController = {
  getMyApplication: catchAsync(
    async (req: Request, res: Response): Promise<void> => {
      const ctx = buildContext(req, res);
      const result = await KycService.getMyApplication(ctx.userId!);
      appResponder(StatusCodes.OK, result, res);
    }
  ),

  saveStep1: catchAsync(async (req: Request, res: Response): Promise<void> => {
    const ctx = buildContext(req, res);
    const files = filesFrom(req);
    const result = await KycService.saveStep1(ctx.userId!, req.body, {
      cniFront: files.cniFront?.[0],
      cniBack: files.cniBack?.[0],
      selfie: files.selfie?.[0],
      nonConvictionCertificate: files.nonConvictionCertificate?.[0],
    });
    appResponder(StatusCodes.OK, result, res);
  }),

  saveStep2: catchAsync(async (req: Request, res: Response): Promise<void> => {
    const ctx = buildContext(req, res);
    const result = await KycService.saveStep2(ctx.userId!, req.body);
    appResponder(StatusCodes.OK, result, res);
  }),

  addCredential: catchAsync(
    async (req: Request, res: Response): Promise<void> => {
      const ctx = buildContext(req, res);
      const parsed = CredentialInputSchema.parse(parseCredentialBody(req.body));
      const result = await KycService.addCredential(
        ctx.userId!,
        parsed,
        req.file!
      );
      appResponder(StatusCodes.CREATED, result, res);
    }
  ),

  removeCredential: catchAsync(
    async (req: Request, res: Response): Promise<void> => {
      const ctx = buildContext(req, res);
      await KycService.removeCredential(ctx.userId!, req.params.credentialId);
      appResponder(StatusCodes.OK, { removed: true }, res);
    }
  ),

  uploadCv: catchAsync(async (req: Request, res: Response): Promise<void> => {
    const ctx = buildContext(req, res);
    if (!req.file) {
      throw new AppError(
        "media/errors:noFileProvided",
        StatusCodes.BAD_REQUEST
      );
    }
    const result = await KycService.uploadCv(ctx.userId!, req.file);
    appResponder(StatusCodes.OK, result, res);
  }),

  submitApplication: catchAsync(
    async (req: Request, res: Response): Promise<void> => {
      const ctx = buildContext(req, res);
      const result = await KycService.submitApplication(ctx.userId!);
      appResponder(StatusCodes.OK, result, res);
    }
  ),

  resubmit: catchAsync(async (req: Request, res: Response): Promise<void> => {
    const ctx = buildContext(req, res);
    const result = await KycService.resubmit(ctx.userId!);
    appResponder(StatusCodes.OK, result, res);
  }),

  addAdditionalSubject: catchAsync(
    async (req: Request, res: Response): Promise<void> => {
      const ctx = buildContext(req, res);
      const parsed = AdditionalSubjectSchema.parse(
        parseAdditionalSubjectBody(req.body)
      );
      const result = await KycService.addAdditionalSubject(
        ctx.userId!,
        parsed,
        req.file!
      );
      appResponder(StatusCodes.CREATED, result, res);
    }
  ),

  getStatus: catchAsync(async (req: Request, res: Response): Promise<void> => {
    const ctx = buildContext(req, res);
    const result = await KycService.getStatus(ctx.userId!);
    appResponder(StatusCodes.OK, result, res);
  }),

  getMySubjects: catchAsync(
    async (req: Request, res: Response): Promise<void> => {
      const ctx = buildContext(req, res);
      const result = await KycService.getMySubjects(ctx.userId!);
      appResponder(StatusCodes.OK, result, res);
    }
  ),

  updateSubjectLevels: catchAsync(
    async (req: Request, res: Response): Promise<void> => {
      const ctx = buildContext(req, res);
      const result = await KycService.updateSubjectLevels(
        ctx.userId!,
        req.params.tutorSubjectId,
        req.body
      );
      appResponder(StatusCodes.OK, result, res);
    }
  ),
};

export default kycController;
