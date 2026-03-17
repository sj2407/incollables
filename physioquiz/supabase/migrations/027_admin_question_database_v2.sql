-- ============================================================================
-- 027_admin_question_database_v2.sql
-- Enhanced question list RPC for the spreadsheet admin view.
-- Returns full choice data as JSON, explanation_html, and supports difficulty filter.
-- Consolidated choices subquery for performance (single LATERAL instead of 2 correlated).
-- ============================================================================

CREATE OR REPLACE FUNCTION get_admin_question_database_v2(
  p_topic_id uuid DEFAULT NULL,
  p_search text DEFAULT NULL,
  p_active_filter text DEFAULT NULL,       -- 'active', 'inactive', 'draft', or NULL for all
  p_difficulty_filter text DEFAULT NULL,    -- 'easy', 'medium', 'hard', or NULL for all
  p_limit int DEFAULT 10000,
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
  is_draft boolean,
  correct_labels text,
  has_explanation boolean,
  explanation_html text,
  all_choices json,
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
    COALESCE(q.is_draft, false) AS is_draft,
    COALESCE(choice_data.correct_labels, '') AS correct_labels,
    (q.explanation_html IS NOT NULL AND q.explanation_html <> '') AS has_explanation,
    q.explanation_html,
    COALESCE(choice_data.all_choices, '[]'::json) AS all_choices,
    COALESCE(stats.total_attempts, 0)::bigint,
    COALESCE(stats.avg_score, 0)::numeric
  FROM questions q
  JOIN topics t ON t.id = q.topic_id
  LEFT JOIN topics pt ON pt.id = t.parent_id
  LEFT JOIN LATERAL (
    SELECT
      string_agg(c.label, ', ' ORDER BY c.sort_order) FILTER (WHERE c.is_correct = true) AS correct_labels,
      json_agg(
        json_build_object('id', c.id, 'label', c.label, 'choice_text', c.choice_text, 'is_correct', c.is_correct)
        ORDER BY c.sort_order
      ) AS all_choices
    FROM choices c WHERE c.question_id = q.id
  ) choice_data ON true
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
         OR (p_active_filter = 'inactive' AND q.is_active = false)
         OR (p_active_filter = 'draft' AND COALESCE(q.is_draft, false) = true))
    AND (p_difficulty_filter IS NULL OR q.difficulty::text = p_difficulty_filter)
  ORDER BY t.title, q.question_number NULLS LAST, q.created_at DESC
  LIMIT p_limit OFFSET p_offset;
END; $$;
