-- 보안 어드바이저 WARN 하드닝
-- (라이브 적용 후 get_advisors(security) 결과 반영)
--
-- 1) set_updated_at: search_path 고정(function_search_path_mutable 경고 해소).
--    트리거 전용 함수로, now()는 pg_catalog에 있어 빈 search_path에서도 동작한다.
-- 2) prevent_profile_role_change: 트리거 전용 함수인데 EXECUTE가 public에 열려 있어
--    RPC(/rest/v1/rpc/...)로 호출 가능하다는 경고. 트리거는 EXECUTE 권한과 무관하게
--    작동하므로 anon/authenticated/public의 EXECUTE를 회수해 노출을 없앤다.
--
-- 참고: is_admin()의 EXECUTE는 회수하지 않는다. RLS 정책(life_info)이 이 함수를
--       평가하려면 호출 역할에 EXECUTE가 필요하기 때문이다. 반환값은 "본인이 admin인가"
--       뿐이라 정보 노출이 미미하다(어드바이저 WARN 수용, docs/DECISIONS.md D-010).

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke execute on function public.prevent_profile_role_change() from public, anon, authenticated;
