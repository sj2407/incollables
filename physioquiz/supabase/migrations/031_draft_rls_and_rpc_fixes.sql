-- ============================================================================
-- 031_draft_rls_and_rpc_fixes.sql
-- Fixes student-facing queries to exclude draft content.
-- Applied via Supabase MCP. This file is a local audit copy.
-- ============================================================================

-- 1. RLS: Students can't see draft questions
DROP POLICY IF EXISTS "Authenticated users can read active questions" ON questions;
CREATE POLICY "Authenticated users can read non-draft questions" ON questions
  FOR SELECT
  USING (
    COALESCE(is_draft, false) = false
    OR EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'::user_role)
  );

-- 2. RLS: Students can't see draft topics
DROP POLICY IF EXISTS "Authenticated users can read topics" ON topics;
CREATE POLICY "Authenticated users can read non-draft topics" ON topics
  FOR SELECT
  USING (
    COALESCE(is_draft, false) = false
    OR EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'::user_role)
  );

-- 3. get_question_counts_by_topic: exclude drafts
CREATE OR REPLACE FUNCTION get_question_counts_by_topic()
RETURNS TABLE(topic_id uuid, question_count bigint)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  RETURN QUERY
  SELECT q.topic_id, COUNT(*) AS question_count
  FROM questions q
  WHERE q.is_active = true AND COALESCE(q.is_draft, false) = false
  GROUP BY q.topic_id;
END; $$;

-- 4. get_topic_mastery_detailed: exclude drafts from question counts
-- (Full function recreated in 022_security_hardening.sql with the fix applied)
