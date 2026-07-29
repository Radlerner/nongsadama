-- PRD v1.5 §9 데모 DB 변경 2건 (제품 오너 §8 빌드 지시로 잠정 승인, 아침 D 확정 대기)
-- ① life_info category에 'support'(상담기관) 추가 — 라우팅 ③
-- ② posts category에 'help'(도움요청) 추가 — 라우팅 ④ 이웃 호출
-- 값 도메인 확장일 뿐 언어·국가 비종속 원칙과 무관. 기존 데이터 영향 없음(추가만).

alter table public.life_info drop constraint if exists life_info_category_check;
alter table public.life_info add constraint life_info_category_check
  check (category in ('hospital', 'market', 'government', 'transport', 'other', 'support'));

alter table public.posts drop constraint if exists posts_category_check;
alter table public.posts add constraint posts_category_check
  check (category in ('question', 'info', 'daily', 'other', 'help'));
