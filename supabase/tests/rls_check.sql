-- RLS 수동 검증 스크립트 (PRD 8.2 / 9 "RLS 권한 테스트")
--
-- 목적: anon / 사용자A / 사용자B / admin 컨텍스트를 시뮬레이션해 정책을 확인한다.
-- 실행: Supabase SQL Editor 또는 psql에서 전체를 그대로 실행한다.
-- 안전: 전체가 BEGIN ... ROLLBACK 으로 감싸져 있어 어떤 데이터도 영구 저장되지 않는다.
--
-- 주의: 이 환경(개발 머신)에는 DB가 없어 작성자가 직접 실행/검증하지 못했다.
--       auth.users 스키마의 NOT NULL 요구가 배포본과 다르면 아래 seed의 컬럼을 조정하라.
--       확정적 검증은 서로 다른 두 실제 계정으로 앱에서 수행하는 것이 가장 확실하다(Week 3).
--
-- 역할 전환/클레임 설정 방법:
--   set local role authenticated;                        -- anon 은 'anon'
--   set local request.jwt.claims = '{"sub":"<uid>", "role":"authenticated"}';
-- auth.uid() 는 request.jwt.claims 의 sub 를 읽는다.

begin;

-- === seed (service/postgres 역할, RLS 우회) ================================
-- 두 사용자, 한 admin, 한 지역, 게시글/생활정보 샘플
insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'user-a@test.local'),
  ('22222222-2222-2222-2222-222222222222', 'user-b@test.local'),
  ('33333333-3333-3333-3333-333333333333', 'admin@test.local');

insert into public.profiles (id, nickname, preferred_locale, role) values
  ('11111111-1111-1111-1111-111111111111', 'A', 'ko', 'user'),
  ('22222222-2222-2222-2222-222222222222', 'B', 'en', 'user'),
  ('33333333-3333-3333-3333-333333333333', 'Admin', 'ko', 'admin');

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
-- 기대: published 글 1건만, 미공개 생활정보 제외(공개 1건), 활성 지역 1건
select 'anon posts (기대 1)'      as check, count(*) from public.posts;
select 'anon life_info (기대 1)'  as check, count(*) from public.life_info;
select 'anon regions (기대 1)'    as check, count(*) from public.regions;
-- 기대: 실패(정책 위반) — anon 은 글 작성 불가. 실행 시 오류가 정상.
-- insert into public.posts(author_id,region_id,category,title,body,source_locale)
--   values ('11111111-1111-1111-1111-111111111111','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','daily','x','y','ko');
reset role;

-- === 사용자 B (타인 글 수정/삭제 시도) =====================================
set local role authenticated;
set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';
-- 기대: 0 (B는 A의 글을 수정할 수 없음)
update public.posts set title = '해킹' where id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
select 'B updated A post rows (기대 0)' as check, count(*) from public.posts where title = '해킹';
-- 기대: 0 (B는 A의 글을 삭제할 수 없음)
delete from public.posts where id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
select 'A post still exists (기대 1)' as check, count(*) from public.posts where id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
-- 기대: 실패 — B가 자기 role을 admin으로 승격 시도 시 트리거가 차단.
-- update public.profiles set role='admin' where id='22222222-2222-2222-2222-222222222222';
reset role;

-- === 사용자 A (자기 글 관리 / 생활정보 쓰기 금지) ==========================
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
-- 기대: 1 (A는 자기 글 수정 가능)
update public.posts set title = 'A가 수정' where id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
select 'A updated own post (기대 1)' as check, count(*) from public.posts where title = 'A가 수정';
-- 기대: 실패 — 일반 사용자는 life_info 작성 불가. 실행 시 오류가 정상.
-- insert into public.life_info(region_id,category,localized_content)
--   values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','market','{"ko":{"name":"x"}}');
reset role;

-- === admin (생활정보 전체 조회/쓰기) ======================================
set local role authenticated;
set local request.jwt.claims = '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}';
-- 기대: 2 (admin은 미공개 포함 전체 생활정보 조회)
select 'admin life_info (기대 2)' as check, count(*) from public.life_info;
-- 기대: 1 (admin은 생활정보 작성 가능)
insert into public.life_info(region_id, category, localized_content, is_published)
  values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'market', '{"ko":{"name":"admin추가"}}', true);
select 'admin inserted life_info (기대 1)' as check, count(*) from public.life_info where category = 'market';
reset role;

rollback;
