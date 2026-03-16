-- ============================================================================
-- Migration 022: Security Hardening
-- ============================================================================
-- Fixes critical security gaps:
-- 1. Views exposed to anon/unauthenticated users
-- 2. SECURITY DEFINER functions accepting arbitrary p_user_id without auth check
-- 3. update_session_counters callable by any authenticated user
-- 4. Overly permissive sessions UPDATE policy
-- 5. Admin user promotion
-- 6. Storage: anon read on question-images
-- ============================================================================

-- ============================================================================
-- 1. LOCK DOWN VIEWS
-- ============================================================================

-- 1a. Revoke ALL permissions from anon on all views
REVOKE ALL ON question_error_rate FROM anon;
REVOKE ALL ON question_user_stats FROM anon;
REVOKE ALL ON safe_choices FROM anon;
REVOKE ALL ON topic_mastery FROM anon;
REVOKE ALL ON user_progress_over_time FROM anon;

-- 1b. Revoke write permissions from authenticated on all views (read-only)
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON question_error_rate FROM authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON question_user_stats FROM authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON safe_choices FROM authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON topic_mastery FROM authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON user_progress_over_time FROM authenticated;

-- 1c. Revoke SELECT on views that students should NOT query directly
-- (they use SECURITY DEFINER RPCs instead, or Edge Functions use service_role)
REVOKE SELECT ON question_user_stats FROM authenticated;
REVOKE SELECT ON topic_mastery FROM authenticated;
REVOKE SELECT ON user_progress_over_time FROM authenticated;
REVOKE SELECT ON question_error_rate FROM authenticated;

-- 1d. safe_choices: keep SELECT for authenticated only (used by client quiz/exam play)

-- ============================================================================
-- 2. ADD auth.uid() ENFORCEMENT TO ALL RPCs ACCEPTING p_user_id
-- ============================================================================

