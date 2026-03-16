-- Activity by week: sessions grouped by ISO week for last N weeks
-- Applied via Supabase MCP; SQL preserved here for reproducibility.

CREATE OR REPLACE FUNCTION get_activity_by_week(p_user_id uuid, p_weeks int DEFAULT 12)
RETURNS TABLE (
  week_start date,
  session_count bigint,
  avg_score numeric
)
LANGUAGE sql SECURITY DEFINER AS $$
  SELECT
    DATE_TRUNC('week', s.completed_at)::date AS week_start,
    COUNT(s.id) AS session_count,
    ROUND(AVG(s.score_percent)::numeric, 1) AS avg_score
  FROM sessions s
  WHERE s.user_id = p_user_id
    AND s.is_completed = true
    AND s.completed_at >= (NOW() - (p_weeks || ' weeks')::interval)
  GROUP BY DATE_TRUNC('week', s.completed_at)
  ORDER BY week_start;
$$;
