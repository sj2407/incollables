-- Calibration data: success rate per confidence level + top 10 false certainties
-- Applied via Supabase MCP; SQL preserved here for reproducibility.

CREATE OR REPLACE FUNCTION get_calibration_data(p_user_id uuid)
RETURNS json
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  result json;
BEGIN
  SELECT json_build_object(
    'levels', (
      SELECT json_agg(row_to_json(t) ORDER BY t.confidence_level)
      FROM (
        SELECT
          sa.confidence AS confidence_level,
          COUNT(*) AS total_answers,
          SUM(CASE WHEN sa.is_correct THEN 1 ELSE 0 END) AS correct_answers,
          ROUND(SUM(CASE WHEN sa.is_correct THEN 1 ELSE 0 END)::numeric / NULLIF(COUNT(*), 0) * 100, 1) AS success_rate
        FROM session_answers sa
        JOIN sessions s ON s.id = sa.session_id
        WHERE s.user_id = p_user_id
          AND s.is_completed = true
          AND sa.confidence IS NOT NULL
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
        ORDER BY sa.answered_at DESC
        LIMIT 10
      ) fc
    )
  ) INTO result;

  RETURN result;
END;
$$;
