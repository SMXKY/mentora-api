-- CreateEnum
CREATE TYPE "GrantType" AS ENUM ('GRANT', 'REVOKE');

-- CreateEnum
CREATE TYPE "LogOperation" AS ENUM ('CREATE', 'READ', 'UPDATE', 'DELETE', 'RESTORE', 'SUSPEND', 'UNSUSPEND', 'BAN', 'APPROVE', 'REJECT', 'RELEASE', 'REFUND', 'TRANSFER', 'AUTH', 'FORGOT_PASSWORD', 'RESET_PASSWORD', 'CHANGE_PASSWORD', 'CHANGE_USER_CREDENTIALS');

-- CreateEnum
CREATE TYPE "LogCategory" AS ENUM ('WRITE', 'READ', 'SENSITIVE_READ', 'AUTH');

-- CreateEnum
CREATE TYPE "LogStatus" AS ENUM ('SUCCESS', 'FAILED');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'SUSPENDED', 'DEACTIVATED', 'BANNED');

-- CreateEnum
CREATE TYPE "UserGender" AS ENUM ('MALE', 'FEMALE', 'PREFER_NOT_TO_SAY');

-- CreateEnum
CREATE TYPE "PaymentAccountType" AS ENUM ('MTN_MOMO', 'ORANGE_MONEY');

-- CreateEnum
CREATE TYPE "SuspensionType" AS ENUM ('SUSPENSION', 'BAN');

-- CreateEnum
CREATE TYPE "PlatformTokenType" AS ENUM ('WHATSAPP_VERIFICATION', 'INVITE_LINK');

-- CreateEnum
CREATE TYPE "Languages" AS ENUM ('EN', 'FR');

-- CreateEnum
CREATE TYPE "KycStatus" AS ENUM ('INCOMPLETE', 'PENDING', 'IDENTITY_APPROVED', 'ACTIVE', 'REJECTED', 'SUSPENDED', 'BANNED', 'PENDING_REVERIFICATION');

-- CreateEnum
CREATE TYPE "QualificationType" AS ENUM ('BSC', 'MSC', 'PHD', 'PGDE', 'TEACHING_CERTIFICATE', 'PROFESSIONAL_CERTIFICATION', 'HND', 'GCE_A_LEVEL', 'GCE_O_LEVEL', 'OTHER');

-- CreateEnum
CREATE TYPE "CredentialStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "SubjectVerificationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "TeachingMode" AS ENUM ('ONLINE_ONLY', 'HOME_ONLY', 'BOTH');

-- CreateEnum
CREATE TYPE "AvailabilitySlotType" AS ENUM ('RECURRING', 'SPECIFIC_DATE');

-- CreateEnum
CREATE TYPE "AvailabilityDay" AS ENUM ('MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY');

-- CreateEnum
CREATE TYPE "SchoolType" AS ENUM ('PRIMARY', 'SECONDARY', 'GCE', 'UNIVERSITY', 'OTHER');

-- CreateEnum
CREATE TYPE "PreferredSessionMode" AS ENUM ('ONLINE', 'HOME', 'BOTH');

-- CreateEnum
CREATE TYPE "FileProcessingStatus" AS ENUM ('PENDING', 'PROCESSING', 'READY', 'FAILED', 'QUARANTINED');

-- CreateEnum
CREATE TYPE "FileType" AS ENUM ('VIDEO', 'AUDIO', 'DOCUMENT', 'IMAGE');

-- CreateEnum
CREATE TYPE "FileCategory" AS ENUM ('PROFILE_PHOTO', 'INTRO_VIDEO', 'KYC_DOCUMENT', 'LESSON_NOTE', 'LESSON_AUDIO', 'LESSON_VIDEO', 'SESSION_RECORDING', 'WHITEBOARD_EXPORT', 'RECEIPT', 'DISPUTE_EVIDENCE', 'MESSAGE_ATTACHMENT');

-- CreateEnum
CREATE TYPE "FileUploadType" AS ENUM ('SERVER_SIDE', 'PRESIGNED');

-- CreateEnum
CREATE TYPE "FileVariantType" AS ENUM ('VIDEO_720P', 'VIDEO_360P', 'IMAGE_RESIZED', 'IMAGE_THUMBNAIL');

-- CreateEnum
CREATE TYPE "QuotaOverrideSource" AS ENUM ('ADMIN_GRANT', 'PAID_PLAN');

-- CreateEnum
CREATE TYPE "MaterialType" AS ENUM ('VIDEO', 'AUDIO', 'DOCUMENT', 'IMAGE', 'WRITTEN_NOTE');

-- CreateEnum
CREATE TYPE "MaterialReviewDecision" AS ENUM ('WARNING', 'SUSPENDED', 'REMOVED', 'REINSTATED', 'FIX_ISSUE');

-- CreateEnum
CREATE TYPE "IdDocumentType" AS ENUM ('ORIGINAL_CNI', 'RECEIPT');

-- CreateEnum
CREATE TYPE "KycStep" AS ENUM ('STEP_1_IDENTITY', 'STEP_2_BIOGRAPHY', 'STEP_3_CREDENTIALS', 'STEP_4_REVIEW', 'SUBMITTED');

-- CreateEnum
CREATE TYPE "KycRejectionFlagItem" AS ENUM ('CNI_NUMBER_MISMATCH', 'SELFIE_MISMATCH', 'DOCUMENT_TYPE_MISMATCH', 'DEGREE_FIELD_MISMATCH', 'SUBJECT_NOT_SUPPORTED_BY_CREDENTIALS', 'DOCUMENT_EXPIRED', 'DOCUMENT_UNREADABLE', 'SUSPICIOUS_DOCUMENT', 'OTHER');

-- CreateEnum
CREATE TYPE "SessionType" AS ENUM ('ONLINE', 'HOME');

-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('REQUESTED', 'ACCEPTED', 'REJECTED', 'CANCELLED_UNPAID', 'PAID', 'IN_PROGRESS', 'AWAITING_CONFIRMATION', 'CONFIRMED', 'AUTO_CONFIRMED', 'DISPUTED', 'RESOLVED_TUTOR_FAVOR', 'RESOLVED_PARENT_FAVOR', 'CANCELLED_BY_TUTOR', 'CANCELLED_BY_PARENT');

-- CreateEnum
CREATE TYPE "RecurrenceType" AS ENUM ('WEEKLY', 'BIWEEKLY', 'CUSTOM');

-- CreateEnum
CREATE TYPE "RescheduleStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "GroupSessionStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'CONFIRMED', 'CANCELLED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "ParticipantPaymentStatus" AS ENUM ('PENDING', 'PAID', 'REFUNDED');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('ACCOUNT_CREATED', 'EMAIL_VERIFICATION', 'PASSWORD_RESET', 'NEW_DEVICE_LOGIN', 'ACCOUNT_SUSPENDED', 'ACCOUNT_UNSUSPENDED', 'TWO_FACTOR_LOCKED', 'KYC_SUBMITTED', 'KYC_IDENTITY_APPROVED', 'KYC_APPROVED', 'KYC_REJECTED', 'KYC_SLA_BREACH', 'KYC_BANNED', 'KYC_REVERIFICATION_REQUIRED', 'BOOKING_REQUESTED', 'BOOKING_ACCEPTED', 'BOOKING_REJECTED', 'BOOKING_CANCELLED_BY_TUTOR', 'BOOKING_CANCELLED_BY_PARENT', 'BOOKING_CANCELLED_UNPAID', 'PAYMENT_WINDOW_REMINDER', 'RESCHEDULE_REQUESTED', 'RESCHEDULE_ACCEPTED', 'RESCHEDULE_REJECTED', 'SESSION_REMINDER_24HR', 'SESSION_REMINDER_1HR', 'SESSION_CHECKIN_REMINDER', 'SESSION_CHECKIN_OVERDUE', 'SESSION_TUTOR_DISCONNECTED', 'SESSION_NO_SHOW', 'PAYMENT_CONFIRMED', 'WALLET_TOPPED_UP', 'WALLET_WITHDRAWAL_INITIATED', 'WITHDRAWAL_FAILED', 'ESCROW_RELEASED', 'REFUND_ISSUED', 'PAYOUT_ACCOUNT_ADDED', 'MONTHLY_FEE_DEDUCTED', 'MONTHLY_FEE_FAILED', 'PAYMENT_RECONCILIATION_PENDING', 'LESSON_AWAITING_CONFIRMATION', 'LESSON_CONFIRMED', 'LESSON_AUTO_CONFIRMED', 'DISPUTE_OPENED', 'DISPUTE_TUTOR_RESPONSE_REMINDER', 'DISPUTE_RESOLVED', 'DISPUTE_ESCALATED', 'REVIEW_WINDOW_OPENED', 'REVIEW_RECEIVED', 'REVIEW_RESPONSE_SUBMITTED', 'ACCOUNT_FLAGGED', 'REAUTH_REQUIRED', 'SUPPORT_TICKET_OPENED', 'SUPPORT_TICKET_RESPONSE', 'SUPPORT_TICKET_RESOLVED', 'MATERIAL_REMOVED', 'MATERIAL_ACCESS_GRANTED', 'PLATFORM_OUTAGE_REFUND', 'SCHEDULED_MAINTENANCE');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('IN_APP', 'EMAIL', 'PUSH', 'WHATSAPP', 'SMS');

