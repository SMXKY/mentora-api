import { Router } from "express";
import multer from "multer";
import os from "os";
import path from "path";
import { randomUUID } from "crypto";
import { kycController } from "./kyc.controller";
import { validate, ParamsId } from "../../middlewares/validate.middleware";
import {
  KycStep1Schema,
  KycStep2Schema,
} from "./kyc.types";
import protect from "../../middlewares/protect.middleware";
import { z } from "zod";

const router = Router();

function makeUpload(maxSizeMB: number, maxFiles: number) {
  return multer({
    storage: multer.diskStorage({
      destination: os.tmpdir(),
      filename: (_req, file, cb) =>
        cb(null, `${randomUUID()}${path.extname(file.originalname).toLowerCase()}`),
    }),
    limits: { fileSize: maxSizeMB * 1024 * 1024, files: maxFiles },
  });
}

const step1Upload = makeUpload(5, 4);
const credentialUpload = makeUpload(10, 1);
const cvUpload = makeUpload(10, 1);

router.use(protect);

router.get("/me", kycController.getMyApplication);

router.post(
  "/me/step-1",
  step1Upload.fields([
    { name: "cniFront", maxCount: 1 },
    { name: "cniBack", maxCount: 1 },
    { name: "selfie", maxCount: 1 },
    { name: "nonConvictionCertificate", maxCount: 1 },
  ]),
  validate(KycStep1Schema),
  kycController.saveStep1
);

router.post("/me/step-2", validate(KycStep2Schema), kycController.saveStep2);

router.post(
  "/me/credentials",
  credentialUpload.single("document"),
  kycController.addCredential
);

router.delete(
  "/me/credentials/:credentialId",
  validate(z.object({ credentialId: z.string().uuid() }), "params"),
  kycController.removeCredential
);

router.post("/me/cv", cvUpload.single("cv"), kycController.uploadCv);

router.post("/me/submit", kycController.submitApplication);

router.post("/me/resubmit", kycController.resubmit);

router.post(
  "/me/additional-subject",
  credentialUpload.single("document"),
  kycController.addAdditionalSubject
);

export default router;
