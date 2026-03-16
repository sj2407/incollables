-- Dashboard stats: avg score this week, session count, study time, partial count, confidence fill rate
-- Applied via Supabase MCP; SQL preserved here for reproducibility.

CREATE OR REPLACE FUNCTION get_dashboard_stats(p_user_id uuid)
RETURNS TABLE (
  avg_score_this_week numeric,
  total_sessions_this_week bigint,
  total_study_time_seconds bigint,
  partial_answer_count bigint,
  confidence_fill_rate numeric
)
LANGUAGE sql SECURITY DEFINER AS $$
  SELECT
    COALESCE(ROUND(AVG(s.score_percent)::numeric, 1), 0) AS avg_score_this_week,
    COUNT(s.id) AS total_sessions_this_week,
    COALESCE(SUM(GREATEST(s.duration_seconds - COALESCE(s.total_pause_seconds, 0), 0)), 0)::bigint AS total_study_time_seconds,
    (SELECT COUNT(*) FROM session_answers sa2 JOIN sessions s2 ON s2.id = sa2.session_id WHERE s2.user_id = p_user_id AND s2.is_completed = true AND sa2.is_partially_correct = true) AS partial_answer_count,
    COALESCE(
      ROUND(
        (SELECT COUNT(*) FROM session_answers sa3 JOIN sessions s3 ON s3.id = sa3.session_id WHERE s3.user_id = p_user_id AND s3.is_completed = true AND sa3.confidence IS NOT NULL)::numeric
        / NULLIF((SELECT COUNT(*) FROM session_answers sa4 JOIN sessions s4 ON s4.id = sa4.session_id WHERE s4.user_id = p_user_id AND s4.is_completed = true), 0) * 100
      , 1)
    , 0) AS confidence_fill_rate
  FROM sessions s
  WHERE s.user_id = p_user_id
    AND s.is_completed = true
    AND s.completed_at >= (NOW() - INTERVAL '7 days');
$$;
