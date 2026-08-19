-- Migration: Add optional photo_url to users and (re)create RPC that returns JSON
-- Run this in Supabase SQL editor. Idempotent where possible.

-- enable gen_random_uuid if not present
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- add column photo_url if missing
ALTER TABLE IF EXISTS public.users
  ADD COLUMN IF NOT EXISTS photo_url text;

-- ensure attendance_logs has timestamp column named "timestamp"
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'attendance_logs' AND column_name = 'timestamp'
  ) THEN
    ALTER TABLE public.attendance_logs ADD COLUMN IF NOT EXISTS "timestamp" timestamptz DEFAULT now();
  END IF;
END$$;

-- Recreate RPC function to return detailed JSON
CREATE OR REPLACE FUNCTION public.log_attendance_by_token(p_token text, p_device_info text)
RETURNS jsonb AS $$
DECLARE
  u_id uuid;
  u_name text;
  u_photo text;
  inserted_id uuid;
  inserted_ts timestamptz;
  result jsonb;
BEGIN
  p_token := btrim(p_token);
  IF p_token IS NULL OR p_token = '' OR length(p_token) > 512 THEN
    RAISE EXCEPTION 'Token QR inválido';
  END IF;

  SELECT id, nombre, photo_url INTO u_id, u_name, u_photo FROM public.users WHERE qr_token = p_token LIMIT 1;
  IF u_id IS NULL THEN
    RAISE EXCEPTION 'Usuario no encontrado para token %', p_token;
  END IF;
  INSERT INTO public.attendance_logs(user_id, device_info) VALUES (u_id, p_device_info) RETURNING id, "timestamp" INTO inserted_id, inserted_ts;
  result := jsonb_build_object(
    'attendance_id', inserted_id,
    'user_id', u_id,
    'nombre', u_name,
    'photo_url', u_photo,
    'created_at', inserted_ts
  );
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- El escáner usa la anon public key desde el navegador.
-- Mantener la función con search_path fijo y sin ejecución pública implícita.
ALTER FUNCTION public.log_attendance_by_token(text, text) SET search_path = public;
REVOKE EXECUTE ON FUNCTION public.log_attendance_by_token(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.log_attendance_by_token(text, text) TO anon, authenticated;
