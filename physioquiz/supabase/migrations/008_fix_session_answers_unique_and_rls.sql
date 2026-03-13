-- ============================================================================
-- 008_fix_session_answers_unique_and_rls.sql
-- Review fixes from Phase B:
-- 1. UNIQUE constraint on session_answers(session_id, question_id) to prevent
--    duplicate answers at the DB level (race condition protection)
-- 2. Remove unnecessary INSERT policy on session_questions (only Edge Functions
--    via service_role should insert)
-- Applied via Supabase MCP. This file is a local audit copy.
-- ============================================================================

ALTER TABLE session_answers ADD CONSTRAINT unique_session_question
  UNIQUE(session_id, question_id);

DROP POLICY IF EXISTS "Users can insert own session questions" ON session_questions;
