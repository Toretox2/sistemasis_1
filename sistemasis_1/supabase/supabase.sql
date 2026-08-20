-- Supabase schema: users and attendance_logs
-- Ejecutar en SQL editor de Supabase

-- Habilita la extensión para gen_random_uuid si no está disponible
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Tabla de usuarios. `qr_token` se genera externamente (por ejemplo Google Sheets)
CREATE TABLE IF NOT EXISTS public.users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre text NOT NULL,
  qr_token text UNIQUE NOT NULL,
  photo_url text,
  created_at timestamptz DEFAULT now()
);

-- Tabla de registros de asistencia
CREATE TABLE IF NOT EXISTS public.attendance_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.users(id) ON DELETE CASCADE,
  timestamp timestamptz DEFAULT now(),
  device_info text,
  tipo_registro text NOT NULL DEFAULT 'entrada' CHECK (tipo_registro IN ('entrada', 'salida'))
);

-- ENABLE RLS (Row Level Security)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_logs ENABLE ROW LEVEL SECURITY;

-- Policy: permitir lectura de `users` sólo a usuarios autenticados
CREATE POLICY "Allow authenticated read on users" ON public.users
  FOR SELECT
  USING ( auth.role() = 'authenticated' );

-- Policy: sólo rol de servicio puede modificar users (ejemplo básico)
CREATE POLICY "Service role manage users" ON public.users
  FOR ALL
  USING ( auth.role() = 'service_role' );

-- Policy para attendance_logs: permitir INSERT si el user_id ya existe
CREATE POLICY "Allow insert if user exists" ON public.attendance_logs
  FOR INSERT
  WITH CHECK ( EXISTS ( SELECT 1 FROM public.users u WHERE u.id = public.attendance_logs.user_id ) );

-- Policy para lectura de logs: permitir a usuarios autenticados ver sus propios logs
CREATE POLICY "Allow users read their logs" ON public.attendance_logs
  FOR SELECT
  USING ( auth.role() = 'authenticated' AND user_id = auth.uid()::uuid );

-- Nota: Las políticas anteriores suponen que los usuarios inician sesión
-- y que `auth.uid()` coincide con `users.id`. Si desea registrar asistencia
-- mediante un token QR sin autenticación, implemente una función server-side
-- (por ejemplo un Edge Function o un endpoint con la service_role key) que
-- valide el `qr_token` y realice la inserción en `attendance_logs`.

-- Ejemplo de función server-side (ejecutar como owner / service role)
CREATE OR REPLACE FUNCTION public.log_attendance_by_token(p_token text, p_device_info text, p_tipo_registro text DEFAULT 'entrada')
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
  p_tipo_registro := lower(btrim(p_tipo_registro));
  IF p_token IS NULL OR p_token = '' OR length(p_token) > 512 THEN
    RAISE EXCEPTION 'Token QR inválido';
  END IF;
  IF p_tipo_registro NOT IN ('entrada', 'salida') THEN
    RAISE EXCEPTION 'Tipo de registro inválido';
  END IF;

  SELECT id, nombre, photo_url INTO u_id, u_name, u_photo FROM public.users WHERE qr_token = p_token LIMIT 1;
  IF u_id IS NULL THEN
    RAISE EXCEPTION 'Usuario no encontrado para token %', p_token;
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.attendance_logs
    WHERE user_id = u_id
      AND tipo_registro = p_tipo_registro
      AND timestamp::date = current_date
  ) THEN
    RAISE EXCEPTION 'Ya existe un registro de % para este usuario hoy', p_tipo_registro;
  END IF;
  INSERT INTO public.attendance_logs(user_id, device_info, tipo_registro)
  VALUES (u_id, p_device_info, p_tipo_registro)
  RETURNING id, timestamp INTO inserted_id, inserted_ts;
  result := jsonb_build_object(
    'attendance_id', inserted_id,
    'user_id', u_id,
    'nombre', u_name,
    'photo_url', u_photo,
    'tipo_registro', p_tipo_registro,
    'created_at', inserted_ts
  );
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- El escáner usa sólo la anon public key desde el navegador.
-- No otorgar service_role al frontend.
ALTER FUNCTION public.log_attendance_by_token(text, text, text) SET search_path = public;
REVOKE EXECUTE ON FUNCTION public.log_attendance_by_token(text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.log_attendance_by_token(text, text, text) TO anon, authenticated;

-- IMPORTANTE: La función `log_attendance_by_token` tiene `SECURITY DEFINER` y
-- se ejecuta con los privilegios del owner. Debe exponerla sólo desde
-- un endpoint seguro (Edge Function) que use la `service_role` key o que
-- implemente sus propias verificaciones.
