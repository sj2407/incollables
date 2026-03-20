-- ============================================================================
-- 035_needs_review.sql
-- Adds needs_review column to questions and learning_materials.
-- Existing data gets needs_review = false (treated as already reviewed).
-- Applied via Supabase MCP. This file is a local audit copy.
-- ============================================================================

-- Questions table
ALTER TABLE questions ADD COLUMN IF NOT EXISTS needs_review BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS idx_questions_needs_review ON questions (needs_review) WHERE needs_review = true;

-- Learning materials table
ALTER TABLE learning_materials ADD COLUMN IF NOT EXISTS needs_review BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS idx_learning_materials_needs_review ON learning_materials (needs_review) WHERE needs_review = true;
