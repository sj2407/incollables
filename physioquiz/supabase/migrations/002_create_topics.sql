-- ============================================================================
-- 002_create_topics.sql
-- Creates the topics table (self-referencing hierarchy) with indexes and RLS.
-- Applied via Supabase MCP. This file is a local audit copy.
-- ============================================================================

CREATE TABLE topics (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id   UUID REFERENCES topics(id) ON DELETE SET NULL,
  title       TEXT NOT NULL,
  description TEXT,
  level       INT NOT NULL,
  sort_order  INT DEFAULT 0,
  is_active   BOOLEAN DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- Index for fast parent lookups (tree traversal)
CREATE INDEX idx_topics_parent_id ON topics(parent_id);

-- ---- Row Level Security ----
ALTER TABLE topics ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read topics
CREATE POLICY "Authenticated users can read topics"
  ON topics FOR SELECT
  TO authenticated
  USING (true);

-- Admins can insert topics
CREATE POLICY "Admins can insert topics"
  ON topics FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Admins can update topics
CREATE POLICY "Admins can update topics"
  ON topics FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Admins can delete topics
CREATE POLICY "Admins can delete topics"
  ON topics FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );
