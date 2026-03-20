-- ============================================================================
-- 033_learning_materials_admin.sql
-- Add admin management columns to learning_materials (soft delete, draft mode)
-- Applied via Supabase MCP. This file is a local audit copy.
-- ============================================================================

-- 1. Soft delete support (7-day retention, same as questions)
ALTER TABLE learning_materials
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

-- 2. Draft/sync mode (same pattern as questions)
ALTER TABLE learning_materials
  ADD COLUMN IF NOT EXISTS is_draft BOOLEAN NOT NULL DEFAULT false;

-- 3. Indexes
CREATE INDEX IF NOT EXISTS idx_learning_materials_type_topic
  ON learning_materials (material_type, topic_id);
CREATE INDEX IF NOT EXISTS idx_learning_materials_deleted_at
  ON learning_materials (deleted_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_learning_materials_draft
  ON learning_materials (is_draft) WHERE is_draft = true;

-- 4. Update RLS: students see only active, published, non-deleted materials
DROP POLICY IF EXISTS "Students can read active learning materials" ON learning_materials;
DROP POLICY IF EXISTS "Students can read active non-draft learning materials" ON learning_materials;
CREATE POLICY "Students can read active non-draft learning materials"
  ON learning_materials FOR SELECT
  TO authenticated
  USING (
    (is_active = true AND is_draft = false AND deleted_at IS NULL)
    OR EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );
