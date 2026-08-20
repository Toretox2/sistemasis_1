-- Add METACOM-style entry/exit records to the existing Supabase schema.
-- Safe to run after the previous attendance migrations.

ALTER TABLE public.attendance_logs
  ADD COLUMN IF NOT EXISTS tipo_registro text NOT NULL DEFAULT 'entrada';

ALTER TABLE public.attendance_logs
  DROP CONSTRAINT IF EXISTS attendance_logs_tipo_registro_check;

ALTER TABLE public.attendance_logs
  ADD CONSTRAINT attendance_logs_tipo_registro_check
  CHECK (tipo_registro IN ('entrada', 'salida'));

CREATE OR REPLACE FUNCTION public.log_attendance_by_token(
  p_token text,
  p_device_info text,
  p_tipo_registro text DEFAULT 'entrada'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  u_id uuid;
  u_name text;
  u_photo text;
  inserted_id uuid;
  inserted_ts timestamptz;
  normalized_token text := btrim(p_token);
  normalized_type text := lower(btrim(p_tipo_registro));
BEGIN
  IF normalized_token IS NULL OR normalized_token = '' OR length(normalized_token) > 512 THEN
    RAISE EXCEPTION 'Token QR inválido';
  END IF;

  IF normalized_type NOT IN ('entrada', 'salida') THEN
    RAISE EXCEPTION 'Tipo de registro inválido';
  END IF;

  SELECT id, nombre, photo_url
  INTO u_id, u_name, u_photo
  FROM public.users
  WHERE qr_token = normalized_token
  LIMIT 1;

  IF u_id IS NULL THEN
    RAISE EXCEPTION 'Usuario no encontrado para token %', normalized_token;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.attendance_logs
    WHERE user_id = u_id
      AND tipo_registro = normalized_type
      AND timestamp::date = current_date
  ) THEN
    RAISE EXCEPTION 'Ya existe un registro de % para este usuario hoy', normalized_type;
  END IF;

  INSERT INTO public.attendance_logs(user_id, device_info, tipo_registro)
  VALUES (u_id, p_device_info, normalized_type)
  RETURNING id, timestamp INTO inserted_id, inserted_ts;

  RETURN jsonb_build_object(
    'attendance_id', inserted_id,
    'user_id', u_id,
    'nombre', u_name,
    'photo_url', u_photo,
    'tipo_registro', normalized_type,
    'created_at', inserted_ts
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.log_attendance_by_token(text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.log_attendance_by_token(text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.log_attendance_by_token(text, text, text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_attendance_logs(
  p_start timestamptz DEFAULT null,
  p_end timestamptz DEFAULT null,
  p_search text DEFAULT null,
  p_limit int DEFAULT 50,
  p_offset int DEFAULT 0
)
RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path = public
AS $$
WITH filtered_all AS (
  SELECT al.id, al.user_id, u.nombre, u.photo_url, al.timestamp, al.device_info, al.tipo_registro
  FROM public.attendance_logs AS al
  JOIN public.users AS u ON u.id = al.user_id
  WHERE (p_start IS NULL OR al.timestamp >= p_start)
    AND (p_end IS NULL OR al.timestamp <= p_end)
    AND (p_search IS NULL OR u.nombre ILIKE ('%' || p_search || '%'))
), logs_page AS (
  SELECT * FROM filtered_all
  ORDER BY timestamp DESC
  LIMIT GREATEST(p_limit, 1) OFFSET GREATEST(p_offset, 0)
)
SELECT jsonb_build_object(
  'logs', COALESCE((SELECT jsonb_agg(row_to_json(t)) FROM (SELECT * FROM logs_page) AS t), '[]'::jsonb),
  'total', (SELECT count(*) FROM filtered_all)
);
$$;

GRANT EXECUTE ON FUNCTION public.get_attendance_logs(timestamptz, timestamptz, text, int, int) TO authenticated;
