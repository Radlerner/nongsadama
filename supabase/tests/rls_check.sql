-- RLS 수동 검증 스크립트 (PRD 8.2 / 9 "RLS 권한 테스트")
--
-- 목적: anon / 사용자A / 사용자B / admin 컨텍스트를 시뮬레이션해 정책을 확인한다.
-- 실행: Supabase SQL Editor 또는 psql에서 전체를 그대로 실행하고 NOTICE 출력을 확인한다.
-- 안전: 전체가 BEGIN ... ROLLBACK 으로 감싸져 있어 어떤 데이터도 영구 저장되지 않는다.
--       거부(예외) 케이스는 DO 블록의 서브트랜잭션으로 잡아 뒤 검증이 중단되지 않게 한다.
--
-- 주의: 이 환경(개발 머신)에는 DB가 없어 작성자가 직접 실행/검증하지 못했다.
--       auth.users 스키마의 NOT NULL 요구가 배포본과 다르면 아래 seed의 컬럼을 조정하라.
--       확정적 검증은 서로 다른 두 실제 계정으로 앱에서 수행하는 것이 가장 확실하다(Week 3).
--
-- 역할 전환/클레임: set local role authenticated;  (anon 은 'anon')
--                   set local request.jwt.claims = '{"sub":"<uid>","role":"authenticated"}';
-- auth.uid() 는 request.jwt.claims 의 sub 를 읽는다.

begin;

-- === seed (service/postgres 역할, RLS 우회) ================================
insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'user-a@test.local'),
  ('22222222-2222-2222-2222-222222222222', 'user-b@test.local'),
  ('33333333-3333-3333-3333-333333333333', 'admin@test.local');

insert into public.profiles (id, nickname, preferred_locale, country_code, role) values
  ('11111111-1111-1111-1111-111111111111', 'A', 'ko', 'VN', 'user'),
  ('22222222-2222-2222-2222-222222222222', 'B', 'en', null, 'user'),
  ('33333333-3333-3333-3333-333333333333', 'Admin', 'ko', null, 'admin');

insert into public.regions (id, names, level) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '{"ko":"테스트시","en":"Test City"}', 'city');

insert into public.posts (id, author_id, region_id, category, title, body, source_locale, status) values
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '11111111-1111-1111-1111-111111111111',
   'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'daily', 'A의 글', '내용', 'ko', 'published');

insert into public.life_info (id, region_id, category, localized_content, is_published) values
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
   'hospital', '{"ko":{"name":"공개병원"}}', true),
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
   'hospital', '{"ko":{"name":"미공개병원"}}', false);

-- === anon ==================================================================
set local role anon;
set local request.jwt.claims = '{"role":"anon"}';
-- 기대: 공개 닉네임 3(뷰), published 글 1, 공개 생활정보 1, 활성 지역 1
select 'R2 anon public_profiles (기대 3)' as check, count(*) from public.public_profiles;
select 'R2 anon posts (기대 1)'           as check, count(*) from public.posts;
select 'R2 anon life_info (기대 1)'       as check, count(*) from public.life_info;
select 'R2 anon regions (기대 1)'         as check, count(*) from public.regions;
-- 기대: 거부 — anon 은 profiles 원본 테이블을 읽을 수 없다(개인정보).
do $$ begin
  perform 1 from public.profiles;
  raise notice 'R9 FAIL: anon read profiles succeeded (expected denied)';
exception when others then
  raise notice 'R9 OK: anon profiles read denied (%)', sqlerrm;
end $$;
-- 기대: 거부 — anon 은 글을 작성할 수 없다.
do $$ begin
  insert into public.posts(author_id, region_id, category, title, body, source_locale)
    values ('11111111-1111-1111-1111-111111111111','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','daily','x','y','ko');
  raise notice 'R3 FAIL: anon insert post succeeded (expected denied)';
exception when others then
  raise notice 'R3 OK: anon insert denied (%)', sqlerrm;
end $$;
reset role;

-- === 사용자 B (타인 글 수정/삭제, 권한 상승 시도) ==========================
set local role authenticated;
set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';
-- 기대: 0행 영향 (B는 A의 글을 수정/삭제할 수 없음 → RLS가 조용히 필터)
update public.posts set title = '해킹' where id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
delete from public.posts where id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
select 'R4 A post intact (기대 1, title=A의 글)' as check, count(*)
  from public.posts where id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb' and title = 'A의 글';
-- 기대: 거부 — B가 자기 role 을 admin 으로 승격 시도 시 트리거가 차단.
do $$ begin
  update public.profiles set role = 'admin' where id = '22222222-2222-2222-2222-222222222222';
  raise notice 'R7 FAIL: role escalation succeeded (expected denied)';
exception when others then
  raise notice 'R7 OK: role escalation denied (%)', sqlerrm;
end $$;
reset role;

-- === 사용자 A (자기 글 관리 / 생활정보 쓰기 금지) ==========================
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
-- 기대: 1행 (A는 자기 글 수정 가능)
update public.posts set title = 'A가 수정' where id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
select 'R5 A updated own post (기대 1)' as check, count(*)
  from public.posts where title = 'A가 수정';
-- 기대: 거부 — 일반 사용자는 life_info 작성 불가.
do $$ begin
  insert into public.life_info(region_id, category, localized_content)
    values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','market','{"ko":{"name":"x"}}');
  raise notice 'R6 FAIL: user life_info insert succeeded (expected denied)';
exception when others then
  raise notice 'R6 OK: user life_info insert denied (%)', sqlerrm;
end $$;
reset role;

-- === admin (생활정보 전체 조회/쓰기) ======================================
set local role authenticated;
set local request.jwt.claims = '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}';
-- 기대: 2 (admin은 미공개 포함 전체 생활정보 조회)
select 'R8 admin life_info (기대 2)' as check, count(*) from public.life_info;
-- 기대: 1 (admin은 생활정보 작성 가능)
insert into public.life_info(region_id, category, localized_content, is_published)
  values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'market', '{"ko":{"name":"admin추가"}}', true);
select 'R8 admin inserted life_info (기대 1)' as check, count(*)
  from public.life_info where category = 'market';
reset role;

rollback;
