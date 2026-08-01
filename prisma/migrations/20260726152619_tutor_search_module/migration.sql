-- CreateEnum
CREATE TYPE "SearchEventType" AS ENUM ('QUERY_SUBMITTED', 'RESULT_CLICKED', 'FILTER_CHANGED', 'ZERO_RESULTS', 'BOOKING_INITIATED');

-- AlterEnum
ALTER TYPE "ConfigCategory" ADD VALUE 'SEARCH';

-- AlterEnum
ALTER TYPE "NotificationResourceType" ADD VALUE 'TUTOR_SUBJECT';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'INTRO_VIDEO_REQUIRED';
ALTER TYPE "NotificationType" ADD VALUE 'SUBJECT_APPLICATION_APPROVED';
ALTER TYPE "NotificationType" ADD VALUE 'SUBJECT_APPLICATION_REJECTED';

-- AlterTable
ALTER TABLE "subjects" ADD COLUMN     "description" TEXT,
ADD COLUMN     "status" "SubjectVerificationStatus" NOT NULL DEFAULT 'APPROVED',
ADD COLUMN     "submitted_by" UUID;

-- AlterTable
ALTER TABLE "tutor_profiles" ADD COLUMN     "intro_video_verified" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "tutor_subject_levels" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tutor_subject_id" UUID NOT NULL,
    "level_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tutor_subject_levels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "search_analytics_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID,
    "event_type" "SearchEventType" NOT NULL,
    "query" VARCHAR(255),
    "filters" JSONB,
    "result_count" INTEGER,
    "position" INTEGER,
    "tutor_profile_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "search_analytics_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "tutor_subject_levels_tutor_subject_id_idx" ON "tutor_subject_levels"("tutor_subject_id");

-- CreateIndex
CREATE INDEX "tutor_subject_levels_level_id_idx" ON "tutor_subject_levels"("level_id");

-- CreateIndex
CREATE UNIQUE INDEX "idx_tutor_subject_level_unique" ON "tutor_subject_levels"("tutor_subject_id", "level_id");

-- CreateIndex
CREATE INDEX "idx_search_event_type_created" ON "search_analytics_events"("event_type", "created_at");

-- CreateIndex
CREATE INDEX "search_analytics_events_user_id_idx" ON "search_analytics_events"("user_id");

-- CreateIndex
CREATE INDEX "search_analytics_events_tutor_profile_id_idx" ON "search_analytics_events"("tutor_profile_id");

-- CreateIndex
CREATE INDEX "subjects_status_idx" ON "subjects"("status");

-- CreateIndex
CREATE INDEX "idx_tutor_search_visible" ON "tutor_profiles"("kyc_status", "intro_video_verified");

-- AddForeignKey
ALTER TABLE "subjects" ADD CONSTRAINT "subjects_submitted_by_fkey" FOREIGN KEY ("submitted_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tutor_subject_levels" ADD CONSTRAINT "tutor_subject_levels_tutor_subject_id_fkey" FOREIGN KEY ("tutor_subject_id") REFERENCES "tutor_subjects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tutor_subject_levels" ADD CONSTRAINT "tutor_subject_levels_level_id_fkey" FOREIGN KEY ("level_id") REFERENCES "levels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "search_analytics_events" ADD CONSTRAINT "search_analytics_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "search_analytics_events" ADD CONSTRAINT "search_analytics_events_tutor_profile_id_fkey" FOREIGN KEY ("tutor_profile_id") REFERENCES "tutor_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
