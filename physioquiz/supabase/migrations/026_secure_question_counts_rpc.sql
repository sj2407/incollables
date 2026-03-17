-- Migration 026: Add auth check to get_question_counts_by_topic()
-- Previously callable by unauthenticated users (SECURITY DEFINER with no auth check).

CREATE OR REPLACE FUNCTION get_question_counts_by_topic()
RETURNS TABLE(topic_id uuid, question_count bigint)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  RETURN QUERY
  SELECT q.topic_id, COUNT(*) AS question_count
  FROM questions q
  WHERE q.is_active = true AND COALESCE(q.is_draft, false) = false
  GROUP BY q.topic_id;
END;
$$;
