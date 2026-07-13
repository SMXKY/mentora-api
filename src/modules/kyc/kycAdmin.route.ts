import { Router } from "express";
import { z } from "zod";
import { kycAdminController } from "./kycAdmin.controller";
import { validate } from "../../middlewares/validate.middleware";
import {
  KycApproveIdentitySchema,
  KycRejectSchema,
  KycBanSchema,
  KycSuspendTutorSchema,
  ApproveSubjectSchema,
  RejectSubjectSchema,
  ReviewCredentialSchema,
  SpotCheckVerdictSchema,
  KycSlaConfigSchema,
  KycQueueQuerySchema,
  KycSubjectQueueQuerySchema,
} from "./kyc.types";
import protect from "../../middlewares/protect.middleware";
import restrictTo from "../../middlewares/restrictTo.middleware";
import { permissions } from "../../data/permission.data";

const router = Router();
const ParamsUuid = (key: string) => z.object({ [key]: z.string().uuid() });

router.use(protect);

router.get(
  "/queue",
  restrictTo(permissions.kyc.queueRead),
  validate(KycQueueQuerySchema, "query"),
  kycAdminController.getQueue
);

router.get(
  "/queue/stats",
  restrictTo(permissions.kyc.queueRead),
  kycAdminController.getQueueStats
);

router.get(
  "/applications/:id",
  restrictTo(permissions.kyc.queueRead, permissions.kyc.documentsRead),
  validate(ParamsUuid("id"), "params"),
  kycAdminController.getApplicationDetail
);

router.post(
  "/applications/:id/approve-identity",
  restrictTo(permissions.kyc.approve),
  validate(ParamsUuid("id"), "params"),
  validate(KycApproveIdentitySchema),
  kycAdminController.approveIdentity
);

router.post(
  "/applications/:id/reject",
  restrictTo(permissions.kyc.reject),
  validate(ParamsUuid("id"), "params"),
  validate(KycRejectSchema),
  kycAdminController.rejectApplication
);

router.post(
  "/tutors/:tutorProfileId/ban",
  restrictTo(permissions.kyc.ban),
  validate(ParamsUuid("tutorProfileId"), "params"),
  validate(KycBanSchema),
  kycAdminController.banTutor
);

router.post(
  "/tutors/:tutorProfileId/suspend",
  restrictTo(permissions.kyc.suspend),
  validate(ParamsUuid("tutorProfileId"), "params"),
  validate(KycSuspendTutorSchema),
  kycAdminController.suspendTutor
);

router.post(
  "/tutors/:tutorProfileId/unsuspend",
  restrictTo(permissions.kyc.suspend),
  validate(ParamsUuid("tutorProfileId"), "params"),
  kycAdminController.unsuspendTutor
);

router.get(
  "/subjects/queue",
  restrictTo(permissions.kyc.subjectsRead),
  validate(KycSubjectQueueQuerySchema, "query"),
  kycAdminController.getSubjectQueue
);

router.post(
  "/subjects/:tutorSubjectId/approve",
  restrictTo(permissions.kyc.subjectsApprove),
  validate(ParamsUuid("tutorSubjectId"), "params"),
  validate(ApproveSubjectSchema),
  kycAdminController.approveSubject
);

router.post(
  "/subjects/:tutorSubjectId/reject",
  restrictTo(permissions.kyc.subjectsReject),
  validate(ParamsUuid("tutorSubjectId"), "params"),
  validate(RejectSubjectSchema),
  kycAdminController.rejectSubject
);

router.post(
  "/credentials/:credentialId/review",
  restrictTo(permissions.kyc.subjectsApprove, permissions.kyc.subjectsReject),
  validate(ParamsUuid("credentialId"), "params"),
  validate(ReviewCredentialSchema),
  kycAdminController.reviewCredential
);

router.get(
  "/spot-check-queue",
  restrictTo(permissions.kyc.spotCheckRead),
  kycAdminController.getSpotCheckQueue
);

router.post(
  "/spot-check/:kycStatusHistoryId/verdict",
  restrictTo(permissions.kyc.spotCheckRead),
  validate(ParamsUuid("kycStatusHistoryId"), "params"),
  validate(SpotCheckVerdictSchema),
  kycAdminController.submitSpotCheckVerdict
);

router.get(
  "/stats/:adminId",
  restrictTo(permissions.kyc.manage),
  validate(ParamsUuid("adminId"), "params"),
  kycAdminController.getAdminStats
);

router.get(
  "/sla-config",
  restrictTo(permissions.platform.configRead),
  kycAdminController.getSlaConfig
);

router.patch(
  "/sla-config",
  restrictTo(permissions.platform.configUpdate),
  validate(KycSlaConfigSchema),
  kycAdminController.updateSlaConfig
);

export default router;
