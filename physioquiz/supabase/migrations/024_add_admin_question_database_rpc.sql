-- ============================================================================
-- 024_add_admin_question_database_rpc.sql
-- Enhanced question list RPC for the database view
-- Returns correct_labels, has_explanation, parent_topic_title, and supports active filter
-- Applied via Supabase MCP. This file is a local audit copy.
-- ============================================================================

CREATE OR REPLACE FUNCTION get_admin_question_database(
  p_topic_id uuid DEFAULT NULL,
  p_search text DEFAULT NULL,
  p_active_filter text DEFAULT NULL,  -- 'active', 'inactive', or NULL for all
  p_limit int DEFAULT 25,
  p_offset int DEFAULT 0
) RETURNS TABLE (
  question_id uuid,
  question_number int,
  question_text text,
  topic_id uuid,
  topic_title text,
  parent_topic_title text,
  difficulty text,
  is_active boolean,
  correct_labels text,
  has_explanation boolean,
  total_attempts bigint,
  avg_score numeric
) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT is_admin() THEN RAISE EXCEPTION 'Forbidden'; END IF;
  RETURN QUERY
  SELECT
    q.id,
    q.question_number,
    q.question_text,
    q.topic_id,
    t.title,
    pt.title AS parent_topic_title,
    q.difficulty::text,
    q.is_active,
    COALESCE(
      (SELECT string_agg(c.label, ', ' ORDER BY c.sort_order)
       FROM choices c WHERE c.question_id = q.id AND c.is_correct = true),
      ''
    ) AS correct_labels,
    (q.explanation_html IS NOT NULL AND q.explanation_html <> '') AS has_explanation,
    COALESCE(stats.total_attempts, 0)::bigint,
    COALESCE(stats.avg_score, 0)::numeric
  FROM questions q
  JOIN topics t ON t.id = q.topic_id
  LEFT JOIN topics pt ON pt.id = t.parent_id
  LEFT JOIN LATERAL (
    SELECT
      COUNT(*) AS total_attempts,
      ROUND(
        (SUM(CASE WHEN sa.is_correct THEN 1 ELSE 0 END)::numeric / NULLIF(COUNT(*), 0)) * 100, 1
      ) AS avg_score
    FROM session_answers sa WHERE sa.question_id = q.id
  ) stats ON true
  WHERE
    (p_topic_id IS NULL OR q.topic_id = p_topic_id)
    AND (p_search IS NULL OR q.question_text ILIKE '%' || p_search || '%')
    AND (p_active_filter IS NULL
         OR (p_active_filter = 'active' AND q.is_active = true)
         OR (p_active_filter = 'inactive' AND q.is_active = false))
  ORDER BY t.title, q.question_number NULLS LAST, q.created_at DESC
  LIMIT p_limit OFFSET p_offset;
END; $$;
