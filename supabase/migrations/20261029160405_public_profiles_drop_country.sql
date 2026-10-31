-- public_profiles에서 country_code 제거 (D-048, D-012 (b) 철회)
-- 게시글 작성자 국적은 공개 화면에 보이지 않는다(D-047). 이 뷰는 anon에게도 열려 있어
-- 매칭 동의자의 국적이 비로그인 공개 인터넷에 노출되던 경로를 닫는다. 원래 D-006 형태(id, nickname)로 되돌린다.
-- 이웃 목록의 국적은 neighbor_profiles(로그인 + 상호 동의)에서만 계속 보인다.
--
-- 컬럼을 빼는 변경은 create or replace로 할 수 없어 drop + create 한다(의존 객체 없음 — 라이브 확인).
-- 규칙(D-012): 재생성 시 revoke-then-grant(SELECT만) + security_barrier를 반드시 반복한다.
-- (public 스키마 기본 권한이 새 뷰에 anon/authenticated ALL을 주므로 revoke가 빠지면 쓰기까지 열린다.)

drop view public.public_profiles;

create view public.public_profiles
  with (security_barrier = true)
as
  select id, nickname from public.profiles;

comment on view public.public_profiles is
  '게시글 작성자 닉네임 표시용 최소 공개 뷰(id, nickname). 정의자 권한으로 profiles RLS를 우회하므로 민감 컬럼(국적·지역·인증수단 등)을 절대 추가하지 않는다. D-006, D-048.';

revoke all on public.public_profiles from public, anon, authenticated;
grant select on public.public_profiles to anon, authenticated;

notify pgrst, 'reload schema';
