-- ============================================================================
-- Update get_calibration_data:
--   1. Add p_fc_days param to filter false_certainties by time window
--   2. Add confidence_fill_rate_alltime (all-time, not 7-day)
-- ============================================================================

CREATE OR REPLACE FUNCTION get_calibration_data(
  p_user_id uuid,
  p_session_type text DEFAULT NULL,
  p_fc_days integer DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result json;
BEGIN
  IF p_user_id != auth.uid() THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  SELECT json_build_object(
    'levels', (
      SELECT json_agg(row_to_json(t) ORDER BY t.confidence_level)
      FROM (
        SELECT
          sa.confidence AS confidence_level,
          COUNT(*) AS total_answers,
          SUM(CASE WHEN sa.is_correct THEN 1 ELSE 0 END) AS correct_answers,
          ROUND(AVG(sa.score_percent)::numeric, 1) AS success_rate
        FROM session_answers sa
        JOIN sessions s ON s.id = sa.session_id
        WHERE s.user_id = p_user_id
          AND s.is_completed = true
          AND sa.confidence IS NOT NULL
          AND (p_session_type IS NULL OR (p_session_type = 'exam' AND s.session_type = 'exam'::session_type) OR (p_session_type = 'short' AND s.session_type IN ('short'::session_type, 'all'::session_type)))
        GROUP BY sa.confidence
      ) t
    ),
    'false_certainties', (
      SELECT json_agg(row_to_json(fc))
      FROM (
        SELECT
          sa.question_id,
          q.question_text,
          q.question_number,
          t.title AS topic_title,
          sa.score_percent
        FROM session_answers sa
        JOIN sessions s ON s.id = sa.session_id
        JOIN questions q ON q.id = sa.question_id
        JOIN topics t ON t.id = q.topic_id
        WHERE s.user_id = p_user_id
          AND s.is_completed = true
          AND sa.confidence = 1.0
          AND sa.is_correct = false
          AND (p_session_type IS NULL OR (p_session_type = 'exam' AND s.session_type = 'exam'::session_type) OR (p_session_type = 'short' AND s.session_type IN ('short'::session_type, 'all'::session_type)))
          AND (p_fc_days IS NULL OR sa.answered_at >= NOW() - (p_fc_days || ' days')::interval)
        ORDER BY sa.score_percent ASC, q.question_number ASC
      ) fc
    ),
    'confidence_fill_rate_alltime', COALESCE(
      ROUND(
        (SELECT COUNT(*) FROM session_answers sa5 JOIN sessions s5 ON s5.id = sa5.session_id
         WHERE s5.user_id = p_user_id AND s5.is_completed = true AND sa5.confidence IS NOT NULL
         AND (p_session_type IS NULL OR (p_session_type = 'exam' AND s5.session_type = 'exam'::session_type) OR (p_session_type = 'short' AND s5.session_type IN ('short'::session_type, 'all'::session_type))))::numeric
        / NULLIF((SELECT COUNT(*) FROM session_answers sa6 JOIN sessions s6 ON s6.id = sa6.session_id
         WHERE s6.user_id = p_user_id AND s6.is_completed = true
         AND (p_session_type IS NULL OR (p_session_type = 'exam' AND s6.session_type = 'exam'::session_type) OR (p_session_type = 'short' AND s6.session_type IN ('short'::session_type, 'all'::session_type)))), 0) * 100
      , 1)
    , 0)
  ) INTO result;
  RETURN result;
END;
$$;
