-- Enterprise attendance extension for the existing users/attendance_logs schema.
-- Run after 2026-08-19_metacom_features.sql.

CREATE TABLE IF NOT EXISTS public.attendance_policy (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  workday_start time NOT NULL DEFAULT '08:00:00',
  workday_end time NOT NULL DEFAULT '17:00:00',
  grace_minutes integer NOT NULL DEFAULT 0 CHECK (grace_minutes >= 0),
  hourly_discount numeric(10,2) NOT NULL DEFAULT 0 CHECK (hourly_discount >= 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.attendance_policy (id)
VALUES (true)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.attendance_logs
  ADD COLUMN IF NOT EXISTS work_date date,
  ADD COLUMN IF NOT EXISTS late_minutes integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS overtime_minutes integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_amount numeric(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS attendance_status text NOT NULL DEFAULT 'a_tiempo';

ALTER TABLE public.attendance_logs
  DROP CONSTRAINT IF EXISTS attendance_logs_attendance_status_check;
ALTER TABLE public.attendance_logs
  ADD CONSTRAINT attendance_logs_attendance_status_check
  CHECK (attendance_status IN ('a_tiempo', 'retardo', 'salida_a_tiempo', 'hora_extra'));

UPDATE public.attendance_logs
SET work_date = (timestamp AT TIME ZONE 'UTC')::date
WHERE work_date IS NULL;

ALTER TABLE public.attendance_logs
  ALTER COLUMN work_date SET DEFAULT ((now() AT TIME ZONE 'UTC')::date);

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
  policy_row public.attendance_policy%ROWTYPE;
  user_row public.users%ROWTYPE;
  normalized_token text := btrim(p_token);
  normalized_type text := lower(btrim(p_tipo_registro));
  event_timestamp timestamptz := now();
  event_date date := (event_timestamp AT TIME ZONE 'UTC')::date;
  late_value integer := 0;
  overtime_value integer := 0;
  discount_value numeric(10,2) := 0;
  status_value text := 'a_tiempo';
  inserted_row public.attendance_logs%ROWTYPE;
BEGIN
  IF normalized_token IS NULL OR normalized_token = '' OR length(normalized_token) > 512 THEN
    RAISE EXCEPTION 'Token QR inválido';
  END IF;
  IF normalized_type NOT IN ('entrada', 'salida') THEN
    RAISE EXCEPTION 'Tipo de registro inválido';
  END IF;

  SELECT * INTO policy_row FROM public.attendance_policy WHERE id = true;
  SELECT * INTO user_row FROM public.users WHERE qr_token = normalized_token LIMIT 1;
  IF user_row.id IS NULL THEN
    RAISE EXCEPTION 'Usuario no encontrado para token %', normalized_token;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.attendance_logs
    WHERE user_id = user_row.id AND tipo_registro = normalized_type AND work_date = event_date
  ) THEN
    RAISE EXCEPTION 'Ya existe un registro de % para este usuario hoy', normalized_type;
  END IF;

  IF normalized_type = 'entrada' THEN
    late_value := GREATEST(0, FLOOR(EXTRACT(EPOCH FROM ((event_timestamp AT TIME ZONE 'UTC')::time - policy_row.workday_start)) / 60)::integer - policy_row.grace_minutes);
    discount_value := ROUND((late_value::numeric / 60) * policy_row.hourly_discount, 2);
    IF late_value > 0 THEN status_value := 'retardo'; END IF;
  ELSE
    overtime_value := GREATEST(0, FLOOR(EXTRACT(EPOCH FROM ((event_timestamp AT TIME ZONE 'UTC')::time - policy_row.workday_end)) / 60)::integer);
    IF overtime_value > 0 THEN status_value := 'hora_extra'; ELSE status_value := 'salida_a_tiempo'; END IF;
  END IF;

  INSERT INTO public.attendance_logs(
    user_id, device_info, tipo_registro, work_date, late_minutes, overtime_minutes, discount_amount, attendance_status, timestamp
  ) VALUES (
    user_row.id, p_device_info, normalized_type, event_date, late_value, overtime_value, discount_value, status_value, event_timestamp
  ) RETURNING * INTO inserted_row;

  RETURN jsonb_build_object(
    'attendance_id', inserted_row.id,
    'user_id', user_row.id,
    'nombre', user_row.nombre,
    'photo_url', user_row.photo_url,
    'tipo_registro', normalized_type,
    'attendance_status', status_value,
    'late_minutes', late_value,
    'overtime_minutes', overtime_value,
    'discount_amount', discount_value,
    'created_at', inserted_row.timestamp
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_attendance_metrics(
  p_start date DEFAULT date_trunc('month', current_date)::date,
  p_end date DEFAULT current_date
)
RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path = public
AS $$
WITH days AS (
  SELECT DISTINCT work_date FROM public.attendance_logs WHERE work_date BETWEEN p_start AND p_end
), work_sessions AS (
  SELECT
    user_id,
    work_date,
    MIN(timestamp) FILTER (WHERE tipo_registro = 'entrada') AS first_entry,
    MAX(timestamp) FILTER (WHERE tipo_registro = 'salida') AS last_exit
  FROM public.attendance_logs
  WHERE work_date BETWEEN p_start AND p_end
  GROUP BY user_id, work_date
), rows AS (
  SELECT
    COUNT(*) FILTER (WHERE attendance_status = 'retardo')::integer AS late_count,
    COALESCE(SUM(late_minutes), 0)::integer AS late_minutes,
    COALESCE(SUM(overtime_minutes), 0)::integer AS overtime_minutes,
    COALESCE(SUM(discount_amount), 0)::numeric(10,2) AS discount_total,
    (
      SELECT COALESCE(SUM(EXTRACT(EPOCH FROM (last_exit - first_entry)) / 60)
        FILTER (WHERE first_entry IS NOT NULL AND last_exit IS NOT NULL), 0)::integer
      FROM work_sessions
    ) AS effective_minutes
  FROM public.attendance_logs
  WHERE work_date BETWEEN p_start AND p_end
)
SELECT jsonb_build_object(
  'days_worked', (SELECT COUNT(*) FROM days),
  'late_count', rows.late_count,
  'late_minutes', rows.late_minutes,
  'overtime_minutes', rows.overtime_minutes,
  'discount_total', rows.discount_total,
  'effective_minutes', rows.effective_minutes
) FROM rows;
$$;

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
  SELECT al.id, al.user_id, u.nombre, u.photo_url, al.timestamp, al.tipo_registro, al.attendance_status
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
  'logs', COALESCE((SELECT jsonb_agg(row_to_json(log_row)) FROM (SELECT * FROM logs_page) AS log_row), '[]'::jsonb),
  'total', (SELECT count(*) FROM filtered_all)
);
$$;

REVOKE EXECUTE ON FUNCTION public.log_attendance_by_token(text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.log_attendance_by_token(text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.log_attendance_by_token(text, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_attendance_metrics(date, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_attendance_logs(timestamptz, timestamptz, text, int, int) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_attendance_logs(
  p_start timestamptz DEFAULT null,
  p_end timestamptz DEFAULT null,
  p_search text DEFAULT null,
  p_user_id uuid DEFAULT null,
  p_status text DEFAULT null,
  p_limit int DEFAULT 50,
  p_offset int DEFAULT 0
)
RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path = public
AS $$
WITH filtered_all AS (
  SELECT al.id, al.user_id, u.nombre, u.photo_url, al.timestamp, al.tipo_registro,
    al.attendance_status, al.late_minutes, al.overtime_minutes, al.discount_amount
  FROM public.attendance_logs AS al
  JOIN public.users AS u ON u.id = al.user_id
  WHERE (p_start IS NULL OR al.timestamp >= p_start)
    AND (p_end IS NULL OR al.timestamp <= p_end)
    AND (p_search IS NULL OR u.nombre ILIKE ('%' || p_search || '%') OR u.id::text ILIKE ('%' || p_search || '%'))
    AND (p_user_id IS NULL OR al.user_id = p_user_id)
    AND (p_status IS NULL OR al.attendance_status = p_status)
), logs_page AS (
  SELECT * FROM filtered_all ORDER BY timestamp DESC LIMIT GREATEST(p_limit, 1) OFFSET GREATEST(p_offset, 0)
)
SELECT jsonb_build_object(
  'logs', COALESCE((SELECT jsonb_agg(row_to_json(log_row)) FROM (SELECT * FROM logs_page) AS log_row), '[]'::jsonb),
  'total', (SELECT count(*) FROM filtered_all)
);
$$;

GRANT EXECUTE ON FUNCTION public.get_attendance_logs(timestamptz, timestamptz, text, uuid, text, int, int) TO authenticated;
