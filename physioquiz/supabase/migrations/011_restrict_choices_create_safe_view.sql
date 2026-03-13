-- Migration 011: Anti-cheat — restrict is_correct from students
-- Students can only read choices via safe_choices view (no is_correct column).
-- Edge Functions use service_role (bypasses RLS) to read is_correct server-side.

-- Remove overly permissive SELECT policy
DROP POLICY IF EXISTS "Authenticated users can read choices" ON choices;

-- Only admins can read the choices table directly
CREATE POLICY "Only admins can read choices directly"
  ON choices FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- Safe view for client use (excludes is_correct)
CREATE OR REPLACE VIEW safe_choices AS
SELECT id, question_id, label, choice_text, sort_order
FROM choices;

GRANT SELECT ON safe_choices TO authenticated;
GRANT SELECT ON safe_choices TO anon;
