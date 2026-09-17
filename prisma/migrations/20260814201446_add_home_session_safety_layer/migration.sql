-- CreateEnum
CREATE TYPE "SafetyAlertType" AS ENUM ('SOS', 'CHECKIN_FLAGGED', 'LOCATION_MISMATCH', 'CHECKOUT_ESCALATION');

-- CreateEnum
CREATE TYPE "SafetyAlertStatus" AS ENUM ('OPEN', 'ACKNOWLEDGED', 'RESOLVED');

-- AlterEnum
ALTER TYPE "NotificationResourceType" ADD VALUE 'SAFETY_ALERT';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'SESSION_SOS_TRIGGERED';
ALTER TYPE "NotificationType" ADD VALUE 'SESSION_CHECKIN_SAFETY_FLAGGED';
ALTER TYPE "NotificationType" ADD VALUE 'SESSION_LOCATION_MISMATCH';
ALTER TYPE "NotificationType" ADD VALUE 'SESSION_CHECKOUT_NUDGE';
ALTER TYPE "NotificationType" ADD VALUE 'SESSION_CHECKOUT_ESCALATED';
ALTER TYPE "NotificationType" ADD VALUE 'SAFETY_ALERT_RESOLVED';

-- AlterTable
ALTER TABLE "bookings" ADD COLUMN     "booker_checked_in_lat" DECIMAL(9,6),
ADD COLUMN     "booker_checked_in_lng" DECIMAL(9,6),
ADD COLUMN     "booker_checked_out_lat" DECIMAL(9,6),
ADD COLUMN     "booker_checked_out_lng" DECIMAL(9,6),
ADD COLUMN     "checkin_safety_note" VARCHAR(500),
ADD COLUMN     "checkout_escalated_at" TIMESTAMP(3),
ADD COLUMN     "checkout_nudge_sent_at" TIMESTAMP(3),
ADD COLUMN     "session_address" VARCHAR(500),
ADD COLUMN     "session_latitude" DECIMAL(9,6),
ADD COLUMN     "session_longitude" DECIMAL(9,6),
ADD COLUMN     "tutor_checked_in_lat" DECIMAL(9,6),
ADD COLUMN     "tutor_checked_in_lng" DECIMAL(9,6),
ADD COLUMN     "tutor_checked_out_lat" DECIMAL(9,6),
ADD COLUMN     "tutor_checked_out_lng" DECIMAL(9,6);

-- AlterTable
ALTER TABLE "tutor_profiles" ADD COLUMN     "emergency_contact_name" VARCHAR(255),
ADD COLUMN     "emergency_contact_phone" VARCHAR(20),
ADD COLUMN     "emergency_contact_relationship" VARCHAR(100);

-- CreateTable
CREATE TABLE "safety_alerts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "booking_id" UUID NOT NULL,
    "alert_type" "SafetyAlertType" NOT NULL,
    "status" "SafetyAlertStatus" NOT NULL DEFAULT 'OPEN',
    "triggered_by" UUID,
    "latitude" DECIMAL(9,6),
    "longitude" DECIMAL(9,6),
    "note" VARCHAR(1000),
    "emergency_contact_notified_at" TIMESTAMP(3),
    "emergency_contact_notified_channel" VARCHAR(20),
    "resolved_by" UUID,
    "resolved_at" TIMESTAMP(3),
    "resolution_note" VARCHAR(1000),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "safety_alerts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "safety_alerts_booking_id_idx" ON "safety_alerts"("booking_id");

-- CreateIndex
CREATE INDEX "safety_alerts_status_idx" ON "safety_alerts"("status");

-- CreateIndex
CREATE INDEX "safety_alerts_alert_type_idx" ON "safety_alerts"("alert_type");

-- CreateIndex
CREATE INDEX "idx_safety_alert_status_time" ON "safety_alerts"("status", "created_at");

-- AddForeignKey
ALTER TABLE "safety_alerts" ADD CONSTRAINT "safety_alerts_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "safety_alerts" ADD CONSTRAINT "safety_alerts_triggered_by_fkey" FOREIGN KEY ("triggered_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "safety_alerts" ADD CONSTRAINT "safety_alerts_resolved_by_fkey" FOREIGN KEY ("resolved_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
