-- CreateEnum
CREATE TYPE "ThemePreference" AS ENUM ('LIGHT', 'DARK', 'SYSTEM');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "phone_country_code" VARCHAR(5) NOT NULL DEFAULT '+237',
ADD COLUMN     "theme_preference" "ThemePreference" NOT NULL DEFAULT 'SYSTEM';
