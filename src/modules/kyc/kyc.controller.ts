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
  let subjectIds: string[];
  try {
    subjectIds = Array.isArray(body.subjectIds)
      ? body.subjectIds
      : JSON.parse(body.subjectIds ?? "[]");
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
    subjectIds,
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
        parseCredentialBody(req.body)
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
};

export default kycController;
