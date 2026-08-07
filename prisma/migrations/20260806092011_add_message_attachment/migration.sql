-- AlterTable
ALTER TABLE "messages" ADD COLUMN     "attachment_file_id" UUID;

-- CreateIndex
CREATE INDEX "messages_attachment_file_id_idx" ON "messages"("attachment_file_id");

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_attachment_file_id_fkey" FOREIGN KEY ("attachment_file_id") REFERENCES "files"("id") ON DELETE SET NULL ON UPDATE CASCADE;
