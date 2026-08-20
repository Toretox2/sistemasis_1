-- Repair migration for existing deployments.
-- Fixes NULL enterprise attendance values before the next QR scan.

CREATE TABLE IF NOT EXISTS public.attendance_policy (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  workday_start time NOT NULL DEFAULT '08:00:00',
  workday_end time NOT NULL DEFAULT '17:00:00',
  grace_minutes integer NOT NULL DEFAULT 0 CHECK (grace_minutes >= 0),
  hourly_discount numeric(10,2) NOT NULL DEFAULT 0 CHECK (hourly_discount >= 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.attendance_policy (id, workday_start, workday_end, grace_minutes, hourly_discount)
VALUES (true, '08:00:00', '17:00:00', 0, 0)
ON CONFLICT (id) DO UPDATE SET
  workday_start = COALESCE(public.attendance_policy.workday_start, '08:00:00'),
  workday_end = COALESCE(public.attendance_policy.workday_end, '17:00:00'),
  grace_minutes = COALESCE(public.attendance_policy.grace_minutes, 0),
  hourly_discount = COALESCE(public.attendance_policy.hourly_discount, 0),
  updated_at = now();

UPDATE public.attendance_logs
SET late_minutes = COALESCE(late_minutes, 0),
    overtime_minutes = COALESCE(overtime_minutes, 0),
    discount_amount = COALESCE(discount_amount, 0),
    attendance_status = COALESCE(attendance_status, 'a_tiempo')
WHERE late_minutes IS NULL
   OR overtime_minutes IS NULL
   OR discount_amount IS NULL
   OR attendance_status IS NULL;

ALTER TABLE public.attendance_logs
  ALTER COLUMN late_minutes SET DEFAULT 0,
  ALTER COLUMN overtime_minutes SET DEFAULT 0,
  ALTER COLUMN discount_amount SET DEFAULT 0,
  ALTER COLUMN attendance_status SET DEFAULT 'a_tiempo';

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
  normalized_type text := lower(btrim(COALESCE(p_tipo_registro, 'entrada')));
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
    late_value := GREATEST(0, FLOOR(EXTRACT(EPOCH FROM ((event_timestamp AT TIME ZONE 'UTC')::time - COALESCE(policy_row.workday_start, '08:00:00'::time))) / 60)::integer - COALESCE(policy_row.grace_minutes, 0));
    discount_value := COALESCE(ROUND((late_value::numeric / 60) * COALESCE(policy_row.hourly_discount, 0), 2), 0);
    IF late_value > 0 THEN status_value := 'retardo'; END IF;
  ELSE
    overtime_value := GREATEST(0, FLOOR(EXTRACT(EPOCH FROM ((event_timestamp AT TIME ZONE 'UTC')::time - COALESCE(policy_row.workday_end, '17:00:00'::time))) / 60)::integer);
    IF overtime_value > 0 THEN status_value := 'hora_extra'; ELSE status_value := 'salida_a_tiempo'; END IF;
  END IF;

  INSERT INTO public.attendance_logs(
    user_id, device_info, tipo_registro, work_date, late_minutes, overtime_minutes, discount_amount, attendance_status, timestamp
  ) VALUES (
    user_row.id, COALESCE(p_device_info, ''), normalized_type, event_date,
    COALESCE(late_value, 0), COALESCE(overtime_value, 0), COALESCE(discount_value, 0),
    COALESCE(status_value, 'a_tiempo'), event_timestamp
  ) RETURNING * INTO inserted_row;

  RETURN jsonb_build_object(
    'attendance_id', inserted_row.id,
    'user_id', user_row.id,
    'nombre', user_row.nombre,
    'photo_url', user_row.photo_url,
    'tipo_registro', normalized_type,
    'attendance_status', COALESCE(inserted_row.attendance_status, 'a_tiempo'),
    'late_minutes', COALESCE(inserted_row.late_minutes, 0),
    'overtime_minutes', COALESCE(inserted_row.overtime_minutes, 0),
    'discount_amount', COALESCE(inserted_row.discount_amount, 0),
    'created_at', inserted_row.timestamp
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.log_attendance_by_token(text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.log_attendance_by_token(text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.log_attendance_by_token(text, text, text) TO anon, authenticated;
