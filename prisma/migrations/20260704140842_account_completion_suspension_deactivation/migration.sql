-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "LogOperation" ADD VALUE 'DEACTIVATE';
ALTER TYPE "LogOperation" ADD VALUE 'REACTIVATE';
ALTER TYPE "LogOperation" ADD VALUE 'ANONYMISE';

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'ADMIN_REVIEW_REQUIRED';

-- AlterTable
ALTER TABLE "student_profiles" ADD COLUMN     "guardian_id" UUID;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "anonymised_at" TIMESTAMP(3),
ADD COLUMN     "escrow_review_required" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "escrow_review_required_at" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "student_profiles_guardian_id_idx" ON "student_profiles"("guardian_id");

-- AddForeignKey
ALTER TABLE "student_profiles" ADD CONSTRAINT "student_profiles_guardian_id_fkey" FOREIGN KEY ("guardian_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
