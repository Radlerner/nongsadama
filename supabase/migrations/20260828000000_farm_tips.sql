-- PRD v1.7 §1: 🌾 농사 도움(farm_tips) — 생활정보와 대칭인 농업기술·안전 팁.
-- life_info 패턴 복제: 공개 읽기(is_published), 쓰기는 admin만. 비로그인 열람(§2).

create table if not exists public.farm_tips (
  id uuid primary key default gen_random_uuid(),
  -- 작목 태그(자유 텍스트 — profiles.crop_type과 문자열 매칭, 코드 하드코딩 금지 원칙).
  -- null = 모든 작목 공통(안전·일반).
  crop_type text,
  localized_content jsonb not null, -- {ko:{name,description},en:{name,description}} — life_info와 동일 키(공용 localizedContent 헬퍼)
  source_url text,
  verified_at timestamptz,
  is_published boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.farm_tips enable row level security;

create policy farm_tips_select_published on public.farm_tips
  for select to anon, authenticated
  using (is_published = true);

create policy farm_tips_admin_write on public.farm_tips
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

comment on table public.farm_tips is '농업기술·안전 팁(PRD v1.7 §1). 공개 읽기, admin 쓰기. 농사로 API 연동 전 큐레이션 시드.';
