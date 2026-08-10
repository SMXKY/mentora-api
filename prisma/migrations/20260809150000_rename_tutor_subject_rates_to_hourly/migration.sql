-- Consolidate TutorSubject's three rate fields (two flat per-session fees
-- plus one mode-ambiguous hourly rate) into exactly two hourly rates, one
-- per session mode. Booking cost is now always hourlyRate(mode) * minutes/60.

-- 1. Add the two new hourly-rate columns.
ALTER TABLE "tutor_subjects" ADD COLUMN "rate_per_online_hour_xaf" INTEGER;
ALTER TABLE "tutor_subjects" ADD COLUMN "rate_per_home_hour_xaf" INTEGER;

-- 2. Backfill from whatever was previously set. A tutor who only had the
-- old ambiguous rate_per_hour_xaf gets it applied to both modes (the best
-- available approximation of their intent, since that rate previously
-- applied regardless of mode); a tutor who had the old flat per-session
-- fields carries those numbers over as their new hourly starting point.
UPDATE "tutor_subjects"
SET
  "rate_per_online_hour_xaf" = COALESCE("rate_per_online_session_xaf", "rate_per_hour_xaf"),
  "rate_per_home_hour_xaf" = COALESCE("rate_per_home_session_xaf", "rate_per_hour_xaf");

-- 3. Drop the three old columns.
ALTER TABLE "tutor_subjects" DROP COLUMN "rate_per_online_session_xaf";
ALTER TABLE "tutor_subjects" DROP COLUMN "rate_per_home_session_xaf";
ALTER TABLE "tutor_subjects" DROP COLUMN "rate_per_hour_xaf";
