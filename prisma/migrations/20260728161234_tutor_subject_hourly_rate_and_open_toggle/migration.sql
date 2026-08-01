-- AlterTable
ALTER TABLE "tutor_profiles" ADD COLUMN     "rate_manually_set" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "tutor_subjects" ADD COLUMN     "is_open_for_booking" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "rate_per_hour_xaf" INTEGER;

-- Data backfill: a tutor who was already bookable yesterday (APPROVED +
-- already had a flat rate) must not go dark today just because the new
-- toggle defaults to false.
UPDATE "tutor_subjects"
SET "is_open_for_booking" = true
WHERE "status" = 'APPROVED'
  AND ("rate_per_online_session_xaf" IS NOT NULL OR "rate_per_home_session_xaf" IS NOT NULL);

-- Data backfill: any tutor_profile that already has a manually-entered
-- min/max rate is flagged as manually set, so the new auto-sync
-- (recomputeTutorRateRange in tutor.service.ts) never overwrites it.
UPDATE "tutor_profiles"
SET "rate_manually_set" = true
WHERE "min_rate_xaf" IS NOT NULL OR "max_rate_xaf" IS NOT NULL;

-- Data backfill: for every tutor who never set a rate, derive min/max now
-- from the rates already configured on their open + approved subjects —
-- this is the one-time equivalent of recomputeTutorRateRange running once
-- over existing data.
WITH subject_rate_values AS (
  SELECT tutor_profile_id, rate_per_hour_xaf AS rate
  FROM tutor_subjects
  WHERE status = 'APPROVED' AND is_open_for_booking = true AND rate_per_hour_xaf IS NOT NULL
  UNION ALL
  SELECT tutor_profile_id, rate_per_online_session_xaf
  FROM tutor_subjects
  WHERE status = 'APPROVED' AND is_open_for_booking = true AND rate_per_online_session_xaf IS NOT NULL
  UNION ALL
  SELECT tutor_profile_id, rate_per_home_session_xaf
  FROM tutor_subjects
  WHERE status = 'APPROVED' AND is_open_for_booking = true AND rate_per_home_session_xaf IS NOT NULL
),
agg AS (
  SELECT tutor_profile_id, MIN(rate) AS min_rate, MAX(rate) AS max_rate
  FROM subject_rate_values
  GROUP BY tutor_profile_id
)
UPDATE "tutor_profiles" tp
SET "min_rate_xaf" = agg.min_rate, "max_rate_xaf" = agg.max_rate
FROM agg
WHERE tp."id" = agg.tutor_profile_id AND tp."min_rate_xaf" IS NULL;
