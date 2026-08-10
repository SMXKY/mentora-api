import { Router } from "express";
import { tutorSearchController } from "./tutorSearch.controller";
import { validate } from "../../middlewares/validate.middleware";
import protect from "../../middlewares/protect.middleware";
import restrictTo from "../../middlewares/restrictTo.middleware";
import { permissions } from "../../data/permission.data";
import {
  SearchTutorsQuerySchema,
  NotifyMeSchema,
  RecordSearchEventSchema,
  RankingWeightsSchema,
  BayesianConfigSchema,
  NewTutorBoostConfigSchema,
} from "./tutorSearch.types";

// Public — no auth. Guest/Parent/Student/Tutor all search identically; the
// controller resolves an optional userId only to attribute analytics
// events, never to gate access.
const router = Router();

router.get(
  "/tutors",
  validate(SearchTutorsQuerySchema, "query"),
  tutorSearchController.searchTutors
);

router.post(
  "/notify-me",
  validate(NotifyMeSchema),
  tutorSearchController.notifyMe
);

router.post(
  "/analytics/event",
  validate(RecordSearchEventSchema),
  tutorSearchController.recordEvent
);

// ── Admin: ranking configuration ────────────────────────────
const adminRouter = Router();
adminRouter.use(protect);

adminRouter.get(
  "/ranking-config",
  restrictTo(permissions.search.rankingRead),
  tutorSearchController.getRankingConfig
);

adminRouter.patch(
  "/ranking-config/weights",
  restrictTo(permissions.search.rankingWrite),
  validate(RankingWeightsSchema),
  tutorSearchController.updateRankingWeights
);

adminRouter.patch(
  "/ranking-config/bayesian",
  restrictTo(permissions.search.rankingWrite),
  validate(BayesianConfigSchema),
  tutorSearchController.updateBayesianConfig
);

adminRouter.patch(
  "/ranking-config/new-tutor-boost",
  restrictTo(permissions.search.rankingWrite),
  validate(NewTutorBoostConfigSchema),
  tutorSearchController.updateNewTutorBoostConfig
);

// ── Admin: analytics — never exposed to Tutors or Parents ───
adminRouter.get(
  "/analytics/ctr-by-position",
  restrictTo(permissions.analytics.demandRead),
  tutorSearchController.getCtrByPosition
);

adminRouter.get(
  "/analytics/dead-end-queries",
  restrictTo(permissions.analytics.demandRead),
  tutorSearchController.getDeadEndQueries
);

adminRouter.get(
  "/analytics/top-queries",
  restrictTo(permissions.analytics.demandRead),
  tutorSearchController.getTopQueries
);

adminRouter.get(
  "/analytics/demand-signals",
  restrictTo(permissions.analytics.demandRead),
  tutorSearchController.getDemandSignals
);

adminRouter.get(
  "/analytics/demand-breakdown",
  restrictTo(permissions.analytics.demandRead),
  tutorSearchController.getSearchDemandBreakdown
);

export { adminRouter as tutorSearchAdminRouter };
export default router;
