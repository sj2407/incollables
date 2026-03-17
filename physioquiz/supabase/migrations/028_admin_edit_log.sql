-- ============================================================================
-- 028_admin_edit_log.sql
-- Audit table for tracking admin edits in the spreadsheet view.
-- Logs field-level changes for undo support and change history.
-- ============================================================================

-- Edit log table
CREATE TABLE IF NOT EXISTS admin_edit_log (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  admin_id uuid NOT NULL REFERENCES auth.users(id),
  question_id uuid REFERENCES questions(id) ON DELETE SET NULL,
  field_changed text NOT NULL,
  old_value text,
  new_value text,
  created_at timestamptz DEFAULT now()
);

-- Index for recent edits query
CREATE INDEX IF NOT EXISTS idx_admin_edit_log_created_at
  ON admin_edit_log (created_at DESC);

-- Index for per-question history
CREATE INDEX IF NOT EXISTS idx_admin_edit_log_question_id
  ON admin_edit_log (question_id);

-- RLS: only admins can read and insert
ALTER TABLE admin_edit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read edit log"
  ON admin_edit_log FOR SELECT
  USING (is_admin());

CREATE POLICY "Admins can insert edit log"
  ON admin_edit_log FOR INSERT
  WITH CHECK (is_admin());

-- RPC to log an admin edit (validates admin role)
CREATE OR REPLACE FUNCTION log_admin_edit(
  p_question_id uuid,
  p_field text,
  p_old text,
  p_new text
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT is_admin() THEN RAISE EXCEPTION 'Forbidden'; END IF;
  INSERT INTO admin_edit_log (admin_id, question_id, field_changed, old_value, new_value)
  VALUES (auth.uid(), p_question_id, p_field, p_old, p_new);
END; $$;
