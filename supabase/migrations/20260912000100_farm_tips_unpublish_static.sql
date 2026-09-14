-- v1.2 (D-036): 정적 농사 도움 콘텐츠 8건 비공개 처리(삭제 아님 — is_published=false, 되돌릴 수 있음).
--
-- 왜: 2026-08-28 시드(supabase/seeds/20260828_farm_tips_seed.sql)의 8건은 폭염·농약·농기계·하우스 환기·허리·
-- 딸기·사과·주간 농사정보 안내 등 한 번 읽으면 반복 가치가 낮은 일반 농업 상식이며 API·실데이터와 연결되지 않는다.
-- 앱의 목적(지역·상황 맞춤 실데이터)과 맞지 않아 v1.2에서 노출을 끊는다. /farm 화면은 날씨(koreaConnect)와
-- 농촌지도사업(농진청 API)만 보여 주고, 팁 목록은 실데이터(농사로 OpenAPI 연동 후)가 생길 때까지 비어 있다.
-- RLS(farm_tips_select_published)는 is_published=true만 공개하므로 이 update로 앱·API 응답에서 즉시 사라진다.
--
-- 롤백: update public.farm_tips set is_published = true where id in (아래 8개 id);

update public.farm_tips set is_published = false
where id in (
  'bd0a7093-3b66-41cd-ba6e-7cdc352a3f8d', -- 폭염 속 밭일, 3가지만 기억하세요
  '970ab341-a090-43a4-a21a-2bdb7d6111d7', -- 농약 살포할 때 꼭 지킬 것
  '8b9b0560-9276-4f7e-b0d7-0b2b992f89b8', -- 경운기·트랙터 사고를 피하려면
  '74694575-8c9e-42af-859f-94d60968c33c', -- 겨울 비닐하우스, 환기가 생명입니다
  'ab838786-abc1-4b6e-a42d-7d576d93d050', -- 허리를 지키는 농작업 습관
  'e1012f89-3046-49b4-8c15-125ae561c210', -- 딸기 하우스 관리의 기본(딸기)
  '8551ec14-e834-4bc7-b5c2-5e08164acee3', -- 사과밭 작업, 계절마다 다릅니다(사과)
  '46747aae-6f41-4465-957b-8de1d9ac0872'  -- 이번 주 농사 정보가 궁금하다면
);

comment on table public.farm_tips is
  '농업기술·안전 팁(PRD v1.7 §1). 공개 읽기, admin 쓰기. v1.2부터 정적 상식 콘텐츠는 비공개(D-036) — 실데이터(농사로 API 등) 연동분만 공개한다.';
