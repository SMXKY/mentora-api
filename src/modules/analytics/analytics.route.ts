import { Router } from "express";
import { analyticsController } from "./analytics.controller";
import { validate } from "../../middlewares/validate.middleware";
import protect from "../../middlewares/protect.middleware";
import { GetAnalyticsQuerySchema, ListAnalyticsSessionsQuerySchema } from "./analytics.types";

const router = Router();
router.use(protect);

router.get("/me", validate(GetAnalyticsQuerySchema, "query"), analyticsController.getMine);
router.get("/me/sessions", validate(ListAnalyticsSessionsQuerySchema, "query"), analyticsController.listSessions);

export default router;
