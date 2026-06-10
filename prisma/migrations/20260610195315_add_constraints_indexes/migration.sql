CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "unaccent";

CREATE UNIQUE INDEX IF NOT EXISTS idx_one_active_role_per_user
  ON user_roles (user_id) WHERE is_active = true;

CREATE UNIQUE INDEX IF NOT EXISTS idx_escrow_one_to_one_unique
  ON escrow_holds (booking_id) WHERE group_participant_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_escrow_group_unique
  ON escrow_holds (booking_id, group_participant_id)
  WHERE group_participant_id IS NOT NULL;


DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_booker_required'
  ) THEN
    ALTER TABLE bookings ADD CONSTRAINT chk_booker_required
      CHECK (is_group_session = true OR booker_id IS NOT NULL);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_wallet_balance_non_negative'
  ) THEN
    ALTER TABLE wallets ADD CONSTRAINT chk_wallet_balance_non_negative
      CHECK (balance_xaf >= 0);
  END IF;
END $$;


DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_material_content'
  ) THEN
    ALTER TABLE materials ADD CONSTRAINT chk_material_content
      CHECK (
        (file_id IS NOT NULL AND content_json IS NULL) OR
        (file_id IS NULL AND content_json IS NOT NULL)
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_review_overall_rating_range'
  ) THEN
    ALTER TABLE reviews ADD CONSTRAINT chk_review_overall_rating_range
      CHECK (overall_rating >= 1 AND overall_rating <= 5);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_review_sub_rating_range'
  ) THEN
    ALTER TABLE reviews ADD CONSTRAINT chk_review_sub_rating_range
      CHECK (
        (rating_subject_knowledge IS NULL OR (rating_subject_knowledge >= 1 AND rating_subject_knowledge <= 5))
        AND (rating_communication IS NULL OR (rating_communication >= 1 AND rating_communication <= 5))
        AND (rating_punctuality IS NULL OR (rating_punctuality >= 1 AND rating_punctuality <= 5))
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_risk_score_non_negative'
  ) THEN
    ALTER TABLE risk_scores ADD CONSTRAINT chk_risk_score_non_negative
      CHECK (current_score >= 0);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_commission_balance_non_negative'
  ) THEN
    ALTER TABLE platform_commission ADD CONSTRAINT chk_commission_balance_non_negative
      CHECK (balance_xaf >= 0);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_escrow_positive_amounts'
  ) THEN
    ALTER TABLE escrow_holds ADD CONSTRAINT chk_escrow_positive_amounts
      CHECK (gross_amount_xaf > 0 AND net_tutor_amount_xaf >= 0);
  END IF;
END $$;

REVOKE UPDATE, DELETE ON audit_logs FROM mentora_user;

REVOKE UPDATE, DELETE ON transaction_ledger FROM mentora_user;

REVOKE UPDATE, DELETE ON risk_signals FROM mentora_user;

REVOKE UPDATE, DELETE ON risk_state_history FROM mentora_user;

REVOKE UPDATE, DELETE ON kyc_status_history FROM mentora_user;

REVOKE UPDATE, DELETE ON ticket_status_history FROM mentora_user;


CREATE OR REPLACE FUNCTION prevent_platform_commission_multi_row()
RETURNS trigger AS $$
BEGIN
  IF (SELECT count(*) FROM platform_commission) >= 1 THEN
    RAISE EXCEPTION 'platform_commission must have exactly one row. Use UPDATE, not INSERT.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_platform_commission_single_row ON platform_commission;
CREATE TRIGGER trg_platform_commission_single_row
  BEFORE INSERT ON platform_commission
  FOR EACH ROW
  EXECUTE FUNCTION prevent_platform_commission_multi_row();


DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tutor_profiles' AND column_name = 'search_vector'
  ) THEN
    ALTER TABLE tutor_profiles ADD COLUMN search_vector tsvector
      GENERATED ALWAYS AS (
        to_tsvector('simple',
          coalesce(bio, '') || ' ' ||
          coalesce(neighbourhood, '')
        )
      ) STORED;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_tutor_search_vector
  ON tutor_profiles USING GIN (search_vector);

CREATE UNIQUE INDEX IF NOT EXISTS idx_learning_snapshot_unique
  ON learning_analytics_snapshots (scope, student_profile_id, tutor_id, subject_id)
  NULLS NOT DISTINCT;
