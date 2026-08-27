-- D-028: 외부 API 키·캐시 저장소 — public 스키마 + RLS(정책 0) + grant 회수 = service_role 전용.
-- (private 스키마는 PostgREST 미노출이라 Edge Function에서 접근 불가 — 실측 후 전환)
-- 키 값 자체는 마이그레이션에 넣지 않는다(라이브 insert만 — 저장소 미노출).
create table if not exists public.api_keys (
  name text primary key,
  value text not null,
  created_at timestamptz not null default now()
);
alter table public.api_keys enable row level security;
revoke all on public.api_keys from public, anon, authenticated;

create table if not exists public.api_cache (
  name text primary key,
  payload jsonb not null,
  fetched_at timestamptz not null default now()
);
alter table public.api_cache enable row level security;
revoke all on public.api_cache from public, anon, authenticated;

comment on table public.api_keys is '외부 API 키(D-028). RLS 정책 0 + grant 회수 = service_role 전용.';
comment on table public.api_cache is '외부 API 응답 캐시(D-028). service_role 전용.';
