-- ============================================================================
-- 036_review_rpcs.sql
-- Updates RPCs to include needs_review field and review-aware publish logic.
-- Applied via Supabase MCP. This file is a local audit copy.
-- ============================================================================

-- Drop functions whose return types are changing (both old 4-param and 6-param versions)
DROP FUNCTION IF EXISTS get_admin_question_database_v2(uuid, text, text, text);
DROP FUNCTION IF EXISTS get_admin_question_database_v2(uuid, text, text, text, int, int);
DROP FUNCTION IF EXISTS get_admin_materials(text, uuid, text);
DROP FUNCTION IF EXISTS get_sync_diff();
DROP FUNCTION IF EXISTS get_material_sync_diff(text);
DROP FUNCTION IF EXISTS publish_all_changes();
DROP FUNCTION IF EXISTS publish_material_drafts(text);

-- 2a. get_admin_question_database_v2: add needs_review to return
CREATE OR REPLACE FUNCTION get_admin_question_database_v2(
  p_topic_id uuid DEFAULT NULL,
  p_search text DEFAULT NULL,
  p_active_filter text DEFAULT NULL,
  p_difficulty_filter text DEFAULT NULL,
  p_limit int DEFAULT 10000,
  p_offset int DEFAULT 0
) RETURNS TABLE (
  question_id uuid,
  question_number int,
  question_text text,
  topic_id uuid,
  topic_title text,
  parent_topic_title text,
  difficulty text,
  is_active boolean,
  is_draft boolean,
  needs_review boolean,
  correct_labels text,
  has_explanation boolean,
  explanation_html text,
  all_choices json,
  total_attempts bigint,
  avg_score numeric
) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT is_admin() THEN RAISE EXCEPTION 'Forbidden'; END IF;
  RETURN QUERY
  SELECT
    q.id AS question_id,
    q.question_number,
    q.question_text,
    q.topic_id,
    t.title AS topic_title,
    pt.title AS parent_topic_title,
    q.difficulty::text,
    q.is_active,
    q.is_draft,
    q.needs_review,
    COALESCE(choice_data.correct_labels, '') AS correct_labels,
    (q.explanation_html IS NOT NULL AND q.explanation_html != '') AS has_explanation,
    q.explanation_html,
    COALESCE(choice_data.all_choices, '[]'::json) AS all_choices,
    COALESCE(stats.total_attempts, 0)::bigint,
    COALESCE(stats.avg_score, 0)::numeric
  FROM questions q
  LEFT JOIN topics t ON t.id = q.topic_id
  LEFT JOIN topics pt ON pt.id = t.parent_id
  LEFT JOIN LATERAL (
    SELECT
      string_agg(c.label, ', ' ORDER BY c.sort_order) FILTER (WHERE c.is_correct = true) AS correct_labels,
      json_agg(
        json_build_object('id', c.id, 'label', c.label, 'choice_text', c.choice_text, 'is_correct', c.is_correct)
        ORDER BY c.sort_order
      ) AS all_choices
    FROM choices c WHERE c.question_id = q.id
  ) choice_data ON true
  LEFT JOIN LATERAL (
    SELECT
      COUNT(*) AS total_attempts,
      ROUND(
        (SUM(CASE WHEN sa.is_correct THEN 1 ELSE 0 END)::numeric / NULLIF(COUNT(*), 0)) * 100, 1
      ) AS avg_score
    FROM session_answers sa WHERE sa.question_id = q.id
  ) stats ON true
  WHERE q.deleted_at IS NULL
    AND (p_topic_id IS NULL OR q.topic_id = p_topic_id OR t.parent_id = p_topic_id)
    AND (p_search IS NULL OR p_search = '' OR q.question_text ILIKE '%' || p_search || '%')
    AND (p_active_filter IS NULL OR
         (p_active_filter = 'active' AND q.is_active = true) OR
         (p_active_filter = 'inactive' AND q.is_active = false) OR
         (p_active_filter = 'draft' AND q.is_draft = true))
    AND (p_difficulty_filter IS NULL OR q.difficulty::text = p_difficulty_filter)
  ORDER BY COALESCE(pt.title, t.title, 'zzz'), COALESCE(t.title, 'zzz'), q.question_number NULLS LAST
  LIMIT p_limit OFFSET p_offset;
END;
$$;

