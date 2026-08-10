-- REQ-017-008/009/010 wiring: a 4th review-fraud signal type for the
-- "3+ removals for the same account" cluster, a notification type for the
-- review-removal moderator action, and an immutable evidence snapshot for
-- incident reports (mirrors dispute_evidence_snapshots).

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.
ALTER TYPE "ReviewFraudSignalType" ADD VALUE 'EXCESSIVE_REMOVALS_BY_ACCOUNT';
ALTER TYPE "NotificationType" ADD VALUE 'REVIEW_REMOVED';

-- CreateTable
CREATE TABLE "incident_report_evidence_snapshots" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "incident_report_id" UUID NOT NULL,
    "booking_snapshot" JSONB NOT NULL,
    "session_data_snapshot" JSONB NOT NULL,
    "conversation_snapshot" JSONB NOT NULL,
    "session_chat_snapshot" JSONB NOT NULL,
    "assembled_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assembly_duration_ms" INTEGER,

    CONSTRAINT "incident_report_evidence_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "incident_report_evidence_snapshots_incident_report_id_key" ON "incident_report_evidence_snapshots"("incident_report_id");

-- CreateIndex
CREATE INDEX "incident_report_evidence_snapshots_assembled_at_idx" ON "incident_report_evidence_snapshots"("assembled_at");

-- AddForeignKey
ALTER TABLE "incident_report_evidence_snapshots" ADD CONSTRAINT "incident_report_evidence_snapshots_incident_report_id_fkey" FOREIGN KEY ("incident_report_id") REFERENCES "incident_reports"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
