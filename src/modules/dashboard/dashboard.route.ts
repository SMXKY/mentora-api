import { Router } from "express";
import { dashboardController } from "./dashboard.controller";
import { validate } from "../../middlewares/validate.middleware";
import { DashboardQuerySchema } from "./dashboard.schema";
import protect from "../../middlewares/protect.middleware";

const router = Router();

router.use(protect);

router.get("/me", validate(DashboardQuerySchema, "query"), dashboardController.getMine);

export default router;
