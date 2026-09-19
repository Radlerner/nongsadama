-- STT Edge Function 사용자별 호출 횟수 제한.
-- 프로세스 메모리가 아니라 Postgres 행으로 유지한다(재시작·다중 인스턴스).
-- 허용 횟수·구간은 함수 secret(STT_RATE_LIMIT_MAX, STT_RATE_LIMIT_WINDOW_SECONDS)이 정한다.
-- 둘 다 없으면 이 테이블을 쓰지 않는다. 마이그레이션이 기본 사업 정책을 넣지 않는다.
-- api_keys와 같이 public + RLS(정책 0) + grant 회수 = service_role만 접근
-- (private 스키마는 PostgREST 미노출이라 Edge Function에서 접근 불가, D-028).

create table if not exists public.stt_rate_windows (
  user_id uuid not null references auth.users(id) on delete cascade,
  window_start timestamptz not null,
  hit_count integer not null default 0 check (hit_count >= 0),
  primary key (user_id, window_start)
);

alter table public.stt_rate_windows enable row level security;
revoke all on public.stt_rate_windows from public, anon, authenticated;

create or replace function public.stt_try_consume(
  p_user_id uuid,
  p_max integer,
  p_window_seconds integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := (select auth.uid());
  w_start timestamptz;
  cnt integer;
  elapsed integer;
begin
  if p_user_id is null then
    raise exception 'user required' using errcode = '28000';
  end if;
  if uid is not null and uid is distinct from p_user_id then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_max is null or p_window_seconds is null or p_max < 1 or p_window_seconds < 1 then
    raise exception 'invalid rate limit' using errcode = '22023';
  end if;

  w_start := to_timestamp(
    floor(extract(epoch from clock_timestamp()) / p_window_seconds) * p_window_seconds
  );

  insert into public.stt_rate_windows (user_id, window_start, hit_count)
  values (p_user_id, w_start, 1)
  on conflict (user_id, window_start)
  do update set hit_count = public.stt_rate_windows.hit_count + 1
  returning hit_count into cnt;

  elapsed := floor(extract(epoch from clock_timestamp()) - extract(epoch from w_start))::integer;

  if cnt > p_max then
    return jsonb_build_object(
      'allowed', false,
      'remaining', 0,
      'retry_after_seconds', greatest(1, p_window_seconds - elapsed)
    );
  end if;

  return jsonb_build_object(
    'allowed', true,
    'remaining', p_max - cnt,
    'retry_after_seconds', 0
  );
end;
$$;

revoke all on function public.stt_try_consume(uuid, integer, integer) from public, anon, authenticated;
grant execute on function public.stt_try_consume(uuid, integer, integer) to service_role;

comment on table public.stt_rate_windows is
  'STT 호출 횟수 창. RLS 정책 0 + grant 회수 = service_role 전용. 음성 원문은 저장하지 않는다.';
comment on function public.stt_try_consume(uuid, integer, integer) is
  'STT 횟수 1회 소비. 동시 요청은 upsert로 합산. EXECUTE는 service_role만.';
