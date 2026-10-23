-- D-043 (2026-10-23) posts category에 'recommend'(우리 동네 추천) 추가 — 이용자가 직접 쓰는 전국 동네 추천 글.
-- 값 도메인 확장만 한다(기존 행·RLS·트리거 영향 없음). 앱 목록: src/lib/postCategories.ts POST_CATEGORIES.
--
-- 적용 시점: 웹 배포·새 AAB보다 **먼저**(값을 넓히기만 하므로 먼저 적용해도 안전하다). 늦게 적용하면 새 앱의
-- 추천 글 저장이 "저장이 안 됐어요"로 실패한다. 추천 글은 새 앱에서만 쓸 수 있으므로 적용 직후에는 추천 글이 없다.
-- 출시된 1.4.1 은 이 값을 몰라 추천 글의 종류 이름 자리(목록·상세·비슷한 글)에 'board.category.recommend'가
-- 그대로 보이고, 그 앱의 수정 화면에서는 종류 칸이 비어 보인다(이용자가 종류를 고르면 그 값으로 저장). 업데이트하면 사라진다.
--
-- 롤백(추천 글을 '정보'로 옮긴 뒤 이전 제약으로):
--   update public.posts set category = 'info' where category = 'recommend';
--   alter table public.posts drop constraint if exists posts_category_check;
--   alter table public.posts add constraint posts_category_check
--     check (category in ('question', 'info', 'daily', 'other', 'help'));

alter table public.posts drop constraint if exists posts_category_check;
alter table public.posts add constraint posts_category_check
  check (category in ('question', 'info', 'recommend', 'daily', 'other', 'help'));
