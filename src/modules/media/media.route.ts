import { Router } from "express";
import multer from "multer";
import os from "os";
import path from "path";
import { randomUUID } from "crypto";
import { mediaController } from "./media.controller";
import { validate, ParamsId } from "../../middlewares/validate.middleware";
import { UploadMediaSchema } from "./media.schema";
import protect from "../../middlewares/protect.middleware";

const router = Router();

// Temp filenames are always server-generated UUIDs — the client filename
// only survives as `originalname` metadata, never as a disk path.
const upload = multer({
  storage: multer.diskStorage({
    destination: os.tmpdir(),
    filename: (_req, file, cb) =>
      cb(null, `${randomUUID()}${path.extname(file.originalname).toLowerCase()}`),
  }),
  limits: { fileSize: 500 * 1024 * 1024, files: 10 },
});

router.use(protect);

router.post(
  "/",
  upload.array("files", 10),
  validate(UploadMediaSchema),
  mediaController.upload
);

router.put(
  "/:id",
  validate(ParamsId, "params"),
  upload.single("file"),
  mediaController.replace
);

router.delete("/:id", validate(ParamsId, "params"), mediaController.remove);

router.get("/:id/url", validate(ParamsId, "params"), mediaController.getUrl);

export default router;
