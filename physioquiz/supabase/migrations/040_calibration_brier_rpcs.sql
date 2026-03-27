-- ============================================================================
-- Brier score RPCs for calibration enhancement
-- Two functions: weekly trend + per-topic breakdown
-- ============================================================================

-- 1. get_brier_score_by_week — calibration score trend over time
CREATE OR REPLACE FUNCTION get_brier_score_by_week(
  p_user_id uuid,
  p_session_type text DEFAULT NULL,
  p_weeks integer DEFAULT 12
)
RETURNS TABLE (
  week_start date,
  calibration_score numeric,
  answer_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_user_id != auth.uid() THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  RETURN QUERY
  SELECT
    sa.answered_at::date AS week_start,
    ROUND(
      (1 - AVG(
        (sa.confidence - CASE WHEN sa.is_correct THEN 1.0 ELSE 0.0 END) ^ 2
      )) * 100
    , 1) AS calibration_score,
    COUNT(*) AS answer_count
  FROM session_answers sa
  JOIN sessions s ON s.id = sa.session_id
  WHERE s.user_id = p_user_id
    AND s.is_completed = true
    AND sa.confidence IS NOT NULL
    AND sa.answered_at >= NOW() - (p_weeks || ' weeks')::interval
    AND (p_session_type IS NULL
      OR (p_session_type = 'exam' AND s.session_type = 'exam'::session_type)
      OR (p_session_type = 'short' AND s.session_type IN ('short'::session_type, 'all'::session_type)))
  GROUP BY sa.answered_at::date
  ORDER BY week_start ASC;
END;
$$;

-- 2. get_brier_score_by_topic — calibration quality per topic
CREATE OR REPLACE FUNCTION get_brier_score_by_topic(
  p_user_id uuid,
  p_session_type text DEFAULT NULL
)
RETURNS TABLE (
  topic_id uuid,
  topic_title text,
  calibration_score numeric,
  answer_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_user_id != auth.uid() THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  RETURN QUERY
  SELECT
    q.topic_id,
    t.title AS topic_title,
    ROUND(
      (1 - AVG(
        (sa.confidence - CASE WHEN sa.is_correct THEN 1.0 ELSE 0.0 END) ^ 2
      )) * 100
    , 1) AS calibration_score,
    COUNT(*) AS answer_count
  FROM session_answers sa
  JOIN sessions s ON s.id = sa.session_id
  JOIN questions q ON q.id = sa.question_id
  JOIN topics t ON t.id = q.topic_id
  WHERE s.user_id = p_user_id
    AND s.is_completed = true
    AND sa.confidence IS NOT NULL
    AND (p_session_type IS NULL
      OR (p_session_type = 'exam' AND s.session_type = 'exam'::session_type)
      OR (p_session_type = 'short' AND s.session_type IN ('short'::session_type, 'all'::session_type)))
  GROUP BY q.topic_id, t.title
  HAVING COUNT(*) >= 5
  ORDER BY calibration_score ASC;
END;
$$;
