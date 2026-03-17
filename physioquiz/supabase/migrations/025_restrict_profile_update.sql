-- Migration 025: Restrict profile UPDATE policy to prevent role self-promotion.
-- The original policy "Users can update own profile" had no column restriction,
-- allowing any authenticated user to SET role = 'admin'.
-- This replaces it with a policy that ensures the role column cannot be changed.

-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;

-- Create restricted policy: user can update own profile but role must stay the same
CREATE POLICY "Users can update own non-role fields" ON profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id
    AND role = (SELECT p.role FROM profiles p WHERE p.id = auth.uid())
  );
