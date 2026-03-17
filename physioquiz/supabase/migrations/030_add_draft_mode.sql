-- ============================================================================
-- 030_add_draft_mode.sql
-- Adds is_draft column to questions and topics for staging layer.
-- All existing production data stays is_draft = false (live).
-- Admin edits set is_draft = true; "Synchroniser" button publishes.
-- ============================================================================

-- Add is_draft to questions (default false for existing data, NOT NULL)
ALTER TABLE questions ADD COLUMN IF NOT EXISTS is_draft boolean NOT NULL DEFAULT false;

-- Add is_draft to topics (default false for existing data, NOT NULL)
ALTER TABLE topics ADD COLUMN IF NOT EXISTS is_draft boolean NOT NULL DEFAULT false;

-- Index for student queries (fast filter on non-draft questions)
CREATE INDEX IF NOT EXISTS idx_questions_draft ON questions (is_draft) WHERE is_draft = false;

-- Index for admin draft count badge
CREATE INDEX IF NOT EXISTS idx_questions_draft_true ON questions (is_draft) WHERE is_draft = true;
