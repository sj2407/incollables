-- ============================================================================
-- 029_upsert_question_choices_rpc.sql
-- Atomic replace of choices (transactional delete+insert) and batch correct answer update.
-- Prevents orphaned data if insert fails after delete.
-- ============================================================================

-- Atomic replace of all choices for a question
CREATE OR REPLACE FUNCTION upsert_question_choices(
  p_question_id uuid,
  p_choices json  -- array of {label, choice_text, is_correct, sort_order}
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT is_admin() THEN RAISE EXCEPTION 'Forbidden'; END IF;

  DELETE FROM choices WHERE question_id = p_question_id;

  INSERT INTO choices (question_id, label, choice_text, is_correct, sort_order)
  SELECT
    p_question_id,
    (elem->>'label')::char(1),
    elem->>'choice_text',
    (elem->>'is_correct')::boolean,
    (elem->>'sort_order')::int
  FROM json_array_elements(p_choices) AS elem;
END; $$;

-- Batch update correct answers (atomic)
CREATE OR REPLACE FUNCTION update_correct_answers(
  p_question_id uuid,
  p_correct_ids uuid[]
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT is_admin() THEN RAISE EXCEPTION 'Forbidden'; END IF;

  UPDATE choices SET is_correct = false WHERE question_id = p_question_id;
  UPDATE choices SET is_correct = true WHERE id = ANY(p_correct_ids) AND question_id = p_question_id;
END; $$;
