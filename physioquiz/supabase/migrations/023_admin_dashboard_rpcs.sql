-- ============================================================================
-- 023_admin_dashboard_rpcs.sql
-- Admin dashboard RPCs: aggregated stats, quality alerts, question list, global stats
-- All functions check is_admin() for authorization.
-- Applied via Supabase MCP. This file is a local audit copy.
-- ============================================================================

-- 1. get_admin_dashboard_stats()
CREATE OR REPLACE FUNCTION get_admin_dashboard_stats()
RETURNS TABLE (
  total_questions bigint, total_active_questions bigint, total_chapters bigint,
  registered_students bigint, sessions_this_week bigint, sessions_prev_week bigint
) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT is_admin() THEN RAISE EXCEPTION 'Forbidden'; END IF;
  RETURN QUERY SELECT
    (SELECT COUNT(*) FROM questions)::bigint,
    (SELECT COUNT(*) FROM questions WHERE is_active = true)::bigint,
    (SELECT COUNT(*) FROM topics WHERE is_active = true)::bigint,
    (SELECT COUNT(*) FROM profiles WHERE role = 'student')::bigint,
    (SELECT COUNT(*) FROM sessions WHERE is_completed = true AND completed_at >= NOW() - INTERVAL '7 days')::bigint,
    (SELECT COUNT(*) FROM sessions WHERE is_completed = true AND completed_at >= NOW() - INTERVAL '14 days' AND completed_at < NOW() - INTERVAL '7 days')::bigint;
END; $$;

-- 2. get_admin_quality_alerts()
CREATE OR REPLACE FUNCTION get_admin_quality_alerts()
RETURNS TABLE (
  question_id uuid, question_number int, question_text text, topic_title text,
  alert_type text, error_rate numeric, attempt_count bigint
) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT is_admin() THEN RAISE EXCEPTION 'Forbidden'; END IF;
  RETURN QUERY
  SELECT q.id, q.question_number, q.question_text, t.title, 'no_choices'::text, 0::numeric, 0::bigint
  FROM questions q JOIN topics t ON t.id = q.topic_id
  WHERE q.is_active = true AND NOT EXISTS (SELECT 1 FROM choices c WHERE c.question_id = q.id)
  UNION ALL
  SELECT q.id, q.question_number, q.question_text, t.title, 'high_error_rate'::text,
    ROUND(SUM(CASE WHEN sa.is_correct THEN 0 ELSE 1 END)::numeric / NULLIF(COUNT(*), 0) * 100, 1),
    COUNT(*)::bigint
  FROM session_answers sa JOIN questions q ON q.id = sa.question_id JOIN topics t ON t.id = q.topic_id
  WHERE q.is_active = true GROUP BY q.id, q.question_number, q.question_text, t.title
  HAVING COUNT(*) >= 5 AND SUM(CASE WHEN sa.is_correct THEN 0 ELSE 1 END)::numeric / NULLIF(COUNT(*), 0) * 100 > 80
  ORDER BY alert_type, error_rate DESC NULLS LAST;
END; $$;

-- 3. get_admin_question_list(p_topic_id, p_search, p_limit, p_offset)
CREATE OR REPLACE FUNCTION get_admin_question_list(
  p_topic_id uuid DEFAULT NULL, p_search text DEFAULT NULL, p_limit int DEFAULT 25, p_offset int DEFAULT 0
) RETURNS TABLE (
  question_id uuid, question_number int, question_text text, topic_id uuid, topic_title text,
  difficulty text, is_active boolean, choice_count bigint, total_attempts bigint, error_rate numeric, partial_rate numeric
) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT is_admin() THEN RAISE EXCEPTION 'Forbidden'; END IF;
  RETURN QUERY SELECT q.id, q.question_number, q.question_text, q.topic_id, t.title, q.difficulty::text, q.is_active,
    (SELECT COUNT(*) FROM choices c WHERE c.question_id = q.id)::bigint,
    COALESCE(stats.total_attempts, 0)::bigint, COALESCE(stats.error_rate, 0)::numeric, COALESCE(stats.partial_rate, 0)::numeric
  FROM questions q JOIN topics t ON t.id = q.topic_id
  LEFT JOIN LATERAL (
    SELECT COUNT(*) AS total_attempts,
      ROUND(SUM(CASE WHEN sa.is_correct THEN 0 ELSE 1 END)::numeric / NULLIF(COUNT(*), 0) * 100, 1) AS error_rate,
      ROUND(SUM(CASE WHEN sa.is_partially_correct THEN 1 ELSE 0 END)::numeric / NULLIF(COUNT(*), 0) * 100, 1) AS partial_rate
    FROM session_answers sa WHERE sa.question_id = q.id
  ) stats ON true
  WHERE (p_topic_id IS NULL OR q.topic_id = p_topic_id) AND (p_search IS NULL OR q.question_text ILIKE '%' || p_search || '%')
  ORDER BY q.question_number NULLS LAST, q.created_at DESC LIMIT p_limit OFFSET p_offset;
END; $$;

-- 4. get_admin_global_stats()
CREATE OR REPLACE FUNCTION get_admin_global_stats()
RETURNS TABLE (
  registered_users bigint, active_today bigint, active_this_week bigint, active_this_month bigint,
  avg_session_duration_seconds numeric, total_sessions bigint, avg_score numeric
) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT is_admin() THEN RAISE EXCEPTION 'Forbidden'; END IF;
  RETURN QUERY SELECT
    (SELECT COUNT(*) FROM profiles WHERE role = 'student')::bigint,
    (SELECT COUNT(DISTINCT user_id) FROM sessions WHERE is_completed = true AND completed_at >= NOW() - INTERVAL '1 day')::bigint,
    (SELECT COUNT(DISTINCT user_id) FROM sessions WHERE is_completed = true AND completed_at >= NOW() - INTERVAL '7 days')::bigint,
    (SELECT COUNT(DISTINCT user_id) FROM sessions WHERE is_completed = true AND completed_at >= NOW() - INTERVAL '30 days')::bigint,
    COALESCE((SELECT ROUND(AVG(GREATEST(duration_seconds - COALESCE(total_pause_seconds, 0), 0))::numeric, 0) FROM sessions WHERE is_completed = true AND duration_seconds IS NOT NULL), 0)::numeric,
    (SELECT COUNT(*) FROM sessions WHERE is_completed = true)::bigint,
    COALESCE((SELECT ROUND(AVG(score_percent)::numeric, 1) FROM sessions WHERE is_completed = true), 0)::numeric;
END; $$;

-- 5. get_admin_sessions_per_day(p_days)
CREATE OR REPLACE FUNCTION get_admin_sessions_per_day(p_days int DEFAULT 30)
RETURNS TABLE (day date, session_count bigint, avg_score numeric)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT is_admin() THEN RAISE EXCEPTION 'Forbidden'; END IF;
  RETURN QUERY SELECT d.day::date, COALESCE(COUNT(s.id), 0)::bigint, COALESCE(ROUND(AVG(s.score_percent)::numeric, 1), 0)::numeric
  FROM generate_series((NOW() - (p_days || ' days')::interval)::date, NOW()::date, '1 day'::interval) AS d(day)
  LEFT JOIN sessions s ON s.completed_at::date = d.day::date AND s.is_completed = true
  GROUP BY d.day ORDER BY d.day;
END; $$;

-- 6. get_admin_score_by_chapter()
CREATE OR REPLACE FUNCTION get_admin_score_by_chapter()
RETURNS TABLE (topic_id uuid, topic_title text, avg_score numeric, session_count bigint)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT is_admin() THEN RAISE EXCEPTION 'Forbidden'; END IF;
  RETURN QUERY SELECT t.id, t.title, ROUND(AVG(s.score_percent)::numeric, 1), COUNT(s.id)::bigint
  FROM sessions s JOIN topics t ON t.id = s.topic_id WHERE s.is_completed = true
  GROUP BY t.id, t.title ORDER BY avg_score ASC NULLS LAST;
END; $$;