-- 2a. get_dashboard_stats — convert from SQL to plpgsql, add auth check
-- FIX: partial_answer_count and confidence_fill_rate now filtered to 7 days (was all-time)
CREATE OR REPLACE FUNCTION get_dashboard_stats(
  p_user_id uuid,
  p_session_type text DEFAULT NULL
)
RETURNS TABLE (
  avg_score_this_week numeric,
  total_sessions_this_week bigint,
  total_study_time_seconds bigint,
  partial_answer_count bigint,
  confidence_fill_rate numeric
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
    COALESCE(ROUND(AVG(s.score_percent)::numeric, 1), 0),
    COUNT(s.id),
    COALESCE(SUM(GREATEST(s.duration_seconds - COALESCE(s.total_pause_seconds, 0), 0)), 0)::bigint,
    (SELECT COUNT(*) FROM session_answers sa2 JOIN sessions s2 ON s2.id = sa2.session_id
     WHERE s2.user_id = p_user_id AND s2.is_completed = true AND sa2.is_partially_correct = true
     AND s2.completed_at >= (NOW() - INTERVAL '7 days')
     AND (p_session_type IS NULL OR (p_session_type = 'exam' AND s2.session_type = 'exam'::session_type) OR (p_session_type = 'short' AND s2.session_type IN ('short'::session_type, 'all'::session_type)))),
    COALESCE(
      ROUND(
        (SELECT COUNT(*) FROM session_answers sa3 JOIN sessions s3 ON s3.id = sa3.session_id
         WHERE s3.user_id = p_user_id AND s3.is_completed = true AND sa3.confidence IS NOT NULL
         AND s3.completed_at >= (NOW() - INTERVAL '7 days')
         AND (p_session_type IS NULL OR (p_session_type = 'exam' AND s3.session_type = 'exam'::session_type) OR (p_session_type = 'short' AND s3.session_type IN ('short'::session_type, 'all'::session_type))))::numeric
        / NULLIF((SELECT COUNT(*) FROM session_answers sa4 JOIN sessions s4 ON s4.id = sa4.session_id
         WHERE s4.user_id = p_user_id AND s4.is_completed = true
         AND s4.completed_at >= (NOW() - INTERVAL '7 days')
         AND (p_session_type IS NULL OR (p_session_type = 'exam' AND s4.session_type = 'exam'::session_type) OR (p_session_type = 'short' AND s4.session_type IN ('short'::session_type, 'all'::session_type)))), 0) * 100
      , 1)
    , 0)
  FROM sessions s
  WHERE s.user_id = p_user_id
    AND s.is_completed = true
    AND s.completed_at >= (NOW() - INTERVAL '7 days')
    AND (p_session_type IS NULL OR (p_session_type = 'exam' AND s.session_type = 'exam'::session_type) OR (p_session_type = 'short' AND s.session_type IN ('short'::session_type, 'all'::session_type)));
END;
$$;

-- 2a-bis. get_dashboard_stats_prev_week — same metrics for 7-14 days ago (WoW trends)
CREATE OR REPLACE FUNCTION get_dashboard_stats_prev_week(
  p_user_id uuid,
  p_session_type text DEFAULT NULL
)
RETURNS TABLE (
  avg_score numeric,
  total_sessions bigint,
  total_study_time_seconds bigint,
  partial_answer_count bigint
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
    COALESCE(ROUND(AVG(s.score_percent)::numeric, 1), 0),
    COUNT(s.id),
    COALESCE(SUM(GREATEST(s.duration_seconds - COALESCE(s.total_pause_seconds, 0), 0)), 0)::bigint,
    (SELECT COUNT(*) FROM session_answers sa2 JOIN sessions s2 ON s2.id = sa2.session_id
     WHERE s2.user_id = p_user_id AND s2.is_completed = true AND sa2.is_partially_correct = true
     AND s2.completed_at >= (NOW() - INTERVAL '14 days') AND s2.completed_at < (NOW() - INTERVAL '7 days')
     AND (p_session_type IS NULL OR (p_session_type = 'exam' AND s2.session_type = 'exam'::session_type) OR (p_session_type = 'short' AND s2.session_type IN ('short'::session_type, 'all'::session_type))))
  FROM sessions s
  WHERE s.user_id = p_user_id
    AND s.is_completed = true
    AND s.completed_at >= (NOW() - INTERVAL '14 days')
    AND s.completed_at < (NOW() - INTERVAL '7 days')
    AND (p_session_type IS NULL OR (p_session_type = 'exam' AND s.session_type = 'exam'::session_type) OR (p_session_type = 'short' AND s.session_type IN ('short'::session_type, 'all'::session_type)));
END;
$$;

-- 2b. get_calibration_data — add auth check
CREATE OR REPLACE FUNCTION get_calibration_data(p_user_id uuid, p_session_type text DEFAULT NULL)
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
        ORDER BY sa.score_percent ASC, q.question_number ASC
      ) fc
    )
  ) INTO result;
  RETURN result;
END;
$$;

