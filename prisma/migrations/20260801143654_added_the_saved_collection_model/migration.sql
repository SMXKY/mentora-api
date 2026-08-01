-- AlterTable
ALTER TABLE "collections" ADD COLUMN     "is_free_preview" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "saved_collections" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "collection_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "saved_collections_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "saved_collections_user_id_idx" ON "saved_collections"("user_id");

-- CreateIndex
CREATE INDEX "saved_collections_collection_id_idx" ON "saved_collections"("collection_id");

-- CreateIndex
CREATE UNIQUE INDEX "idx_saved_collection_unique" ON "saved_collections"("user_id", "collection_id");

-- CreateIndex
CREATE INDEX "collections_is_free_preview_idx" ON "collections"("is_free_preview");

-- AddForeignKey
ALTER TABLE "saved_collections" ADD CONSTRAINT "saved_collections_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saved_collections" ADD CONSTRAINT "saved_collections_collection_id_fkey" FOREIGN KEY ("collection_id") REFERENCES "collections"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
