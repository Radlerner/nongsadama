-- PRD v1.4 이웃 연결(매칭) 기반 확장 + 생활정보 컬럼 보강
--
-- 원칙(PRD v1.4 §4):
-- - 정확한 사용자 위치를 수집·저장·공개하지 않는다. 중심좌표는 "지역"의 속성이다.
-- - 국적·작목·이웃 노출은 전부 선택(opt-in)이며 기본값은 비공개다.
-- - 노출은 UI가 아니라 뷰 정의·GRANT·RLS로 강제한다.
-- 멱등: add column if not exists / create or replace / drop ... if exists.

-- 1) regions: 읍·면 중심좌표(공개 행정 지리정보, 근사 거리 표시용) ------------
alter table public.regions
  add column if not exists centroid_lat numeric(9, 6)
    check (centroid_lat is null or centroid_lat between -90 and 90),
  add column if not exists centroid_lng numeric(9, 6)
    check (centroid_lng is null or centroid_lng between -180 and 180);

comment on column public.regions.centroid_lat is '지역(읍·면) 중심 위도 근사값. 사용자 위치가 아니다.';
comment on column public.regions.centroid_lng is '지역(읍·면) 중심 경도 근사값. 사용자 위치가 아니다.';

-- 2) profiles: 재배 작목(선택) + 매칭 공개 동의(기본 false) -------------------
alter table public.profiles
  add column if not exists crop_type text
    check (crop_type is null or char_length(crop_type) between 1 and 60),
  add column if not exists is_matching_visible boolean not null default false;

comment on column public.profiles.crop_type is '재배 작목(선택, 자유 텍스트). 특정 작목 코드를 로직에 하드코딩하지 않는다.';
comment on column public.profiles.is_matching_visible is '이웃 목록 노출 및 게시글 국적 표시 동의(opt-in). 기본 비공개.';

-- 3) life_info: 운영시간·언어지원(재검수 발견5, PRD 4.3-3) --------------------
alter table public.life_info
  add column if not exists opening_hours text,
  add column if not exists language_support text;

comment on column public.life_info.opening_hours is '운영시간(자유 텍스트, 운영자 검수 입력).';
comment on column public.life_info.language_support is '언어지원 안내(자유 텍스트, 예: 통역 가능 언어).';

-- 4) 상호성 판별 함수: 현재 사용자가 매칭 공개에 동의했는가 -------------------
-- neighbor_profiles 뷰 정의에 내장되어 "동의자만 이웃 목록을 본다"를 DB에서 강제한다.
create or replace function public.is_matching_opted_in()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and is_matching_visible = true
  );
$$;
-- 뷰에 참조된 함수는 "호출자 권한"으로 실행되므로 뷰를 조회할 역할(authenticated)에는
-- EXECUTE가 필요하다(is_admin 전례와 동일). 반환값은 "본인이 동의했는가"뿐이라 노출 미미.
-- anon/public은 뷰 접근 자체가 없으므로 회수한다.
revoke execute on function public.is_matching_opted_in() from public, anon;
grant execute on function public.is_matching_opted_in() to authenticated;

-- 5) public_profiles 뷰 개정(D-006 개정): 동의자에 한해 국적 노출 -------------
-- 기존 컬럼(id, nickname) 유지 + country_code는 is_matching_visible=true 인 행만 값 노출.
-- (게시글 카드·상세의 작성자 국적 표시용. 미동의자는 null.)
create or replace view public.public_profiles as
  select
    id,
    nickname,
    case when is_matching_visible then country_code end as country_code
  from public.profiles;

-- 6) neighbor_profiles 뷰: 이웃 목록(로그인 + 본인 동의 시에만, 읍·면 단위) ----
-- 정확 위치·연락처 없음. 동의자 행만, 그리고 열람자 본인이 동의자일 때만 반환(상호성).
create or replace view public.neighbor_profiles as
  select
    id,
    nickname,
    region_id,
    country_code,
    crop_type,
    preferred_locale
  from public.profiles
  where is_matching_visible = true
    and public.is_matching_opted_in();

revoke all on public.neighbor_profiles from public, anon, authenticated;
grant select on public.neighbor_profiles to authenticated;
