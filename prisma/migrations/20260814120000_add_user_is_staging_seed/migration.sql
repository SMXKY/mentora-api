-- Gates real notification dispatch for staging-seeded accounts (see
-- POST /auth/staging/create and notification.dispatcher.ts) — KYC
-- notification types are transactional and bypass notificationsMuted,
-- so without this a bulk seed run would email real KYC reviewer accounts
-- once per fake application submitted.
ALTER TABLE "users" ADD COLUMN "is_staging_seed" BOOLEAN NOT NULL DEFAULT false;
