-- AlterTable
ALTER TABLE "collections" ADD COLUMN     "order_index" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "idx_collection_tutor_order" ON "collections"("tutor_profile_id", "order_index");