-- 2c. get_activity_by_week — convert to plpgsql, add auth check
CREATE OR REPLACE FUNCTION get_activity_by_week(
  p_user_id uuid,
  p_weeks integer DEFAULT 8
)
RETURNS TABLE (
  week_start date,
  session_count bigint,
  avg_score numeric
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
    DATE_TRUNC('week', s.completed_at)::date AS week_start,
    COUNT(s.id) AS session_count,
    ROUND(AVG(s.score_percent)::numeric, 1) AS avg_score
  FROM sessions s
  WHERE s.user_id = p_user_id
    AND s.is_completed = true
    AND s.completed_at >= (NOW() - (p_weeks || ' weeks')::interval)
  GROUP BY DATE_TRUNC('week', s.completed_at)
  ORDER BY week_start;
END;
$$;

-- 2d. get_weak_questions — convert to plpgsql, add auth check
CREATE OR REPLACE FUNCTION get_weak_questions(
  p_user_id uuid,
  p_limit integer DEFAULT 1000,
  p_session_type text DEFAULT NULL
)
RETURNS TABLE (
  question_id uuid,
  question_text text,
  question_number integer,
  topic_title text,
  avg_score numeric,
  attempt_count bigint
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
    AND (p_session_type IS NULL OR (p_session_type = 'exam' AND s.session_type = 'exam'::session_type) OR (p_session_type = 'short' AND s.session_type IN ('short'::session_type, 'all'::session_type)))
  GROUP BY sa.question_id, q.question_text, q.question_number, t.title
  HAVING AVG(sa.score_percent) < 100
  ORDER BY
    CASE WHEN AVG(sa.score_percent) = 0 THEN 0 ELSE 1 END ASC,
    CASE WHEN AVG(sa.score_percent) = 0 THEN COUNT(DISTINCT s.id) END DESC,
    CASE WHEN AVG(sa.score_percent) > 0 THEN AVG(sa.score_percent) END ASC
  LIMIT p_limit;
END;
$$;

-- 2e. get_topic_mastery_detailed — convert to plpgsql, add auth check
CREATE OR REPLACE FUNCTION get_topic_mastery_detailed(
  p_user_id uuid,
  p_session_type text DEFAULT NULL
)
RETURNS TABLE (
  topic_id uuid,
  topic_title text,
  topic_level integer,
  parent_id uuid,
  question_count bigint,
  questions_attempted bigint,
  coverage numeric,
  mastery_percent numeric
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
  WITH question_attempts AS (
    SELECT
      sa.question_id,
      q.topic_id,
      ROUND(AVG(CASE WHEN sa.is_correct THEN 100.0 ELSE 0.0 END)::numeric, 1) AS recent_success_rate,
      (ARRAY_AGG(CASE WHEN sa.is_correct THEN 1.0 ELSE 0.0 END ORDER BY sa.answered_at DESC))[1] AS last_correct,
      ROUND(AVG(COALESCE(sa.confidence, 0.5))::numeric, 2) AS avg_confidence
    FROM (
      SELECT
        sa_inner.*,
        ROW_NUMBER() OVER (PARTITION BY sa_inner.question_id ORDER BY sa_inner.answered_at DESC) AS rn
      FROM session_answers sa_inner
      JOIN sessions s ON s.id = sa_inner.session_id
      WHERE s.user_id = p_user_id AND s.is_completed = true
        AND (p_session_type IS NULL OR (p_session_type = 'exam' AND s.session_type = 'exam'::session_type) OR (p_session_type = 'short' AND s.session_type IN ('short'::session_type, 'all'::session_type)))
    ) sa
    JOIN questions q ON q.id = sa.question_id
    WHERE sa.rn <= 3
    GROUP BY sa.question_id, q.topic_id
  ),
  question_mastery AS (
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
      COUNT(DISTINCT q.id) AS question_count,
      COUNT(DISTINCT qm.question_id) AS questions_attempted,
      CASE WHEN COUNT(DISTINCT q.id) = 0 THEN 0
        ELSE ROUND(COUNT(DISTINCT qm.question_id)::numeric / COUNT(DISTINCT q.id) * 100, 1)
      END AS coverage,
      CASE WHEN COUNT(DISTINCT q.id) = 0 THEN 0
        ELSE ROUND(
          COALESCE(AVG(qm.mastery), 0) * COUNT(DISTINCT qm.question_id)::numeric / COUNT(DISTINCT q.id)
        , 1)
      END AS mastery_percent
    FROM topics t
    LEFT JOIN questions q ON q.topic_id = t.id AND q.is_active = true
    LEFT JOIN question_mastery qm ON qm.question_id = q.id
    GROUP BY t.id, t.title, t.level, t.parent_id
  )
  SELECT ts.topic_id, ts.topic_title, ts.topic_level, ts.parent_id,
    ts.question_count, ts.questions_attempted, ts.coverage, ts.mastery_percent
  FROM topic_stats ts
  WHERE ts.question_count > 0
  ORDER BY ts.topic_level, ts.topic_title;
END;
$$;

-- 2f. get_topic_detail_stats — add auth check
CREATE OR REPLACE FUNCTION get_topic_detail_stats(
  p_user_id uuid,
  p_topic_id uuid,
  p_session_type text DEFAULT NULL
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
    'session_count', COALESCE(s.session_count, 0),
    'total_questions_answered', COALESCE(s.total_questions, 0),
    'correct_count', COALESCE(s.correct_count, 0),
    'wrong_count', COALESCE(s.wrong_count, 0),
    'partial_count', COALESCE(s.partial_count, 0),
    'avg_score', COALESCE(round(s.avg_score::numeric, 1), 0),
    'total_time_seconds', COALESCE(s.total_time, 0),
    'avg_confidence', COALESCE(round(a.avg_confidence::numeric, 1), 0),
    'confidence_fill_rate', COALESCE(round(
      CASE WHEN a.total_answers > 0
        THEN (a.answers_with_confidence::numeric / a.total_answers * 100)
        ELSE 0
      END, 0), 0)
  ) INTO result
  FROM (
    SELECT
      count(*) as session_count,
      sum(question_count) as total_questions,
      sum(correct_count) as correct_count,
      sum(wrong_count) as wrong_count,
      sum(partial_count) as partial_count,
      avg(score_percent) as avg_score,
      sum(duration_seconds) as total_time
    FROM public.sessions
    WHERE user_id = p_user_id
      AND topic_id = p_topic_id
      AND is_completed = true
      AND (p_session_type IS NULL OR (p_session_type = 'exam' AND session_type = 'exam'::session_type) OR (p_session_type = 'short' AND session_type IN ('short'::session_type, 'all'::session_type)))
  ) s
  CROSS JOIN (
    SELECT
      count(*) as total_answers,
      avg(CASE WHEN sa.confidence IS NOT NULL THEN sa.confidence END) as avg_confidence,
      count(sa.confidence) as answers_with_confidence
    FROM public.session_answers sa
    JOIN public.sessions sess ON sess.id = sa.session_id
    WHERE sess.user_id = p_user_id
      AND sess.topic_id = p_topic_id
      AND sess.is_completed = true
      AND (p_session_type IS NULL OR (p_session_type = 'exam' AND sess.session_type = 'exam'::session_type) OR (p_session_type = 'short' AND sess.session_type IN ('short'::session_type, 'all'::session_type)))
  ) a;
  RETURN result;
END;
$$;

-- ============================================================================
-- 3. REVOKE EXECUTE ON INTERNAL-ONLY FUNCTIONS
-- ============================================================================

-- update_session_counters: only used by Edge Functions (service_role)
REVOKE EXECUTE ON FUNCTION update_session_counters(uuid, boolean, boolean, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION update_session_counters(uuid, boolean, boolean, boolean) TO postgres;
GRANT EXECUTE ON FUNCTION update_session_counters(uuid, boolean, boolean, boolean) TO service_role;

-- handle_new_user: trigger function, should not be callable directly
REVOKE EXECUTE ON FUNCTION handle_new_user() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION handle_new_user() TO postgres;

-- ============================================================================
-- 4. RESTRICT SESSIONS UPDATE POLICY
-- ============================================================================

DROP POLICY "Users can update own sessions" ON sessions;

-- Students can only update their own incomplete sessions
-- Scoring/completion is done by Edge Functions via service_role (bypasses RLS)
CREATE POLICY "Users can update own incomplete sessions" ON sessions
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid() AND is_completed = false)
  WITH CHECK (user_id = auth.uid() AND is_completed = false);

-- ============================================================================
-- 5. ADMIN USER
-- ============================================================================
-- Admin promotion deferred until admin view is built (Sprint 5).
-- Will create sjam242903@gmail.com as admin at that point.

-- ============================================================================
-- 6. STORAGE: REVOKE ANON READ ON QUESTION-IMAGES
-- ============================================================================

DROP POLICY "Public read access for question images" ON storage.objects;
