/*
  Warnings:

  - Added the required column `resourceId` to the `notifications` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "NotificationResourceType" AS ENUM ('BOOKING', 'DISPUTE', 'PAYMENT', 'KYC', 'REVIEW', 'MATERIAL', 'SUPPORT_TICKET', 'ACCOUNT', 'MESSAGE');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'NEW_MESSAGE_RECEIVED';
ALTER TYPE "NotificationType" ADD VALUE 'OTHER';

-- AlterTable
ALTER TABLE "notifications" ADD COLUMN     "resourceId" TEXT NOT NULL,
ADD COLUMN     "resource_type" "NotificationResourceType";

-- CreateIndex
CREATE INDEX "idx_notification_resource" ON "notifications"("resource_type", "resourceId");
