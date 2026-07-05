import { Router } from "express";
import { z } from "zod";
import { studentController } from "./student.controller";
import { validate } from "../../middlewares/validate.middleware";
import { UpdateMyStudentProfileSchema, AddSubjectOfInterestSchema } from "./student.schema";
import protect from "../../middlewares/protect.middleware";

const router = Router();

router.use(protect);

router.get("/me", studentController.getMe);
router.patch("/me", validate(UpdateMyStudentProfileSchema), studentController.updateMe);

router.post(
  "/me/subjects",
  validate(AddSubjectOfInterestSchema),
  studentController.addSubject
);

router.delete(
  "/me/subjects/:subjectId",
  validate(z.object({ subjectId: z.string().uuid() }), "params"),
  studentController.removeSubject
);

export default router;