-- 2b. get_admin_materials: add needs_review to return
CREATE OR REPLACE FUNCTION get_admin_materials(
  p_type TEXT,
  p_topic_id UUID DEFAULT NULL,
  p_search TEXT DEFAULT NULL
) RETURNS TABLE(
  id UUID, topic_id UUID, material_type TEXT, title TEXT,
  video_url TEXT, file_name TEXT, is_active BOOLEAN, is_draft BOOLEAN,
  needs_review BOOLEAN,
  created_at TIMESTAMPTZ, topic_title TEXT, parent_topic_title TEXT
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NOT is_admin() THEN RAISE EXCEPTION 'Forbidden'; END IF;
  RETURN QUERY
  SELECT lm.id, lm.topic_id, lm.material_type, lm.title,
         lm.video_url, lm.file_name, lm.is_active, lm.is_draft, lm.needs_review, lm.created_at,
         t.title AS topic_title, pt.title AS parent_topic_title
  FROM learning_materials lm
  LEFT JOIN topics t ON t.id = lm.topic_id
  LEFT JOIN topics pt ON pt.id = t.parent_id
  WHERE lm.material_type = p_type AND lm.deleted_at IS NULL
    AND (p_topic_id IS NULL OR lm.topic_id = p_topic_id OR t.parent_id = p_topic_id)
    AND (p_search IS NULL OR p_search = '' OR lm.title ILIKE '%' || p_search || '%')
  ORDER BY COALESCE(pt.title, t.title, 'zzz'), COALESCE(t.title, 'zzz'), lm.title;
END;
$$;

-- 2c. get_sync_diff: add needs_review flag
CREATE OR REPLACE FUNCTION get_sync_diff()
RETURNS TABLE(question_id uuid, question_number int, question_text_preview text, needs_review boolean)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT is_admin() THEN RAISE EXCEPTION 'Forbidden'; END IF;
  RETURN QUERY
  SELECT q.id, q.question_number, LEFT(q.question_text, 60), q.needs_review
  FROM questions q
  WHERE q.deleted_at IS NULL AND (q.current_hash IS DISTINCT FROM q.published_hash)
  ORDER BY q.question_number NULLS LAST;
END;
$$;

-- 2d. get_material_sync_diff: add needs_review flag
CREATE OR REPLACE FUNCTION get_material_sync_diff(p_type TEXT DEFAULT NULL)
RETURNS TABLE(id UUID, title TEXT, material_type TEXT, needs_review BOOLEAN)
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NOT is_admin() THEN RAISE EXCEPTION 'Forbidden'; END IF;
  RETURN QUERY
    SELECT lm.id, lm.title, lm.material_type, lm.needs_review FROM learning_materials lm
    WHERE lm.is_draft = true AND lm.deleted_at IS NULL
      AND (p_type IS NULL OR lm.material_type = p_type)
    ORDER BY lm.title;
END;
$$;

-- 2e. publish_all_changes: add p_force parameter (skip needs_review unless forced)
-- IMPORTANT: needs_review filter only applies to the UPDATE (hash sync), NOT to the
-- INSERT into published tables. Previously published questions must remain published.
CREATE OR REPLACE FUNCTION publish_all_changes(p_force BOOLEAN DEFAULT false)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE changed_count integer;
BEGIN
  IF NOT is_admin() THEN RAISE EXCEPTION 'Forbidden'; END IF;

  -- Count questions that will have their hash synced
  SELECT COUNT(*) INTO changed_count FROM questions
  WHERE deleted_at IS NULL
    AND (COALESCE(current_hash,'') != COALESCE(published_hash,''))
    AND (p_force OR needs_review = false);

  -- TRUNCATE + re-insert ALL active published content (no needs_review filter here)
  TRUNCATE published_question_images, published_choices, published_questions, published_topics CASCADE;

  INSERT INTO published_topics (id,parent_id,title,description,level,sort_order,is_active,published_at)
    SELECT id,parent_id,title,description,level,sort_order,is_active,now() FROM topics WHERE is_active=true;

  -- Re-insert: already-published questions + newly published (passes review filter)
  INSERT INTO published_questions (id,topic_id,question_number,question_text,explanation_html,difficulty,is_active,video_url,video_timestamp,published_at)
    SELECT q.id,q.topic_id,q.question_number,q.question_text,q.explanation_html,q.difficulty,q.is_active,q.video_url,q.video_timestamp,now()
    FROM questions q
    WHERE q.is_active=true AND q.deleted_at IS NULL
      AND (
        -- Already published (hash matches) — always re-insert
        (q.published_hash IS NOT NULL AND q.current_hash = q.published_hash)
        OR
        -- Being published now (hash mismatch, passes review filter)
        (COALESCE(q.current_hash,'') != COALESCE(q.published_hash,'') AND (p_force OR q.needs_review = false))
      )
      AND EXISTS(SELECT 1 FROM published_topics pt WHERE pt.id=q.topic_id);

  INSERT INTO published_choices (id,question_id,label,choice_text,is_correct,sort_order)
    SELECT c.id,c.question_id,c.label,c.choice_text,c.is_correct,c.sort_order FROM choices c WHERE EXISTS(SELECT 1 FROM published_questions pq WHERE pq.id=c.question_id);

  INSERT INTO published_question_images (id,question_id,storage_path,original_name,sort_order)
    SELECT qi.id,qi.question_id,qi.storage_path,qi.original_name,qi.sort_order FROM question_images qi WHERE EXISTS(SELECT 1 FROM published_questions pq WHERE pq.id=qi.question_id);

  -- Only sync hash for questions that pass the review filter
  UPDATE questions SET published_hash=current_hash, is_draft=false
  WHERE deleted_at IS NULL
    AND (COALESCE(current_hash,'')!=COALESCE(published_hash,''))
    AND (p_force OR needs_review = false);

  UPDATE topics SET is_draft=false WHERE is_draft=true;

  RETURN changed_count;
END;
$$;

-- 2f. publish_material_drafts: add p_force parameter
CREATE OR REPLACE FUNCTION publish_material_drafts(p_type TEXT DEFAULT NULL, p_force BOOLEAN DEFAULT false)
RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE cnt bigint;
BEGIN
  IF NOT is_admin() THEN RAISE EXCEPTION 'Forbidden'; END IF;
  UPDATE learning_materials SET is_draft = false, updated_at = now()
  WHERE is_draft = true AND deleted_at IS NULL
    AND (p_type IS NULL OR material_type = p_type)
    AND (p_force OR needs_review = false);
  GET DIAGNOSTICS cnt = ROW_COUNT;
  RETURN cnt;
END;
$$;
