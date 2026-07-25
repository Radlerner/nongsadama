-- RLS 활성화 및 정책 (PRD 8.2)
-- 원칙: UI 은닉이 아니라 RLS로 권한을 강제한다.
-- 역할: anon(비로그인), authenticated(로그인). service_role은 RLS를 우회한다(대시보드 시딩).
-- 멱등성: 정책은 drop ... if exists 후 재생성한다(수동 재실행 대비).

alter table public.regions enable row level security;
alter table public.profiles enable row level security;
alter table public.posts enable row level security;
alter table public.life_info enable row level security;

-- 테이블/뷰 권한(GRANT). RLS가 행을 걸러도 역할에 테이블 권한이 없으면 접근이 거부되므로
-- Supabase 기본 권한에 의존하지 않고 명시한다. 실제 행 접근은 아래 정책이 최종 통제한다.
--
-- profiles: 원본 테이블은 authenticated에게만(본인 행 RLS). 공개 닉네임은 public_profiles 뷰로만 노출.
grant select on public.regions to anon, authenticated;
grant select on public.public_profiles to anon, authenticated;
grant select on public.profiles to authenticated;
grant insert, update on public.profiles to authenticated;
grant select on public.posts to anon, authenticated;
grant insert, update, delete on public.posts to authenticated;
grant select on public.life_info to anon, authenticated;
grant insert, update, delete on public.life_info to authenticated;

-- regions -------------------------------------------------------------------
-- 활성 지역은 누구나 읽는다(로그인 전 언어·지역 선택에 필요). 쓰기는 서비스 역할만.
drop policy if exists "regions_select_active" on public.regions;
create policy "regions_select_active"
on public.regions for select
to anon, authenticated
using (is_active = true);

-- profiles ------------------------------------------------------------------
-- 원본 테이블은 본인 행만 조회(개인정보 보호). 타인 닉네임은 public_profiles 뷰로 노출.
-- 자기 프로필 생성 시 role은 'user'로 고정하여 자기 admin 승격을 막는다.
-- (admin 승격은 운영자가 대시보드/서비스 역할로만 수행 → RLS 우회)
drop policy if exists "profiles_select_public" on public.profiles;
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
on public.profiles for select
to authenticated
using (id = auth.uid());

drop policy if exists "profiles_insert_self" on public.profiles;
create policy "profiles_insert_self"
on public.profiles for insert
to authenticated
with check (id = auth.uid() and role = 'user');

drop policy if exists "profiles_update_self" on public.profiles;
create policy "profiles_update_self"
on public.profiles for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

-- posts ---------------------------------------------------------------------
-- published 글은 누구나, 본인 글은 상태와 무관하게(초안/숨김/삭제) 본인이 조회.
-- 생성·수정·삭제는 본인만. (삭제는 소프트=status 'deleted' UPDATE, 하드=DELETE 모두 허용)
drop policy if exists "posts_select_published_or_own" on public.posts;
create policy "posts_select_published_or_own"
on public.posts for select
to anon, authenticated
using (status = 'published' or author_id = auth.uid());

drop policy if exists "posts_insert_own" on public.posts;
create policy "posts_insert_own"
on public.posts for insert
to authenticated
with check (author_id = auth.uid());

drop policy if exists "posts_update_own" on public.posts;
create policy "posts_update_own"
on public.posts for update
to authenticated
using (author_id = auth.uid())
with check (author_id = auth.uid());

drop policy if exists "posts_delete_own" on public.posts;
create policy "posts_delete_own"
on public.posts for delete
to authenticated
using (author_id = auth.uid());

-- life_info -----------------------------------------------------------------
-- 공개된 생활정보는 누구나, admin은 미공개 포함 전체 조회. 쓰기는 admin만.
drop policy if exists "life_info_select_published_or_admin" on public.life_info;
create policy "life_info_select_published_or_admin"
on public.life_info for select
to anon, authenticated
using (is_published = true or public.is_admin());

drop policy if exists "life_info_insert_admin" on public.life_info;
create policy "life_info_insert_admin"
on public.life_info for insert
to authenticated
with check (public.is_admin());

drop policy if exists "life_info_update_admin" on public.life_info;
create policy "life_info_update_admin"
on public.life_info for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "life_info_delete_admin" on public.life_info;
create policy "life_info_delete_admin"
on public.life_info for delete
to authenticated
using (public.is_admin());
