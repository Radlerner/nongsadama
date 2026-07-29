-- 농사다마 시딩 데이터 — 파일럿 지역: 충청남도 홍성군
--
-- 데이터 진실성 방침(PRD 6.3):
-- - regions(홍성군 + 읍·면)는 실제 공개 행정정보라 정확히 넣는다.
-- - life_info는 실존 시설의 주소/전화/운영시간을 출처 없이 지어내지 않는다.
--   아래 항목은 카테고리 UI 검증용 "[샘플] 검수 필요" 데이터이며, 전화·주소는 비워 둔다.
--   실제 정보는 운영자가 출처(source_url)와 최종 확인일(verified_at)을 붙여 검수 후 교체한다.
--
-- 멱등: 고정 UUID + on conflict do nothing. 여러 번 실행해도 안전하다.
-- 적용: Supabase SQL Editor 또는 CLI(`supabase db reset`이 seed.sql 자동 실행). service_role은 RLS 우회.

-- ── regions ────────────────────────────────────────────────────────────────
insert into public.regions (id, parent_id, names, level, is_active) values
  ('a1000000-0000-4000-8000-000000000001', null,
   '{"ko":"홍성군","en":"Hongseong-gun"}', 'city', true)
on conflict (id) do nothing;

insert into public.regions (id, parent_id, names, level, is_active) values
  ('a2000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000001','{"ko":"홍성읍","en":"Hongseong-eup"}','town',true),
  ('a2000000-0000-4000-8000-000000000002','a1000000-0000-4000-8000-000000000001','{"ko":"광천읍","en":"Gwangcheon-eup"}','town',true),
  ('a2000000-0000-4000-8000-000000000003','a1000000-0000-4000-8000-000000000001','{"ko":"홍북읍","en":"Hongbuk-eup"}','town',true),
  ('a2000000-0000-4000-8000-000000000004','a1000000-0000-4000-8000-000000000001','{"ko":"금마면","en":"Geumma-myeon"}','town',true),
  ('a2000000-0000-4000-8000-000000000005','a1000000-0000-4000-8000-000000000001','{"ko":"홍동면","en":"Hongdong-myeon"}','town',true),
  ('a2000000-0000-4000-8000-000000000006','a1000000-0000-4000-8000-000000000001','{"ko":"장곡면","en":"Janggok-myeon"}','town',true),
  ('a2000000-0000-4000-8000-000000000007','a1000000-0000-4000-8000-000000000001','{"ko":"은하면","en":"Eunha-myeon"}','town',true),
  ('a2000000-0000-4000-8000-000000000008','a1000000-0000-4000-8000-000000000001','{"ko":"결성면","en":"Gyeolseong-myeon"}','town',true),
  ('a2000000-0000-4000-8000-000000000009','a1000000-0000-4000-8000-000000000001','{"ko":"서부면","en":"Seobu-myeon"}','town',true),
  ('a2000000-0000-4000-8000-000000000010','a1000000-0000-4000-8000-000000000001','{"ko":"갈산면","en":"Galsan-myeon"}','town',true),
  ('a2000000-0000-4000-8000-000000000011','a1000000-0000-4000-8000-000000000001','{"ko":"구항면","en":"Guhang-myeon"}','town',true)
on conflict (id) do nothing;

