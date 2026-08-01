-- AlterTable
ALTER TABLE "users" ADD COLUMN     "city_id" UUID;

-- CreateIndex
CREATE INDEX "users_city_id_idx" ON "users"("city_id");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_city_id_fkey" FOREIGN KEY ("city_id") REFERENCES "cities"("id") ON DELETE SET NULL ON UPDATE CASCADE;
