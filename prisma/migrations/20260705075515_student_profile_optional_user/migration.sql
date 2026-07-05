-- DropForeignKey
ALTER TABLE "student_profiles" DROP CONSTRAINT "student_profiles_user_id_fkey";

-- AlterTable
ALTER TABLE "student_profiles" ALTER COLUMN "user_id" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "student_profiles" ADD CONSTRAINT "student_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
