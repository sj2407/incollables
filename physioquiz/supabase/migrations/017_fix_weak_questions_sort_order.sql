-- Fix weak questions sort: zero-score first (by attempt count desc),
-- then non-zero sorted by avg score ascending.
CREATE OR REPLACE FUNCTION public.get_weak_questions(p_user_id uuid, p_limit integer DEFAULT 20)
 RETURNS TABLE(question_id uuid, question_text text, question_number integer, topic_title text, avg_score numeric, attempt_count bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path = public
AS $function$
  SELECT
    sa.question_id,
    q.question_text,
    q.question_number,
    t.title AS topic_title,
    ROUND(AVG(sa.score_percent)::numeric, 1) AS avg_score,
    COUNT(DISTINCT s.id) AS attempt_count
  FROM session_answers sa
  JOIN sessions s ON s.id = sa.session_id
  JOIN questions q ON q.id = sa.question_id
  JOIN topics t ON t.id = s.topic_id
  WHERE s.user_id = p_user_id
    AND s.is_completed = true
  GROUP BY sa.question_id, q.question_text, q.question_number, t.title
  HAVING AVG(sa.score_percent) < 100
  ORDER BY
    -- Step 1: Zero-score questions first
    CASE WHEN AVG(sa.score_percent) = 0 THEN 0 ELSE 1 END ASC,
    -- Step 2: Within zero-score: more attempts = worse (desc)
    -- Within non-zero: lower avg score = worse (asc)
    CASE WHEN AVG(sa.score_percent) = 0 THEN COUNT(DISTINCT s.id) END DESC,
    CASE WHEN AVG(sa.score_percent) > 0 THEN AVG(sa.score_percent) END ASC
  LIMIT p_limit;
$function$;
