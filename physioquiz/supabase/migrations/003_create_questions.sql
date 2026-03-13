-- ============================================================================
-- 003_create_questions.sql
-- Creates questions, choices, and question_images tables with indexes and RLS.
-- Applied via Supabase MCP. This file is a local audit copy.
-- ============================================================================

-- Difficulty enum
CREATE TYPE difficulty_level AS ENUM ('easy', 'medium', 'hard');

-- ---- Questions ----
CREATE TABLE questions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id         UUID NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
  question_number  INT,
  question_text    TEXT NOT NULL,
  explanation_html TEXT,
  difficulty       difficulty_level DEFAULT 'medium',
  is_active        BOOLEAN DEFAULT true,
  video_url        TEXT,
  video_timestamp  INT,
  created_at       TIMESTAMPTZ DEFAULT now(),
  updated_at       TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_questions_topic_id ON questions(topic_id);

-- ---- Choices ----
CREATE TABLE choices (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  label       CHAR(1) NOT NULL,
  choice_text TEXT NOT NULL,
  is_correct  BOOLEAN NOT NULL,
  sort_order  INT NOT NULL
);

CREATE INDEX idx_choices_question_id ON choices(question_id);

-- ---- Question images ----
CREATE TABLE question_images (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id   UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  storage_path  TEXT NOT NULL,
  original_name TEXT,
  sort_order    INT DEFAULT 0
);

CREATE INDEX idx_question_images_question_id ON question_images(question_id);

-- ---- Row Level Security ----

-- Questions RLS
ALTER TABLE questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read questions"
  ON questions FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can insert questions"
  ON questions FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins can update questions"
  ON questions FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins can delete questions"
  ON questions FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Choices RLS
ALTER TABLE choices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read choices"
  ON choices FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can insert choices"
  ON choices FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins can update choices"
  ON choices FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins can delete choices"
  ON choices FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Question images RLS
ALTER TABLE question_images ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read question images"
  ON question_images FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can insert question images"
  ON question_images FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins can update question images"
  ON question_images FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins can delete question images"
  ON question_images FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );
