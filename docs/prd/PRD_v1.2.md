# PRD v1.2 — 기능 개선 및 데이터 품질 개선

| 항목 | 값 |
|---|---|
| 버전 | 1.2 (Android `versionName 1.2`, `versionCode 3`, 웹 `APP_VERSION '1.2'`, `package.json` 1.2.0) |
| 작성일 | 2026-09-12 |
| 이전 버전 | 1.1 — [PRD_v1.1](PRD_v1.1.md), Git tag `v1.1`(유지), Play 비공개 테스트 `versionCode 2` |
| 결정 기록 | docs/DECISIONS.md D-034(연관 글) · D-035(전국 지역) · D-036(정적 팁) · D-037(충남 실데이터) |
| 검증 기록 | docs/TEST_CHECKLIST.md "v1.2", [RELEASE_v1.2](../releases/RELEASE_v1.2.md) §6 |
| UI 원칙 | Figma/v0 디자인 브랜치와 분리 — 기능 수정에 필요한 최소 UI 변경만(§9) |

## 1. 문제 정의(원인 분석 결과)
1. **정적 농사 도움 정보** — /farm 팁 목록의 출처는 `farm_tips` 테이블 시드 8건(2026-08-28)이 전부였다. 하드코딩 배열·JSON·mock·API 실패 폴백은 없었고, 날씨(koreaConnect)·농촌지도사업(농진청 data.go.kr)만 API 실데이터였다. 8건은 폭염·농약·농기계·하우스 환기·허리·딸기·사과·주간 농사정보 안내 등 반복 가치가 낮은 일반 상식이다.
2. **연관 질문 추천 오류** — 추측이 아니라 라이브 측정으로 확인: OpenAI API 호출은 **없다**. 글 작성 시 Edge Function `embed-post`가 Supabase 내장 gte-small(384차원)로 제목+본문을 임베딩해 `posts.embedding`에 저장하고, 상세 화면은 RPC `similar_posts(source_id, 3)`가 코사인 상위 3건을 **임계값 없이** 돌려준다(공개 글 5건 이상 게이트만). 캐시·mock·하드코딩 추천 없음. 한국어 글끼리 코사인이 0.85~0.95에 몰려 변별력이 없어("몸이 아파요 병원 추천"의 1위가 "일요일 풋살 멤버 구해요" 0.949, 실제 관련 글 "읍내 내과"는 0.928) "풋살" 글이 거의 모든 글의 상위에 걸렸다. 공개 글 10건 중 2건은 임베딩이 없어 후보에도 못 든다.
3. **지역 목록·데이터 부족** — v1.1은 충남 15개 시·군만 `regions`에 넣었고(설계상 의도), 시·도 단계가 없어 전국 목록을 표현할 수 없었다. 예산군은 선택은 됐지만 생활정보가 0건이었다. 홍성(13건)과 나머지 지역의 데이터 격차가 그대로였다.

## 2. v1.2 목표
- 농사 도움: 정적 상식 콘텐츠 제거, API·실데이터 중심, 데이터 없으면 정상 빈 상태(가짜 콘텐츠·정적 폴백 금지).
- 연관 글: 의미적으로 무관한 글이 노출되지 않도록 최소 관련성 기준, 후보 없으면 빈 상태, 외부 API 실패 시 무관한 글 반환 금지, 비밀정보 하드코딩 금지.
- 지역: 전국 시/도 → 시·군·구 선택, 목록과 콘텐츠 분리, 데이터 없는 지역 빈 상태, 우선 지역(홍성·예산·충남)에 출처 확인된 실데이터.
- 버전·문서·롤백 체계 유지.

## 3. 변경 기능
| # | 기능 | 내용 |
|---|---|---|
| 1 | 정적 팁 비공개 | `farm_tips` 8건 `is_published=false`(삭제 아님, 복원 가능). /farm은 날씨·교육·사업 카드가 본문; 지역 없으면 안내(`farm.pickRegionHint`), 지역 있는데 둘 다 없으면 빈 상태(`farm.noRegionalData`); 팁 목록은 실데이터가 생길 때만 렌더. 부제·홈 진입 카드 문구를 실제 내용에 맞춤. |
| 2 | 연관 글 관련성 게이트 | RPC v3: 같은 임베딩 모델끼리 코사인 상위 20 → **gte-small: 코사인 ≥ 0.92 AND 문자 바이그램 자카드 ≥ 0.02** / OpenAI: 코사인 ≥ 0.45 → 상위 3. 바이그램은 pg_trgm 없이 SQL 함수(`private.text_bigrams`, `private.bigram_jaccard` — PostgREST 미노출 스키마, 입력 1500자·단어 40자 상한)로 계산. 후보 0건이면 빈 결과. |
| 3 | 임베딩 모델 기록·선택 | `posts.embedding_model` 컬럼. `embed-post` v2: Supabase secret `OPENAI_API_KEY`가 있으면 `text-embedding-3-small`(dimensions=384), 없으면 gte-small. 실패 시 대체 모델로 섞어 저장하지 않고 502. 키는 코드·저장소에 없음. |
| 4 | 연관 글 빈 상태 | 상세 화면 "비슷한 글" 섹션에 "아직 비슷한 글이 없어요"(ko/en). 로딩·오류 중 숨김. |
| 5 | 전국 지역 구조 | `regions.level`에 `province` 추가, 시·도 16 + 시·군·구 215 추가(카카오 현행 행정구역명, 좌표 포함; 기존 충남 15는 parent만 연결). 선택 화면에 시/도 `<select>` 한 단계, 프로필 편집은 시/도별 optgroup. 농촌지도사업 필터에 시/도 동반·재시도. |
| 6 | 충남 실데이터 | 14개 시·군 공공기관·지역 필수시설 94건(카테고리별 government 15·hospital 26·transport 14·support 22·market 17; 병원에는 민간 종합병원 4건 포함 — 설명에 '민간' 명시), 좌표 94건 전부 확인. 재검수 후 전화 4건·주소 11건·설명 5건 정정. |
| 7 | 버전 | Android 1.2/3, 웹 1.2, package 1.2.0. |
| 8 | 이웃 뷰 키(재검수 P1) | `neighbor_profiles`의 "같은 시·군" 판정을 단계 기반으로 재정의(읍·면→부모 시·군·구, 시·군·구→자기 자신). 시·군·구의 부모가 시·도가 된 뒤에도 범위가 시·도로 넓어지지 않음. 노출 컬럼·권한 동일. |
| 9 | 전화 링크 | 생활정보 상세의 `tel:` 링크는 숫자·`+`만 남겨 발신(표시 문자열은 원문). |

## 4. 영향 범위
- 화면: 지역 선택(시/도 단계), 프로필 편집(지역 목록), 홈 지도(지역 목록만 넓어짐), 생활정보(충남 14 시·군 데이터, 상세 전화 링크 정규화), 게시글 상세(연관 글 게이트·빈 상태), 농사 도움(팁 제거·빈 상태·문구), 내 정보(버전 표기), 이웃 목록(뷰 키 재정의 — 화면 코드 무변경, 범위 동일).
- 헤더·하단 탭·카드·색상 체계·네비게이션은 변경 없음(§9).

## 5. 데이터 변경(Supabase, 2026-09-12~13 라이브 적용)
| 마이그레이션 | 종류 | 내용 | 롤백 |
|---|---|---|---|
| `20260912000000_similar_posts_relevance.sql` | 컬럼 추가 + 함수 교체 | `posts.embedding_model text`, `text_bigrams`, `bigram_jaccard`, `similar_posts` v3(+`lexical` 컬럼) | 이전 함수 정의로 되돌림(20260726000900 파일), 헬퍼 drop. 컬럼은 남겨도 무해 |
| `20260912000100_farm_tips_unpublish_static.sql` | 데이터 갱신 | 8건 `is_published=false` | `set is_published=true where id in (...)` |
| `20260912000200_regions_nationwide.sql` | CHECK 확장(비파괴) + 데이터 추가 | level `province` 허용, 시·도 16·시·군·구 215 insert, 충남 15 parent_id 갱신 | 헤더의 SQL(행 삭제·CHECK 복원) |
| `20260912000300_life_info_chungnam_public.sql` | 데이터 추가 | 생활정보 94건(verified_at 2026-09-12 = 공식 페이지 2회 교차 확인) | `delete ... where verified_at='2026-09-12' and source_url in (...)` |
| `20260912000400_v12_hardening.sql`(재검수 반영, 09-13 적용) | 함수 이동 + 뷰 재정의 + 데이터 정정 | 스키마 `private`에 `text_bigrams`(입력 1500자 상한)·`bigram_jaccard(text[],text[])`, public 헬퍼 drop, `similar_posts` 재생성(원문 바이그램 1회 계산), `neighbor_profiles` 단계 기반 키(security_barrier·grant 재적용), life_info 전화 4·주소 11·설명 5건 정정 | 헬퍼·RPC는 20260912000000 정의 재적용. 뷰는 지역 데이터를 함께 되돌리지 않는 한 복원하지 않음(§13 3-e). 데이터 정정은 되돌리지 않음(정정값이 출처와 일치) |
- 파괴적 변경(drop table/column, 데이터 삭제·덮어쓰기) 없음. 기존 홍성 데이터 무변경.
- 데이터 출처: 지역 = 카카오맵 SDK 지오코딩·역지오코딩 전수 일치(229건 → 카카오 현행 명칭 채택: 전남광주통합특별시, 인천 제물포·영종·검단·서해구). 생활정보 = 시·군청·보건소·공공의료원·코레일·가족센터(familynet)·공식 관광 페이지·기관 사이트를 WebFetch로 직접 읽은 값 → 항목별 독립 재확인 → 좌표 지오코딩 후 시·군 일치 확인. 각 행의 `source_url`이 근거.

## 6. API 변경
- 클라이언트↔Supabase: `similar_posts` 반환에 `lexical` 컬럼 추가(호환), 시그니처 동일. `rural-programs` 호출에 `sido` 파라미터를 함께 보내고 0건이면 접미 제거·시/도 제외 순 재시도(서버 무변경). `weather`·`delete-account`·`rural-programs` Edge Function 무변경.
- `embed-post` v2 배포(verify_jwt=true 유지). 외부 API: OpenAI Embeddings는 **secret이 있을 때만** 호출.

## 7. Supabase 변경 요약 / 재임베딩 절차
- 스키마: `posts.embedding_model`(nullable), `regions_level_check`에 `province`, 스키마 `private`(어휘 헬퍼 2개 — anon/authenticated EXECUTE는 RPC가 SECURITY INVOKER라 필요하지만 PostgREST에 노출되지 않아 직접 호출 불가, `rpc/text_bigrams` → 404). 뷰 `neighbor_profiles` 재정의(단계 기반 키, D-012 절차: security_barrier + revoke-then-grant, authenticated SELECT만). RLS 정책 무변경.
- **OpenAI 키 활성화 전제(D-034)**: OpenAI 경로는 게시글 제목·본문을 미국 OpenAI로 보낸다. secret을 넣기 **전에** 개인정보처리방침 §3에 "OpenAI(임베딩 생성, 미국) — 게시글 제목·본문, 처리위탁·국외 이전" 항목과 개정일·§6 이력을 갱신하고 결정을 D-0xx로 기록한다. 갱신 전에는 키를 넣지 않는다(현재 배포본은 키가 없어 gte-small만 사용).
- 재임베딩(오너, OPENAI_API_KEY 설정 시): 로그인 상태에서 각 글에 대해 `supabase.functions.invoke('embed-post', { body: { post_id } })`를 호출(글 수정 저장으로도 자동 호출됨). 임베딩 없는 기존 글 2건("홍성읍 사과밭에서 인사드려요", "오늘은 의정부왔습니다")도 같은 방법으로 채운다. 모델이 섞여도 RPC는 같은 모델끼리만 비교하므로 오류·오추천은 없다(재임베딩 전까지 해당 글만 후보에서 빠짐).

## 8. Android 영향
- `versionCode 3`, `versionName "1.2"`만 변경. package id·keystore·권한·플러그인 무변경. 웹 번들이 앱에 포함되므로 AAB 재생성 필요(RELEASE_v1.2 §4). v1.1의 알려진 앱 이슈(위치 권한 미선언, WebView 카카오 OAuth)는 그대로.

## 9. UI 변경 범위(Figma/v0 분리 원칙)
최소 변경만: 지역 선택 화면에 native `<select>`(시/도) 1개 추가, 안내 문구 3개, 연관 글 빈 상태 문구 1줄, 농사 도움 부제·빈 상태 박스(기존 `EmptyBox` 재사용), 프로필 편집 optgroup 묶음 기준 변경. 색상·카드·헤더·탭·컴포넌트 구조는 손대지 않았다. Figma/v0 작업과 충돌 가능성이 있는 파일: `src/pages/Select.tsx`, `src/pages/FarmTips.tsx`, `src/pages/BoardPostDetail.tsx`, `src/pages/ProfileEdit.tsx`, `src/pages/LifeInfoDetail.tsx`(tel 링크 1줄), `src/i18n/dictionaries/*.json`(문구 키 추가·변경).

## 10. 테스트 항목
| 항목 | 결과 |
|---|---|
| `npm run build` 성공 · TypeScript 오류 0 · ko/en 패리티 0 | ✅ |
| 기존 로그인(이메일) 정상 — 인증 코드 무변경, 빌드·라우트 무변경 | ✅(코드 검토) |
| Supabase 연결 정상(지역 26→257행 조회, 생활정보·RPC 호출) | ✅ |
| 홍성군 기존 데이터: 읍·면 11, 생활정보 13, 게시글, 지도 핀 | ✅ |
| 예산군 선택 가능 + 생활정보 7건 | ✅ |
| 전국 시/도(16) → 시·군·구 선택: 충남 → 홍성 읍·면+14, 경기도 31, 수원시 선택·저장 | ✅ |
| 데이터 없는 지역(수원시) crash 없음, 가짜 정보 없음, 빈 상태 문구 | ✅ |
| 농사 도움: 정적 팁 8건 미노출(anon 조회 0), 날씨·사업 API 정상(수원시 7건), 부제 갱신 | ✅ |
| 연관 글: "몸이 아파요"→"읍내 내과"만, "임금 체불"·"월급"·"덥네요"→빈 결과, "풋살"→"축구"만(라이브 RPC, anon 역할 포함) | ✅ |
| 연관 글 빈 상태 문구 렌더 | ✅(코드·사전) — 브라우저 실측은 §RELEASE §6 참조 |
| 카카오맵 기능 영향 없음(홈 지도·지오코더·내 위치 코드 무변경) | ✅ |
| `npx cap sync android` 성공 | ✅ |
| 재검수 하드닝(09-13 라이브): public 헬퍼 0·private 2, `rpc/text_bigrams` 404, 5000자 무공백 입력 Temp Written 0, similar_posts anon 3케이스 결과 동일, neighbor_profiles 단계 키·security_barrier·anon 거부, 전화·주소·설명 정정 확인 | ✅ |
| 생활정보 상세 `tel:` 링크 숫자·+만(표시 원문) | ✅(코드·빌드) |

## 11. 알려진 이슈
- gte-small은 한국어 변별력이 낮아 게이트가 보수적이다 — 관련 글이 있어도 어휘가 겹치지 않으면 빈 상태가 나올 수 있다(예: "임금 체불"↔"월급이 안 나와요"). OpenAI 키를 넣으면 완화된다.
- 임베딩 없는 기존 글 2건은 재임베딩 전까지 연관 글이 없다.
- 시·군·구 영문명은 로마자 표기법 기준이며 공식 영문 홈페이지 표기와 다를 수 있다. 지역명은 카카오 현행 데이터(2026-09) 기준 — 행정구역이 바뀌면 이름·좌표 갱신 필요.
- 충남 외 시·군·구는 지역 목록만 있고 콘텐츠는 없다(빈 상태). 광역시 자치구 대부분은 농촌지도사업 카드가 비어 있다(농업기술센터가 광역시 단위).
- 데이터 확충 필요(출처 확인 실패로 미수록): 공주·아산·계룡·부여·서천·태안 등 기차역 전화, 아산시외버스터미널 주소, 합덕역, 부여시장·부여중앙시장 주소, 공주종합버스터미널 주소, 서산·공주·논산 등 외국인근로자지원센터 공식 페이지, 각 시·군 공공 종합병원(없는 곳 다수 — 민간 종합병원만 등재). 상세는 마이그레이션 헤더·워크플로 기록.
- verified_at은 공식 페이지 교차 확인 기준이며 전화 통화 확인이 아니다(D-026). 시청 대표번호 `1422-36`·`1422-42`·`1422-45`는 지역번호 없는 공식 콜센터 번호다.
- 어휘 게이트는 한글·영숫자만 본다 — 베트남어 성조 문자·태국어 등 다른 문자 체계로만 쓴 글은 어휘 점수 0이라 gte-small 경로에서 연관 글이 항상 비어 있다(OpenAI 경로는 어휘 게이트 없음).
- 시·군·구 목록 정렬은 한글 이름 기준이라 영어 UI에서는 알파벳순이 아니다.
- admin 계정은 RLS 예외로 비공개 팁 8건이 /farm에 그대로 보인다(일반·비로그인 사용자는 0건).
- 농사 도움의 날씨·사업 API 실패는 재시도 없이 빈 상태로 표시되며 오류와 구분되지 않는다.
- v1.1 이월: Android 위치 권한, WebView 카카오 OAuth, 카카오맵 앱 도메인, Kakao unlink.

