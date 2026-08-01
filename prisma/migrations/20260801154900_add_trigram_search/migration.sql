CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_subjects_name_trgm ON subjects USING gin (name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_tutor_profiles_bio_trgm ON tutor_profiles USING gin (bio gin_trgm_ops);