-- CreateEnum
CREATE TYPE "NotificationDeliveryStatus" AS ENUM ('PENDING', 'DELIVERED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ScheduledNotificationStatus" AS ENUM ('PENDING', 'DELIVERED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "WalletType" AS ENUM ('PARENT', 'STUDENT', 'TUTOR');

-- CreateEnum
CREATE TYPE "EscrowStatus" AS ENUM ('HELD', 'RELEASED', 'REFUNDED', 'FROZEN');

-- CreateEnum
CREATE TYPE "PayoutQueueStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'WAITING_ON_FLOAT', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "LedgerOperation" AS ENUM ('WALLET_TOPUP', 'BOOKING_PAYMENT', 'BOOKING_PAYMENT_MOMO', 'ESCROW_RELEASE', 'ESCROW_REFUND', 'WALLET_WITHDRAWAL', 'COMMISSION_DEDUCTION', 'MONTHLY_FEE', 'PLATFORM_WITHDRAWAL', 'MANUAL_ADJUSTMENT');

-- CreateEnum
CREATE TYPE "LedgerStatus" AS ENUM ('SUCCESS', 'FAILED', 'PENDING', 'REVERSED');

-- CreateEnum
CREATE TYPE "TransactionIssueType" AS ENUM ('FAILED_PAYOUT', 'PENDING_RECONCILIATION', 'MANUAL_INVESTIGATION');

-- CreateEnum
CREATE TYPE "TransactionIssueStatus" AS ENUM ('OPEN', 'INVESTIGATING', 'RESOLVED', 'ESCALATED');

-- CreateEnum
CREATE TYPE "PaymentDirection" AS ENUM ('USER_TO_PLATFORM', 'PLATFORM_TO_USER', 'INTERNAL');

-- CreateEnum
CREATE TYPE "LiveRoomStatus" AS ENUM ('PENDING', 'CREATED', 'ACTIVE', 'ENDED', 'FAILED');

-- CreateEnum
CREATE TYPE "SessionEndReason" AS ENUM ('TUTOR_ENDED', 'TIMEOUT', 'EMPTY_TIMEOUT', 'ALL_LEFT');

-- CreateEnum
CREATE TYPE "ParticipantRole" AS ENUM ('TUTOR', 'STUDENT', 'PARENT', 'ADMIN');

-- CreateEnum
CREATE TYPE "ConnectionQuality" AS ENUM ('EXCELLENT', 'GOOD', 'FAIR', 'POOR', 'LOST');

-- CreateEnum
CREATE TYPE "ParticipantEventType" AS ENUM ('JOINED', 'LEFT', 'RECONNECTING', 'RECONNECTED', 'REMOVED', 'MUTED', 'UNMUTED');

-- CreateEnum
CREATE TYPE "ConversationType" AS ENUM ('INQUIRY', 'DIRECT', 'GROUP', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ConversationStatus" AS ENUM ('ACTIVE', 'ARCHIVED', 'FROZEN');

-- CreateEnum
CREATE TYPE "MessageStatus" AS ENUM ('SENT', 'DELIVERED', 'READ', 'DELETED');

-- CreateEnum
CREATE TYPE "MessageFilterResult" AS ENUM ('CLEAN', 'BLOCKED_PHONE', 'BLOCKED_URL', 'BLOCKED_SOCIAL', 'BLOCKED_OBFUSCATED', 'BLOCKED_INTENT_KEYWORD');

-- CreateEnum
CREATE TYPE "ConversationParticipantRole" AS ENUM ('MEMBER', 'ADMIN');

-- CreateEnum
CREATE TYPE "ModerationReviewStatus" AS ENUM ('PENDING', 'REVIEWED', 'WARNING_ISSUED', 'FROZEN', 'ESCALATED', 'RESOLVED');

-- CreateEnum
CREATE TYPE "ModerationReviewTrigger" AS ENUM ('FILTER_ESCALATION', 'TRUST_SAFETY_FLAG', 'MANUAL_REPORT', 'ADMIN_INITIATED');

-- CreateEnum
CREATE TYPE "FilterKeywordLanguage" AS ENUM ('EN', 'FR', 'ANY');

-- CreateEnum
CREATE TYPE "ConfirmationAction" AS ENUM ('CONFIRMED', 'AUTO_CONFIRMED');

-- CreateEnum
CREATE TYPE "AutoResolutionRecommendationType" AS ENUM ('TUTOR_FAVOR', 'PARENT_FAVOR', 'ADMIN_REVIEW');

-- CreateEnum
CREATE TYPE "DisputeStatus" AS ENUM ('OPEN', 'AWAITING_ADMIN', 'UNDER_REVIEW', 'RESOLVED_TUTOR_FAVOR', 'RESOLVED_PARENT_FAVOR', 'ESCALATED');

-- CreateEnum
CREATE TYPE "DisputeReason" AS ENUM ('LESSON_DID_NOT_HAPPEN', 'LESSON_SIGNIFICANTLY_SHORTER', 'TUTOR_DID_NOT_COVER_SUBJECT', 'TUTOR_BEHAVIOUR_INAPPROPRIATE', 'TECHNICAL_ISSUES_PREVENTED_LESSON', 'OTHER');

-- CreateEnum
CREATE TYPE "DisputeEvidenceParty" AS ENUM ('PARENT', 'TUTOR');

-- CreateEnum
CREATE TYPE "IncidentReportType" AS ENUM ('PARENT_REPORTING_TUTOR', 'TUTOR_REPORTING_PARENT', 'TUTOR_REPORTING_STUDENT');

-- CreateEnum
CREATE TYPE "IncidentReason" AS ENUM ('INAPPROPRIATE_LANGUAGE_OR_BEHAVIOUR', 'DID_NOT_COVER_AGREED_SUBJECT', 'SIGNIFICANTLY_LATE_OR_UNPREPARED', 'MADE_UNCOMFORTABLE', 'ATTEMPTED_OFF_PLATFORM_CONTACT', 'ABUSIVE_OR_DISRESPECTFUL', 'UNREASONABLE_DEMANDS', 'NO_SHOW_WITHOUT_CANCELLATION', 'OTHER');

-- CreateEnum
CREATE TYPE "ReviewAuthorRole" AS ENUM ('PARENT', 'STUDENT', 'TUTOR');

-- CreateEnum
CREATE TYPE "ReviewSubjectRole" AS ENUM ('TUTOR', 'PARENT', 'STUDENT');

-- CreateEnum
CREATE TYPE "ReviewStatus" AS ENUM ('PENDING', 'SUBMITTED', 'REVEALED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "ReportReason" AS ENUM ('FAKE_OR_SPAM', 'INAPPROPRIATE_CONTENT', 'HARASSMENT', 'IRRELEVANT', 'OTHER');

-- CreateEnum
CREATE TYPE "ReviewReportStatus" AS ENUM ('PENDING', 'DISMISSED', 'WARNING_ISSUED', 'REMOVED', 'ESCALATED');

-- CreateEnum
CREATE TYPE "ReviewFraudSignalType" AS ENUM ('COORDINATED_REVIEW_BURST', 'ZERO_BOOKING_HISTORY_CLUSTER', 'EXCESSIVE_REPORTS_BY_ACCOUNT');

-- CreateEnum
CREATE TYPE "RiskState" AS ENUM ('GREEN', 'YELLOW', 'ORANGE', 'RED');

-- CreateEnum
CREATE TYPE "ReauthChallengeStatus" AS ENUM ('PENDING', 'PASSED', 'FAILED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "DeadLetterJobStatus" AS ENUM ('FAILED', 'RETRYING', 'RESOLVED', 'DISMISSED');

-- CreateEnum
CREATE TYPE "TicketStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'AWAITING_USER', 'ESCALATED', 'RESOLVED', 'CLOSED', 'REOPENED');

-- CreateEnum
CREATE TYPE "TicketCategory" AS ENUM ('PAYMENT_ISSUE', 'BOOKING_ISSUE', 'ACCOUNT_ACCESS', 'KYC_QUERY', 'DISPUTE_QUERY', 'WITHDRAWAL_FAILED', 'RECONCILIATION_PENDING', 'TECHNICAL_ISSUE', 'POLICY_QUERY', 'OTHER');

-- CreateEnum
CREATE TYPE "TicketCreationSource" AS ENUM ('USER_MANUAL', 'SYSTEM_FAILED_PAYOUT', 'SYSTEM_RECONCILIATION');

-- CreateEnum
CREATE TYPE "TicketMessageAuthorType" AS ENUM ('USER', 'SUPPORT_AGENT', 'ADMIN', 'SYSTEM');

-- CreateEnum
CREATE TYPE "AnalyticsSnapshotType" AS ENUM ('REVENUE_METRICS', 'USER_METRICS', 'DEMAND_SIGNALS', 'TUTOR_PERFORMANCE', 'PLATFORM_HEALTH', 'LEARNING_HEALTH');

-- CreateEnum
CREATE TYPE "ReportFormat" AS ENUM ('CSV', 'PDF');

-- CreateEnum
CREATE TYPE "ReportSchedule" AS ENUM ('DAILY', 'WEEKLY', 'MONTHLY');

-- CreateEnum
CREATE TYPE "GeneratedReportStatus" AS ENUM ('QUEUED', 'GENERATING', 'COMPLETED', 'FAILED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "ReportType" AS ENUM ('REVENUE_SUMMARY', 'USER_REGISTRATIONS', 'TUTOR_PERFORMANCE', 'BOOKING_SUMMARY', 'DISPUTE_SUMMARY', 'PAYMENT_LEDGER', 'KYC_PIPELINE', 'TRUST_SAFETY_SUMMARY', 'DEMAND_SIGNALS', 'LEARNING_ANALYTICS', 'CUSTOM');

-- CreateEnum
CREATE TYPE "HeartbeatJobStatus" AS ENUM ('HEALTHY', 'MISSED', 'DISABLED');

-- CreateEnum
CREATE TYPE "LearningSnapshotScope" AS ENUM ('STUDENT_SUBJECT', 'TUTOR_SUBJECT', 'PLATFORM_AGGREGATE');

-- CreateEnum
CREATE TYPE "EngagementTrend" AS ENUM ('IMPROVING', 'STABLE', 'DECLINING', 'INSUFFICIENT_DATA');

-- CreateEnum
CREATE TYPE "ConfigCategory" AS ENUM ('RBAC', 'RATE_LIMITING', 'FEATURE_FLAGS', 'MEDIA', 'STORAGE', 'SECURITY', 'LOCALIZATION');

-- CreateTable
CREATE TABLE "roles" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permission_modules" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name_locale_code" VARCHAR(100) NOT NULL,
    "description_locale_code" VARCHAR(100),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "permission_modules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permission_submodules" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name_locale_code" VARCHAR(100) NOT NULL,
    "description_locale_code" VARCHAR(100),
    "permission_module_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "permission_submodules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permissions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "code" VARCHAR(100) NOT NULL,
    "name_locale_code" VARCHAR(100) NOT NULL,
    "description_locale_code" VARCHAR(100),
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "permission_module_id" UUID NOT NULL,
    "permission_submodule_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_permissions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "role_id" UUID NOT NULL,
    "permission_id" UUID NOT NULL,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_roles" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "role_id" UUID NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "expires_at" TIMESTAMP(3),
    "created_by" UUID NOT NULL,
    "reason" VARCHAR(255),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permission_overrides" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "permission_id" UUID NOT NULL,
    "grant_type" "GrantType" NOT NULL,
    "expires_at" TIMESTAMP(3),
    "created_by" UUID NOT NULL,
    "reason" VARCHAR(255),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "permission_overrides_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permission_implications" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "permission_id" UUID NOT NULL,
    "implied_permission_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "permission_implications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ip_blocks" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "ip_address" VARCHAR(45) NOT NULL,
    "ip_range" VARCHAR(50),
    "reason" TEXT NOT NULL,
    "blocked_by" UUID NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ip_blocks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "actor_id" UUID,
    "actor_email" VARCHAR(255),
    "actor_role" VARCHAR(50),
    "event_type" VARCHAR(100) NOT NULL,
    "operation" "LogOperation" NOT NULL,
    "category" "LogCategory" NOT NULL,
    "status" "LogStatus" NOT NULL DEFAULT 'SUCCESS',
    "failure_reason" TEXT,
    "table_name" VARCHAR(100) NOT NULL,
    "target_id" VARCHAR(255),
    "target_type" VARCHAR(100),
    "previous_state" JSONB,
    "new_state" JSONB,
    "changed_fields" TEXT[],
    "ip_address" VARCHAR(45),
    "user_agent" TEXT,
    "request_id" UUID,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "clerk_id" VARCHAR(255) NOT NULL,
    "google_auth_id" VARCHAR(255),
    "facebook_auth_id" VARCHAR(255),
    "first_name" VARCHAR(100),
    "last_name" VARCHAR(155),
    "username" VARCHAR(100),
    "email" VARCHAR(255) NOT NULL,
    "is_email_verified" BOOLEAN NOT NULL DEFAULT false,
    "phone_number" VARCHAR(20),
    "whatsapp_number" VARCHAR(20),
    "whatsapp_opt_in" BOOLEAN NOT NULL DEFAULT false,
    "whatsapp_opt_in_at" TIMESTAMP(3),
    "dob" DATE,
    "gender" "UserGender" NOT NULL DEFAULT 'PREFER_NOT_TO_SAY',
    "profile_picture_url" VARCHAR(500),
    "address" VARCHAR(500),
    "preferred_language" "Languages" NOT NULL DEFAULT 'EN',
    "notifications_muted" BOOLEAN NOT NULL DEFAULT false,
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "is_account_complete" BOOLEAN NOT NULL DEFAULT false,
    "last_logged_in_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_devices" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "device_fingerprint_hash" VARCHAR(255) NOT NULL,
    "ip_address" VARCHAR(45),
    "os" VARCHAR(100),
    "browser" VARCHAR(100),
    "browser_version" VARCHAR(50),
    "device_type" VARCHAR(50),
    "last_seen_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_devices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_sessions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "device_id" UUID NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "last_active_at" TIMESTAMP(3),
    "terminated_at" TIMESTAMP(3),
    "terminated_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_tokens" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "token_hash" VARCHAR(255) NOT NULL,
    "token_type" "PlatformTokenType" NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used_at" TIMESTAMP(3),
    "attempt_count" INTEGER NOT NULL DEFAULT 0,
    "invalidated_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "platform_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_accounts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "phone_number" VARCHAR(20) NOT NULL,
    "account_type" "PaymentAccountType" NOT NULL,
    "is_verified" BOOLEAN NOT NULL DEFAULT false,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "cooling_off_until" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "payment_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account_suspensions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "suspension_type" "SuspensionType" NOT NULL DEFAULT 'SUSPENSION',
    "reason" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3),
    "lifted_at" TIMESTAMP(3),
    "lifted_by" UUID,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "account_suspensions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "regions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(100) NOT NULL,
    "country_code" VARCHAR(5) NOT NULL DEFAULT 'CM',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "regions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cities" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(100) NOT NULL,
    "region_id" UUID NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_in_allowlist" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subject_domains" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(100) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subject_domains_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subjects" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(100) NOT NULL,
    "domain_id" UUID NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subjects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subject_relationship_weights" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "qualification_type" "QualificationType" NOT NULL,
    "field_of_study" VARCHAR(255) NOT NULL,
    "subject_id" UUID NOT NULL,
    "confidence_weight" INTEGER NOT NULL,
    "set_by" UUID NOT NULL,
    "set_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "subject_relationship_weights_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "levels" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(100) NOT NULL,
    "school_type" "SchoolType" NOT NULL,
    "order_index" INTEGER NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "levels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tutor_profiles" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "bio" TEXT NOT NULL,
    "years_of_experience" INTEGER NOT NULL DEFAULT 0,
    "teaching_mode" "TeachingMode" NOT NULL DEFAULT 'ONLINE_ONLY',
    "languages" "Languages"[] DEFAULT ARRAY['EN']::"Languages"[],
    "intro_video_url" VARCHAR(500),
    "cv_url" VARCHAR(500),
    "profile_picture_url" VARCHAR(500),
    "city_id" UUID NOT NULL,
    "neighbourhood" VARCHAR(255),
    "exact_address" VARCHAR(500),
    "kyc_status" "KycStatus" NOT NULL DEFAULT 'INCOMPLETE',
    "kyc_submitted_at" TIMESTAMP(3),
    "kyc_approved_at" TIMESTAMP(3),
    "kyc_rejected_at" TIMESTAMP(3),
    "kyc_rejection_reason" TEXT,
    "is_payment_overdue" BOOLEAN NOT NULL DEFAULT false,
    "response_rate" INTEGER,
    "composite_score" DECIMAL(65,30),
    "completed_sessions_count" INTEGER NOT NULL DEFAULT 0,
    "min_rate_xaf" INTEGER,
    "max_rate_xaf" INTEGER,
    "new_tutor_boost_expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "tutor_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tutor_credentials" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tutor_profile_id" UUID NOT NULL,
    "institution_name" VARCHAR(255) NOT NULL,
    "qualification_type" "QualificationType" NOT NULL,
    "field_of_study" VARCHAR(255) NOT NULL,
    "grade_or_classification" VARCHAR(100),
    "year_awarded" INTEGER NOT NULL,
    "document_url" VARCHAR(500) NOT NULL,
    "status" "CredentialStatus" NOT NULL DEFAULT 'PENDING',
    "reviewed_by" UUID,
    "reviewed_at" TIMESTAMP(3),
    "rejection_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tutor_credentials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "credential_subject_links" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "credential_id" UUID NOT NULL,
    "subject_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "credential_subject_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tutor_subjects" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tutor_profile_id" UUID NOT NULL,
    "subject_id" UUID NOT NULL,
    "status" "SubjectVerificationStatus" NOT NULL DEFAULT 'PENDING',
    "confidence_score" INTEGER,
    "confidence_explanation" TEXT,
    "approved_by" UUID,
    "approved_at" TIMESTAMP(3),
    "rejected_reason" TEXT,
    "rate_per_online_session_xaf" INTEGER,
    "rate_per_home_session_xaf" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tutor_subjects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "availability_slots" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tutor_profile_id" UUID NOT NULL,
    "slot_type" "AvailabilitySlotType" NOT NULL,
    "day_of_week" "AvailabilityDay",
    "start_time" TIME NOT NULL,
    "end_time" TIME NOT NULL,
    "specific_date" DATE,
    "buffer_minutes" INTEGER NOT NULL DEFAULT 30,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "availability_slots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "student_profiles" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "first_name" VARCHAR(100) NOT NULL,
    "dob" DATE,
    "level_id" UUID,
    "school_type" "SchoolType",
    "exam_or_goal" VARCHAR(255),
    "preferred_mode" "PreferredSessionMode",
    "preferred_language" "Languages",
    "special_notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "student_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "student_profile_subjects" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "student_profile_id" UUID NOT NULL,
    "subject_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "student_profile_subjects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "files" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "uploaded_by" UUID NOT NULL,
    "ref_table" VARCHAR(100),
    "ref_record_id" UUID,
    "original_file_name" VARCHAR(255) NOT NULL,
    "storage_path" VARCHAR(500) NOT NULL,
    "file_category" "FileCategory" NOT NULL,
    "file_type" "FileType" NOT NULL,
    "mime_type" VARCHAR(100) NOT NULL,
    "file_size_bytes" BIGINT NOT NULL,
    "upload_type" "FileUploadType" NOT NULL,
    "status" "FileProcessingStatus" NOT NULL DEFAULT 'PENDING',
    "processing_started_at" TIMESTAMP(3),
    "processing_completed_at" TIMESTAMP(3),
    "processing_error" TEXT,
    "scan_result" VARCHAR(50),
    "scan_completed_at" TIMESTAMP(3),
    "is_dispute_locked" BOOLEAN NOT NULL DEFAULT false,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "file_variants" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "file_id" UUID NOT NULL,
    "variant" "FileVariantType" NOT NULL,
    "storage_path" VARCHAR(500) NOT NULL,
    "file_size_bytes" BIGINT NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "bitrate_kbps" INTEGER,
    "status" "FileProcessingStatus" NOT NULL DEFAULT 'PENDING',
    "processing_error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "file_variants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "storage_quota_defaults" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "role_id" UUID NOT NULL,
    "quota_limit_bytes" BIGINT NOT NULL,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "storage_quota_defaults_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "storage_quota_overrides" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "quota_limit_bytes" BIGINT NOT NULL,
    "source" "QuotaOverrideSource" NOT NULL DEFAULT 'ADMIN_GRANT',
    "granted_by" UUID NOT NULL,
    "reason" TEXT,
    "expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "storage_quota_overrides_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "storage_usage" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "used_bytes" BIGINT NOT NULL DEFAULT 0,
    "last_updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "storage_usage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "collections" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tutor_profile_id" UUID NOT NULL,
    "subject_id" UUID NOT NULL,
    "level_id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "is_published" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "collections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sections" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "collection_id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "description" VARCHAR(255),
    "order_index" INTEGER NOT NULL,
    "is_free_preview" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "sections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "materials" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "collection_id" UUID NOT NULL,
    "section_id" UUID,
    "name" VARCHAR(255) NOT NULL,
    "material_type" "MaterialType" NOT NULL,
    "order_index" INTEGER NOT NULL,
    "file_id" UUID,
    "content_json" JSONB,
    "is_free_preview" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "materials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lesson_plans" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "collection_id" UUID NOT NULL,
    "tutor_profile_id" UUID NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "is_published" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "lesson_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lesson_plan_topics" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "lesson_plan_id" UUID NOT NULL,
    "section_id" UUID,
    "title" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "order_index" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "lesson_plan_topics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "material_access" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "collection_id" UUID NOT NULL,
    "booking_id" UUID NOT NULL,
    "granted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "material_access_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "material_reviews" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "collection_id" UUID NOT NULL,
    "material_id" UUID,
    "reviewed_by" UUID NOT NULL,
    "tutor_id" UUID NOT NULL,
    "reported_by" UUID,
    "report_reason" VARCHAR(255),
    "decision" "MaterialReviewDecision" NOT NULL,
    "review_note" TEXT,
    "removal_reason" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "material_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kyc_applications" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tutor_profile_id" UUID NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "current_step" "KycStep" NOT NULL DEFAULT 'STEP_1_IDENTITY',
    "id_document_type" "IdDocumentType",
    "cni_number" VARCHAR(20),
    "cni_date_issued" DATE,
    "cni_expiration_date" DATE,
    "cni_front_photo_id" UUID,
    "cni_back_photo_id" UUID,
    "selfie_with_cni_id" UUID,
    "full_legal_name" VARCHAR(255),
    "surname" VARCHAR(255),
    "dob" DATE,
    "gender" "UserGender",
    "place_of_birth" VARCHAR(255),
    "current_street" VARCHAR(255),
    "current_neighbourhood" VARCHAR(255),
    "current_city_id" UUID,
    "current_region_id" UUID,
    "city_of_origin" VARCHAR(255),
    "region_of_origin" VARCHAR(255),
    "emergency_contact_name" VARCHAR(255),
    "emergency_contact_phone" VARCHAR(20),
    "self_declaration_statement" VARCHAR(500),
    "declaration_accepted" BOOLEAN NOT NULL DEFAULT false,
    "declaration_accepted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "kyc_applications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kyc_status_history" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "kyc_application_id" UUID NOT NULL,
    "tutor_profile_id" UUID NOT NULL,
    "previous_status" "KycStatus",
    "new_status" "KycStatus" NOT NULL,
    "changed_by" UUID NOT NULL,
    "reason" TEXT,
    "review_duration_seconds" INTEGER,
    "checklist_completed" BOOLEAN,
    "flagged_for_spot_check" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "kyc_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kyc_rejection_flags" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "kyc_application_id" UUID NOT NULL,
    "kyc_status_history_id" UUID NOT NULL,
    "flag_item" "KycRejectionFlagItem" NOT NULL,
    "reason" TEXT NOT NULL,
    "admin_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "kyc_rejection_flags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kyc_checklist_submissions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "kyc_application_id" UUID NOT NULL,
    "kyc_status_history_id" UUID NOT NULL,
    "reviewed_by" UUID NOT NULL,
    "cni_number_matches_document" BOOLEAN NOT NULL DEFAULT false,
    "selfie_matches_cni_photo" BOOLEAN NOT NULL DEFAULT false,
    "document_type_matches_declaration" BOOLEAN NOT NULL DEFAULT false,
    "degree_matches_field_of_study" BOOLEAN NOT NULL DEFAULT false,
    "subjects_supported_by_credentials" BOOLEAN NOT NULL DEFAULT false,
    "review_opened_at" TIMESTAMP(3) NOT NULL,
    "submitted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "kyc_checklist_submissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kyc_bans" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tutor_profile_id" UUID NOT NULL,
    "banned_by" UUID NOT NULL,
    "reason" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "kyc_bans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "demand_signals" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "subject_id" UUID,
    "city_id" UUID,
    "user_id" UUID,
    "search_query" VARCHAR(255),
    "is_notify_me" BOOLEAN NOT NULL DEFAULT false,
    "notified_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "demand_signals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "booking_series" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "parent_id" UUID NOT NULL,
    "tutor_profile_id" UUID NOT NULL,
    "subject_id" UUID NOT NULL,
    "level_id" UUID NOT NULL,
    "session_type" "SessionType" NOT NULL DEFAULT 'ONLINE',
    "recurrence_type" "RecurrenceType" NOT NULL,
    "recurrence_days" TEXT[],
    "start_date" DATE NOT NULL,
    "end_date" DATE,
    "occurrence_count" INTEGER,
    "duration_minutes" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "booking_series_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bookings" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "booker_id" UUID,
    "student_profile_id" UUID,
    "tutor_profile_id" UUID NOT NULL,
    "subject_id" UUID NOT NULL,
    "level_id" UUID NOT NULL,
    "session_type" "SessionType" NOT NULL DEFAULT 'ONLINE',
    "duration_minutes" INTEGER NOT NULL,
    "message_to_tutor" TEXT,
    "session_date" DATE NOT NULL,
    "session_start_time" TIME NOT NULL,
    "session_end_time" TIME NOT NULL,
    "payment_window_expires_at" TIMESTAMP(3),
    "agreed_rate_xaf" INTEGER,
    "commission_rate_percent" INTEGER,
    "commission_amount_xaf" INTEGER,
    "net_tutor_amount_xaf" INTEGER,
    "tax_type" VARCHAR(50),
    "tax_rate_percent" INTEGER,
    "tax_amount_xaf" INTEGER,
    "total_amount_xaf" INTEGER,
    "status" "BookingStatus" NOT NULL DEFAULT 'REQUESTED',
    "rejection_reason" TEXT,
    "cancelled_by" UUID,
    "cancelled_at" TIMESTAMP(3),
    "cancellation_reason" TEXT,
    "tutor_checked_in_at" TIMESTAMP(3),
    "booker_checked_in_at" TIMESTAMP(3),
    "tutor_checked_out_at" TIMESTAMP(3),
    "booker_checked_out_at" TIMESTAMP(3),
    "is_group_session" BOOLEAN NOT NULL DEFAULT false,
    "series_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "bookings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "group_session_participants" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "booking_id" UUID NOT NULL,
    "student_id" UUID NOT NULL,
    "student_profile_id" UUID,
    "payment_status" "ParticipantPaymentStatus" NOT NULL DEFAULT 'PENDING',
    "agreed_rate_xaf" INTEGER,
    "commission_amount_xaf" INTEGER,
    "net_tutor_amount_xaf" INTEGER,
    "tax_amount_xaf" INTEGER,
    "total_amount_xaf" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "group_session_participants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "group_sessions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tutor_profile_id" UUID NOT NULL,
    "booking_id" UUID NOT NULL,
    "subject_id" UUID NOT NULL,
    "level_id" UUID NOT NULL,
    "topic" VARCHAR(255) NOT NULL,
    "min_students" INTEGER NOT NULL,
    "max_students" INTEGER NOT NULL,
    "price_per_student_xaf" INTEGER NOT NULL,
    "registration_cutoff_at" TIMESTAMP(3) NOT NULL,
    "status" "GroupSessionStatus" NOT NULL DEFAULT 'DRAFT',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "group_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reschedule_requests" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "booking_id" UUID NOT NULL,
    "requested_by" UUID NOT NULL,
    "proposed_date" DATE NOT NULL,
    "proposed_start_time" TIME NOT NULL,
    "proposed_end_time" TIME NOT NULL,
    "reason" TEXT,
    "status" "RescheduleStatus" NOT NULL DEFAULT 'PENDING',
    "responded_by" UUID,
    "responded_at" TIMESTAMP(3),
    "rejection_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reschedule_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "recipient_id" UUID NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title_code" VARCHAR(255) NOT NULL,
    "body_code" VARCHAR(255) NOT NULL,
    "data" JSONB,
    "is_transactional" BOOLEAN NOT NULL DEFAULT false,
    "read_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_deliveries" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "notification_id" UUID NOT NULL,
    "channel" "NotificationChannel" NOT NULL,
    "status" "NotificationDeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "attempt_number" INTEGER NOT NULL DEFAULT 1,
    "failure_reason" TEXT,
    "attempted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "delivered_at" TIMESTAMP(3),

    CONSTRAINT "notification_deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scheduled_notifications" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "recipient_id" UUID NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title_code" VARCHAR(255) NOT NULL,
    "body_code" VARCHAR(255) NOT NULL,
    "data" JSONB,
    "scheduled_for" TIMESTAMP(3) NOT NULL,
    "job_id" VARCHAR(255),
    "status" "ScheduledNotificationStatus" NOT NULL DEFAULT 'PENDING',
    "booking_id" UUID,
    "delivered_at" TIMESTAMP(3),
    "cancelled_at" TIMESTAMP(3),
    "failure_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "scheduled_notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_preferences" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "notification_type" "NotificationType" NOT NULL,
    "channel" "NotificationChannel" NOT NULL,
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "push_tokens" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "device_id" UUID,
    "fcm_token" VARCHAR(500) NOT NULL,
    "platform" VARCHAR(20) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "invalidated_at" TIMESTAMP(3),
    "invalidation_reason" VARCHAR(100),
    "last_used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "push_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wallets" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "wallet_type" "WalletType" NOT NULL,
    "balance_xaf" INTEGER NOT NULL DEFAULT 0,
    "pending_escrow_xaf" INTEGER,
    "total_earned_xaf" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wallets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "escrow_holds" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "booking_id" UUID NOT NULL,
    "group_participant_id" UUID,
    "payer_id" UUID NOT NULL,
    "tutor_id" UUID NOT NULL,
    "gross_amount_xaf" INTEGER NOT NULL,
    "commission_rate_snapshot" INTEGER NOT NULL,
    "commission_amount_xaf" INTEGER NOT NULL,
    "momo_fee_xaf" INTEGER NOT NULL DEFAULT 0,
    "net_tutor_amount_xaf" INTEGER NOT NULL,
    "status" "EscrowStatus" NOT NULL DEFAULT 'HELD',
    "released_at" TIMESTAMP(3),
    "refunded_at" TIMESTAMP(3),
    "frozen_at" TIMESTAMP(3),
    "released_by_dispute_id" UUID,
    "auto_released" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "escrow_holds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_commission" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "balance_xaf" INTEGER NOT NULL DEFAULT 0,
    "last_updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_by_ledger_entry_id" UUID,

    CONSTRAINT "platform_commission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transaction_ledger" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "from_user_id" UUID,
    "to_user_id" UUID,
    "operation" "LedgerOperation" NOT NULL,
    "direction" "PaymentDirection" NOT NULL,
    "status" "LedgerStatus" NOT NULL DEFAULT 'SUCCESS',
    "amount_xaf" INTEGER NOT NULL,
    "provider_transaction_id" VARCHAR(255),
    "provider_service" VARCHAR(50),
    "momo_phone" VARCHAR(20),
    "momo_provider" VARCHAR(20),
    "momo_fee_xaf" INTEGER,
    "booking_id" UUID,
    "escrow_hold_id" UUID,
    "payout_queue_id" UUID,
    "idempotency_key_id" UUID,
    "is_platform_sender" BOOLEAN NOT NULL DEFAULT false,
    "is_platform_receiver" BOOLEAN NOT NULL DEFAULT false,
    "failure_reason" TEXT,
    "admin_reason" TEXT,
    "performed_by" UUID,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transaction_ledger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payout_queue" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "payment_account_id" UUID NOT NULL,
    "gross_amount_xaf" INTEGER NOT NULL,
    "momo_fee_xaf" INTEGER NOT NULL,
    "net_amount_xaf" INTEGER NOT NULL,
    "status" "PayoutQueueStatus" NOT NULL DEFAULT 'PENDING',
    "provider_transaction_id" VARCHAR(255),
    "provider_response" JSONB,
    "attempt_count" INTEGER NOT NULL DEFAULT 0,
    "last_attempted_at" TIMESTAMP(3),
    "next_retry_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "failed_at" TIMESTAMP(3),
    "failure_reason" TEXT,
    "cancelled_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payout_queue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "idempotency_keys" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "key" VARCHAR(255) NOT NULL,
    "operation" VARCHAR(100) NOT NULL,
    "response_status" INTEGER NOT NULL,
    "response_body" JSONB NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "idempotency_keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_reconciliations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "booking_id" UUID,
    "provider_transaction_id" VARCHAR(255) NOT NULL,
    "provider_status" VARCHAR(50),
    "provider_query_response" JSONB,
    "queried_at" TIMESTAMP(3),
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "resolved_at" TIMESTAMP(3),
    "resolution_action" VARCHAR(100),
    "support_ticket_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_reconciliations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transaction_issues" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "issue_type" "TransactionIssueType" NOT NULL,
    "status" "TransactionIssueStatus" NOT NULL DEFAULT 'OPEN',
    "payout_queue_id" UUID,
    "reconciliation_id" UUID,
    "ledger_entry_id" UUID,
    "amount_xaf" INTEGER,
    "failure_reason" TEXT,
    "provider_response" JSONB,
    "support_ticket_id" UUID,
    "resolved_by" UUID,
    "resolved_at" TIMESTAMP(3),
    "resolution_note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "transaction_issues_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "receipts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "reference_number" VARCHAR(50) NOT NULL,
    "booking_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "file_id" UUID NOT NULL,
    "amount_xaf" INTEGER NOT NULL,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "receipts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "monthly_fee_charges" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tutor_profile_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "period_start" DATE NOT NULL,
    "amount_xaf" INTEGER NOT NULL,
    "is_paid" BOOLEAN NOT NULL DEFAULT false,
    "paid_at" TIMESTAMP(3),
    "grace_period_ends_at" TIMESTAMP(3),
    "is_overdue" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "monthly_fee_charges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "live_rooms" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "booking_id" UUID NOT NULL,
    "room_name" VARCHAR(255) NOT NULL,
    "status" "LiveRoomStatus" NOT NULL DEFAULT 'PENDING',
    "scheduled_start_at" TIMESTAMP(3) NOT NULL,
    "scheduled_end_at" TIMESTAMP(3) NOT NULL,
    "room_create_at" TIMESTAMP(3),
    "room_created_at" TIMESTAMP(3),
    "actual_start_at" TIMESTAMP(3),
    "actual_end_at" TIMESTAMP(3),
    "end_reason" "SessionEndReason",
    "overlap_seconds" INTEGER,
    "overlap_percentage" INTEGER,
    "whiteboard_file_id" UUID,
    "recording_file_id" UUID,
    "creation_failed_at" TIMESTAMP(3),
    "creation_failure_reason" TEXT,
    "creation_attempts" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "live_rooms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session_participants" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "live_room_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "participant_role" "ParticipantRole" NOT NULL,
    "first_joined_at" TIMESTAMP(3),
    "last_left_at" TIMESTAMP(3),
    "total_time_seconds" INTEGER,
    "device_type" VARCHAR(50),
    "browser" VARCHAR(100),
    "os" VARCHAR(100),
    "livekit_participant_identity" VARCHAR(255),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "session_participants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "participant_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "live_room_id" UUID NOT NULL,
    "session_participant_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "event_type" "ParticipantEventType" NOT NULL,
    "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actioned_by" UUID,
    "source" VARCHAR(50) NOT NULL DEFAULT 'livekit_webhook',
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "participant_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "connection_quality_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "live_room_id" UUID NOT NULL,
    "session_participant_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "quality" "ConnectionQuality" NOT NULL,
    "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "duration_seconds" INTEGER,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "connection_quality_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "type" "ConversationType" NOT NULL,
    "status" "ConversationStatus" NOT NULL DEFAULT 'ACTIVE',
    "booking_id" UUID,
    "last_message_at" TIMESTAMP(3),
    "last_message_preview" VARCHAR(100),
    "frozen_by" UUID,
    "frozen_at" TIMESTAMP(3),
    "freeze_reason" TEXT,
    "block_count_conversation" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversation_participants" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "conversation_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "role" "ConversationParticipantRole" NOT NULL DEFAULT 'MEMBER',
    "unread_count" INTEGER NOT NULL DEFAULT 0,
    "last_read_message_id" UUID,
    "last_read_at" TIMESTAMP(3),
    "added_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "added_by" UUID,
    "removed_at" TIMESTAMP(3),
    "removed_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "conversation_participants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "messages" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "conversation_id" UUID NOT NULL,
    "sender_id" UUID NOT NULL,
    "content" TEXT NOT NULL,
    "content_deleted" BOOLEAN NOT NULL DEFAULT false,
    "deleted_content_key" VARCHAR(255),
    "reply_to_id" UUID,
    "status" "MessageStatus" NOT NULL DEFAULT 'SENT',
    "delivered_at" TIMESTAMP(3),
    "deleted_by" UUID,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "message_read_receipts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "message_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "read_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "message_read_receipts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "filter_blocks" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "conversation_id" UUID NOT NULL,
    "sender_id" UUID NOT NULL,
    "attempted_content" TEXT NOT NULL,
    "filter_result" "MessageFilterResult" NOT NULL,
    "matched_pattern" VARCHAR(500),
    "normalised_content" TEXT,
    "filter_layer" INTEGER NOT NULL,
    "escalated_to_moderator" BOOLEAN NOT NULL DEFAULT false,
    "escalated_to_trust_safety" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "filter_blocks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "moderation_reviews" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "conversation_id" UUID NOT NULL,
    "trigger" "ModerationReviewTrigger" NOT NULL,
    "status" "ModerationReviewStatus" NOT NULL DEFAULT 'PENDING',
    "filter_block_id" UUID,
    "reported_message_id" UUID,
    "reported_by" UUID,
    "report_reason" VARCHAR(255),
    "reviewed_by" UUID,
    "reviewed_at" TIMESTAMP(3),
    "review_note" TEXT,
    "action_taken" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "moderation_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session_chat_messages" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "live_room_id" UUID NOT NULL,
    "sender_id" UUID NOT NULL,
    "content" TEXT NOT NULL,
    "reply_to_id" UUID,
    "sent_via_livekit" BOOLEAN NOT NULL DEFAULT true,
    "deleted_by" UUID,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "session_chat_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "filter_keywords" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "keyword" VARCHAR(255) NOT NULL,
    "language" "FilterKeywordLanguage" NOT NULL DEFAULT 'ANY',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "added_by" UUID NOT NULL,
    "added_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deactivated_at" TIMESTAMP(3),

    CONSTRAINT "filter_keywords_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lesson_confirmations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "booking_id" UUID NOT NULL,
    "action" "ConfirmationAction",
    "confirmed_by" UUID,
    "confirmed_at" TIMESTAMP(3),
    "window_opened_at" TIMESTAMP(3) NOT NULL,
    "window_closes_at" TIMESTAMP(3) NOT NULL,
    "auto_release_job_id" VARCHAR(255),
    "session_data_snapshot" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lesson_confirmations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auto_resolution_recommendations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "booking_id" UUID NOT NULL,
    "lesson_confirmation_id" UUID NOT NULL,
    "recommendation" "AutoResolutionRecommendationType" NOT NULL,
    "overlap_percentage" INTEGER,
    "tutor_joined" BOOLEAN NOT NULL,
    "student_joined" BOOLEAN NOT NULL,
    "tutor_join_delay_minutes" INTEGER,
    "severe_connection_events" BOOLEAN NOT NULL DEFAULT false,
    "session_ended_early" BOOLEAN NOT NULL DEFAULT false,
    "reasoning" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auto_resolution_recommendations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "disputes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "booking_id" UUID NOT NULL,
    "lesson_confirmation_id" UUID NOT NULL,
    "opened_by" UUID NOT NULL,
    "reason" "DisputeReason" NOT NULL,
    "description" TEXT NOT NULL,
    "status" "DisputeStatus" NOT NULL DEFAULT 'OPEN',
    "tutor_response_due_at" TIMESTAMP(3) NOT NULL,
    "tutor_response_reminder_sent" BOOLEAN NOT NULL DEFAULT false,
    "tutor_responded_at" TIMESTAMP(3),
    "tutor_response_statement" TEXT,
    "assigned_to" UUID,
    "assigned_at" TIMESTAMP(3),
    "resolved_by" UUID,
    "resolved_at" TIMESTAMP(3),
    "resolution_reason" TEXT,
    "escalated_at" TIMESTAMP(3),
    "escalation_notified" BOOLEAN NOT NULL DEFAULT false,
    "recommendation_id" UUID,
    "opened_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "disputes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dispute_evidence_files" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "dispute_id" UUID NOT NULL,
    "file_id" UUID NOT NULL,
    "uploaded_by" UUID NOT NULL,
    "party" "DisputeEvidenceParty" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dispute_evidence_files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dispute_evidence_snapshots" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "dispute_id" UUID NOT NULL,
    "booking_snapshot" JSONB NOT NULL,
    "session_data_snapshot" JSONB NOT NULL,
    "conversation_snapshot" JSONB NOT NULL,
    "session_chat_snapshot" JSONB NOT NULL,
    "recommendation_snapshot" JSONB NOT NULL,
    "tutor_dispute_history_snapshot" JSONB NOT NULL,
    "parent_dispute_history_snapshot" JSONB NOT NULL,
    "assembled_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assembly_duration_ms" INTEGER,

    CONSTRAINT "dispute_evidence_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "incident_reports" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "booking_id" UUID NOT NULL,
    "reported_by" UUID NOT NULL,
    "reported_against" UUID NOT NULL,
    "report_type" "IncidentReportType" NOT NULL,
    "reason" "IncidentReason" NOT NULL,
    "description" TEXT NOT NULL,
    "reviewed_by" UUID,
    "reviewed_at" TIMESTAMP(3),
    "review_note" TEXT,
    "action_taken" VARCHAR(255),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "incident_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "review_windows" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "booking_id" UUID NOT NULL,
    "opened_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closes_at" TIMESTAMP(3) NOT NULL,
    "close_job_id" VARCHAR(255),
    "author_submitted" BOOLEAN NOT NULL DEFAULT false,
    "subject_submitted" BOOLEAN NOT NULL DEFAULT false,
    "revealed_at" TIMESTAMP(3),
    "reopened_by" UUID,
    "reopened_at" TIMESTAMP(3),
    "reopen_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "review_windows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reviews" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "booking_id" UUID NOT NULL,
    "review_window_id" UUID NOT NULL,
    "author_id" UUID NOT NULL,
    "subject_id" UUID NOT NULL,
    "author_role" "ReviewAuthorRole" NOT NULL,
    "subject_role" "ReviewSubjectRole" NOT NULL,
    "overall_rating" INTEGER NOT NULL,
    "would_rebook" BOOLEAN NOT NULL,
    "rating_subject_knowledge" INTEGER,
    "rating_communication" INTEGER,
    "rating_punctuality" INTEGER,
    "written_review" TEXT,
    "status" "ReviewStatus" NOT NULL DEFAULT 'SUBMITTED',
    "revealed_at" TIMESTAMP(3),
    "tutor_response" TEXT,
    "tutor_response_at" TIMESTAMP(3),
    "tutor_response_edit_deadline" TIMESTAMP(3),
    "deleted_by" UUID,
    "deleted_at" TIMESTAMP(3),
    "deletion_reason" TEXT,
    "low_star_prompt_shown" BOOLEAN NOT NULL DEFAULT false,
    "incident_report_filed" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tutor_rating_snapshots" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tutor_id" UUID NOT NULL,
    "bayesian_rating" DECIMAL(3,2) NOT NULL DEFAULT 0,
    "raw_average" DECIMAL(3,2) NOT NULL DEFAULT 0,
    "total_review_count" INTEGER NOT NULL DEFAULT 0,
    "would_rebook_count" INTEGER NOT NULL DEFAULT 0,
    "would_rebook_percentage" INTEGER,
    "avg_subject_knowledge" DECIMAL(3,2),
    "avg_communication" DECIMAL(3,2),
    "avg_punctuality" DECIMAL(3,2),
    "count_5_star" INTEGER NOT NULL DEFAULT 0,
    "count_4_star" INTEGER NOT NULL DEFAULT 0,
    "count_3_star" INTEGER NOT NULL DEFAULT 0,
    "count_2_star" INTEGER NOT NULL DEFAULT 0,
    "count_1_star" INTEGER NOT NULL DEFAULT 0,
    "last_recalculated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "recalculated_by_review_id" UUID,
    "platform_avg_at_calculation" DECIMAL(3,2),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tutor_rating_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "review_reports" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "review_id" UUID NOT NULL,
    "reported_by" UUID NOT NULL,
    "reason" "ReportReason" NOT NULL,
    "description" TEXT,
    "status" "ReviewReportStatus" NOT NULL DEFAULT 'PENDING',
    "reviewed_by" UUID,
    "reviewed_at" TIMESTAMP(3),
    "review_note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "review_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "review_fraud_signals" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "signal_type" "ReviewFraudSignalType" NOT NULL,
    "subject_user_id" UUID NOT NULL,
    "review_ids" UUID[],
    "detected_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "detection_window_hours" INTEGER NOT NULL,
    "trust_safety_signal_created" BOOLEAN NOT NULL DEFAULT false,
    "trust_safety_signal_at" TIMESTAMP(3),
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "review_fraud_signals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "risk_scores" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "current_score" INTEGER NOT NULL DEFAULT 0,
    "current_state" "RiskState" NOT NULL DEFAULT 'GREEN',
    "last_negative_signal_at" TIMESTAMP(3),
    "last_decay_at" TIMESTAMP(3),
    "next_decay_at" TIMESTAMP(3),
    "current_state_since" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "suspended_by_trust_safety" BOOLEAN NOT NULL DEFAULT false,
    "human_review_due_at" TIMESTAMP(3),
    "human_review_completed_at" TIMESTAMP(3),
    "human_review_completed_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "risk_scores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "risk_signals" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "risk_score_id" UUID NOT NULL,
    "signal_type" VARCHAR(100) NOT NULL,
    "points_applied" INTEGER NOT NULL,
    "score_before" INTEGER NOT NULL,
    "score_after" INTEGER NOT NULL,
    "state_before" "RiskState" NOT NULL,
    "state_after" "RiskState" NOT NULL,
    "source_module" VARCHAR(10) NOT NULL,
    "source_record_id" UUID,
    "source_record_type" VARCHAR(100),
    "triggered_immediate_escalation" BOOLEAN NOT NULL DEFAULT false,
    "performed_by" UUID,
    "manual_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "risk_signals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "risk_state_history" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "risk_score_id" UUID NOT NULL,
    "previous_state" "RiskState" NOT NULL,
    "new_state" "RiskState" NOT NULL,
    "score_at_transition" INTEGER NOT NULL,
    "triggering_signal_id" UUID NOT NULL,
    "suspension_triggered" BOOLEAN NOT NULL DEFAULT false,
    "suspension_triggered_at" TIMESTAMP(3),
    "cleared_by" UUID,
    "cleared_at" TIMESTAMP(3),
    "clearance_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "risk_state_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reauth_challenges" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "trigger_action" VARCHAR(100) NOT NULL,
    "trigger_record_id" UUID,
    "status" "ReauthChallengeStatus" NOT NULL DEFAULT 'PENDING',
    "issued_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "completed_at" TIMESTAMP(3),
    "failure_reason" TEXT,
    "risk_score_at_issue" INTEGER NOT NULL,
    "risk_state_at_issue" "RiskState" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reauth_challenges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "device_fingerprint_registry" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "device_fingerprint_hash" VARCHAR(255) NOT NULL,
    "user_id" UUID NOT NULL,
    "first_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "associated_with_suspended" BOOLEAN NOT NULL DEFAULT false,
    "associated_with_banned" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "device_fingerprint_registry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dead_letter_jobs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "job_id" VARCHAR(255) NOT NULL,
    "queue_name" VARCHAR(100) NOT NULL,
    "job_type" VARCHAR(100) NOT NULL,
    "job_data" JSONB NOT NULL,
    "status" "DeadLetterJobStatus" NOT NULL DEFAULT 'FAILED',
    "attempt_count" INTEGER NOT NULL,
    "last_failure_reason" TEXT NOT NULL,
    "last_failed_at" TIMESTAMP(3) NOT NULL,
    "error_stack" TEXT,
    "booking_id" UUID,
    "user_id" UUID,
    "payout_queue_id" UUID,
    "retried_by" UUID,
    "retried_at" TIMESTAMP(3),
    "retry_job_id" VARCHAR(255),
    "resolved_at" TIMESTAMP(3),
    "dismissed_by" UUID,
    "dismissed_at" TIMESTAMP(3),
    "dismissal_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dead_letter_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "support_tickets" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "submitted_by" UUID NOT NULL,
    "category" "TicketCategory" NOT NULL,
    "subject" VARCHAR(100) NOT NULL,
    "status" "TicketStatus" NOT NULL DEFAULT 'OPEN',
    "creation_source" "TicketCreationSource" NOT NULL DEFAULT 'USER_MANUAL',
    "assigned_to" UUID,
    "assigned_at" TIMESTAMP(3),
    "escalated_to" UUID,
    "escalated_at" TIMESTAMP(3),
    "escalation_reason" TEXT,
    "resolved_by" UUID,
    "resolved_at" TIMESTAMP(3),
    "resolution_summary" TEXT,
    "reopen_deadline" TIMESTAMP(3),
    "reopened_at" TIMESTAMP(3),
    "reopen_count" INTEGER NOT NULL DEFAULT 0,
    "auto_close_job_id" VARCHAR(255),
    "booking_id" UUID,
    "payout_queue_id" UUID,
    "reconciliation_id" UUID,
    "dispute_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "support_tickets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ticket_messages" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "ticket_id" UUID NOT NULL,
    "author_id" UUID,
    "author_type" "TicketMessageAuthorType" NOT NULL,
    "content" TEXT NOT NULL,
    "is_internal_note" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ticket_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ticket_attachments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "ticket_id" UUID NOT NULL,
    "message_id" UUID NOT NULL,
    "file_id" UUID NOT NULL,
    "uploaded_by" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ticket_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ticket_status_history" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "ticket_id" UUID NOT NULL,
    "previous_status" "TicketStatus",
    "new_status" "TicketStatus" NOT NULL,
    "changed_by" UUID,
    "change_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ticket_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "failed_payout_contexts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "ticket_id" UUID NOT NULL,
    "payout_queue_id" UUID NOT NULL,
    "withdrawal_amount_xaf" INTEGER NOT NULL,
    "destination_phone" VARCHAR(20) NOT NULL,
    "destination_provider" VARCHAR(20) NOT NULL,
    "provider_failure_reason" TEXT,
    "provider_response_snapshot" JSONB,
    "registered_accounts_snapshot" JSONB NOT NULL,
    "retry_initiated_by" UUID,
    "retry_initiated_at" TIMESTAMP(3),
    "retry_payout_queue_id" UUID,
    "retry_outcome" VARCHAR(50),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "failed_payout_contexts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reconciliation_contexts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "ticket_id" UUID NOT NULL,
    "reconciliation_id" UUID NOT NULL,
    "provider_transaction_id" VARCHAR(255) NOT NULL,
    "payment_amount_xaf" INTEGER NOT NULL,
    "provider_query_result" VARCHAR(50),
    "provider_query_snapshot" JSONB,
    "parent_wallet_balance_at_ticket" INTEGER NOT NULL,
    "manually_resolved_by" UUID,
    "manually_resolved_at" TIMESTAMP(3),
    "manual_resolution" VARCHAR(50),
    "manual_resolution_note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reconciliation_contexts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "analytics_snapshots" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "snapshot_type" "AnalyticsSnapshotType" NOT NULL,
    "data" JSONB NOT NULL,
    "computed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "computation_duration_ms" INTEGER,
    "covers_period_from" TIMESTAMP(3) NOT NULL,
    "covers_period_to" TIMESTAMP(3) NOT NULL,
    "job_id" VARCHAR(255),

    CONSTRAINT "analytics_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scheduled_reports" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "created_by" UUID NOT NULL,
    "report_type" "ReportType" NOT NULL,
    "format" "ReportFormat" NOT NULL,
    "schedule" "ReportSchedule" NOT NULL,
    "rolling_days" INTEGER NOT NULL,
    "filters" JSONB,
    "recipient_emails" TEXT[],
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_run_at" TIMESTAMP(3),
    "next_run_at" TIMESTAMP(3) NOT NULL,
    "job_id" VARCHAR(255),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "scheduled_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "generated_reports" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "requested_by" UUID NOT NULL,
    "report_type" "ReportType" NOT NULL,
    "format" "ReportFormat" NOT NULL,
    "status" "GeneratedReportStatus" NOT NULL DEFAULT 'QUEUED',
    "scheduled_report_id" UUID,
    "date_from" TIMESTAMP(3) NOT NULL,
    "date_to" TIMESTAMP(3) NOT NULL,
    "filters" JSONB,
    "file_id" UUID,
    "download_expires_at" TIMESTAMP(3),
    "job_id" VARCHAR(255),
    "generation_started_at" TIMESTAMP(3),
    "generation_completed_at" TIMESTAMP(3),
    "generation_duration_ms" INTEGER,
    "failure_reason" TEXT,
    "failed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "generated_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_heartbeat_registry" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "job_key" VARCHAR(100) NOT NULL,
    "display_name" VARCHAR(255) NOT NULL,
    "queue_name" VARCHAR(100) NOT NULL,
    "expected_interval_seconds" INTEGER NOT NULL,
    "grace_period_seconds" INTEGER NOT NULL DEFAULT 60,
    "last_heartbeat_at" TIMESTAMP(3),
    "current_status" "HeartbeatJobStatus" NOT NULL DEFAULT 'HEALTHY',
    "status_changed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "alert_firing" BOOLEAN NOT NULL DEFAULT false,
    "alert_fired_at" TIMESTAMP(3),
    "alert_resolved_at" TIMESTAMP(3),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "disabled_by" UUID,
    "disabled_at" TIMESTAMP(3),
    "disable_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "job_heartbeat_registry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "learning_analytics_snapshots" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "scope" "LearningSnapshotScope" NOT NULL,
    "student_profile_id" UUID,
    "tutor_id" UUID,
    "subject_id" UUID,
    "sessions_completed_this_month" INTEGER,
    "sessions_completed_all_time" INTEGER,
    "current_streak_weeks" INTEGER,
    "longest_streak_weeks" INTEGER,
    "streak_active" BOOLEAN,
    "consistency_score_percent" INTEGER,
    "session_frequency_trend" INTEGER[],
    "total_materials_available" INTEGER,
    "total_materials_accessed" INTEGER,
    "materials_access_ratio" INTEGER,
    "last_material_accessed_at" TIMESTAMP(3),
    "last_material_title" VARCHAR(255),
    "topics_covered_count" INTEGER,
    "topics_total_count" INTEGER,
    "engagement_trend" "EngagementTrend",
    "student_overview" JSONB,
    "subject_rebooking_rate_percent" INTEGER,
    "avg_sessions_before_churn" DECIMAL(4,1),
    "materials_access_rate_percent" INTEGER,
    "student_retention_rate_percent" INTEGER,
    "sessions_per_week_trend" INTEGER[],
    "platform_avg_sessions_before_churn" DECIMAL(4,1),
    "material_upload_rebooking_correlation" DECIMAL(3,2),
    "consistency_rebooking_correlation" DECIMAL(3,2),
    "avg_topics_before_churn" DECIMAL(4,1),
    "avg_streak_weeks" DECIMAL(4,1),
    "computed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "computation_duration_ms" INTEGER,
    "covers_period_from" TIMESTAMP(3) NOT NULL,
    "covers_period_to" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "learning_analytics_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_configs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "key" VARCHAR(200) NOT NULL,
    "value" JSONB NOT NULL,
    "category" "ConfigCategory" NOT NULL,
    "description" TEXT NOT NULL,
    "default_value" JSONB NOT NULL,
    "is_sensitive" BOOLEAN NOT NULL DEFAULT false,
    "updated_by" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_configs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "roles_name_key" ON "roles"("name");

-- CreateIndex
CREATE INDEX "roles_is_active_idx" ON "roles"("is_active");

-- CreateIndex
CREATE UNIQUE INDEX "permission_modules_name_locale_code_key" ON "permission_modules"("name_locale_code");

-- CreateIndex
CREATE UNIQUE INDEX "permission_submodules_name_locale_code_key" ON "permission_submodules"("name_locale_code");

-- CreateIndex
CREATE INDEX "permission_submodules_permission_module_id_idx" ON "permission_submodules"("permission_module_id");

-- CreateIndex
CREATE UNIQUE INDEX "permissions_code_key" ON "permissions"("code");

-- CreateIndex
CREATE UNIQUE INDEX "permissions_name_locale_code_key" ON "permissions"("name_locale_code");

-- CreateIndex
CREATE INDEX "permissions_permission_module_id_idx" ON "permissions"("permission_module_id");

-- CreateIndex
CREATE INDEX "permissions_permission_submodule_id_idx" ON "permissions"("permission_submodule_id");

-- CreateIndex
CREATE INDEX "role_permissions_role_id_idx" ON "role_permissions"("role_id");

-- CreateIndex
CREATE INDEX "role_permissions_permission_id_idx" ON "role_permissions"("permission_id");

-- CreateIndex
CREATE UNIQUE INDEX "unique_role_permission" ON "role_permissions"("role_id", "permission_id");

-- CreateIndex
CREATE INDEX "user_roles_user_id_idx" ON "user_roles"("user_id");

-- CreateIndex
CREATE INDEX "user_roles_role_id_idx" ON "user_roles"("role_id");

-- CreateIndex
CREATE INDEX "idx_user_role_active_lookup" ON "user_roles"("user_id", "role_id", "is_active");

-- CreateIndex
CREATE INDEX "user_roles_expires_at_idx" ON "user_roles"("expires_at");

-- CreateIndex
CREATE INDEX "user_roles_is_active_idx" ON "user_roles"("is_active");

-- CreateIndex
CREATE UNIQUE INDEX "unique_user_role" ON "user_roles"("user_id", "role_id");

-- CreateIndex
CREATE INDEX "permission_overrides_user_id_idx" ON "permission_overrides"("user_id");

-- CreateIndex
CREATE INDEX "permission_overrides_permission_id_idx" ON "permission_overrides"("permission_id");

-- CreateIndex
CREATE INDEX "permission_overrides_expires_at_idx" ON "permission_overrides"("expires_at");

-- CreateIndex
CREATE INDEX "permission_overrides_grant_type_idx" ON "permission_overrides"("grant_type");

-- CreateIndex
CREATE UNIQUE INDEX "unique_user_permission_override" ON "permission_overrides"("user_id", "permission_id");

-- CreateIndex
CREATE INDEX "permission_implications_permission_id_idx" ON "permission_implications"("permission_id");

-- CreateIndex
CREATE INDEX "permission_implications_implied_permission_id_idx" ON "permission_implications"("implied_permission_id");

-- CreateIndex
CREATE UNIQUE INDEX "unique_permission_implication" ON "permission_implications"("permission_id", "implied_permission_id");

-- CreateIndex
CREATE INDEX "ip_blocks_ip_address_idx" ON "ip_blocks"("ip_address");

-- CreateIndex
CREATE INDEX "ip_blocks_is_active_idx" ON "ip_blocks"("is_active");

-- CreateIndex
CREATE INDEX "ip_blocks_expires_at_idx" ON "ip_blocks"("expires_at");

-- CreateIndex
CREATE INDEX "idx_ip_blocks_lookup" ON "ip_blocks"("ip_address", "is_active");

-- CreateIndex
CREATE INDEX "audit_logs_actor_id_idx" ON "audit_logs"("actor_id");

-- CreateIndex
CREATE INDEX "audit_logs_event_type_idx" ON "audit_logs"("event_type");

-- CreateIndex
CREATE INDEX "audit_logs_operation_idx" ON "audit_logs"("operation");

-- CreateIndex
CREATE INDEX "audit_logs_table_name_idx" ON "audit_logs"("table_name");

-- CreateIndex
CREATE INDEX "audit_logs_target_id_idx" ON "audit_logs"("target_id");

-- CreateIndex
CREATE INDEX "audit_logs_target_type_idx" ON "audit_logs"("target_type");

-- CreateIndex
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs"("created_at");

-- CreateIndex
CREATE INDEX "audit_logs_status_idx" ON "audit_logs"("status");

-- CreateIndex
CREATE INDEX "idx_audit_actor_time" ON "audit_logs"("actor_id", "created_at");

-- CreateIndex
CREATE INDEX "idx_audit_target_event" ON "audit_logs"("target_id", "event_type");

-- CreateIndex
CREATE INDEX "idx_audit_table_operation" ON "audit_logs"("table_name", "operation");

-- CreateIndex
CREATE UNIQUE INDEX "users_clerk_id_key" ON "users"("clerk_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_google_auth_id_key" ON "users"("google_auth_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_facebook_auth_id_key" ON "users"("facebook_auth_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_status_idx" ON "users"("status");

-- CreateIndex
CREATE INDEX "users_is_account_complete_idx" ON "users"("is_account_complete");

-- CreateIndex
CREATE INDEX "idx_users_email_status" ON "users"("email", "status");

-- CreateIndex
CREATE INDEX "idx_users_name" ON "users"("first_name", "last_name");

-- CreateIndex
CREATE INDEX "user_devices_user_id_idx" ON "user_devices"("user_id");

-- CreateIndex
CREATE INDEX "user_devices_device_fingerprint_hash_idx" ON "user_devices"("device_fingerprint_hash");

-- CreateIndex
CREATE INDEX "idx_user_device_fingerprint" ON "user_devices"("user_id", "device_fingerprint_hash");

-- CreateIndex
CREATE INDEX "user_sessions_user_id_idx" ON "user_sessions"("user_id");

-- CreateIndex
CREATE INDEX "user_sessions_device_id_idx" ON "user_sessions"("device_id");

-- CreateIndex
CREATE INDEX "user_sessions_is_active_idx" ON "user_sessions"("is_active");

-- CreateIndex
CREATE INDEX "user_sessions_expires_at_idx" ON "user_sessions"("expires_at");

-- CreateIndex
CREATE INDEX "idx_sessions_user_active" ON "user_sessions"("user_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "platform_tokens_token_hash_key" ON "platform_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "platform_tokens_user_id_idx" ON "platform_tokens"("user_id");

-- CreateIndex
CREATE INDEX "platform_tokens_token_type_idx" ON "platform_tokens"("token_type");

-- CreateIndex
CREATE INDEX "platform_tokens_expires_at_idx" ON "platform_tokens"("expires_at");

-- CreateIndex
CREATE INDEX "idx_tokens_user_type" ON "platform_tokens"("user_id", "token_type");

-- CreateIndex
CREATE INDEX "payment_accounts_user_id_idx" ON "payment_accounts"("user_id");

-- CreateIndex
CREATE INDEX "payment_accounts_account_type_idx" ON "payment_accounts"("account_type");

-- CreateIndex
CREATE INDEX "payment_accounts_is_verified_idx" ON "payment_accounts"("is_verified");

-- CreateIndex
CREATE INDEX "payment_accounts_cooling_off_until_idx" ON "payment_accounts"("cooling_off_until");

-- CreateIndex
CREATE UNIQUE INDEX "idx_payment_account_unique" ON "payment_accounts"("user_id", "phone_number", "account_type");

-- CreateIndex
CREATE INDEX "account_suspensions_user_id_idx" ON "account_suspensions"("user_id");

-- CreateIndex
CREATE INDEX "account_suspensions_suspension_type_idx" ON "account_suspensions"("suspension_type");

-- CreateIndex
CREATE INDEX "account_suspensions_lifted_at_idx" ON "account_suspensions"("lifted_at");

-- CreateIndex
CREATE INDEX "account_suspensions_expires_at_idx" ON "account_suspensions"("expires_at");

-- CreateIndex
CREATE INDEX "idx_suspensions_active" ON "account_suspensions"("user_id", "lifted_at");

-- CreateIndex
CREATE UNIQUE INDEX "regions_name_key" ON "regions"("name");

-- CreateIndex
CREATE INDEX "regions_country_code_idx" ON "regions"("country_code");

-- CreateIndex
CREATE INDEX "regions_is_active_idx" ON "regions"("is_active");

-- CreateIndex
CREATE INDEX "cities_region_id_idx" ON "cities"("region_id");

-- CreateIndex
CREATE INDEX "cities_is_active_idx" ON "cities"("is_active");

-- CreateIndex
CREATE INDEX "cities_is_in_allowlist_idx" ON "cities"("is_in_allowlist");

-- CreateIndex
CREATE UNIQUE INDEX "idx_city_name_region" ON "cities"("name", "region_id");

-- CreateIndex
CREATE UNIQUE INDEX "subject_domains_name_key" ON "subject_domains"("name");

-- CreateIndex
CREATE INDEX "subject_domains_is_active_idx" ON "subject_domains"("is_active");

-- CreateIndex
CREATE INDEX "subjects_domain_id_idx" ON "subjects"("domain_id");

-- CreateIndex
CREATE INDEX "subjects_is_active_idx" ON "subjects"("is_active");

-- CreateIndex
CREATE UNIQUE INDEX "idx_subject_name_domain" ON "subjects"("name", "domain_id");

-- CreateIndex
CREATE INDEX "subject_relationship_weights_subject_id_idx" ON "subject_relationship_weights"("subject_id");

-- CreateIndex
CREATE INDEX "subject_relationship_weights_qualification_type_idx" ON "subject_relationship_weights"("qualification_type");

-- CreateIndex
CREATE UNIQUE INDEX "idx_relationship_weight_unique" ON "subject_relationship_weights"("qualification_type", "field_of_study", "subject_id");

-- CreateIndex
CREATE UNIQUE INDEX "levels_name_key" ON "levels"("name");

-- CreateIndex
CREATE INDEX "levels_school_type_idx" ON "levels"("school_type");

-- CreateIndex
CREATE INDEX "levels_is_active_idx" ON "levels"("is_active");

-- CreateIndex
CREATE INDEX "levels_order_index_idx" ON "levels"("order_index");

-- CreateIndex
CREATE UNIQUE INDEX "idx_level_name_school_type" ON "levels"("name", "school_type");

-- CreateIndex
CREATE UNIQUE INDEX "tutor_profiles_user_id_key" ON "tutor_profiles"("user_id");

-- CreateIndex
CREATE INDEX "tutor_profiles_kyc_status_idx" ON "tutor_profiles"("kyc_status");

-- CreateIndex
CREATE INDEX "tutor_profiles_city_id_idx" ON "tutor_profiles"("city_id");

-- CreateIndex
CREATE INDEX "tutor_profiles_composite_score_idx" ON "tutor_profiles"("composite_score");

-- CreateIndex
CREATE INDEX "tutor_profiles_is_payment_overdue_idx" ON "tutor_profiles"("is_payment_overdue");

-- CreateIndex
CREATE INDEX "tutor_profiles_new_tutor_boost_expires_at_idx" ON "tutor_profiles"("new_tutor_boost_expires_at");

-- CreateIndex
CREATE INDEX "idx_tutor_kyc_city" ON "tutor_profiles"("kyc_status", "city_id");

-- CreateIndex
CREATE INDEX "idx_tutor_searchable" ON "tutor_profiles"("kyc_status", "is_payment_overdue", "city_id");

-- CreateIndex
CREATE INDEX "tutor_credentials_tutor_profile_id_idx" ON "tutor_credentials"("tutor_profile_id");

-- CreateIndex
CREATE INDEX "tutor_credentials_status_idx" ON "tutor_credentials"("status");

-- CreateIndex
CREATE INDEX "tutor_credentials_qualification_type_idx" ON "tutor_credentials"("qualification_type");

-- CreateIndex
CREATE INDEX "credential_subject_links_credential_id_idx" ON "credential_subject_links"("credential_id");

-- CreateIndex
CREATE INDEX "credential_subject_links_subject_id_idx" ON "credential_subject_links"("subject_id");

-- CreateIndex
CREATE UNIQUE INDEX "idx_credential_subject_unique" ON "credential_subject_links"("credential_id", "subject_id");

-- CreateIndex
CREATE INDEX "tutor_subjects_tutor_profile_id_idx" ON "tutor_subjects"("tutor_profile_id");

-- CreateIndex
CREATE INDEX "tutor_subjects_subject_id_idx" ON "tutor_subjects"("subject_id");

-- CreateIndex
CREATE INDEX "tutor_subjects_status_idx" ON "tutor_subjects"("status");

-- CreateIndex
CREATE INDEX "idx_tutor_subject_status" ON "tutor_subjects"("tutor_profile_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "idx_tutor_subject_unique" ON "tutor_subjects"("tutor_profile_id", "subject_id");

-- CreateIndex
CREATE INDEX "availability_slots_tutor_profile_id_idx" ON "availability_slots"("tutor_profile_id");

-- CreateIndex
CREATE INDEX "availability_slots_slot_type_idx" ON "availability_slots"("slot_type");

-- CreateIndex
CREATE INDEX "availability_slots_is_active_idx" ON "availability_slots"("is_active");

-- CreateIndex
CREATE INDEX "availability_slots_day_of_week_idx" ON "availability_slots"("day_of_week");

-- CreateIndex
CREATE INDEX "availability_slots_specific_date_idx" ON "availability_slots"("specific_date");

-- CreateIndex
CREATE INDEX "student_profiles_user_id_idx" ON "student_profiles"("user_id");

-- CreateIndex
CREATE INDEX "student_profiles_school_type_idx" ON "student_profiles"("school_type");

-- CreateIndex
CREATE INDEX "student_profiles_level_id_idx" ON "student_profiles"("level_id");

-- CreateIndex
CREATE INDEX "student_profile_subjects_student_profile_id_idx" ON "student_profile_subjects"("student_profile_id");

-- CreateIndex
CREATE INDEX "student_profile_subjects_subject_id_idx" ON "student_profile_subjects"("subject_id");

-- CreateIndex
CREATE UNIQUE INDEX "idx_student_subject_unique" ON "student_profile_subjects"("student_profile_id", "subject_id");

-- CreateIndex
CREATE INDEX "files_uploaded_by_idx" ON "files"("uploaded_by");

-- CreateIndex
CREATE INDEX "files_file_category_idx" ON "files"("file_category");

-- CreateIndex
CREATE INDEX "files_file_type_idx" ON "files"("file_type");

-- CreateIndex
CREATE INDEX "files_status_idx" ON "files"("status");

-- CreateIndex
CREATE INDEX "files_ref_table_idx" ON "files"("ref_table");

-- CreateIndex
CREATE INDEX "files_ref_record_id_idx" ON "files"("ref_record_id");

-- CreateIndex
CREATE INDEX "idx_files_polymorphic" ON "files"("ref_table", "ref_record_id");

-- CreateIndex
CREATE INDEX "idx_files_owner_category" ON "files"("uploaded_by", "file_category");

-- CreateIndex
CREATE INDEX "files_deleted_at_idx" ON "files"("deleted_at");

-- CreateIndex
CREATE INDEX "files_is_dispute_locked_idx" ON "files"("is_dispute_locked");

-- CreateIndex
CREATE INDEX "file_variants_file_id_idx" ON "file_variants"("file_id");

-- CreateIndex
CREATE INDEX "file_variants_variant_idx" ON "file_variants"("variant");

-- CreateIndex
CREATE INDEX "file_variants_status_idx" ON "file_variants"("status");

-- CreateIndex
CREATE UNIQUE INDEX "idx_file_variant_unique" ON "file_variants"("file_id", "variant");

-- CreateIndex
CREATE UNIQUE INDEX "storage_quota_defaults_role_id_key" ON "storage_quota_defaults"("role_id");

-- CreateIndex
CREATE UNIQUE INDEX "storage_quota_overrides_user_id_key" ON "storage_quota_overrides"("user_id");

-- CreateIndex
CREATE INDEX "storage_quota_overrides_source_idx" ON "storage_quota_overrides"("source");

-- CreateIndex
CREATE INDEX "storage_quota_overrides_expires_at_idx" ON "storage_quota_overrides"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "storage_usage_user_id_key" ON "storage_usage"("user_id");

-- CreateIndex
CREATE INDEX "collections_tutor_profile_id_idx" ON "collections"("tutor_profile_id");

-- CreateIndex
CREATE INDEX "collections_subject_id_idx" ON "collections"("subject_id");

-- CreateIndex
CREATE INDEX "collections_level_id_idx" ON "collections"("level_id");

-- CreateIndex
CREATE INDEX "collections_is_published_idx" ON "collections"("is_published");

-- CreateIndex
CREATE INDEX "idx_collection_tutor_subject" ON "collections"("tutor_profile_id", "subject_id");

-- CreateIndex
CREATE INDEX "collections_deleted_at_idx" ON "collections"("deleted_at");

-- CreateIndex
CREATE INDEX "sections_collection_id_idx" ON "sections"("collection_id");

-- CreateIndex
CREATE INDEX "sections_is_free_preview_idx" ON "sections"("is_free_preview");

-- CreateIndex
CREATE INDEX "idx_section_order" ON "sections"("collection_id", "order_index");

-- CreateIndex
CREATE INDEX "sections_deleted_at_idx" ON "sections"("deleted_at");

-- CreateIndex
CREATE INDEX "materials_collection_id_idx" ON "materials"("collection_id");

-- CreateIndex
CREATE INDEX "materials_section_id_idx" ON "materials"("section_id");

-- CreateIndex
CREATE INDEX "materials_material_type_idx" ON "materials"("material_type");

-- CreateIndex
CREATE INDEX "materials_file_id_idx" ON "materials"("file_id");

-- CreateIndex
CREATE INDEX "materials_is_free_preview_idx" ON "materials"("is_free_preview");

-- CreateIndex
CREATE INDEX "idx_material_collection_order" ON "materials"("collection_id", "order_index");

-- CreateIndex
CREATE INDEX "idx_material_section_order" ON "materials"("section_id", "order_index");

-- CreateIndex
CREATE INDEX "materials_deleted_at_idx" ON "materials"("deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "lesson_plans_collection_id_key" ON "lesson_plans"("collection_id");

-- CreateIndex
CREATE INDEX "lesson_plans_tutor_profile_id_idx" ON "lesson_plans"("tutor_profile_id");

-- CreateIndex
CREATE INDEX "lesson_plans_is_published_idx" ON "lesson_plans"("is_published");

-- CreateIndex
CREATE INDEX "lesson_plans_deleted_at_idx" ON "lesson_plans"("deleted_at");

-- CreateIndex
CREATE INDEX "lesson_plan_topics_lesson_plan_id_idx" ON "lesson_plan_topics"("lesson_plan_id");

-- CreateIndex
CREATE INDEX "lesson_plan_topics_section_id_idx" ON "lesson_plan_topics"("section_id");

-- CreateIndex
CREATE INDEX "idx_topic_plan_order" ON "lesson_plan_topics"("lesson_plan_id", "order_index");

-- CreateIndex
CREATE INDEX "lesson_plan_topics_deleted_at_idx" ON "lesson_plan_topics"("deleted_at");

-- CreateIndex
CREATE INDEX "material_access_user_id_idx" ON "material_access"("user_id");

-- CreateIndex
CREATE INDEX "material_access_collection_id_idx" ON "material_access"("collection_id");

-- CreateIndex
CREATE INDEX "material_access_booking_id_idx" ON "material_access"("booking_id");

-- CreateIndex
CREATE UNIQUE INDEX "idx_material_access_unique" ON "material_access"("user_id", "collection_id");

-- CreateIndex
CREATE INDEX "material_reviews_collection_id_idx" ON "material_reviews"("collection_id");

-- CreateIndex
CREATE INDEX "material_reviews_material_id_idx" ON "material_reviews"("material_id");

-- CreateIndex
CREATE INDEX "material_reviews_reviewed_by_idx" ON "material_reviews"("reviewed_by");

-- CreateIndex
CREATE INDEX "material_reviews_tutor_id_idx" ON "material_reviews"("tutor_id");

-- CreateIndex
CREATE INDEX "material_reviews_reported_by_idx" ON "material_reviews"("reported_by");

-- CreateIndex
CREATE INDEX "material_reviews_decision_idx" ON "material_reviews"("decision");

-- CreateIndex
CREATE INDEX "material_reviews_is_active_idx" ON "material_reviews"("is_active");

-- CreateIndex
CREATE INDEX "idx_review_tutor_decision_time" ON "material_reviews"("tutor_id", "decision", "created_at");

-- CreateIndex
CREATE INDEX "kyc_applications_tutor_profile_id_idx" ON "kyc_applications"("tutor_profile_id");

-- CreateIndex
CREATE INDEX "kyc_applications_current_step_idx" ON "kyc_applications"("current_step");

-- CreateIndex
CREATE INDEX "kyc_applications_deleted_at_idx" ON "kyc_applications"("deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "idx_kyc_tutor_version" ON "kyc_applications"("tutor_profile_id", "version");

-- CreateIndex
CREATE INDEX "kyc_status_history_kyc_application_id_idx" ON "kyc_status_history"("kyc_application_id");

-- CreateIndex
CREATE INDEX "kyc_status_history_tutor_profile_id_idx" ON "kyc_status_history"("tutor_profile_id");

-- CreateIndex
CREATE INDEX "kyc_status_history_new_status_idx" ON "kyc_status_history"("new_status");

-- CreateIndex
CREATE INDEX "kyc_status_history_changed_by_idx" ON "kyc_status_history"("changed_by");

-- CreateIndex
CREATE INDEX "kyc_status_history_flagged_for_spot_check_idx" ON "kyc_status_history"("flagged_for_spot_check");

-- CreateIndex
CREATE INDEX "kyc_status_history_created_at_idx" ON "kyc_status_history"("created_at");

-- CreateIndex
CREATE INDEX "kyc_rejection_flags_kyc_application_id_idx" ON "kyc_rejection_flags"("kyc_application_id");

-- CreateIndex
CREATE INDEX "kyc_rejection_flags_kyc_status_history_id_idx" ON "kyc_rejection_flags"("kyc_status_history_id");

-- CreateIndex
CREATE INDEX "kyc_rejection_flags_flag_item_idx" ON "kyc_rejection_flags"("flag_item");

-- CreateIndex
CREATE INDEX "kyc_checklist_submissions_kyc_application_id_idx" ON "kyc_checklist_submissions"("kyc_application_id");

-- CreateIndex
CREATE INDEX "kyc_checklist_submissions_kyc_status_history_id_idx" ON "kyc_checklist_submissions"("kyc_status_history_id");

-- CreateIndex
CREATE INDEX "kyc_checklist_submissions_reviewed_by_idx" ON "kyc_checklist_submissions"("reviewed_by");

-- CreateIndex
CREATE UNIQUE INDEX "kyc_bans_tutor_profile_id_key" ON "kyc_bans"("tutor_profile_id");

-- CreateIndex
CREATE INDEX "kyc_bans_banned_by_idx" ON "kyc_bans"("banned_by");

-- CreateIndex
CREATE INDEX "demand_signals_subject_id_idx" ON "demand_signals"("subject_id");

-- CreateIndex
CREATE INDEX "demand_signals_city_id_idx" ON "demand_signals"("city_id");

-- CreateIndex
CREATE INDEX "demand_signals_user_id_idx" ON "demand_signals"("user_id");

-- CreateIndex
CREATE INDEX "demand_signals_is_notify_me_idx" ON "demand_signals"("is_notify_me");

-- CreateIndex
CREATE INDEX "idx_demand_subject_city" ON "demand_signals"("subject_id", "city_id");

-- CreateIndex
CREATE INDEX "demand_signals_notified_at_idx" ON "demand_signals"("notified_at");

-- CreateIndex
CREATE INDEX "booking_series_parent_id_idx" ON "booking_series"("parent_id");

-- CreateIndex
CREATE INDEX "booking_series_tutor_profile_id_idx" ON "booking_series"("tutor_profile_id");

-- CreateIndex
CREATE INDEX "booking_series_subject_id_idx" ON "booking_series"("subject_id");

-- CreateIndex
CREATE INDEX "bookings_booker_id_idx" ON "bookings"("booker_id");

-- CreateIndex
CREATE INDEX "bookings_tutor_profile_id_idx" ON "bookings"("tutor_profile_id");

-- CreateIndex
CREATE INDEX "bookings_subject_id_idx" ON "bookings"("subject_id");

-- CreateIndex
CREATE INDEX "bookings_level_id_idx" ON "bookings"("level_id");

-- CreateIndex
CREATE INDEX "bookings_status_idx" ON "bookings"("status");

-- CreateIndex
CREATE INDEX "bookings_session_date_idx" ON "bookings"("session_date");

-- CreateIndex
CREATE INDEX "bookings_series_id_idx" ON "bookings"("series_id");

-- CreateIndex
CREATE INDEX "bookings_is_group_session_idx" ON "bookings"("is_group_session");

-- CreateIndex
CREATE INDEX "bookings_payment_window_expires_at_idx" ON "bookings"("payment_window_expires_at");

-- CreateIndex
CREATE INDEX "idx_booking_tutor_date_status" ON "bookings"("tutor_profile_id", "session_date", "status");

-- CreateIndex
CREATE INDEX "idx_booking_booker_status" ON "bookings"("booker_id", "status");

-- CreateIndex
CREATE INDEX "bookings_deleted_at_idx" ON "bookings"("deleted_at");

-- CreateIndex
CREATE INDEX "group_session_participants_booking_id_idx" ON "group_session_participants"("booking_id");

-- CreateIndex
CREATE INDEX "group_session_participants_student_id_idx" ON "group_session_participants"("student_id");

-- CreateIndex
CREATE INDEX "group_session_participants_payment_status_idx" ON "group_session_participants"("payment_status");

-- CreateIndex
CREATE UNIQUE INDEX "idx_group_participant_unique" ON "group_session_participants"("booking_id", "student_id");

-- CreateIndex
CREATE UNIQUE INDEX "group_sessions_booking_id_key" ON "group_sessions"("booking_id");

-- CreateIndex
CREATE INDEX "group_sessions_tutor_profile_id_idx" ON "group_sessions"("tutor_profile_id");

-- CreateIndex
CREATE INDEX "group_sessions_subject_id_idx" ON "group_sessions"("subject_id");

-- CreateIndex
CREATE INDEX "group_sessions_level_id_idx" ON "group_sessions"("level_id");

-- CreateIndex
CREATE INDEX "group_sessions_status_idx" ON "group_sessions"("status");

-- CreateIndex
CREATE INDEX "group_sessions_registration_cutoff_at_idx" ON "group_sessions"("registration_cutoff_at");

-- CreateIndex
CREATE INDEX "group_sessions_deleted_at_idx" ON "group_sessions"("deleted_at");

-- CreateIndex
CREATE INDEX "reschedule_requests_booking_id_idx" ON "reschedule_requests"("booking_id");

-- CreateIndex
CREATE INDEX "reschedule_requests_requested_by_idx" ON "reschedule_requests"("requested_by");

-- CreateIndex
CREATE INDEX "reschedule_requests_status_idx" ON "reschedule_requests"("status");

-- CreateIndex
CREATE INDEX "idx_reschedule_booking_status" ON "reschedule_requests"("booking_id", "status");

-- CreateIndex
CREATE INDEX "notifications_recipient_id_idx" ON "notifications"("recipient_id");

-- CreateIndex
CREATE INDEX "notifications_type_idx" ON "notifications"("type");

-- CreateIndex
CREATE INDEX "notifications_read_at_idx" ON "notifications"("read_at");

-- CreateIndex
CREATE INDEX "notifications_is_transactional_idx" ON "notifications"("is_transactional");

-- CreateIndex
CREATE INDEX "idx_notifications_recipient_read" ON "notifications"("recipient_id", "read_at");

-- CreateIndex
CREATE INDEX "idx_notifications_recipient_type" ON "notifications"("recipient_id", "type");

-- CreateIndex
CREATE INDEX "notifications_deleted_at_idx" ON "notifications"("deleted_at");

-- CreateIndex
CREATE INDEX "notification_deliveries_notification_id_idx" ON "notification_deliveries"("notification_id");

-- CreateIndex
CREATE INDEX "notification_deliveries_channel_idx" ON "notification_deliveries"("channel");

-- CreateIndex
CREATE INDEX "notification_deliveries_status_idx" ON "notification_deliveries"("status");

-- CreateIndex
CREATE INDEX "notification_deliveries_attempt_number_idx" ON "notification_deliveries"("attempt_number");

-- CreateIndex
CREATE INDEX "idx_delivery_notification_channel" ON "notification_deliveries"("notification_id", "channel");

-- CreateIndex
CREATE INDEX "idx_delivery_status_time" ON "notification_deliveries"("status", "attempted_at");

-- CreateIndex
CREATE INDEX "scheduled_notifications_recipient_id_idx" ON "scheduled_notifications"("recipient_id");

-- CreateIndex
CREATE INDEX "scheduled_notifications_type_idx" ON "scheduled_notifications"("type");

-- CreateIndex
CREATE INDEX "scheduled_notifications_status_idx" ON "scheduled_notifications"("status");

-- CreateIndex
CREATE INDEX "scheduled_notifications_scheduled_for_idx" ON "scheduled_notifications"("scheduled_for");

-- CreateIndex
CREATE INDEX "scheduled_notifications_booking_id_idx" ON "scheduled_notifications"("booking_id");

-- CreateIndex
CREATE INDEX "scheduled_notifications_job_id_idx" ON "scheduled_notifications"("job_id");

-- CreateIndex
CREATE INDEX "idx_scheduled_pending_time" ON "scheduled_notifications"("status", "scheduled_for");

-- CreateIndex
CREATE INDEX "idx_scheduled_booking_status" ON "scheduled_notifications"("booking_id", "status");

-- CreateIndex
CREATE INDEX "notification_preferences_user_id_idx" ON "notification_preferences"("user_id");

-- CreateIndex
CREATE INDEX "notification_preferences_notification_type_idx" ON "notification_preferences"("notification_type");

-- CreateIndex
CREATE INDEX "notification_preferences_channel_idx" ON "notification_preferences"("channel");

-- CreateIndex
CREATE UNIQUE INDEX "idx_preference_unique" ON "notification_preferences"("user_id", "notification_type", "channel");

-- CreateIndex
CREATE INDEX "push_tokens_user_id_idx" ON "push_tokens"("user_id");

-- CreateIndex
CREATE INDEX "push_tokens_device_id_idx" ON "push_tokens"("device_id");

-- CreateIndex
CREATE INDEX "push_tokens_is_active_idx" ON "push_tokens"("is_active");

-- CreateIndex
CREATE INDEX "idx_push_tokens_active" ON "push_tokens"("user_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "idx_push_token_unique" ON "push_tokens"("user_id", "fcm_token");

-- CreateIndex
CREATE UNIQUE INDEX "wallets_user_id_key" ON "wallets"("user_id");

-- CreateIndex
CREATE INDEX "wallets_wallet_type_idx" ON "wallets"("wallet_type");

-- CreateIndex
CREATE INDEX "escrow_holds_booking_id_idx" ON "escrow_holds"("booking_id");

-- CreateIndex
CREATE INDEX "escrow_holds_group_participant_id_idx" ON "escrow_holds"("group_participant_id");

-- CreateIndex
CREATE INDEX "escrow_holds_payer_id_idx" ON "escrow_holds"("payer_id");

-- CreateIndex
CREATE INDEX "escrow_holds_tutor_id_idx" ON "escrow_holds"("tutor_id");

-- CreateIndex
CREATE INDEX "escrow_holds_status_idx" ON "escrow_holds"("status");

-- CreateIndex
CREATE INDEX "idx_escrow_status_time" ON "escrow_holds"("status", "created_at");

-- CreateIndex
CREATE INDEX "escrow_holds_auto_released_idx" ON "escrow_holds"("auto_released");

-- CreateIndex
CREATE INDEX "transaction_ledger_from_user_id_idx" ON "transaction_ledger"("from_user_id");

-- CreateIndex
CREATE INDEX "transaction_ledger_to_user_id_idx" ON "transaction_ledger"("to_user_id");

-- CreateIndex
CREATE INDEX "transaction_ledger_operation_idx" ON "transaction_ledger"("operation");

-- CreateIndex
CREATE INDEX "transaction_ledger_status_idx" ON "transaction_ledger"("status");

-- CreateIndex
CREATE INDEX "transaction_ledger_provider_transaction_id_idx" ON "transaction_ledger"("provider_transaction_id");

-- CreateIndex
CREATE INDEX "transaction_ledger_booking_id_idx" ON "transaction_ledger"("booking_id");

-- CreateIndex
CREATE INDEX "transaction_ledger_escrow_hold_id_idx" ON "transaction_ledger"("escrow_hold_id");

-- CreateIndex
CREATE INDEX "transaction_ledger_payout_queue_id_idx" ON "transaction_ledger"("payout_queue_id");

-- CreateIndex
CREATE INDEX "transaction_ledger_created_at_idx" ON "transaction_ledger"("created_at");

-- CreateIndex
CREATE INDEX "idx_ledger_from_user_time" ON "transaction_ledger"("from_user_id", "created_at");

-- CreateIndex
CREATE INDEX "idx_ledger_to_user_time" ON "transaction_ledger"("to_user_id", "created_at");

-- CreateIndex
CREATE INDEX "idx_ledger_operation_status" ON "transaction_ledger"("operation", "status");

-- CreateIndex
CREATE INDEX "payout_queue_user_id_idx" ON "payout_queue"("user_id");

-- CreateIndex
CREATE INDEX "payout_queue_payment_account_id_idx" ON "payout_queue"("payment_account_id");

-- CreateIndex
CREATE INDEX "payout_queue_status_idx" ON "payout_queue"("status");

-- CreateIndex
CREATE INDEX "idx_payout_queue_status_time" ON "payout_queue"("status", "created_at");

-- CreateIndex
CREATE INDEX "idx_payout_queue_retry" ON "payout_queue"("status", "next_retry_at");

-- CreateIndex
CREATE INDEX "payout_queue_provider_transaction_id_idx" ON "payout_queue"("provider_transaction_id");

-- CreateIndex
CREATE INDEX "idempotency_keys_expires_at_idx" ON "idempotency_keys"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "idx_idempotency_user_key" ON "idempotency_keys"("user_id", "key");

-- CreateIndex
CREATE INDEX "payment_reconciliations_user_id_idx" ON "payment_reconciliations"("user_id");

-- CreateIndex
CREATE INDEX "payment_reconciliations_provider_transaction_id_idx" ON "payment_reconciliations"("provider_transaction_id");

-- CreateIndex
CREATE INDEX "payment_reconciliations_resolved_idx" ON "payment_reconciliations"("resolved");

-- CreateIndex
CREATE INDEX "payment_reconciliations_booking_id_idx" ON "payment_reconciliations"("booking_id");

-- CreateIndex
CREATE INDEX "idx_reconciliation_unresolved" ON "payment_reconciliations"("resolved", "created_at");

-- CreateIndex
CREATE INDEX "transaction_issues_user_id_idx" ON "transaction_issues"("user_id");

-- CreateIndex
CREATE INDEX "transaction_issues_issue_type_idx" ON "transaction_issues"("issue_type");

-- CreateIndex
CREATE INDEX "transaction_issues_status_idx" ON "transaction_issues"("status");

-- CreateIndex
CREATE INDEX "transaction_issues_payout_queue_id_idx" ON "transaction_issues"("payout_queue_id");

-- CreateIndex
CREATE INDEX "idx_issues_status_time" ON "transaction_issues"("status", "created_at");

-- CreateIndex
CREATE INDEX "idx_issues_type_status" ON "transaction_issues"("issue_type", "status");

-- CreateIndex
CREATE UNIQUE INDEX "receipts_reference_number_key" ON "receipts"("reference_number");

-- CreateIndex
CREATE INDEX "receipts_booking_id_idx" ON "receipts"("booking_id");

-- CreateIndex
CREATE INDEX "receipts_user_id_idx" ON "receipts"("user_id");

-- CreateIndex
CREATE INDEX "receipts_file_id_idx" ON "receipts"("file_id");

-- CreateIndex
CREATE INDEX "monthly_fee_charges_is_paid_idx" ON "monthly_fee_charges"("is_paid");

-- CreateIndex
CREATE INDEX "monthly_fee_charges_is_overdue_idx" ON "monthly_fee_charges"("is_overdue");

-- CreateIndex
CREATE INDEX "monthly_fee_charges_grace_period_ends_at_idx" ON "monthly_fee_charges"("grace_period_ends_at");

-- CreateIndex
CREATE UNIQUE INDEX "idx_monthly_fee_tutor_period" ON "monthly_fee_charges"("tutor_profile_id", "period_start");

-- CreateIndex
CREATE UNIQUE INDEX "live_rooms_booking_id_key" ON "live_rooms"("booking_id");

-- CreateIndex
CREATE UNIQUE INDEX "live_rooms_room_name_key" ON "live_rooms"("room_name");

-- CreateIndex
CREATE INDEX "live_rooms_status_idx" ON "live_rooms"("status");

-- CreateIndex
CREATE INDEX "live_rooms_scheduled_start_at_idx" ON "live_rooms"("scheduled_start_at");

-- CreateIndex
CREATE INDEX "idx_rooms_status_schedule" ON "live_rooms"("status", "scheduled_start_at");

-- CreateIndex
CREATE INDEX "live_rooms_actual_end_at_idx" ON "live_rooms"("actual_end_at");

-- CreateIndex
CREATE INDEX "session_participants_live_room_id_idx" ON "session_participants"("live_room_id");

-- CreateIndex
CREATE INDEX "session_participants_user_id_idx" ON "session_participants"("user_id");

-- CreateIndex
CREATE INDEX "session_participants_participant_role_idx" ON "session_participants"("participant_role");

-- CreateIndex
CREATE INDEX "idx_participant_room_role" ON "session_participants"("live_room_id", "participant_role");

-- CreateIndex
CREATE UNIQUE INDEX "idx_participant_room_user" ON "session_participants"("live_room_id", "user_id");

-- CreateIndex
CREATE INDEX "participant_events_live_room_id_idx" ON "participant_events"("live_room_id");

-- CreateIndex
CREATE INDEX "participant_events_session_participant_id_idx" ON "participant_events"("session_participant_id");

-- CreateIndex
CREATE INDEX "participant_events_user_id_idx" ON "participant_events"("user_id");

-- CreateIndex
CREATE INDEX "participant_events_event_type_idx" ON "participant_events"("event_type");

-- CreateIndex
CREATE INDEX "participant_events_occurred_at_idx" ON "participant_events"("occurred_at");

-- CreateIndex
CREATE INDEX "idx_events_room_time" ON "participant_events"("live_room_id", "occurred_at");

-- CreateIndex
CREATE INDEX "idx_events_participant_type" ON "participant_events"("session_participant_id", "event_type");

-- CreateIndex
CREATE INDEX "connection_quality_events_live_room_id_idx" ON "connection_quality_events"("live_room_id");

-- CreateIndex
CREATE INDEX "connection_quality_events_session_participant_id_idx" ON "connection_quality_events"("session_participant_id");

-- CreateIndex
CREATE INDEX "connection_quality_events_user_id_idx" ON "connection_quality_events"("user_id");

-- CreateIndex
CREATE INDEX "connection_quality_events_quality_idx" ON "connection_quality_events"("quality");

-- CreateIndex
CREATE INDEX "connection_quality_events_occurred_at_idx" ON "connection_quality_events"("occurred_at");

-- CreateIndex
CREATE INDEX "idx_quality_participant_time" ON "connection_quality_events"("session_participant_id", "occurred_at");

-- CreateIndex
CREATE INDEX "idx_quality_room_level" ON "connection_quality_events"("live_room_id", "quality");

-- CreateIndex
CREATE INDEX "conversations_booking_id_idx" ON "conversations"("booking_id");

-- CreateIndex
CREATE INDEX "conversations_type_idx" ON "conversations"("type");

-- CreateIndex
CREATE INDEX "conversations_status_idx" ON "conversations"("status");

-- CreateIndex
CREATE INDEX "conversations_last_message_at_idx" ON "conversations"("last_message_at");

-- CreateIndex
CREATE INDEX "idx_conv_type_status" ON "conversations"("type", "status");

-- CreateIndex
CREATE INDEX "conversations_deleted_at_idx" ON "conversations"("deleted_at");

-- CreateIndex
CREATE INDEX "conversation_participants_conversation_id_idx" ON "conversation_participants"("conversation_id");

-- CreateIndex
CREATE INDEX "conversation_participants_user_id_idx" ON "conversation_participants"("user_id");

-- CreateIndex
CREATE INDEX "idx_participant_unread" ON "conversation_participants"("user_id", "unread_count");

-- CreateIndex
CREATE INDEX "conversation_participants_removed_at_idx" ON "conversation_participants"("removed_at");

-- CreateIndex
CREATE UNIQUE INDEX "idx_participant_conv_user" ON "conversation_participants"("conversation_id", "user_id");

-- CreateIndex
CREATE INDEX "messages_conversation_id_idx" ON "messages"("conversation_id");

-- CreateIndex
CREATE INDEX "messages_sender_id_idx" ON "messages"("sender_id");

-- CreateIndex
CREATE INDEX "messages_status_idx" ON "messages"("status");

-- CreateIndex
CREATE INDEX "messages_reply_to_id_idx" ON "messages"("reply_to_id");

-- CreateIndex
CREATE INDEX "messages_content_deleted_idx" ON "messages"("content_deleted");

-- CreateIndex
CREATE INDEX "idx_messages_conv_time" ON "messages"("conversation_id", "created_at");

-- CreateIndex
CREATE INDEX "idx_messages_conv_status" ON "messages"("conversation_id", "status");

-- CreateIndex
CREATE INDEX "messages_deleted_at_idx" ON "messages"("deleted_at");

-- CreateIndex
CREATE INDEX "message_read_receipts_message_id_idx" ON "message_read_receipts"("message_id");

-- CreateIndex
CREATE INDEX "message_read_receipts_user_id_idx" ON "message_read_receipts"("user_id");

-- CreateIndex
CREATE INDEX "idx_read_receipt_user_time" ON "message_read_receipts"("user_id", "read_at");

-- CreateIndex
CREATE UNIQUE INDEX "idx_read_receipt_unique" ON "message_read_receipts"("message_id", "user_id");

-- CreateIndex
CREATE INDEX "filter_blocks_conversation_id_idx" ON "filter_blocks"("conversation_id");

-- CreateIndex
CREATE INDEX "filter_blocks_sender_id_idx" ON "filter_blocks"("sender_id");

-- CreateIndex
CREATE INDEX "filter_blocks_filter_result_idx" ON "filter_blocks"("filter_result");

-- CreateIndex
CREATE INDEX "filter_blocks_filter_layer_idx" ON "filter_blocks"("filter_layer");

-- CreateIndex
CREATE INDEX "filter_blocks_created_at_idx" ON "filter_blocks"("created_at");

-- CreateIndex
CREATE INDEX "idx_blocks_sender_time" ON "filter_blocks"("sender_id", "created_at");

-- CreateIndex
CREATE INDEX "idx_blocks_conv_sender" ON "filter_blocks"("conversation_id", "sender_id");

-- CreateIndex
CREATE INDEX "filter_blocks_escalated_to_trust_safety_idx" ON "filter_blocks"("escalated_to_trust_safety");

-- CreateIndex
CREATE INDEX "moderation_reviews_conversation_id_idx" ON "moderation_reviews"("conversation_id");

-- CreateIndex
CREATE INDEX "moderation_reviews_trigger_idx" ON "moderation_reviews"("trigger");

-- CreateIndex
CREATE INDEX "moderation_reviews_status_idx" ON "moderation_reviews"("status");

-- CreateIndex
CREATE INDEX "moderation_reviews_reviewed_by_idx" ON "moderation_reviews"("reviewed_by");

-- CreateIndex
CREATE INDEX "moderation_reviews_reported_by_idx" ON "moderation_reviews"("reported_by");

-- CreateIndex
CREATE INDEX "idx_moderation_status_time" ON "moderation_reviews"("status", "created_at");

-- CreateIndex
CREATE INDEX "idx_moderation_conv_status" ON "moderation_reviews"("conversation_id", "status");

-- CreateIndex
CREATE INDEX "session_chat_messages_live_room_id_idx" ON "session_chat_messages"("live_room_id");

-- CreateIndex
CREATE INDEX "session_chat_messages_sender_id_idx" ON "session_chat_messages"("sender_id");

-- CreateIndex
CREATE INDEX "idx_session_chat_room_time" ON "session_chat_messages"("live_room_id", "created_at");

-- CreateIndex
CREATE INDEX "session_chat_messages_deleted_at_idx" ON "session_chat_messages"("deleted_at");

-- CreateIndex
CREATE INDEX "filter_keywords_keyword_idx" ON "filter_keywords"("keyword");

-- CreateIndex
CREATE INDEX "filter_keywords_language_idx" ON "filter_keywords"("language");

-- CreateIndex
CREATE INDEX "filter_keywords_is_active_idx" ON "filter_keywords"("is_active");

-- CreateIndex
CREATE UNIQUE INDEX "idx_keyword_lang_unique" ON "filter_keywords"("keyword", "language");

-- CreateIndex
CREATE UNIQUE INDEX "lesson_confirmations_booking_id_key" ON "lesson_confirmations"("booking_id");

-- CreateIndex
CREATE INDEX "lesson_confirmations_action_idx" ON "lesson_confirmations"("action");

-- CreateIndex
CREATE INDEX "lesson_confirmations_window_closes_at_idx" ON "lesson_confirmations"("window_closes_at");

-- CreateIndex
CREATE INDEX "idx_confirmation_action_time" ON "lesson_confirmations"("action", "confirmed_at");

-- CreateIndex
CREATE UNIQUE INDEX "auto_resolution_recommendations_booking_id_key" ON "auto_resolution_recommendations"("booking_id");

-- CreateIndex
CREATE UNIQUE INDEX "auto_resolution_recommendations_lesson_confirmation_id_key" ON "auto_resolution_recommendations"("lesson_confirmation_id");

-- CreateIndex
CREATE INDEX "auto_resolution_recommendations_recommendation_idx" ON "auto_resolution_recommendations"("recommendation");

-- CreateIndex
CREATE INDEX "auto_resolution_recommendations_lesson_confirmation_id_idx" ON "auto_resolution_recommendations"("lesson_confirmation_id");

-- CreateIndex
CREATE UNIQUE INDEX "disputes_booking_id_key" ON "disputes"("booking_id");

-- CreateIndex
CREATE UNIQUE INDEX "disputes_lesson_confirmation_id_key" ON "disputes"("lesson_confirmation_id");

-- CreateIndex
CREATE INDEX "disputes_opened_by_idx" ON "disputes"("opened_by");

-- CreateIndex
CREATE INDEX "disputes_status_idx" ON "disputes"("status");

-- CreateIndex
CREATE INDEX "disputes_resolved_by_idx" ON "disputes"("resolved_by");

-- CreateIndex
CREATE INDEX "disputes_tutor_response_due_at_idx" ON "disputes"("tutor_response_due_at");

-- CreateIndex
CREATE INDEX "idx_dispute_status_time" ON "disputes"("status", "opened_at");

-- CreateIndex
CREATE INDEX "idx_dispute_escalation" ON "disputes"("status", "escalated_at");

-- CreateIndex
CREATE INDEX "dispute_evidence_files_dispute_id_idx" ON "dispute_evidence_files"("dispute_id");

-- CreateIndex
CREATE INDEX "dispute_evidence_files_file_id_idx" ON "dispute_evidence_files"("file_id");

-- CreateIndex
CREATE INDEX "dispute_evidence_files_uploaded_by_idx" ON "dispute_evidence_files"("uploaded_by");

-- CreateIndex
CREATE INDEX "dispute_evidence_files_party_idx" ON "dispute_evidence_files"("party");

-- CreateIndex
CREATE INDEX "idx_evidence_dispute_party" ON "dispute_evidence_files"("dispute_id", "party");

-- CreateIndex
CREATE UNIQUE INDEX "dispute_evidence_snapshots_dispute_id_key" ON "dispute_evidence_snapshots"("dispute_id");

-- CreateIndex
CREATE INDEX "dispute_evidence_snapshots_assembled_at_idx" ON "dispute_evidence_snapshots"("assembled_at");

-- CreateIndex
CREATE INDEX "incident_reports_booking_id_idx" ON "incident_reports"("booking_id");

-- CreateIndex
CREATE INDEX "incident_reports_reported_by_idx" ON "incident_reports"("reported_by");

-- CreateIndex
CREATE INDEX "incident_reports_reported_against_idx" ON "incident_reports"("reported_against");

-- CreateIndex
CREATE INDEX "incident_reports_report_type_idx" ON "incident_reports"("report_type");

-- CreateIndex
CREATE INDEX "incident_reports_reviewed_by_idx" ON "incident_reports"("reviewed_by");

-- CreateIndex
CREATE INDEX "idx_incident_against_time" ON "incident_reports"("reported_against", "created_at");

-- CreateIndex
CREATE INDEX "idx_incident_by_time" ON "incident_reports"("reported_by", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "review_windows_booking_id_key" ON "review_windows"("booking_id");

-- CreateIndex
CREATE INDEX "review_windows_closes_at_idx" ON "review_windows"("closes_at");

-- CreateIndex
CREATE INDEX "review_windows_revealed_at_idx" ON "review_windows"("revealed_at");

-- CreateIndex
CREATE INDEX "idx_window_submission_state" ON "review_windows"("author_submitted", "subject_submitted");

-- CreateIndex
CREATE INDEX "idx_window_pending_reveal" ON "review_windows"("closes_at", "revealed_at");

-- CreateIndex
CREATE INDEX "reviews_booking_id_idx" ON "reviews"("booking_id");

-- CreateIndex
CREATE INDEX "reviews_review_window_id_idx" ON "reviews"("review_window_id");

-- CreateIndex
CREATE INDEX "reviews_author_id_idx" ON "reviews"("author_id");

-- CreateIndex
CREATE INDEX "reviews_subject_id_idx" ON "reviews"("subject_id");

-- CreateIndex
CREATE INDEX "reviews_overall_rating_idx" ON "reviews"("overall_rating");

-- CreateIndex
CREATE INDEX "reviews_status_idx" ON "reviews"("status");

-- CreateIndex
CREATE INDEX "reviews_revealed_at_idx" ON "reviews"("revealed_at");

-- CreateIndex
CREATE INDEX "reviews_deleted_at_idx" ON "reviews"("deleted_at");

-- CreateIndex
CREATE INDEX "idx_review_subject_revealed" ON "reviews"("subject_id", "status", "revealed_at");

-- CreateIndex
CREATE INDEX "idx_review_subject_time" ON "reviews"("subject_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "idx_review_booking_author" ON "reviews"("booking_id", "author_id");

-- CreateIndex
CREATE UNIQUE INDEX "tutor_rating_snapshots_tutor_id_key" ON "tutor_rating_snapshots"("tutor_id");

-- CreateIndex
CREATE INDEX "tutor_rating_snapshots_bayesian_rating_idx" ON "tutor_rating_snapshots"("bayesian_rating");

-- CreateIndex
CREATE INDEX "tutor_rating_snapshots_total_review_count_idx" ON "tutor_rating_snapshots"("total_review_count");

-- CreateIndex
CREATE INDEX "tutor_rating_snapshots_last_recalculated_at_idx" ON "tutor_rating_snapshots"("last_recalculated_at");

-- CreateIndex
CREATE INDEX "review_reports_review_id_idx" ON "review_reports"("review_id");

-- CreateIndex
CREATE INDEX "review_reports_reported_by_idx" ON "review_reports"("reported_by");

-- CreateIndex
CREATE INDEX "review_reports_status_idx" ON "review_reports"("status");

-- CreateIndex
CREATE INDEX "review_reports_reviewed_by_idx" ON "review_reports"("reviewed_by");

-- CreateIndex
CREATE INDEX "idx_report_status_time" ON "review_reports"("status", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "idx_report_review_user" ON "review_reports"("review_id", "reported_by");

-- CreateIndex
CREATE INDEX "review_fraud_signals_subject_user_id_idx" ON "review_fraud_signals"("subject_user_id");

-- CreateIndex
CREATE INDEX "review_fraud_signals_signal_type_idx" ON "review_fraud_signals"("signal_type");

-- CreateIndex
CREATE INDEX "review_fraud_signals_detected_at_idx" ON "review_fraud_signals"("detected_at");

-- CreateIndex
CREATE INDEX "review_fraud_signals_trust_safety_signal_created_idx" ON "review_fraud_signals"("trust_safety_signal_created");

-- CreateIndex
CREATE INDEX "idx_fraud_signal_subject_type" ON "review_fraud_signals"("subject_user_id", "signal_type");

-- CreateIndex
CREATE UNIQUE INDEX "risk_scores_user_id_key" ON "risk_scores"("user_id");

-- CreateIndex
CREATE INDEX "risk_scores_current_state_idx" ON "risk_scores"("current_state");

-- CreateIndex
CREATE INDEX "risk_scores_current_score_idx" ON "risk_scores"("current_score");

-- CreateIndex
CREATE INDEX "idx_risk_state_since" ON "risk_scores"("current_state", "current_state_since");

-- CreateIndex
CREATE INDEX "risk_scores_next_decay_at_idx" ON "risk_scores"("next_decay_at");

-- CreateIndex
CREATE INDEX "risk_scores_human_review_due_at_idx" ON "risk_scores"("human_review_due_at");

-- CreateIndex
CREATE INDEX "risk_scores_suspended_by_trust_safety_idx" ON "risk_scores"("suspended_by_trust_safety");

-- CreateIndex
CREATE INDEX "risk_signals_user_id_idx" ON "risk_signals"("user_id");

-- CreateIndex
CREATE INDEX "risk_signals_risk_score_id_idx" ON "risk_signals"("risk_score_id");

-- CreateIndex
CREATE INDEX "risk_signals_signal_type_idx" ON "risk_signals"("signal_type");

-- CreateIndex
CREATE INDEX "risk_signals_source_module_idx" ON "risk_signals"("source_module");

-- CreateIndex
CREATE INDEX "risk_signals_source_record_id_idx" ON "risk_signals"("source_record_id");

-- CreateIndex
CREATE INDEX "risk_signals_created_at_idx" ON "risk_signals"("created_at");

-- CreateIndex
CREATE INDEX "risk_signals_triggered_immediate_escalation_idx" ON "risk_signals"("triggered_immediate_escalation");

-- CreateIndex
CREATE INDEX "idx_signals_user_time" ON "risk_signals"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "idx_signals_user_type" ON "risk_signals"("user_id", "signal_type");

-- CreateIndex
CREATE INDEX "idx_signals_type_time" ON "risk_signals"("signal_type", "created_at");

-- CreateIndex
CREATE INDEX "risk_state_history_user_id_idx" ON "risk_state_history"("user_id");

-- CreateIndex
CREATE INDEX "risk_state_history_risk_score_id_idx" ON "risk_state_history"("risk_score_id");

-- CreateIndex
CREATE INDEX "risk_state_history_previous_state_idx" ON "risk_state_history"("previous_state");

-- CreateIndex
CREATE INDEX "risk_state_history_new_state_idx" ON "risk_state_history"("new_state");

-- CreateIndex
CREATE INDEX "risk_state_history_triggering_signal_id_idx" ON "risk_state_history"("triggering_signal_id");

-- CreateIndex
CREATE INDEX "risk_state_history_created_at_idx" ON "risk_state_history"("created_at");

-- CreateIndex
CREATE INDEX "risk_state_history_suspension_triggered_idx" ON "risk_state_history"("suspension_triggered");

-- CreateIndex
CREATE INDEX "idx_state_history_user_time" ON "risk_state_history"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "idx_state_history_new_state_time" ON "risk_state_history"("new_state", "created_at");

-- CreateIndex
CREATE INDEX "reauth_challenges_user_id_idx" ON "reauth_challenges"("user_id");

-- CreateIndex
CREATE INDEX "reauth_challenges_status_idx" ON "reauth_challenges"("status");

-- CreateIndex
CREATE INDEX "reauth_challenges_expires_at_idx" ON "reauth_challenges"("expires_at");

-- CreateIndex
CREATE INDEX "reauth_challenges_trigger_record_id_idx" ON "reauth_challenges"("trigger_record_id");

-- CreateIndex
CREATE INDEX "idx_reauth_user_status" ON "reauth_challenges"("user_id", "status");

-- CreateIndex
CREATE INDEX "idx_reauth_pending_expiry" ON "reauth_challenges"("status", "expires_at");

-- CreateIndex
CREATE INDEX "device_fingerprint_registry_device_fingerprint_hash_idx" ON "device_fingerprint_registry"("device_fingerprint_hash");

-- CreateIndex
CREATE INDEX "device_fingerprint_registry_user_id_idx" ON "device_fingerprint_registry"("user_id");

-- CreateIndex
CREATE INDEX "idx_fingerprint_banned" ON "device_fingerprint_registry"("device_fingerprint_hash", "associated_with_banned");

-- CreateIndex
CREATE INDEX "device_fingerprint_registry_associated_with_suspended_idx" ON "device_fingerprint_registry"("associated_with_suspended");

-- CreateIndex
CREATE UNIQUE INDEX "idx_fingerprint_user_unique" ON "device_fingerprint_registry"("device_fingerprint_hash", "user_id");

-- CreateIndex
CREATE INDEX "dead_letter_jobs_job_id_idx" ON "dead_letter_jobs"("job_id");

-- CreateIndex
CREATE INDEX "dead_letter_jobs_queue_name_idx" ON "dead_letter_jobs"("queue_name");

-- CreateIndex
CREATE INDEX "dead_letter_jobs_job_type_idx" ON "dead_letter_jobs"("job_type");

-- CreateIndex
CREATE INDEX "dead_letter_jobs_status_idx" ON "dead_letter_jobs"("status");

-- CreateIndex
CREATE INDEX "dead_letter_jobs_user_id_idx" ON "dead_letter_jobs"("user_id");

-- CreateIndex
CREATE INDEX "dead_letter_jobs_booking_id_idx" ON "dead_letter_jobs"("booking_id");

-- CreateIndex
CREATE INDEX "dead_letter_jobs_payout_queue_id_idx" ON "dead_letter_jobs"("payout_queue_id");

-- CreateIndex
CREATE INDEX "dead_letter_jobs_last_failed_at_idx" ON "dead_letter_jobs"("last_failed_at");

-- CreateIndex
CREATE INDEX "idx_dlq_status_time" ON "dead_letter_jobs"("status", "last_failed_at");

-- CreateIndex
CREATE INDEX "idx_dlq_queue_status" ON "dead_letter_jobs"("queue_name", "status");

-- CreateIndex
CREATE INDEX "support_tickets_submitted_by_idx" ON "support_tickets"("submitted_by");

-- CreateIndex
CREATE INDEX "support_tickets_assigned_to_idx" ON "support_tickets"("assigned_to");

-- CreateIndex
CREATE INDEX "support_tickets_escalated_to_idx" ON "support_tickets"("escalated_to");

-- CreateIndex
CREATE INDEX "support_tickets_status_idx" ON "support_tickets"("status");

-- CreateIndex
CREATE INDEX "support_tickets_category_idx" ON "support_tickets"("category");

-- CreateIndex
CREATE INDEX "support_tickets_creation_source_idx" ON "support_tickets"("creation_source");

-- CreateIndex
CREATE INDEX "support_tickets_booking_id_idx" ON "support_tickets"("booking_id");

-- CreateIndex
CREATE INDEX "support_tickets_payout_queue_id_idx" ON "support_tickets"("payout_queue_id");

-- CreateIndex
CREATE INDEX "idx_ticket_status_time" ON "support_tickets"("status", "created_at");

-- CreateIndex
CREATE INDEX "idx_ticket_agent_status" ON "support_tickets"("assigned_to", "status");

-- CreateIndex
CREATE INDEX "idx_ticket_reopen_window" ON "support_tickets"("status", "reopen_deadline");

-- CreateIndex
CREATE INDEX "idx_ticket_user_status" ON "support_tickets"("submitted_by", "status");

-- CreateIndex
CREATE INDEX "ticket_messages_ticket_id_idx" ON "ticket_messages"("ticket_id");

-- CreateIndex
CREATE INDEX "ticket_messages_author_id_idx" ON "ticket_messages"("author_id");

-- CreateIndex
CREATE INDEX "ticket_messages_author_type_idx" ON "ticket_messages"("author_type");

-- CreateIndex
CREATE INDEX "ticket_messages_is_internal_note_idx" ON "ticket_messages"("is_internal_note");

-- CreateIndex
CREATE INDEX "idx_ticket_messages_thread" ON "ticket_messages"("ticket_id", "created_at");

-- CreateIndex
CREATE INDEX "idx_ticket_messages_visibility" ON "ticket_messages"("ticket_id", "is_internal_note");

-- CreateIndex
CREATE INDEX "ticket_attachments_ticket_id_idx" ON "ticket_attachments"("ticket_id");

-- CreateIndex
CREATE INDEX "ticket_attachments_message_id_idx" ON "ticket_attachments"("message_id");

-- CreateIndex
CREATE INDEX "ticket_attachments_file_id_idx" ON "ticket_attachments"("file_id");

-- CreateIndex
CREATE INDEX "ticket_attachments_uploaded_by_idx" ON "ticket_attachments"("uploaded_by");

-- CreateIndex
CREATE UNIQUE INDEX "idx_attachment_message_file" ON "ticket_attachments"("message_id", "file_id");

-- CreateIndex
CREATE INDEX "ticket_status_history_ticket_id_idx" ON "ticket_status_history"("ticket_id");

-- CreateIndex
CREATE INDEX "ticket_status_history_previous_status_idx" ON "ticket_status_history"("previous_status");

-- CreateIndex
CREATE INDEX "ticket_status_history_new_status_idx" ON "ticket_status_history"("new_status");

-- CreateIndex
CREATE INDEX "ticket_status_history_changed_by_idx" ON "ticket_status_history"("changed_by");

-- CreateIndex
CREATE INDEX "ticket_status_history_created_at_idx" ON "ticket_status_history"("created_at");

-- CreateIndex
CREATE INDEX "idx_ticket_history_thread" ON "ticket_status_history"("ticket_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "failed_payout_contexts_ticket_id_key" ON "failed_payout_contexts"("ticket_id");

-- CreateIndex
CREATE INDEX "failed_payout_contexts_payout_queue_id_idx" ON "failed_payout_contexts"("payout_queue_id");

-- CreateIndex
CREATE INDEX "failed_payout_contexts_retry_payout_queue_id_idx" ON "failed_payout_contexts"("retry_payout_queue_id");

-- CreateIndex
CREATE UNIQUE INDEX "reconciliation_contexts_ticket_id_key" ON "reconciliation_contexts"("ticket_id");

-- CreateIndex
CREATE INDEX "reconciliation_contexts_reconciliation_id_idx" ON "reconciliation_contexts"("reconciliation_id");

-- CreateIndex
CREATE INDEX "reconciliation_contexts_provider_transaction_id_idx" ON "reconciliation_contexts"("provider_transaction_id");

-- CreateIndex
CREATE INDEX "reconciliation_contexts_manual_resolution_idx" ON "reconciliation_contexts"("manual_resolution");

-- CreateIndex
CREATE INDEX "analytics_snapshots_snapshot_type_idx" ON "analytics_snapshots"("snapshot_type");

-- CreateIndex
CREATE INDEX "analytics_snapshots_computed_at_idx" ON "analytics_snapshots"("computed_at");

-- CreateIndex
CREATE INDEX "idx_snapshot_type_time" ON "analytics_snapshots"("snapshot_type", "computed_at");

-- CreateIndex
CREATE INDEX "scheduled_reports_created_by_idx" ON "scheduled_reports"("created_by");

-- CreateIndex
CREATE INDEX "scheduled_reports_report_type_idx" ON "scheduled_reports"("report_type");

-- CreateIndex
CREATE INDEX "scheduled_reports_schedule_idx" ON "scheduled_reports"("schedule");

-- CreateIndex
CREATE INDEX "scheduled_reports_is_active_idx" ON "scheduled_reports"("is_active");

-- CreateIndex
CREATE INDEX "scheduled_reports_next_run_at_idx" ON "scheduled_reports"("next_run_at");

-- CreateIndex
CREATE INDEX "idx_scheduled_report_due" ON "scheduled_reports"("is_active", "next_run_at");

-- CreateIndex
CREATE INDEX "scheduled_reports_deleted_at_idx" ON "scheduled_reports"("deleted_at");

-- CreateIndex
CREATE INDEX "generated_reports_requested_by_idx" ON "generated_reports"("requested_by");

-- CreateIndex
CREATE INDEX "generated_reports_report_type_idx" ON "generated_reports"("report_type");

-- CreateIndex
CREATE INDEX "generated_reports_status_idx" ON "generated_reports"("status");

-- CreateIndex
CREATE INDEX "generated_reports_scheduled_report_id_idx" ON "generated_reports"("scheduled_report_id");

-- CreateIndex
CREATE INDEX "generated_reports_file_id_idx" ON "generated_reports"("file_id");

-- CreateIndex
CREATE INDEX "generated_reports_download_expires_at_idx" ON "generated_reports"("download_expires_at");

-- CreateIndex
CREATE INDEX "idx_generated_status_time" ON "generated_reports"("status", "created_at");

-- CreateIndex
CREATE INDEX "idx_generated_requester_time" ON "generated_reports"("requested_by", "created_at");

-- CreateIndex
CREATE INDEX "idx_generated_expiry" ON "generated_reports"("status", "download_expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "job_heartbeat_registry_job_key_key" ON "job_heartbeat_registry"("job_key");

-- CreateIndex
CREATE INDEX "job_heartbeat_registry_current_status_idx" ON "job_heartbeat_registry"("current_status");

-- CreateIndex
CREATE INDEX "job_heartbeat_registry_alert_firing_idx" ON "job_heartbeat_registry"("alert_firing");

-- CreateIndex
CREATE INDEX "job_heartbeat_registry_is_active_idx" ON "job_heartbeat_registry"("is_active");

-- CreateIndex
CREATE INDEX "job_heartbeat_registry_last_heartbeat_at_idx" ON "job_heartbeat_registry"("last_heartbeat_at");

-- CreateIndex
CREATE INDEX "idx_heartbeat_health" ON "job_heartbeat_registry"("current_status", "alert_firing");

-- CreateIndex
CREATE INDEX "learning_analytics_snapshots_scope_idx" ON "learning_analytics_snapshots"("scope");

-- CreateIndex
CREATE INDEX "learning_analytics_snapshots_student_profile_id_idx" ON "learning_analytics_snapshots"("student_profile_id");

-- CreateIndex
CREATE INDEX "learning_analytics_snapshots_tutor_id_idx" ON "learning_analytics_snapshots"("tutor_id");

-- CreateIndex
CREATE INDEX "learning_analytics_snapshots_subject_id_idx" ON "learning_analytics_snapshots"("subject_id");

-- CreateIndex
CREATE INDEX "learning_analytics_snapshots_computed_at_idx" ON "learning_analytics_snapshots"("computed_at");

-- CreateIndex
CREATE INDEX "learning_analytics_snapshots_engagement_trend_idx" ON "learning_analytics_snapshots"("engagement_trend");

-- CreateIndex
CREATE INDEX "idx_learning_student_subject" ON "learning_analytics_snapshots"("student_profile_id", "subject_id", "computed_at");

-- CreateIndex
CREATE INDEX "idx_learning_tutor_subject" ON "learning_analytics_snapshots"("tutor_id", "subject_id", "computed_at");

-- CreateIndex
CREATE INDEX "idx_learning_scope_time" ON "learning_analytics_snapshots"("scope", "computed_at");

-- CreateIndex
CREATE UNIQUE INDEX "platform_configs_key_key" ON "platform_configs"("key");

-- CreateIndex
CREATE INDEX "platform_configs_category_idx" ON "platform_configs"("category");

-- AddForeignKey
ALTER TABLE "permission_submodules" ADD CONSTRAINT "permission_submodules_permission_module_id_fkey" FOREIGN KEY ("permission_module_id") REFERENCES "permission_modules"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "permissions" ADD CONSTRAINT "permissions_permission_module_id_fkey" FOREIGN KEY ("permission_module_id") REFERENCES "permission_modules"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "permissions" ADD CONSTRAINT "permissions_permission_submodule_id_fkey" FOREIGN KEY ("permission_submodule_id") REFERENCES "permission_submodules"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "permission_overrides" ADD CONSTRAINT "permission_overrides_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "permission_overrides" ADD CONSTRAINT "permission_overrides_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "permission_overrides" ADD CONSTRAINT "permission_overrides_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "permission_implications" ADD CONSTRAINT "permission_implications_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "permission_implications" ADD CONSTRAINT "permission_implications_implied_permission_id_fkey" FOREIGN KEY ("implied_permission_id") REFERENCES "permissions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ip_blocks" ADD CONSTRAINT "ip_blocks_blocked_by_fkey" FOREIGN KEY ("blocked_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_devices" ADD CONSTRAINT "user_devices_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_sessions" ADD CONSTRAINT "user_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_sessions" ADD CONSTRAINT "user_sessions_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "user_devices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_sessions" ADD CONSTRAINT "user_sessions_terminated_by_fkey" FOREIGN KEY ("terminated_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_tokens" ADD CONSTRAINT "platform_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_accounts" ADD CONSTRAINT "payment_accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account_suspensions" ADD CONSTRAINT "account_suspensions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account_suspensions" ADD CONSTRAINT "account_suspensions_lifted_by_fkey" FOREIGN KEY ("lifted_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account_suspensions" ADD CONSTRAINT "account_suspensions_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cities" ADD CONSTRAINT "cities_region_id_fkey" FOREIGN KEY ("region_id") REFERENCES "regions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subjects" ADD CONSTRAINT "subjects_domain_id_fkey" FOREIGN KEY ("domain_id") REFERENCES "subject_domains"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subject_relationship_weights" ADD CONSTRAINT "subject_relationship_weights_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "subjects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subject_relationship_weights" ADD CONSTRAINT "subject_relationship_weights_set_by_fkey" FOREIGN KEY ("set_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tutor_profiles" ADD CONSTRAINT "tutor_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tutor_profiles" ADD CONSTRAINT "tutor_profiles_city_id_fkey" FOREIGN KEY ("city_id") REFERENCES "cities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tutor_credentials" ADD CONSTRAINT "tutor_credentials_tutor_profile_id_fkey" FOREIGN KEY ("tutor_profile_id") REFERENCES "tutor_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tutor_credentials" ADD CONSTRAINT "tutor_credentials_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credential_subject_links" ADD CONSTRAINT "credential_subject_links_credential_id_fkey" FOREIGN KEY ("credential_id") REFERENCES "tutor_credentials"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credential_subject_links" ADD CONSTRAINT "credential_subject_links_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "subjects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tutor_subjects" ADD CONSTRAINT "tutor_subjects_tutor_profile_id_fkey" FOREIGN KEY ("tutor_profile_id") REFERENCES "tutor_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tutor_subjects" ADD CONSTRAINT "tutor_subjects_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "subjects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tutor_subjects" ADD CONSTRAINT "tutor_subjects_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "availability_slots" ADD CONSTRAINT "availability_slots_tutor_profile_id_fkey" FOREIGN KEY ("tutor_profile_id") REFERENCES "tutor_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_profiles" ADD CONSTRAINT "student_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_profiles" ADD CONSTRAINT "student_profiles_level_id_fkey" FOREIGN KEY ("level_id") REFERENCES "levels"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_profile_subjects" ADD CONSTRAINT "student_profile_subjects_student_profile_id_fkey" FOREIGN KEY ("student_profile_id") REFERENCES "student_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_profile_subjects" ADD CONSTRAINT "student_profile_subjects_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "subjects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "files" ADD CONSTRAINT "files_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "file_variants" ADD CONSTRAINT "file_variants_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "files"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "storage_quota_defaults" ADD CONSTRAINT "storage_quota_defaults_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "storage_quota_defaults" ADD CONSTRAINT "storage_quota_defaults_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "storage_quota_overrides" ADD CONSTRAINT "storage_quota_overrides_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "storage_quota_overrides" ADD CONSTRAINT "storage_quota_overrides_granted_by_fkey" FOREIGN KEY ("granted_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "storage_usage" ADD CONSTRAINT "storage_usage_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collections" ADD CONSTRAINT "collections_tutor_profile_id_fkey" FOREIGN KEY ("tutor_profile_id") REFERENCES "tutor_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collections" ADD CONSTRAINT "collections_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "subjects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collections" ADD CONSTRAINT "collections_level_id_fkey" FOREIGN KEY ("level_id") REFERENCES "levels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sections" ADD CONSTRAINT "sections_collection_id_fkey" FOREIGN KEY ("collection_id") REFERENCES "collections"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "materials" ADD CONSTRAINT "materials_collection_id_fkey" FOREIGN KEY ("collection_id") REFERENCES "collections"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "materials" ADD CONSTRAINT "materials_section_id_fkey" FOREIGN KEY ("section_id") REFERENCES "sections"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "materials" ADD CONSTRAINT "materials_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "files"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesson_plans" ADD CONSTRAINT "lesson_plans_collection_id_fkey" FOREIGN KEY ("collection_id") REFERENCES "collections"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesson_plans" ADD CONSTRAINT "lesson_plans_tutor_profile_id_fkey" FOREIGN KEY ("tutor_profile_id") REFERENCES "tutor_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesson_plan_topics" ADD CONSTRAINT "lesson_plan_topics_lesson_plan_id_fkey" FOREIGN KEY ("lesson_plan_id") REFERENCES "lesson_plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesson_plan_topics" ADD CONSTRAINT "lesson_plan_topics_section_id_fkey" FOREIGN KEY ("section_id") REFERENCES "sections"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_access" ADD CONSTRAINT "material_access_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_access" ADD CONSTRAINT "material_access_collection_id_fkey" FOREIGN KEY ("collection_id") REFERENCES "collections"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_access" ADD CONSTRAINT "material_access_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_reviews" ADD CONSTRAINT "material_reviews_collection_id_fkey" FOREIGN KEY ("collection_id") REFERENCES "collections"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_reviews" ADD CONSTRAINT "material_reviews_material_id_fkey" FOREIGN KEY ("material_id") REFERENCES "materials"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_reviews" ADD CONSTRAINT "material_reviews_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_reviews" ADD CONSTRAINT "material_reviews_tutor_id_fkey" FOREIGN KEY ("tutor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_reviews" ADD CONSTRAINT "material_reviews_reported_by_fkey" FOREIGN KEY ("reported_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kyc_applications" ADD CONSTRAINT "kyc_applications_tutor_profile_id_fkey" FOREIGN KEY ("tutor_profile_id") REFERENCES "tutor_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kyc_applications" ADD CONSTRAINT "kyc_applications_cni_front_photo_id_fkey" FOREIGN KEY ("cni_front_photo_id") REFERENCES "files"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kyc_applications" ADD CONSTRAINT "kyc_applications_cni_back_photo_id_fkey" FOREIGN KEY ("cni_back_photo_id") REFERENCES "files"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kyc_applications" ADD CONSTRAINT "kyc_applications_selfie_with_cni_id_fkey" FOREIGN KEY ("selfie_with_cni_id") REFERENCES "files"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kyc_applications" ADD CONSTRAINT "kyc_applications_current_city_id_fkey" FOREIGN KEY ("current_city_id") REFERENCES "cities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kyc_applications" ADD CONSTRAINT "kyc_applications_current_region_id_fkey" FOREIGN KEY ("current_region_id") REFERENCES "regions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kyc_status_history" ADD CONSTRAINT "kyc_status_history_kyc_application_id_fkey" FOREIGN KEY ("kyc_application_id") REFERENCES "kyc_applications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kyc_status_history" ADD CONSTRAINT "kyc_status_history_tutor_profile_id_fkey" FOREIGN KEY ("tutor_profile_id") REFERENCES "tutor_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kyc_status_history" ADD CONSTRAINT "kyc_status_history_changed_by_fkey" FOREIGN KEY ("changed_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kyc_rejection_flags" ADD CONSTRAINT "kyc_rejection_flags_kyc_application_id_fkey" FOREIGN KEY ("kyc_application_id") REFERENCES "kyc_applications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kyc_rejection_flags" ADD CONSTRAINT "kyc_rejection_flags_kyc_status_history_id_fkey" FOREIGN KEY ("kyc_status_history_id") REFERENCES "kyc_status_history"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kyc_checklist_submissions" ADD CONSTRAINT "kyc_checklist_submissions_kyc_application_id_fkey" FOREIGN KEY ("kyc_application_id") REFERENCES "kyc_applications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kyc_checklist_submissions" ADD CONSTRAINT "kyc_checklist_submissions_kyc_status_history_id_fkey" FOREIGN KEY ("kyc_status_history_id") REFERENCES "kyc_status_history"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kyc_checklist_submissions" ADD CONSTRAINT "kyc_checklist_submissions_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kyc_bans" ADD CONSTRAINT "kyc_bans_tutor_profile_id_fkey" FOREIGN KEY ("tutor_profile_id") REFERENCES "tutor_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kyc_bans" ADD CONSTRAINT "kyc_bans_banned_by_fkey" FOREIGN KEY ("banned_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "demand_signals" ADD CONSTRAINT "demand_signals_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "subjects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "demand_signals" ADD CONSTRAINT "demand_signals_city_id_fkey" FOREIGN KEY ("city_id") REFERENCES "cities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "demand_signals" ADD CONSTRAINT "demand_signals_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_series" ADD CONSTRAINT "booking_series_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_series" ADD CONSTRAINT "booking_series_tutor_profile_id_fkey" FOREIGN KEY ("tutor_profile_id") REFERENCES "tutor_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_series" ADD CONSTRAINT "booking_series_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "subjects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_series" ADD CONSTRAINT "booking_series_level_id_fkey" FOREIGN KEY ("level_id") REFERENCES "levels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_booker_id_fkey" FOREIGN KEY ("booker_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_student_profile_id_fkey" FOREIGN KEY ("student_profile_id") REFERENCES "student_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_tutor_profile_id_fkey" FOREIGN KEY ("tutor_profile_id") REFERENCES "tutor_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "subjects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_level_id_fkey" FOREIGN KEY ("level_id") REFERENCES "levels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_cancelled_by_fkey" FOREIGN KEY ("cancelled_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_series_id_fkey" FOREIGN KEY ("series_id") REFERENCES "booking_series"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "group_session_participants" ADD CONSTRAINT "group_session_participants_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "group_session_participants" ADD CONSTRAINT "group_session_participants_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "group_session_participants" ADD CONSTRAINT "group_session_participants_student_profile_id_fkey" FOREIGN KEY ("student_profile_id") REFERENCES "student_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "group_sessions" ADD CONSTRAINT "group_sessions_tutor_profile_id_fkey" FOREIGN KEY ("tutor_profile_id") REFERENCES "tutor_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "group_sessions" ADD CONSTRAINT "group_sessions_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "group_sessions" ADD CONSTRAINT "group_sessions_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "subjects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "group_sessions" ADD CONSTRAINT "group_sessions_level_id_fkey" FOREIGN KEY ("level_id") REFERENCES "levels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reschedule_requests" ADD CONSTRAINT "reschedule_requests_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reschedule_requests" ADD CONSTRAINT "reschedule_requests_requested_by_fkey" FOREIGN KEY ("requested_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reschedule_requests" ADD CONSTRAINT "reschedule_requests_responded_by_fkey" FOREIGN KEY ("responded_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_recipient_id_fkey" FOREIGN KEY ("recipient_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_deliveries" ADD CONSTRAINT "notification_deliveries_notification_id_fkey" FOREIGN KEY ("notification_id") REFERENCES "notifications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scheduled_notifications" ADD CONSTRAINT "scheduled_notifications_recipient_id_fkey" FOREIGN KEY ("recipient_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scheduled_notifications" ADD CONSTRAINT "scheduled_notifications_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "push_tokens" ADD CONSTRAINT "push_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "push_tokens" ADD CONSTRAINT "push_tokens_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "user_devices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wallets" ADD CONSTRAINT "wallets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "escrow_holds" ADD CONSTRAINT "escrow_holds_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "escrow_holds" ADD CONSTRAINT "escrow_holds_group_participant_id_fkey" FOREIGN KEY ("group_participant_id") REFERENCES "group_session_participants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "escrow_holds" ADD CONSTRAINT "escrow_holds_payer_id_fkey" FOREIGN KEY ("payer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "escrow_holds" ADD CONSTRAINT "escrow_holds_tutor_id_fkey" FOREIGN KEY ("tutor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "escrow_holds" ADD CONSTRAINT "escrow_holds_released_by_dispute_id_fkey" FOREIGN KEY ("released_by_dispute_id") REFERENCES "disputes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transaction_ledger" ADD CONSTRAINT "transaction_ledger_from_user_id_fkey" FOREIGN KEY ("from_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transaction_ledger" ADD CONSTRAINT "transaction_ledger_to_user_id_fkey" FOREIGN KEY ("to_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transaction_ledger" ADD CONSTRAINT "transaction_ledger_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transaction_ledger" ADD CONSTRAINT "transaction_ledger_escrow_hold_id_fkey" FOREIGN KEY ("escrow_hold_id") REFERENCES "escrow_holds"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transaction_ledger" ADD CONSTRAINT "transaction_ledger_payout_queue_id_fkey" FOREIGN KEY ("payout_queue_id") REFERENCES "payout_queue"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transaction_ledger" ADD CONSTRAINT "transaction_ledger_idempotency_key_id_fkey" FOREIGN KEY ("idempotency_key_id") REFERENCES "idempotency_keys"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transaction_ledger" ADD CONSTRAINT "transaction_ledger_performed_by_fkey" FOREIGN KEY ("performed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payout_queue" ADD CONSTRAINT "payout_queue_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payout_queue" ADD CONSTRAINT "payout_queue_payment_account_id_fkey" FOREIGN KEY ("payment_account_id") REFERENCES "payment_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "idempotency_keys" ADD CONSTRAINT "idempotency_keys_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_reconciliations" ADD CONSTRAINT "payment_reconciliations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_reconciliations" ADD CONSTRAINT "payment_reconciliations_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_reconciliations" ADD CONSTRAINT "payment_reconciliations_support_ticket_id_fkey" FOREIGN KEY ("support_ticket_id") REFERENCES "support_tickets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transaction_issues" ADD CONSTRAINT "transaction_issues_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transaction_issues" ADD CONSTRAINT "transaction_issues_payout_queue_id_fkey" FOREIGN KEY ("payout_queue_id") REFERENCES "payout_queue"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transaction_issues" ADD CONSTRAINT "transaction_issues_reconciliation_id_fkey" FOREIGN KEY ("reconciliation_id") REFERENCES "payment_reconciliations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transaction_issues" ADD CONSTRAINT "transaction_issues_ledger_entry_id_fkey" FOREIGN KEY ("ledger_entry_id") REFERENCES "transaction_ledger"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transaction_issues" ADD CONSTRAINT "transaction_issues_resolved_by_fkey" FOREIGN KEY ("resolved_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "files"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "monthly_fee_charges" ADD CONSTRAINT "monthly_fee_charges_tutor_profile_id_fkey" FOREIGN KEY ("tutor_profile_id") REFERENCES "tutor_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "monthly_fee_charges" ADD CONSTRAINT "monthly_fee_charges_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "live_rooms" ADD CONSTRAINT "live_rooms_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "live_rooms" ADD CONSTRAINT "live_rooms_whiteboard_file_id_fkey" FOREIGN KEY ("whiteboard_file_id") REFERENCES "files"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "live_rooms" ADD CONSTRAINT "live_rooms_recording_file_id_fkey" FOREIGN KEY ("recording_file_id") REFERENCES "files"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_participants" ADD CONSTRAINT "session_participants_live_room_id_fkey" FOREIGN KEY ("live_room_id") REFERENCES "live_rooms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_participants" ADD CONSTRAINT "session_participants_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "participant_events" ADD CONSTRAINT "participant_events_live_room_id_fkey" FOREIGN KEY ("live_room_id") REFERENCES "live_rooms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "participant_events" ADD CONSTRAINT "participant_events_session_participant_id_fkey" FOREIGN KEY ("session_participant_id") REFERENCES "session_participants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "participant_events" ADD CONSTRAINT "participant_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "participant_events" ADD CONSTRAINT "participant_events_actioned_by_fkey" FOREIGN KEY ("actioned_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "connection_quality_events" ADD CONSTRAINT "connection_quality_events_live_room_id_fkey" FOREIGN KEY ("live_room_id") REFERENCES "live_rooms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "connection_quality_events" ADD CONSTRAINT "connection_quality_events_session_participant_id_fkey" FOREIGN KEY ("session_participant_id") REFERENCES "session_participants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "connection_quality_events" ADD CONSTRAINT "connection_quality_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_frozen_by_fkey" FOREIGN KEY ("frozen_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation_participants" ADD CONSTRAINT "conversation_participants_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation_participants" ADD CONSTRAINT "conversation_participants_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation_participants" ADD CONSTRAINT "conversation_participants_added_by_fkey" FOREIGN KEY ("added_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation_participants" ADD CONSTRAINT "conversation_participants_removed_by_fkey" FOREIGN KEY ("removed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_reply_to_id_fkey" FOREIGN KEY ("reply_to_id") REFERENCES "messages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_deleted_by_fkey" FOREIGN KEY ("deleted_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_read_receipts" ADD CONSTRAINT "message_read_receipts_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "messages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_read_receipts" ADD CONSTRAINT "message_read_receipts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "filter_blocks" ADD CONSTRAINT "filter_blocks_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "filter_blocks" ADD CONSTRAINT "filter_blocks_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "moderation_reviews" ADD CONSTRAINT "moderation_reviews_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "moderation_reviews" ADD CONSTRAINT "moderation_reviews_filter_block_id_fkey" FOREIGN KEY ("filter_block_id") REFERENCES "filter_blocks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "moderation_reviews" ADD CONSTRAINT "moderation_reviews_reported_message_id_fkey" FOREIGN KEY ("reported_message_id") REFERENCES "messages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "moderation_reviews" ADD CONSTRAINT "moderation_reviews_reported_by_fkey" FOREIGN KEY ("reported_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "moderation_reviews" ADD CONSTRAINT "moderation_reviews_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_chat_messages" ADD CONSTRAINT "session_chat_messages_live_room_id_fkey" FOREIGN KEY ("live_room_id") REFERENCES "live_rooms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_chat_messages" ADD CONSTRAINT "session_chat_messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_chat_messages" ADD CONSTRAINT "session_chat_messages_reply_to_id_fkey" FOREIGN KEY ("reply_to_id") REFERENCES "session_chat_messages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_chat_messages" ADD CONSTRAINT "session_chat_messages_deleted_by_fkey" FOREIGN KEY ("deleted_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "filter_keywords" ADD CONSTRAINT "filter_keywords_added_by_fkey" FOREIGN KEY ("added_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesson_confirmations" ADD CONSTRAINT "lesson_confirmations_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesson_confirmations" ADD CONSTRAINT "lesson_confirmations_confirmed_by_fkey" FOREIGN KEY ("confirmed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auto_resolution_recommendations" ADD CONSTRAINT "auto_resolution_recommendations_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auto_resolution_recommendations" ADD CONSTRAINT "auto_resolution_recommendations_lesson_confirmation_id_fkey" FOREIGN KEY ("lesson_confirmation_id") REFERENCES "lesson_confirmations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_lesson_confirmation_id_fkey" FOREIGN KEY ("lesson_confirmation_id") REFERENCES "lesson_confirmations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_opened_by_fkey" FOREIGN KEY ("opened_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_assigned_to_fkey" FOREIGN KEY ("assigned_to") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_resolved_by_fkey" FOREIGN KEY ("resolved_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_recommendation_id_fkey" FOREIGN KEY ("recommendation_id") REFERENCES "auto_resolution_recommendations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dispute_evidence_files" ADD CONSTRAINT "dispute_evidence_files_dispute_id_fkey" FOREIGN KEY ("dispute_id") REFERENCES "disputes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dispute_evidence_files" ADD CONSTRAINT "dispute_evidence_files_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "files"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dispute_evidence_files" ADD CONSTRAINT "dispute_evidence_files_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dispute_evidence_snapshots" ADD CONSTRAINT "dispute_evidence_snapshots_dispute_id_fkey" FOREIGN KEY ("dispute_id") REFERENCES "disputes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incident_reports" ADD CONSTRAINT "incident_reports_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incident_reports" ADD CONSTRAINT "incident_reports_reported_by_fkey" FOREIGN KEY ("reported_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incident_reports" ADD CONSTRAINT "incident_reports_reported_against_fkey" FOREIGN KEY ("reported_against") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incident_reports" ADD CONSTRAINT "incident_reports_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_windows" ADD CONSTRAINT "review_windows_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_windows" ADD CONSTRAINT "review_windows_reopened_by_fkey" FOREIGN KEY ("reopened_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_review_window_id_fkey" FOREIGN KEY ("review_window_id") REFERENCES "review_windows"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_deleted_by_fkey" FOREIGN KEY ("deleted_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tutor_rating_snapshots" ADD CONSTRAINT "tutor_rating_snapshots_tutor_id_fkey" FOREIGN KEY ("tutor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tutor_rating_snapshots" ADD CONSTRAINT "tutor_rating_snapshots_recalculated_by_review_id_fkey" FOREIGN KEY ("recalculated_by_review_id") REFERENCES "reviews"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_reports" ADD CONSTRAINT "review_reports_review_id_fkey" FOREIGN KEY ("review_id") REFERENCES "reviews"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_reports" ADD CONSTRAINT "review_reports_reported_by_fkey" FOREIGN KEY ("reported_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_reports" ADD CONSTRAINT "review_reports_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_fraud_signals" ADD CONSTRAINT "review_fraud_signals_subject_user_id_fkey" FOREIGN KEY ("subject_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "risk_scores" ADD CONSTRAINT "risk_scores_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "risk_scores" ADD CONSTRAINT "risk_scores_human_review_completed_by_fkey" FOREIGN KEY ("human_review_completed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "risk_signals" ADD CONSTRAINT "risk_signals_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "risk_signals" ADD CONSTRAINT "risk_signals_risk_score_id_fkey" FOREIGN KEY ("risk_score_id") REFERENCES "risk_scores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "risk_signals" ADD CONSTRAINT "risk_signals_performed_by_fkey" FOREIGN KEY ("performed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "risk_state_history" ADD CONSTRAINT "risk_state_history_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "risk_state_history" ADD CONSTRAINT "risk_state_history_risk_score_id_fkey" FOREIGN KEY ("risk_score_id") REFERENCES "risk_scores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "risk_state_history" ADD CONSTRAINT "risk_state_history_triggering_signal_id_fkey" FOREIGN KEY ("triggering_signal_id") REFERENCES "risk_signals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "risk_state_history" ADD CONSTRAINT "risk_state_history_cleared_by_fkey" FOREIGN KEY ("cleared_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reauth_challenges" ADD CONSTRAINT "reauth_challenges_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "device_fingerprint_registry" ADD CONSTRAINT "device_fingerprint_registry_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dead_letter_jobs" ADD CONSTRAINT "dead_letter_jobs_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dead_letter_jobs" ADD CONSTRAINT "dead_letter_jobs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dead_letter_jobs" ADD CONSTRAINT "dead_letter_jobs_payout_queue_id_fkey" FOREIGN KEY ("payout_queue_id") REFERENCES "payout_queue"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dead_letter_jobs" ADD CONSTRAINT "dead_letter_jobs_retried_by_fkey" FOREIGN KEY ("retried_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dead_letter_jobs" ADD CONSTRAINT "dead_letter_jobs_dismissed_by_fkey" FOREIGN KEY ("dismissed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_submitted_by_fkey" FOREIGN KEY ("submitted_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_assigned_to_fkey" FOREIGN KEY ("assigned_to") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_escalated_to_fkey" FOREIGN KEY ("escalated_to") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_resolved_by_fkey" FOREIGN KEY ("resolved_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_payout_queue_id_fkey" FOREIGN KEY ("payout_queue_id") REFERENCES "payout_queue"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_dispute_id_fkey" FOREIGN KEY ("dispute_id") REFERENCES "disputes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_messages" ADD CONSTRAINT "ticket_messages_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "support_tickets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_messages" ADD CONSTRAINT "ticket_messages_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_attachments" ADD CONSTRAINT "ticket_attachments_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "support_tickets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_attachments" ADD CONSTRAINT "ticket_attachments_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "ticket_messages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_attachments" ADD CONSTRAINT "ticket_attachments_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "files"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_attachments" ADD CONSTRAINT "ticket_attachments_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_status_history" ADD CONSTRAINT "ticket_status_history_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "support_tickets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_status_history" ADD CONSTRAINT "ticket_status_history_changed_by_fkey" FOREIGN KEY ("changed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "failed_payout_contexts" ADD CONSTRAINT "failed_payout_contexts_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "support_tickets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "failed_payout_contexts" ADD CONSTRAINT "failed_payout_contexts_payout_queue_id_fkey" FOREIGN KEY ("payout_queue_id") REFERENCES "payout_queue"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "failed_payout_contexts" ADD CONSTRAINT "failed_payout_contexts_retry_initiated_by_fkey" FOREIGN KEY ("retry_initiated_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "failed_payout_contexts" ADD CONSTRAINT "failed_payout_contexts_retry_payout_queue_id_fkey" FOREIGN KEY ("retry_payout_queue_id") REFERENCES "payout_queue"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reconciliation_contexts" ADD CONSTRAINT "reconciliation_contexts_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "support_tickets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reconciliation_contexts" ADD CONSTRAINT "reconciliation_contexts_reconciliation_id_fkey" FOREIGN KEY ("reconciliation_id") REFERENCES "payment_reconciliations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reconciliation_contexts" ADD CONSTRAINT "reconciliation_contexts_manually_resolved_by_fkey" FOREIGN KEY ("manually_resolved_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scheduled_reports" ADD CONSTRAINT "scheduled_reports_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "generated_reports" ADD CONSTRAINT "generated_reports_requested_by_fkey" FOREIGN KEY ("requested_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "generated_reports" ADD CONSTRAINT "generated_reports_scheduled_report_id_fkey" FOREIGN KEY ("scheduled_report_id") REFERENCES "scheduled_reports"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "generated_reports" ADD CONSTRAINT "generated_reports_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "files"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_heartbeat_registry" ADD CONSTRAINT "job_heartbeat_registry_disabled_by_fkey" FOREIGN KEY ("disabled_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning_analytics_snapshots" ADD CONSTRAINT "learning_analytics_snapshots_student_profile_id_fkey" FOREIGN KEY ("student_profile_id") REFERENCES "student_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning_analytics_snapshots" ADD CONSTRAINT "learning_analytics_snapshots_tutor_id_fkey" FOREIGN KEY ("tutor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning_analytics_snapshots" ADD CONSTRAINT "learning_analytics_snapshots_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "subjects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_configs" ADD CONSTRAINT "platform_configs_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