## 12. 롤백 조건
다음 중 하나라도 v1.2 비공개 테스트에서 재현되면 v1.1 기준으로 롤백한다.
- 앱 실행 불가 / 로그인 불가 / 홈 라우팅 오류(무한 리다이렉트, `/home` 도달 불가)
- 기존 홍성군 데이터 접근 불가(읍·면 선택 시 생활정보 13건이 보이지 않음)
- 다른 지역(시/도·시·군·구) 선택 시 crash(ErrorBoundary 화면)
- Supabase query 오류(지역 목록·게시판·생활정보·연관 글 RPC가 오류 박스로 떨어짐)
- 연관 글에 무관한 글이 계속 노출됨(게이트 미동작)

## 13. 롤백 방법(v1.1 코드 기준, versionCode 재증가)
1. **코드**: `git checkout v1.1 -- src public index.html package.json package-lock.json supabase/functions/embed-post` 후 커밋(오너 실행, force push 없음). 또는 `git revert <v1.2 릴리스 커밋>`.
2. **Edge Function**: `embed-post`를 v1.1 파일(`git show v1.1:supabase/functions/embed-post/index.ts`)로 재배포(verify_jwt=true). v1.2 RPC는 `embedding_model`이 null이어도 동작하므로 함수만 되돌려도 안전. OpenAI 키를 넣은 뒤라면 `update posts set embedding=null, embedding_model=null where embedding_model='text-embedding-3-small'` 후 v1.1 함수로 재임베딩(384차원이라 오류는 없지만 모델이 섞이면 코사인이 무의미).
3. **DB(선택, 비파괴 순서)**: (a) `similar_posts`를 20260726000900 정의로 재생성 — v1.1 클라이언트는 `lexical` 컬럼을 쓰지 않으므로 v1.2 함수를 그대로 둬도 동작. (b) 지역: v1.1 클라이언트는 `province` 행을 무시하므로 crash 없이 동작하지만 city 230행을 시/도 구분 없이 모두 그린다(충남 15만 보이려면 데이터 롤백 필요). 완전 복구는 20260912000200 헤더의 롤백 SQL(참조 행 생기면 delete 대신 `is_active=false`). (c) 팁: `update farm_tips set is_published=true where id in (8개)`. (d) 생활정보: `delete from life_info where verified_at='2026-09-12'`(참조 없음, 안전). (e) 하드닝(20260912000400): 헬퍼·RPC는 20260912000000 정의로 재적용 가능. `neighbor_profiles`는 지역 데이터를 (b)로 함께 되돌린 뒤에만 20260726000300 정의로 복원한다 — v1.2 지역 데이터 위에 `coalesce(parent_id,id)` 키를 두면 이웃 범위가 시·도로 넓어진다.
4. **앱**: v1.1 코드로 `npm run build && npx cap sync android`, `android/app/build.gradle`의 `versionCode`를 **4**(현재 3보다 큰 값)로, `versionName`은 `"1.2.1"`처럼 1.2와 구분되는 값으로 올려 AAB 재업로드(`src/config/version.ts`·package.json도 같이). Play는 versionCode를 낮출 수 없다.
5. CHANGELOG에 "[1.2] 롤백 — 사유" 기록, 태그 `v1.2-rolled-back`.
