/*
  Warnings:

  - You are about to drop the column `search_vector` on the `tutor_profiles` table. All the data in the column will be lost.

*/
-- AlterEnum
ALTER TYPE "LogOperation" ADD VALUE 'ROLE_MODIFICATION';

-- DropIndex
DROP INDEX "idx_learning_snapshot_unique";

-- DropIndex
DROP INDEX "idx_tutor_search_vector";

-- AlterTable
ALTER TABLE "roles" ADD COLUMN     "allows_multiple" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "tutor_profiles" DROP COLUMN "search_vector";
