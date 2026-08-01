-- AlterEnum
ALTER TYPE "ConfigCategory" ADD VALUE 'LIVE_SESSIONS';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'SESSION_ROOM_CREATION_FAILED';
ALTER TYPE "NotificationType" ADD VALUE 'SESSION_INCOMING_CALL';
ALTER TYPE "NotificationType" ADD VALUE 'SESSION_CALL_MISSED';
ALTER TYPE "NotificationType" ADD VALUE 'SESSION_EMPTY_TIMEOUT_CLOSED';
