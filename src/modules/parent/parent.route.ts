import { Router } from "express";
import { parentController } from "./parent.controller";
import { validate, ParamsId } from "../../middlewares/validate.middleware";
import { CreateManagedStudentSchema, UpdateManagedStudentSchema } from "./parent.schema";
import protect from "../../middlewares/protect.middleware";

const router = Router();

router.use(protect);

router.get("/me/students", parentController.listMyStudents);

router.post(
  "/me/students",
  validate(CreateManagedStudentSchema),
  parentController.createStudent
);

router.patch(
  "/me/students/:id",
  validate(ParamsId, "params"),
  validate(UpdateManagedStudentSchema),
  parentController.updateStudent
);

router.delete(
  "/me/students/:id",
  validate(ParamsId, "params"),
  parentController.removeStudent
);

export default router;
