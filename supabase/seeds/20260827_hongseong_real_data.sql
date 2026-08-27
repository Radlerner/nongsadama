-- 5순위 실데이터 시딩(D-026, 2026-08-27) — 라이브 적용 완료본의 보존 사본.
-- 원칙: 공공·대형 기관만(오류 위험 최소화), verified_at=null(검수 전 표시 → 운영자 검수 후
-- verified_at 갱신), 모든 항목에 공식 source_url. 좌표는 넣지 않음(오좌표 위험 차단 —
-- 읍·면 중심 핀 + "위치 검수 전" 프레임, PRD v1.5 §4).
--
-- 검수 방법: 각 source_url에서 전화·주소 확인 후
--   update life_info set verified_at=now() where id='...';
-- 좌표 추가 시: update life_info set latitude=.., longitude=.. where id='...';

delete from public.life_info where localized_content->'ko'->>'name' like '[샘플%';

insert into public.life_info (category, region_id, localized_content, address, phone, source_url, verified_at, is_published) values
('hospital','a2000000-0000-4000-8000-000000000001',
 '{"ko":{"name":"충청남도 홍성의료원","description":"홍성의 공공 종합병원입니다. 응급실이 있습니다."},"en":{"name":"Hongseong Medical Center","description":"Public general hospital in Hongseong with an emergency room."}}',
 '충남 홍성군 홍성읍 조양로 224','041-630-6114','https://www.hsmc.or.kr/content/64',null,true),
('hospital','a2000000-0000-4000-8000-000000000001',
 '{"ko":{"name":"홍성군보건소","description":"예방접종과 기본 진료를 저렴하게 받을 수 있는 공공 보건소입니다."},"en":{"name":"Hongseong-gun Public Health Center","description":"Public health center offering vaccinations and basic care at low cost."}}',
 '충남 홍성군 홍성읍 문화로 106',null,'https://www.hongseong.go.kr/health/sub01_06.do',null,true),
('market','a2000000-0000-4000-8000-000000000001',
 '{"ko":{"name":"홍성전통시장","description":"홍성읍 중심의 전통시장입니다."},"en":{"name":"Hongseong Traditional Market","description":"Traditional market in central Hongseong-eup."}}',
 '충남 홍성군 홍성읍 대교리 400-1',null,'https://www.hongseong.go.kr/tour/sub04_0102.do',null,true),
('market','a2000000-0000-4000-8000-000000000002',
 '{"ko":{"name":"광천전통시장","description":"젓갈과 김으로 유명한 광천읍의 전통시장입니다."},"en":{"name":"Gwangcheon Traditional Market","description":"Traditional market in Gwangcheon-eup, famous for salted seafood and gim (seaweed)."}}',
 '충남 홍성군 광천읍 광천리 230',null,'https://www.hongseong.go.kr/tour/sub04_0103.do',null,true),
('government','a2000000-0000-4000-8000-000000000001',
 '{"ko":{"name":"홍성군청","description":"군 행정·민원 전반을 처리합니다. 읍·면 행정복지센터 안내도 받을 수 있습니다."},"en":{"name":"Hongseong-gun Office","description":"County office for civil affairs. Can direct you to town/township community centers."}}',
 '충남 홍성군 홍성읍 아문길 27','041-630-1114','https://www.hongseong.go.kr/kor/sub04_0304.do',null,true),
('transport','a2000000-0000-4000-8000-000000000001',
 '{"ko":{"name":"홍성역","description":"장항선 기차역입니다(용산·천안 방면)."},"en":{"name":"Hongseong Station","description":"Train station on the Janghang Line (toward Yongsan/Cheonan)."}}',
 '충남 홍성군 홍성읍 조양로 272','1544-7788','https://ko.wikipedia.org/wiki/%ED%99%8D%EC%84%B1%EC%97%AD',null,true),
('transport','a2000000-0000-4000-8000-000000000002',
 '{"ko":{"name":"광천역","description":"장항선 기차역입니다. 전화는 코레일 고객센터입니다."},"en":{"name":"Gwangcheon Station","description":"Train station on the Janghang Line. Phone is the Korail call center."}}',
 null,'1544-7788','https://ko.wikipedia.org/wiki/%EA%B4%91%EC%B2%9C%EC%97%AD_(%ED%99%8D%EC%84%B1%EA%B5%B0)',null,true),
('transport','a2000000-0000-4000-8000-000000000001',
 '{"ko":{"name":"홍성종합터미널","description":"시외·고속버스 터미널입니다."},"en":{"name":"Hongseong Bus Terminal","description":"Intercity and express bus terminal."}}',
 '충남 홍성군 홍성읍 고암리 1042',null,'https://namu.wiki/w/%ED%99%8D%EC%84%B1%EC%A2%85%ED%95%A9%ED%84%B0%EB%AF%B8%EB%84%90',null,true),
('support','a2000000-0000-4000-8000-000000000003',
 '{"ko":{"name":"홍성군가족센터","description":"다문화가족·외국인 주민을 위한 프로그램과 한국어 교육 상담을 제공합니다."},"en":{"name":"Hongseong-gun Family Center","description":"Programs for multicultural families and foreign residents, including Korean language classes."}}',
 '충남 홍성군 홍북읍 홍학로 48 2층','041-634-7432','https://hongseong.familynet.or.kr/center/index.do',null,true);
