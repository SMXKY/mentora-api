-- AlterTable
ALTER TABLE "files" ADD COLUMN     "purged_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "notifications" ALTER COLUMN "resourceId" DROP NOT NULL;
