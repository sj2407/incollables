-- Fix infinite recursion: profiles "Admins can read all profiles" policy
-- references profiles itself, causing infinite recursion when any other
-- table's admin policy checks profiles.role.
--
-- Solution: Create a SECURITY DEFINER function that checks admin role
-- without going through RLS, then use it in all admin policies.

CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
  );
$$;

-- Fix profiles admin policy (the source of infinite recursion)
DROP POLICY IF EXISTS "Admins can read all profiles" ON profiles;
CREATE POLICY "Admins can read all profiles" ON profiles
  FOR SELECT USING (is_admin());

-- Fix sessions admin policy
DROP POLICY IF EXISTS "Admins can read all sessions" ON sessions;
CREATE POLICY "Admins can read all sessions" ON sessions
  FOR SELECT USING (is_admin());

-- Fix session_answers admin policy
DROP POLICY IF EXISTS "Admins can read all session answers" ON session_answers;
CREATE POLICY "Admins can read all session answers" ON session_answers
  FOR SELECT USING (is_admin());
