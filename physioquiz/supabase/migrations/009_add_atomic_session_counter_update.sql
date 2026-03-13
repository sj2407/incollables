-- ============================================================================
-- 009_add_atomic_session_counter_update.sql
-- RPC function for atomic session counter updates (prevents race conditions).
-- Called by validate-answer Edge Function instead of read-modify-write.
-- Applied via Supabase MCP. This file is a local audit copy.
-- ============================================================================

CREATE OR REPLACE FUNCTION update_session_counters(
  p_session_id UUID,
  p_is_correct BOOLEAN,
  p_is_partially_correct BOOLEAN,
  p_is_wrong BOOLEAN
) RETURNS void AS $$
BEGIN
  UPDATE sessions SET
    correct_count = correct_count + CASE WHEN p_is_correct THEN 1 ELSE 0 END,
    partial_count = partial_count + CASE WHEN p_is_partially_correct THEN 1 ELSE 0 END,
    wrong_count = wrong_count + CASE WHEN p_is_wrong THEN 1 ELSE 0 END,
    current_question_index = (
      SELECT COUNT(*) FROM session_answers WHERE session_id = p_session_id
    )
  WHERE id = p_session_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
