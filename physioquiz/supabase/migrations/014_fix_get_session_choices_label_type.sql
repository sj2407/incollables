-- Fix type mismatch: choices.label is char(1) but function declared text
-- Cast label to text in the RETURN QUERY
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
SET search_path = public
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
  SELECT c.id AS choice_id, c.question_id, c.label::text, c.choice_text, c.is_correct, c.sort_order
  FROM choices c
  INNER JOIN session_questions sq ON sq.question_id = c.question_id
  WHERE sq.session_id = p_session_id
  ORDER BY c.question_id, c.sort_order;
END;
$$;