-- ── regions 중심좌표(근사) ──────────────────────────────────────────────────
-- 공개 행정 지리정보 기반의 "지역" 중심 근사값(±1~2km 오차 가능)이며 사용자 위치가 아니다.
-- 용도: 게시글의 "약 N km" 근사 거리 표시(PRD v1.4 §2.3). 파일럿 검수 시 교정 가능.
update public.regions set centroid_lat = 36.601, centroid_lng = 126.665 where id = 'a1000000-0000-4000-8000-000000000001'; -- 홍성군(군청 일대)
update public.regions set centroid_lat = 36.601, centroid_lng = 126.665 where id = 'a2000000-0000-4000-8000-000000000001'; -- 홍성읍
update public.regions set centroid_lat = 36.525, centroid_lng = 126.630 where id = 'a2000000-0000-4000-8000-000000000002'; -- 광천읍
update public.regions set centroid_lat = 36.666, centroid_lng = 126.703 where id = 'a2000000-0000-4000-8000-000000000003'; -- 홍북읍
update public.regions set centroid_lat = 36.617, centroid_lng = 126.715 where id = 'a2000000-0000-4000-8000-000000000004'; -- 금마면
update public.regions set centroid_lat = 36.565, centroid_lng = 126.687 where id = 'a2000000-0000-4000-8000-000000000005'; -- 홍동면
update public.regions set centroid_lat = 36.550, centroid_lng = 126.740 where id = 'a2000000-0000-4000-8000-000000000006'; -- 장곡면
update public.regions set centroid_lat = 36.505, centroid_lng = 126.585 where id = 'a2000000-0000-4000-8000-000000000007'; -- 은하면
update public.regions set centroid_lat = 36.560, centroid_lng = 126.560 where id = 'a2000000-0000-4000-8000-000000000008'; -- 결성면
update public.regions set centroid_lat = 36.590, centroid_lng = 126.500 where id = 'a2000000-0000-4000-8000-000000000009'; -- 서부면
update public.regions set centroid_lat = 36.640, centroid_lng = 126.580 where id = 'a2000000-0000-4000-8000-000000000010'; -- 갈산면
update public.regions set centroid_lat = 36.590, centroid_lng = 126.610 where id = 'a2000000-0000-4000-8000-000000000011'; -- 구항면

