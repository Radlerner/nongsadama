create table public.map_config (
  id boolean primary key default true check (id),
  kakao_javascript_key text not null check (kakao_javascript_key ~ '^[0-9a-fA-F]{32}$')
);

alter table public.map_config enable row level security;
revoke all on public.map_config from public, anon, authenticated;
grant select on public.map_config to anon, authenticated;
grant select, insert, update, delete on public.map_config to service_role;

create policy map_config_select_all on public.map_config
  for select to anon, authenticated
  using (true);

comment on table public.map_config is
  '브라우저에 공개되는 지도 설정. 비밀 키를 저장하지 않는다.';
comment on column public.map_config.kakao_javascript_key is
  'Kakao Maps JavaScript 키. Kakao Web 플랫폼 허용 도메인으로 사용처를 제한한다.';
