-- Drop the assign_admin_by_email function which allows privilege escalation
-- This function was intended as a one-time migration helper but remains callable
-- by any authenticated user via RPC, which could allow users to grant admin privileges
DROP FUNCTION IF EXISTS public.assign_admin_by_email(text);