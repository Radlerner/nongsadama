-- 농사다마 초기 데이터 모델 (PRD 8.1)
-- 국가·언어 비종속 원칙(PRD 0·6.4): locale / country_code / source_locale 은 자유 텍스트이며
-- 특정 코드('ko','vi' 등)를 CHECK 등으로 하드코딩하지 않는다. 언어 추가에 DB 변경이 필요 없다.
--
-- 값 집합(level/category/status/role)은 Postgres ENUM 대신 text + CHECK 제약을 사용한다.
-- (값 추가/변경 시 ALTER TYPE 없이 마이그레이션이 간단하다. 결정 근거: docs/DECISIONS.md D-005)

create extension if not exists pgcrypto;

-- 공통: updated_at 자동 갱신 --------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- regions -------------------------------------------------------------------
create table public.regions (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid references public.regions(id) on delete set null,
  names jsonb not null check (jsonb_typeof(names) = 'object'),
  level text not null check (level in ('city', 'town')),
  is_active boolean not null default true
);
create index regions_parent_id_idx on public.regions(parent_id);
create index regions_active_idx on public.regions(is_active);

comment on table public.regions is '시군(city)·읍면동(town) 지역. names는 locale을 키로 하는 지역명 JSON.';

-- profiles ------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nickname text not null check (char_length(nickname) between 1 and 40),
  preferred_locale text not null check (char_length(preferred_locale) between 2 and 35),
  country_code text check (country_code is null or char_length(country_code) between 2 and 3),
  region_id uuid references public.regions(id) on delete set null,
  auth_provider text,
  role text not null default 'user' check (role in ('user', 'admin')),
  created_at timestamptz not null default now()
);
create index profiles_region_id_idx on public.profiles(region_id);

comment on table public.profiles is 'Supabase Auth 사용자 프로필. country_code는 선택 입력이며 국적 인증이 아니다(PRD 8.1).';

-- posts ---------------------------------------------------------------------
create table public.posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references auth.users(id) on delete cascade,
  region_id uuid not null references public.regions(id) on delete restrict,
  category text not null check (category in ('question', 'info', 'daily', 'other')),
  title text not null check (char_length(title) between 1 and 200),
  body text not null check (char_length(body) between 1 and 5000),
  source_locale text not null check (char_length(source_locale) between 2 and 35),
  status text not null default 'published' check (status in ('published', 'hidden', 'deleted')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index posts_feed_idx on public.posts(region_id, status, created_at desc);
create index posts_author_idx on public.posts(author_id);

create trigger posts_set_updated_at
before update on public.posts
for each row execute function public.set_updated_at();

comment on table public.posts is '지역 게시글. source_locale은 작성 원문 언어(UI 언어와 다를 수 있음, PRD 6.2).';

-- life_info -----------------------------------------------------------------
create table public.life_info (
  id uuid primary key default gen_random_uuid(),
  region_id uuid not null references public.regions(id) on delete restrict,
  category text not null check (category in ('hospital', 'market', 'government', 'transport', 'other')),
  localized_content jsonb not null check (jsonb_typeof(localized_content) = 'object'),
  address text,
  phone text,
  latitude numeric(9, 6),
  longitude numeric(9, 6),
  source_url text,
  verified_at date,
  is_published boolean not null default false
);
create index life_info_region_category_idx on public.life_info(region_id, category);
create index life_info_published_idx on public.life_info(is_published);

comment on table public.life_info is '운영자 검수 생활정보. localized_content는 locale별 명칭·설명 JSON(PRD 6.3).';

-- 관리자 판별 함수 -----------------------------------------------------------
-- RLS 정책에서 profiles.role을 참조할 때 재귀/권한 문제를 피하기 위해
-- SECURITY DEFINER로 RLS를 우회해 현재 사용자의 admin 여부만 반환한다.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- 권한 상승 방지: 일반 사용자가 자신의 role을 admin으로 바꾸지 못하게 막는다.
-- (RLS WITH CHECK로는 old/new 비교가 불가하여 트리거로 강제한다.)
create or replace function public.prevent_profile_role_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- auth.uid()가 null이면 서비스 역할/대시보드(운영자) 컨텍스트이므로 허용한다.
  -- 실제 로그인 사용자(auth.uid() 존재)가 admin이 아니면서 role을 바꾸려 하면 차단한다.
  if auth.uid() is not null
     and new.role is distinct from old.role
     and not public.is_admin() then
    raise exception 'not allowed to change role';
  end if;
  return new;
end;
$$;
create trigger profiles_guard_role
before update on public.profiles
for each row execute function public.prevent_profile_role_change();
