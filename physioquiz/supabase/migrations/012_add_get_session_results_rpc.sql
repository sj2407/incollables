-- Migration 012: RPC to get choices with is_correct for completed sessions only.
-- Students can only see correct answers AFTER session completion.
-- This is needed because the choices table RLS now blocks is_correct from students.

CREATE OR REPLACE FUNCTION get_session_choices(p_session_id uuid)
RETURNS TABLE(
  choice_id uuid,
  question_id uuid,
  label text,
  choice_text text,
  is_correct boolean,
  sort_order integer
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM sessions s
    WHERE s.id = p_session_id
      AND s.user_id = auth.uid()
      AND s.is_completed = true
  ) THEN
    RAISE EXCEPTION 'Session not found, not yours, or not completed';
  END IF;

  RETURN QUERY
  SELECT c.id AS choice_id, c.question_id, c.label, c.choice_text, c.is_correct, c.sort_order
  FROM choices c
  INNER JOIN session_questions sq ON sq.question_id = c.question_id
  WHERE sq.session_id = p_session_id
  ORDER BY c.question_id, c.sort_order;
END;
$$;
