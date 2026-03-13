-- ============================================================================
-- 004_create_sessions.sql
-- Creates sessions, session_answers, and session_answer_choices tables
-- with indexes and RLS.
-- Applied via Supabase MCP. This file is a local audit copy.
-- ============================================================================

-- Session type enum
CREATE TYPE session_type AS ENUM ('short', 'all', 'exam');

-- ---- Sessions ----
CREATE TABLE sessions (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  topic_id               UUID NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
  session_type           session_type NOT NULL,
  question_count         INT NOT NULL,
  correct_count          INT DEFAULT 0,
  wrong_count            INT DEFAULT 0,
  partial_count          INT DEFAULT 0,
  score_percent          DECIMAL,
  duration_seconds       INT,
  time_limit_seconds     INT,
  include_subtopics      BOOLEAN DEFAULT false,
  current_question_index INT DEFAULT 0,
  is_paused              BOOLEAN DEFAULT false,
  paused_at              TIMESTAMPTZ,
  total_pause_seconds    INT DEFAULT 0,
  started_at             TIMESTAMPTZ DEFAULT now(),
  completed_at           TIMESTAMPTZ,
  is_completed           BOOLEAN DEFAULT false
);

CREATE INDEX idx_sessions_user_id ON sessions(user_id);
CREATE INDEX idx_sessions_topic_id ON sessions(topic_id);

-- ---- Session answers ----
CREATE TABLE session_answers (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id           UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  question_id          UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  is_correct           BOOLEAN NOT NULL,
  is_partially_correct BOOLEAN NOT NULL,
  score_percent        DECIMAL NOT NULL,
  confidence           DECIMAL(2,1),
  time_spent_sec       INT,
  is_flagged           BOOLEAN DEFAULT false,
  answered_at          TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_session_answers_session_id ON session_answers(session_id);
CREATE INDEX idx_session_answers_question_id ON session_answers(question_id);

-- ---- Session answer choices (which choices the user selected) ----
CREATE TABLE session_answer_choices (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_answer_id UUID NOT NULL REFERENCES session_answers(id) ON DELETE CASCADE,
  choice_id         UUID NOT NULL REFERENCES choices(id) ON DELETE CASCADE
);

CREATE INDEX idx_session_answer_choices_session_answer_id
  ON session_answer_choices(session_answer_id);

-- ---- Row Level Security ----

-- Sessions RLS
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own sessions"
  ON sessions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own sessions"
  ON sessions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own sessions"
  ON sessions FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can read all sessions"
  ON sessions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Session answers RLS
ALTER TABLE session_answers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own session answers"
  ON session_answers FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM sessions
      WHERE sessions.id = session_answers.session_id
        AND sessions.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own session answers"
  ON session_answers FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM sessions
      WHERE sessions.id = session_answers.session_id
        AND sessions.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can read all session answers"
  ON session_answers FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Session answer choices RLS
ALTER TABLE session_answer_choices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own session answer choices"
  ON session_answer_choices FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM session_answers
      JOIN sessions ON sessions.id = session_answers.session_id
      WHERE session_answers.id = session_answer_choices.session_answer_id
        AND sessions.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own session answer choices"
  ON session_answer_choices FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM session_answers
      JOIN sessions ON sessions.id = session_answers.session_id
      WHERE session_answers.id = session_answer_choices.session_answer_id
        AND sessions.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can read all session answer choices"
  ON session_answer_choices FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );
