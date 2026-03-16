-- Topic mastery detailed: per-question mastery formula from §8.3
-- mastery(Q) = 0.50 × recent_success_rate(last 3) + 0.30 × last_correct + 0.20 × avg_confidence
-- mastery(T) = avg(question mastery) × coverage(attempted/total)
-- Applied via Supabase MCP; SQL preserved here for reproducibility.

CREATE OR REPLACE FUNCTION get_topic_mastery_detailed(p_user_id uuid)
RETURNS TABLE (
  topic_id uuid,
  topic_title text,
  topic_level int,
  parent_id uuid,
  question_count bigint,
  questions_attempted bigint,
  coverage numeric,
  mastery_percent numeric
)
LANGUAGE sql SECURITY DEFINER AS $$
WITH question_attempts AS (
  -- Get per-question stats: last 3 attempts for recent success rate,
  -- last answer correctness, avg recent confidence
  SELECT
    sa.question_id,
    q.topic_id,
    -- Recent success rate (last 3 attempts)
    ROUND(
      AVG(CASE WHEN sa.is_correct THEN 100.0 ELSE 0.0 END)::numeric
    , 1) AS recent_success_rate,
    -- Last correct (1.0 if last attempt was correct, 0.0 otherwise)
    (ARRAY_AGG(CASE WHEN sa.is_correct THEN 1.0 ELSE 0.0 END ORDER BY sa.answered_at DESC))[1] AS last_correct,
    -- Avg recent confidence (default 0.5 if null)
    ROUND(AVG(COALESCE(sa.confidence, 0.5))::numeric, 2) AS avg_confidence
  FROM (
    -- Window to get only last 3 attempts per question for this user
    SELECT
      sa_inner.*,
      ROW_NUMBER() OVER (PARTITION BY sa_inner.question_id ORDER BY sa_inner.answered_at DESC) AS rn
    FROM session_answers sa_inner
    JOIN sessions s ON s.id = sa_inner.session_id
    WHERE s.user_id = p_user_id AND s.is_completed = true
  ) sa
  JOIN questions q ON q.id = sa.question_id
  WHERE sa.rn <= 3
  GROUP BY sa.question_id, q.topic_id
),
question_mastery AS (
  -- Per-question mastery formula from §8.3:
  -- 0.50 × recent_success_rate + 0.30 × last_correct + 0.20 × avg_confidence
  SELECT
    qa.question_id,
    qa.topic_id,
    ROUND(
      (0.50 * qa.recent_success_rate) +
      (0.30 * qa.last_correct * 100) +
      (0.20 * qa.avg_confidence * 100)
    , 1) AS mastery
  FROM question_attempts qa
),
topic_stats AS (
  SELECT
    t.id AS topic_id,
    t.title AS topic_title,
    t.level AS topic_level,
    t.parent_id,
    -- Total active questions in topic
    COUNT(DISTINCT q.id) AS question_count,
    -- Questions attempted by this user
    COUNT(DISTINCT qm.question_id) AS questions_attempted,
    -- Coverage
    CASE
      WHEN COUNT(DISTINCT q.id) = 0 THEN 0
      ELSE ROUND(COUNT(DISTINCT qm.question_id)::numeric / COUNT(DISTINCT q.id) * 100, 1)
    END AS coverage,
    -- Average mastery of attempted questions × coverage
    CASE
      WHEN COUNT(DISTINCT q.id) = 0 THEN 0
      ELSE ROUND(
        COALESCE(AVG(qm.mastery), 0) * COUNT(DISTINCT qm.question_id)::numeric / COUNT(DISTINCT q.id)
      , 1)
    END AS mastery_percent
  FROM topics t
  LEFT JOIN questions q ON q.topic_id = t.id AND q.is_active = true
  LEFT JOIN question_mastery qm ON qm.question_id = q.id
  GROUP BY t.id, t.title, t.level, t.parent_id
)
SELECT
  ts.topic_id,
  ts.topic_title,
  ts.topic_level,
  ts.parent_id,
  ts.question_count,
  ts.questions_attempted,
  ts.coverage,
  ts.mastery_percent
FROM topic_stats ts
WHERE ts.question_count > 0
ORDER BY ts.topic_level, ts.topic_title;
$$;
