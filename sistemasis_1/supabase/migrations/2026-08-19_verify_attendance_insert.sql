-- Ensure the QR scanner can execute the attendance RPC with the anon key.
-- Run this migration in the Supabase SQL Editor if the database already exists.

ALTER FUNCTION public.log_attendance_by_token(text, text) SET search_path = public;
REVOKE EXECUTE ON FUNCTION public.log_attendance_by_token(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.log_attendance_by_token(text, text) TO anon, authenticated;

DROP POLICY IF EXISTS "Allow insert if user exists" ON public.attendance_logs;
CREATE POLICY "Allow insert if user exists" ON public.attendance_logs
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.users AS users_row
      WHERE users_row.id = public.attendance_logs.user_id
    )
  );
