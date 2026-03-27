-- Per-topic calibration detail: confidence breakdown for a specific topic
CREATE OR REPLACE FUNCTION get_topic_calibration_detail(
  p_user_id uuid,
  p_topic_id uuid,
  p_session_type text DEFAULT NULL
)
RETURNS TABLE (
  confidence_level numeric,
  total_answers bigint,
  correct_answers bigint,
  success_rate numeric,
  brier_score numeric
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
    sa.confidence AS confidence_level,
    COUNT(*) AS total_answers,
    SUM(CASE WHEN sa.is_correct THEN 1 ELSE 0 END)::bigint AS correct_answers,
    ROUND(AVG(sa.score_percent)::numeric, 1) AS success_rate,
    ROUND(
      (1 - AVG(
        (sa.confidence - CASE WHEN sa.is_correct THEN 1.0 ELSE 0.0 END) ^ 2
      )) * 100
    , 1) AS brier_score
  FROM session_answers sa
  JOIN sessions s ON s.id = sa.session_id
  JOIN questions q ON q.id = sa.question_id
  WHERE s.user_id = p_user_id
    AND s.is_completed = true
    AND sa.confidence IS NOT NULL
    AND q.topic_id = p_topic_id
    AND (p_session_type IS NULL
      OR (p_session_type = 'exam' AND s.session_type = 'exam'::session_type)
      OR (p_session_type = 'short' AND s.session_type IN ('short'::session_type, 'all'::session_type)))
  GROUP BY sa.confidence
  ORDER BY sa.confidence ASC;
END;
$$;
