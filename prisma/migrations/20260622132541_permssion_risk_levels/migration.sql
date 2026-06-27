-- CreateEnum
CREATE TYPE "PermissionRiskLevel" AS ENUM ('LOW', 'STANDARD', 'SENSITIVE', 'CRITICAL');

-- AlterTable
ALTER TABLE "permissions" ADD COLUMN     "risk_level" "PermissionRiskLevel" NOT NULL DEFAULT 'STANDARD';
