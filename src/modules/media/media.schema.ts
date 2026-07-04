import { z } from "zod";
import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import { FileCategory } from "../../generated/prisma";

extendZodWithOpenApi(z);

export const UploadMediaSchema = z
  .object({
    fileCategory: z.enum(FileCategory),
    refTable: z.string().max(100).optional(),
    refRecordId: z.string().uuid("common/errors:validation.invalidFormat").optional(),
  })
  .openapi("UploadMedia");

export const MediaUploadResultSchema = z
  .object({
    id: z.string(),
    fileId: z.string().uuid(),
    storagePath: z.string(),
  })
  .openapi("MediaUploadResult");

export const MediaUrlResponseSchema = z
  .object({
    url: z.string().url(),
  })
  .openapi("MediaUrl");
