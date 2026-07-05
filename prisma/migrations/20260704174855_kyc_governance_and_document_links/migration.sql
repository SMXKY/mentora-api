-- CreateEnum
CREATE TYPE "SpotCheckVerdict" AS ENUM ('GOOD', 'BAD');

-- AlterTable
ALTER TABLE "kyc_applications" ADD COLUMN     "cv_file_id" UUID,
ADD COLUMN     "non_conviction_certificate_id" UUID;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "kyc_countersignature_required" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "kyc_spot_check_reviews" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "kyc_status_history_id" UUID NOT NULL,
    "reviewed_by" UUID NOT NULL,
    "verdict" "SpotCheckVerdict" NOT NULL,
    "note" TEXT,
    "reviewed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "kyc_spot_check_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "kyc_spot_check_reviews_kyc_status_history_id_key" ON "kyc_spot_check_reviews"("kyc_status_history_id");

-- CreateIndex
CREATE INDEX "kyc_spot_check_reviews_reviewed_by_idx" ON "kyc_spot_check_reviews"("reviewed_by");

-- CreateIndex
CREATE INDEX "kyc_spot_check_reviews_verdict_idx" ON "kyc_spot_check_reviews"("verdict");

-- AddForeignKey
ALTER TABLE "kyc_applications" ADD CONSTRAINT "kyc_applications_non_conviction_certificate_id_fkey" FOREIGN KEY ("non_conviction_certificate_id") REFERENCES "files"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kyc_applications" ADD CONSTRAINT "kyc_applications_cv_file_id_fkey" FOREIGN KEY ("cv_file_id") REFERENCES "files"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kyc_spot_check_reviews" ADD CONSTRAINT "kyc_spot_check_reviews_kyc_status_history_id_fkey" FOREIGN KEY ("kyc_status_history_id") REFERENCES "kyc_status_history"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kyc_spot_check_reviews" ADD CONSTRAINT "kyc_spot_check_reviews_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