-- ── life_info (샘플/검수 필요) ───────────────────────────────────────────────
-- 전화·주소·좌표·출처는 비워 두고, 설명에 검수 필요·방문 전 확인 문구를 넣는다.
-- 마지막 1건은 is_published=false 로 두어 admin 전용 가시성(미공개)을 데모한다.
insert into public.life_info
  (id, region_id, category, localized_content, address, phone, source_url, verified_at, is_published) values
  -- hospital
  ('a3000000-0000-4000-8000-000000000001','a2000000-0000-4000-8000-000000000001','hospital',
   '{"ko":{"name":"[샘플] 홍성읍 병·의원","description":"카테고리 검증용 샘플입니다. 실제 명칭·주소·전화·운영시간은 운영자 검수 후 제공됩니다. 방문 전 반드시 전화로 확인하세요."},"en":{"name":"[Sample] Hongseong-eup clinic","description":"Sample entry for UI. Real name/address/phone/hours provided after operator review. Please call before visiting."}}',
   null,null,null,null,true),
  ('a3000000-0000-4000-8000-000000000002','a2000000-0000-4000-8000-000000000002','hospital',
   '{"ko":{"name":"[샘플] 광천읍 병·의원","description":"샘플입니다. 실제 정보는 운영자 검수 후 제공됩니다. 방문 전 확인하세요."},"en":{"name":"[Sample] Gwangcheon-eup clinic","description":"Sample. Real info after operator review. Call before visiting."}}',
   null,null,null,null,true),
  ('a3000000-0000-4000-8000-000000000003','a2000000-0000-4000-8000-000000000003','hospital',
   '{"ko":{"name":"[샘플] 홍북읍 약국","description":"샘플입니다. 실제 정보는 운영자 검수 후 제공됩니다. 방문 전 확인하세요."},"en":{"name":"[Sample] Hongbuk-eup pharmacy","description":"Sample. Real info after operator review. Call before visiting."}}',
   null,null,null,null,true),
  -- market
  ('a3000000-0000-4000-8000-000000000004','a2000000-0000-4000-8000-000000000001','market',
   '{"ko":{"name":"[샘플] 홍성 전통시장","description":"샘플입니다. 실제 정보는 운영자 검수 후 제공됩니다. 방문 전 확인하세요."},"en":{"name":"[Sample] Hongseong traditional market","description":"Sample. Real info after operator review. Call before visiting."}}',
   null,null,null,null,true),
  ('a3000000-0000-4000-8000-000000000005','a2000000-0000-4000-8000-000000000002','market',
   '{"ko":{"name":"[샘플] 광천 시장","description":"샘플입니다. 실제 정보는 운영자 검수 후 제공됩니다. 방문 전 확인하세요."},"en":{"name":"[Sample] Gwangcheon market","description":"Sample. Real info after operator review. Call before visiting."}}',
   null,null,null,null,true),
  ('a3000000-0000-4000-8000-000000000006','a2000000-0000-4000-8000-000000000004','market',
   '{"ko":{"name":"[샘플] 금마면 마트","description":"샘플입니다. 실제 정보는 운영자 검수 후 제공됩니다. 방문 전 확인하세요."},"en":{"name":"[Sample] Geumma-myeon store","description":"Sample. Real info after operator review. Call before visiting."}}',
   null,null,null,null,true),
  -- government
  ('a3000000-0000-4000-8000-000000000007','a2000000-0000-4000-8000-000000000001','government',
   '{"ko":{"name":"[샘플] 홍성군청/행정복지센터","description":"샘플입니다. 실제 연락처·업무시간은 운영자 검수 후 제공됩니다. 방문 전 확인하세요."},"en":{"name":"[Sample] Hongseong county/community office","description":"Sample. Real contact/hours after operator review. Call before visiting."}}',
   null,null,null,null,true),
  ('a3000000-0000-4000-8000-000000000008','a2000000-0000-4000-8000-000000000002','government',
   '{"ko":{"name":"[샘플] 광천읍 행정복지센터","description":"샘플입니다. 실제 정보는 운영자 검수 후 제공됩니다. 방문 전 확인하세요."},"en":{"name":"[Sample] Gwangcheon-eup community office","description":"Sample. Real info after operator review. Call before visiting."}}',
   null,null,null,null,true),
  ('a3000000-0000-4000-8000-000000000009','a2000000-0000-4000-8000-000000000009','government',
   '{"ko":{"name":"[샘플] 외국인 지원 창구","description":"샘플입니다. 실제 운영 여부·연락처는 운영자 검수 후 제공됩니다. 방문 전 확인하세요."},"en":{"name":"[Sample] Foreign resident help desk","description":"Sample. Availability/contact after operator review. Call before visiting."}}',
   null,null,null,null,true),
  -- transport
  ('a3000000-0000-4000-8000-000000000010','a2000000-0000-4000-8000-000000000001','transport',
   '{"ko":{"name":"[샘플] 홍성 시외/고속버스터미널","description":"샘플입니다. 실제 시간표·연락처는 운영자 검수 후 제공됩니다. 방문 전 확인하세요."},"en":{"name":"[Sample] Hongseong bus terminal","description":"Sample. Real timetable/contact after operator review. Check before visiting."}}',
   null,null,null,null,true),
  ('a3000000-0000-4000-8000-000000000011','a2000000-0000-4000-8000-000000000001','transport',
   '{"ko":{"name":"[샘플] 홍성역","description":"샘플입니다. 실제 열차 정보는 운영자 검수 후 제공됩니다. 방문 전 확인하세요."},"en":{"name":"[Sample] Hongseong station","description":"Sample. Real train info after operator review. Check before visiting."}}',
   null,null,null,null,true),
  ('a3000000-0000-4000-8000-000000000012','a2000000-0000-4000-8000-000000000002','transport',
   '{"ko":{"name":"[샘플] 광천역","description":"샘플입니다. 실제 정보는 운영자 검수 후 제공됩니다. 방문 전 확인하세요."},"en":{"name":"[Sample] Gwangcheon station","description":"Sample. Real info after operator review. Check before visiting."}}',
   null,null,null,null,true),
  -- other
  ('a3000000-0000-4000-8000-000000000013','a2000000-0000-4000-8000-000000000005','other',
   '{"ko":{"name":"[샘플] 홍동면 도서관/문화공간","description":"샘플입니다. 실제 정보는 운영자 검수 후 제공됩니다. 방문 전 확인하세요."},"en":{"name":"[Sample] Hongdong-myeon library","description":"Sample. Real info after operator review. Check before visiting."}}',
   null,null,null,null,true),
  ('a3000000-0000-4000-8000-000000000014','a2000000-0000-4000-8000-000000000006','other',
   '{"ko":{"name":"[샘플] 장곡면 생활 SOC","description":"샘플입니다. 실제 정보는 운영자 검수 후 제공됩니다. 방문 전 확인하세요."},"en":{"name":"[Sample] Janggok-myeon facility","description":"Sample. Real info after operator review. Check before visiting."}}',
   null,null,null,null,true),
  ('a3000000-0000-4000-8000-000000000015','a2000000-0000-4000-8000-000000000001','other',
   '{"ko":{"name":"[샘플] 다문화가족지원센터","description":"샘플입니다. 실제 운영 여부·연락처는 운영자 검수 후 제공됩니다. 방문 전 확인하세요."},"en":{"name":"[Sample] Multicultural family support center","description":"Sample. Availability/contact after operator review. Call before visiting."}}',
   null,null,null,null,true),
  -- support: 전국 공통 공공 핫라인(안정적 공개 번호). 주소·좌표 없음.
  -- verified_at은 운영자 최종 확인 후 기입(그 전까지 신선도 배지가 '검수 확인일 없음' 표시 — 의도).
  -- 실기관(농촌인력인권센터 등 지역 기관)은 명칭·관할·연락처·존속 확인 후 운영자가 추가한다(PRD v1.5 §6).
  ('a3000000-0000-4000-8000-000000000017','a1000000-0000-4000-8000-000000000001','support',
   '{"ko":{"name":"외국인종합안내센터 ☎1345","description":"체류·비자·생활 전반을 여러 언어로 안내하는 정부 콜센터입니다. 국번 없이 1345."},"en":{"name":"Immigration Contact Center ☎1345","description":"Government call center for visa, stay and daily-life questions in many languages. Dial 1345."}}',
   null,'1345',null,null,true),
  ('a3000000-0000-4000-8000-000000000018','a1000000-0000-4000-8000-000000000001','support',
   '{"ko":{"name":"고용노동부 상담센터 ☎1350","description":"임금 체불, 근로계약, 산재 등 일 문제 상담. 국번 없이 1350."},"en":{"name":"Ministry of Employment & Labor ☎1350","description":"Help with unpaid wages, contracts and workplace injuries. Dial 1350."}}',
   null,'1350',null,null,true),
  ('a3000000-0000-4000-8000-000000000019','a1000000-0000-4000-8000-000000000001','support',
   '{"ko":{"name":"긴급 신고 ☎112","description":"폭력·감금 등 위급한 상황에서는 바로 112에 신고하세요."},"en":{"name":"Emergency ☎112","description":"In danger (violence, confinement), call 112 immediately."}}',
   null,'112',null,null,true),
  ('a3000000-0000-4000-8000-000000000020','a1000000-0000-4000-8000-000000000001','support',
   '{"ko":{"name":"다누리콜센터 ☎1577-1366","description":"폭력 피해·가정 문제를 여러 언어로 24시간 상담합니다."},"en":{"name":"Danuri Helpline ☎1577-1366","description":"24h multilingual help for violence and family issues."}}',
   null,'1577-1366',null,null,true),
  -- 미공개 샘플(admin 전용 가시성 데모)
  ('a3000000-0000-4000-8000-000000000016','a2000000-0000-4000-8000-000000000001','other',
   '{"ko":{"name":"[샘플·미공개] 검수 대기 항목","description":"is_published=false 예시. 공개 전에는 anon/일반 사용자에게 보이지 않고 admin만 볼 수 있다."},"en":{"name":"[Sample·unpublished] Pending review","description":"is_published=false example. Hidden from public until an admin publishes it."}}',
   null,null,null,null,false)
on conflict (id) do nothing;
