-- ============================================================================
-- 005_create_views.sql
-- Creates 4 database views for analytics, progress tracking, and the
-- question selection algorithm.
-- Applied via Supabase MCP. This file is a local audit copy.
-- ============================================================================

-- ---- 1. question_user_stats ----
-- Per-user stats for each question. Used by the selection algorithm to
-- prioritise questions the student struggles with.
CREATE OR REPLACE VIEW question_user_stats AS
SELECT
  sa.question_id,
  s.user_id,
  COUNT(*)                                          AS attempt_count,
  SUM(CASE WHEN sa.is_correct THEN 1 ELSE 0 END)   AS correct_count,
  SUM(CASE WHEN sa.is_correct THEN 0 ELSE 1 END)   AS wrong_count,
  ROUND(AVG(sa.score_percent), 2)                   AS avg_score,
  MAX(sa.answered_at)                               AS last_attempted_at
FROM session_answers sa
JOIN sessions s ON s.id = sa.session_id
GROUP BY sa.question_id, s.user_id;

-- ---- 2. question_error_rate ----
-- Aggregated error rate per question (admin view).
-- Helps admins spot ambiguous or poorly worded questions.
CREATE OR REPLACE VIEW question_error_rate AS
SELECT
  sa.question_id,
  q.question_text,
  t.title AS topic_title,
  COUNT(*)                                          AS total_attempts,
  SUM(CASE WHEN sa.is_correct THEN 0 ELSE 1 END)   AS error_count,
  ROUND(
    SUM(CASE WHEN sa.is_correct THEN 0 ELSE 1 END)::DECIMAL
    / NULLIF(COUNT(*), 0) * 100,
    2
  )                                                 AS error_rate_percent
FROM session_answers sa
JOIN questions q ON q.id = sa.question_id
JOIN topics t ON t.id = q.topic_id
GROUP BY sa.question_id, q.question_text, t.title
ORDER BY error_rate_percent DESC;

-- ---- 3. user_progress_over_time ----
-- One row per completed session, showing cumulative progress for the student.
CREATE OR REPLACE VIEW user_progress_over_time AS
SELECT
  s.user_id,
  s.id AS session_id,
  s.topic_id,
  t.title AS topic_title,
  s.session_type,
  s.score_percent,
  s.correct_count,
  s.wrong_count,
  s.partial_count,
  s.question_count,
  s.duration_seconds,
  s.completed_at
FROM sessions s
JOIN topics t ON t.id = s.topic_id
WHERE s.is_completed = true
ORDER BY s.completed_at;

-- ---- 4. topic_mastery ----
-- Heatmap-ready data: latest score per topic per user, computed from the
-- most recent completed session using a CTE with ROW_NUMBER.
CREATE OR REPLACE VIEW topic_mastery AS
WITH ranked AS (
  SELECT
    s.user_id,
    s.topic_id,
    t.title AS topic_title,
    t.level AS topic_level,
    s.score_percent,
    s.completed_at,
    ROW_NUMBER() OVER (
      PARTITION BY s.user_id, s.topic_id
      ORDER BY s.completed_at DESC
    ) AS rn
  FROM sessions s
  JOIN topics t ON t.id = s.topic_id
  WHERE s.is_completed = true
)
SELECT
  user_id,
  topic_id,
  topic_title,
  topic_level,
  score_percent AS latest_score,
  completed_at  AS last_session_at
FROM ranked
WHERE rn = 1;
