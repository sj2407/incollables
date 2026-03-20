-- ============================================================================
-- 034_learning_materials_rpcs.sql
-- RPC functions for admin learning materials management
-- Applied via Supabase MCP. This file is a local audit copy.
-- ============================================================================

-- 1. get_admin_materials: list materials by type with filters
CREATE OR REPLACE FUNCTION get_admin_materials(
  p_type TEXT,
  p_topic_id UUID DEFAULT NULL,
  p_search TEXT DEFAULT NULL
) RETURNS TABLE(
  id UUID, topic_id UUID, material_type TEXT, title TEXT,
  video_url TEXT, file_name TEXT, is_active BOOLEAN, is_draft BOOLEAN,
  created_at TIMESTAMPTZ, topic_title TEXT, parent_topic_title TEXT
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NOT is_admin() THEN RAISE EXCEPTION 'Forbidden'; END IF;
  RETURN QUERY
    SELECT lm.id, lm.topic_id, lm.material_type, lm.title,
           lm.video_url, lm.file_name, lm.is_active, lm.is_draft, lm.created_at,
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

-- 2. get_deleted_materials: corbeille
CREATE OR REPLACE FUNCTION get_deleted_materials(p_type TEXT)
RETURNS TABLE(id UUID, title TEXT, material_type TEXT, topic_title TEXT, deleted_at TIMESTAMPTZ)
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NOT is_admin() THEN RAISE EXCEPTION 'Forbidden'; END IF;
  RETURN QUERY
    SELECT lm.id, lm.title, lm.material_type, t.title AS topic_title, lm.deleted_at
    FROM learning_materials lm LEFT JOIN topics t ON t.id = lm.topic_id
    WHERE lm.deleted_at IS NOT NULL AND lm.material_type = p_type
    ORDER BY lm.deleted_at DESC;
END;
$$;

-- 3. purge_deleted_materials: hard-delete after 7 days
CREATE OR REPLACE FUNCTION purge_deleted_materials() RETURNS int
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE deleted_count int;
BEGIN
  IF NOT is_admin() THEN RAISE EXCEPTION 'Forbidden'; END IF;
  DELETE FROM learning_materials WHERE deleted_at IS NOT NULL AND deleted_at < now() - interval '7 days';
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

-- 4. log_material_edit: audit trail (reuses admin_edit_log table)
CREATE OR REPLACE FUNCTION log_material_edit(
  p_material_id UUID, p_field TEXT, p_old TEXT DEFAULT NULL, p_new TEXT DEFAULT NULL
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NOT is_admin() THEN RAISE EXCEPTION 'Forbidden'; END IF;
  INSERT INTO admin_edit_log (admin_id, question_id, field_changed, old_value, new_value)
  VALUES (auth.uid(), NULL, 'material:' || p_field, p_old, p_new);
END;
$$;

-- 5. get_material_draft_count
CREATE OR REPLACE FUNCTION get_material_draft_count(p_type TEXT DEFAULT NULL)
RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE cnt bigint;
BEGIN
  IF NOT is_admin() THEN RAISE EXCEPTION 'Forbidden'; END IF;
  SELECT COUNT(*) INTO cnt FROM learning_materials
  WHERE is_draft = true AND deleted_at IS NULL
    AND (p_type IS NULL OR material_type = p_type);
  RETURN cnt;
END;
$$;

-- 6. publish_material_drafts
CREATE OR REPLACE FUNCTION publish_material_drafts(p_type TEXT DEFAULT NULL)
RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE cnt bigint;
BEGIN
  IF NOT is_admin() THEN RAISE EXCEPTION 'Forbidden'; END IF;
  UPDATE learning_materials SET is_draft = false, updated_at = now()
  WHERE is_draft = true AND deleted_at IS NULL
    AND (p_type IS NULL OR material_type = p_type);
  GET DIAGNOSTICS cnt = ROW_COUNT;
  RETURN cnt;
END;
$$;

-- 7. get_material_sync_diff
CREATE OR REPLACE FUNCTION get_material_sync_diff(p_type TEXT DEFAULT NULL)
RETURNS TABLE(id UUID, title TEXT, material_type TEXT)
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NOT is_admin() THEN RAISE EXCEPTION 'Forbidden'; END IF;
  RETURN QUERY
    SELECT lm.id, lm.title, lm.material_type FROM learning_materials lm
    WHERE lm.is_draft = true AND lm.deleted_at IS NULL
      AND (p_type IS NULL OR lm.material_type = p_type)
    ORDER BY lm.title;
END;
$$;
