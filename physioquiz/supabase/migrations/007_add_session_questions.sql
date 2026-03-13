-- ============================================================================
-- 007_add_session_questions.sql
-- Creates session_questions table (tracks which questions are in a session,
-- in order). Used by validate-answer Edge Function to verify question
-- belongs to session (anti-cheat §12).
-- Applied via Supabase MCP. This file is a local audit copy.
-- Note: question_user_stats view was already updated in a prior session
-- with confidence columns (confidence_count, avg_confidence, days_since_last,
-- last_was_false_certainty).
-- ============================================================================

CREATE TABLE session_questions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  sort_order  INT NOT NULL,
  UNIQUE(session_id, question_id)
);

CREATE INDEX idx_session_questions_session_id ON session_questions(session_id);

ALTER TABLE session_questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own session questions"
  ON session_questions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM sessions
      WHERE sessions.id = session_questions.session_id
        AND sessions.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own session questions"
  ON session_questions FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM sessions
      WHERE sessions.id = session_questions.session_id
        AND sessions.user_id = auth.uid()
    )
  );
