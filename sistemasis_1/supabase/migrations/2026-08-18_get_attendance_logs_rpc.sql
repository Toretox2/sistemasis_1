-- Idempotent migration: create RPC that returns joined logs with total count and pagination
create or replace function public.get_attendance_logs(
  p_start timestamptz DEFAULT null,
  p_end timestamptz DEFAULT null,
  p_search text DEFAULT null,
  p_limit int DEFAULT 50,
  p_offset int DEFAULT 0
)
returns jsonb language sql stable as $$
with filtered_all as (
  select al.id, al.user_id, u.nombre, u.photo_url, al.timestamp, al.device_info
  from public.attendance_logs al
  join public.users u on u.id = al.user_id
  where (p_start is null or al.timestamp >= p_start)
    and (p_end is null or al.timestamp <= p_end)
    and (p_search is null or u.nombre ilike ('%' || p_search || '%'))
),
logs_page as (
  select * from filtered_all
  order by timestamp desc
  limit p_limit offset p_offset
)
select jsonb_build_object(
  'logs', coalesce((select jsonb_agg(row_to_json(t)) from (select id, user_id, nombre, photo_url, timestamp, device_info from logs_page) t), '[]'::jsonb),
  'total', (select count(*) from filtered_all)
);
$$;

comment on function public.get_attendance_logs is 'Returns JSON with keys: logs (array) and total (int). Parameters: p_start, p_end, p_search, p_limit, p_offset.';
