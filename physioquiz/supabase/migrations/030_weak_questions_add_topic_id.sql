-- Add topic_id to weak questions RPC return (preserving auth check, session_type filter, and limit)
-- Must DROP first because return type changed (added topic_id column)
DROP FUNCTION IF EXISTS public.get_weak_questions(uuid, integer, text);
DROP FUNCTION IF EXISTS public.get_weak_questions(uuid, integer);

CREATE OR REPLACE FUNCTION public.get_weak_questions(
  p_user_id uuid,
  p_limit integer DEFAULT 1000,
  p_session_type text DEFAULT NULL
)
 RETURNS TABLE(question_id uuid, question_text text, question_number integer, topic_title text, topic_id uuid, avg_score numeric, attempt_count bigint)
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
    sa.question_id,
    q.question_text,
    q.question_number,
    t.title AS topic_title,
    s.topic_id,
    ROUND(AVG(sa.score_percent)::numeric, 1) AS avg_score,
    COUNT(DISTINCT s.id) AS attempt_count
  FROM session_answers sa
  JOIN sessions s ON s.id = sa.session_id
  JOIN questions q ON q.id = sa.question_id
  JOIN topics t ON t.id = s.topic_id
  WHERE s.user_id = p_user_id
    AND s.is_completed = true
    AND (p_session_type IS NULL OR (p_session_type = 'exam' AND s.session_type = 'exam'::session_type) OR (p_session_type = 'short' AND s.session_type IN ('short'::session_type, 'all'::session_type)))
  GROUP BY sa.question_id, q.question_text, q.question_number, t.title, s.topic_id
  HAVING AVG(sa.score_percent) < 100
  ORDER BY
    CASE WHEN AVG(sa.score_percent) = 0 THEN 0 ELSE 1 END ASC,
    CASE WHEN AVG(sa.score_percent) = 0 THEN COUNT(DISTINCT s.id) END DESC,
    CASE WHEN AVG(sa.score_percent) > 0 THEN AVG(sa.score_percent) END ASC
  LIMIT p_limit;
END;
$$;
