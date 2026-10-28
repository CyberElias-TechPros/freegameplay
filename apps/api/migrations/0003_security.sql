-- One-time migration, tracked by scripts/migrate.mjs. Invalidate legacy confirm
-- links: they were reusable and could have been exposed on mail failure.
ALTER TABLE subscribers ADD COLUMN confirm_expires_at TEXT;
UPDATE subscribers SET confirm_token = NULL;

-- Existing duplicate submissions are collapsed before enforcing uniqueness.
DELETE FROM scores WHERE session_id IS NOT NULL AND id NOT IN (
  SELECT MIN(id) FROM scores WHERE session_id IS NOT NULL
  GROUP BY game_slug, session_id, score
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_scores_submission
ON scores(game_slug, session_id, score) WHERE session_id IS NOT NULL;
