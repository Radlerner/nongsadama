# PRD v1.0 — Google Play 비공개 테스트 최초 버전(기준선)

> 이 문서는 **사후 정리본**이다. v1.0은 릴리스 PRD 없이 출시됐으므로, 2026-09-10 시점의 코드·마이그레이션·
> `docs/DECISIONS.md`(D-001~D-032)·`docs/TEST_CHECKLIST.md`를 근거로 "무엇이 들어 있었는가"를 복원했다.
> 이후 버전은 출시 전에 릴리스 PRD를 쓴다(v1.1부터). 제품 스펙 반복본(루트 `PRD_v1_1.md`~`PRD_v1_7.md`)은
> 기능 설계 문서이며 이 릴리스 축과 번호가 다르다.

| 항목 | 값 |
|---|---|
| 버전 | 1.0 (Android `versionName 1.0`, `versionCode 1`, 패키지 `com.nongsadama.myapp`) |
| 작성일 | 2026-09-10 (기준 코드: 커밋 `2183579`, 웹 배포 nongsadama.app) |
| 상태 | Google Play 비공개 테스트 진행 중 |
| 다음 버전 | [PRD_v1.1](PRD_v1.1.md) |

## 1. 제품 요약
농촌에서 일하는 외국인 계절근로자가 **자신의 언어로** 지역 생활정보(병원·마트·행정·교통·상담)를 지도와 목록으로 찾고,
지역 게시판에서 묻고, 같은 시·군의 이웃과 연결되며, 농업 안전·작목 팁과 오늘 날씨·농촌지도사업 정보를 한 앱에서 보는
모바일 우선 웹앱. 웹(nongsadama.app, GitHub Pages 미러)과 Capacitor Android 래퍼로 제공.
읽기(생활정보·게시판·지도·농사 도움)는 로그인 없이 가능하고, 쓰기·이웃·프로필만 로그인이 필요하다.

## 2. 대상 사용자
- 1차: 충청남도 홍성군(파일럿)에서 일하는 외국인 계절근로자. 한국어가 서툴고 스마트폰은 익숙함.
- 2차: 고용주·지역 기관 담당자(정보 등록은 운영자 검수 경로).
- 설계 원칙: "10세도 쓸 수 있게" — 큰 터치(44px+), 아이콘+색 이중 부호화, 짧은 해요체 문장, 음성 입력.

## 3. 기능 인벤토리(영역별)
| 영역 | 기능 | 라우트 | 핵심 파일 | 상태 |
|---|---|---|---|---|
| 온보딩 | 랜딩(로고·기능 3칩·언어 전환), 언어·지역 선택(위치 기반 추천) | `/`, `/select` | Landing.tsx, Select.tsx, SelectedRegionContext | 완료 |
| 인증 | 이메일+비밀번호 가입/로그인, 카카오 간편로그인(접힌 보조), 프로필 자동 생성 | `/login` | Login.tsx, AuthContext.tsx | 완료(카카오 account_email 동의항목은 비즈앱 승인 대기) |
| 홈(지도) | 카카오맵(키 있으면)/Leaflet 폴백, 카테고리 타일 필터, 실좌표 핀·읍면 묶음 핀, 내 위치·가장 가까운 서비스 지역 안내, 공유 버튼 | `/home` | MapHome.tsx, lib/kakaoMap.ts, lib/geo.ts | 완료 |
| 생활정보 | 목록(카테고리·신선도 배지)·상세(전화·주소·출처), 운영자 검수 데이터 | `/life-info`, `/life-info/:id` | LifeInfo.tsx, LifeInfoDetail.tsx, hooks/useLifeInfo.ts | 완료(홍성 실데이터 13건) |
| 게시판 | 지역 게시글 목록·상세·작성·수정·삭제, 카테고리, 공개 경고 동의, 비슷한 글 추천(임베딩), 신고·차단 | `/board`, `/board/new`, `/board/:id`, `/board/:id/edit` | Board.tsx, PostForm.tsx, BoardPostDetail.tsx, hooks/usePosts.ts, useModeration.ts | 완료 |
| 말하기 | 4택 고민 라우터 + 음성 입력(Web Speech, 동의 안내) + 읽어주기, 안전 전화 3종 | `/talk` | Talk.tsx | 완료 |
| 이웃 | 상호 공개(opt-in) 사용자끼리 같은 시·군 이웃 목록, 매칭 점수(언어·작목·국적·거리), 차단 반영 | `/neighbors` | Neighbors.tsx, hooks/useNeighbors.ts, lib/matching.ts | 완료 |
| 농사 도움 | 농업 안전·작목 팁 목록/상세, 오늘 날씨(위치 기반), 우리 지역 농촌지도사업(농진청) | `/farm`, `/farm/:tipId` | FarmTips.tsx, FarmTipDetail.tsx, hooks/useRegionalInfo.ts | 완료(팁 8건 큐레이션) |
| 내 정보 | 프로필 보기·편집(언어·지역·국적·작목·공개 동의), 로그아웃, 계정 삭제(2단계), 차단 목록 | `/profile`, `/profile/edit` | Profile.tsx, ProfileEdit.tsx | 완료 |
| 법적 페이지 | 개인정보처리방침, 계정 삭제 안내, 아동 안전 표준(모두 공개·한/영) | `/privacy`, `/delete-account`, `/child-safety` | Privacy.tsx, DeleteAccount.tsx, ChildSafety.tsx | 완료(Play 제출 URL) |
| 공통 | 하단 5탭(lucide 아이콘), 언어 스위처, 오프라인 배너, 오류 경계, PWA(manifest·SW), SEO/GEO(robots·llms.txt·JSON-LD), GA4·Clarity | — | AppLayout.tsx, BottomNav.tsx, ErrorBoundary.tsx, public/* | 완료 |

## 4. 라우트 전체
`/`, `/select`, `/login`, `/privacy`, `/delete-account`, `/child-safety`, `/home`, `/board`, `/board/new`, `/board/:postId`, `/board/:postId/edit`,
`/life-info`, `/life-info/:infoId`, `/farm`, `/farm/:tipId`, `/profile`, `/profile/edit`, `/neighbors`, `/talk`, `/index.html`→`/`, `*`(404).
`/privacy`·`/delete-account`·`/child-safety`는 AppLayout 밖 독립 라우트(인증·지역 무관).

## 5. 데이터·서버
- **DB(Supabase Postgres, 서울 리전, RLS 전면)**: `regions`(시군 city·읍면 town, names jsonb, centroid), `profiles`(+`public_profiles` 뷰, `neighbor_profiles` 뷰),
  `posts`(embedding pgvector), `life_info`, `reports`, `blocks`, `farm_tips`, `api_keys`·`api_cache`(service_role 전용 비밀 저장소).
- **RPC/함수**: `similar_posts(source_id, match_count)`(pgvector 코사인, 공개 글 5건 이상일 때만, 지역 무관 전국), `is_admin()`(SECURITY DEFINER, search_path 고정), `is_matching_opted_in()`(authenticated만), role 승격 방지 트리거, 소프트 삭제(status=deleted) 규칙.
- **Edge Functions**: `embed-post`(gte-small 384차원 임베딩), `delete-account`(본인 JWT만, cascade 삭제), `weather`(koreaConnect MCP 프록시, 0.1° 반올림, 한국 bbox, 30분 캐시),
  `rural-programs`(data.go.kr 농촌지도사업, 24h 캐시).
- **마이그레이션**: `20260726000000_initial_schema` ~ `20260828001000_api_infra`(10개). 시드: `supabase/seed.sql`(홍성군+읍·면 11, 샘플), `seeds/20260827_hongseong_real_data.sql`(실데이터 9기관).
- **v1.0 지역 데이터 상태**: regions = 홍성군 1 city + 11 town(모두 centroid). 다른 시·군 없음 → v1.1에서 확장.

## 6. 제3자 서비스
Supabase(Auth·DB·Edge Functions), 카카오(지도 SDK+services, 간편로그인), OpenStreetMap(폴백 타일), koreaConnect MCP(날씨), 농촌진흥청 data.go.kr(농촌지도사업),
Google Analytics 4, Microsoft Clarity, AddToAny(공유), 브라우저 Web Speech(음성), Cloudflare Workers(nongsadama.app)·GitHub Pages(미러 배포).

## 7. 설정·환경변수(이름만)
`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_KAKAO_MAP_KEY`(선택), `VITE_GA_MEASUREMENT_ID`(선택), `VITE_STT_ENDPOINT`·`VITE_STT_KEY`(선택), 빌드 `BASE_PATH`(GH Pages 전용).
서버 비밀(data.go.kr 키, koreaConnect 키)은 `api_keys` 테이블(RLS 잠금)에만 있고 저장소·클라이언트에 없다.
앱 설정: `src/config/app.ts`(지원 언어·기본 언어·OAuth 제공자·연락처·공식 주소).

## 8. 비기능 원칙
- 국가·언어 비종속: locale은 설정 데이터, 코드 분기 금지. ko/en 사전 키 패리티 유지(법적 페이지만 정적 병기 예외, D-020).
- 개인정보 최소화: 전화·정확한 위치·실명 미수집, 좌표는 조회 시 0.1° 반올림, 이웃은 상호 공개만.
- 보안: anon 키만 클라이언트, RLS 전면, service_role은 Edge Function 전용, 비밀은 DB 잠금 테이블.
- 접근성·디자인: DESIGN.md v1(크림 그라운드·알약 CTA·lucide 아이콘·44px 터치·해요체).
- 배포: push 시 자동(Cloudflare Workers + GH Pages), PWA SW `nongsadama-v2`(내비게이션 network-first).
- 검수 루프: 구현 → typecheck/build → 브라우저 실측 → 독립 재검수(적대적 검증) → P0/P1/P2 반영 → DECISIONS·TEST_CHECKLIST 기록.

## 9. 알려진 이슈(v1.0 기준)
- 지역 데이터가 홍성군뿐이라 다른 시·군 사용자는 지역을 고를 수 없고, "내 주변 지역 찾기"가 먼 거리에서도 홍성 읍·면을 자동 선택함(→ v1.1).
- 좌측 상단 로고가 홈 링크가 아님(→ v1.1). 영문 브랜드 표기 `NongsaDama`/`NongsaDaMa` 혼재(→ v1.1).
- Android 매니페스트에 위치 권한이 없어 앱에서 "내 위치"가 실패(웹은 정상).
- 카카오 로그인 `account_email` 동의항목은 카카오 비즈앱 전환·심사 후 동작.
- 계정 삭제 시 카카오 측 연결 끊기(unlink)는 호출하지 않음(문구로 고지, Admin 키 필요).
- 비슷한 글 추천은 전국 단위이고 gte-small의 한국어 변별력이 낮아 품질 게이트가 실질 1~2/3(공급자 결정 오너 대기). 지역 미선택 시 목록은 전체 범위(라벨 없음).
- 생활정보 13건·농사 팁 8건 모두 `verified_at`이 없어 "검수 확인일 없음" 배지가 뜨고, 좌표 미입력이라 지도는 읍·면 중심 묶음 핀만 보인다(오너 검수·좌표 입력 대기, D-026).
- admin 계정이 0명이라 신고(reports) 검토와 앱 밖 생활정보·팁 입력이 불가(대시보드 SQL로 승격 필요).
- Supabase 인증 설정(Confirm email OFF·Leaked Password Protection ON)이 체크리스트에 미완으로 남아 있음.
- 문서 정합: D-023은 TWA(assetlinks)를 전제했으나 실제 패키징은 Capacitor(dist 번들, 웹 배포가 앱에 자동 반영되지 않음). README는 v0.1.0·4탭 기준으로 구버전(v1.1에서 버전 줄만 갱신). `.env.example`의 카카오 도메인 안내에 nongsadama.app 누락. DECISIONS 번호 D-018 결번.
- npm audit 4건(vite/esbuild dev 전용 high, react-router moderate) 수용·추적 중. 자동 회귀 테스트 없음(수동 체크리스트).
- 죽은 코드: `src/lib/categories.ts`의 이모지 아이콘 상수, `src/components/PagePlaceholder.tsx`.
- Web Speech 미지원 WebView에서는 말하기 화면의 마이크 카드가 숨겨지고 4택만 제공(외부 STT 미설정).
- 만 14세 미만 정책(PRD v1.5 §10-I) 미결. Play Data safety 양식·스토어 스크린샷·설명문·테스터 20명 모집 진행 중.

## 10. 오너 대기 작업(2026-09-10)
카카오 비즈앱 전환+account_email 동의항목 승인(→ 실계정 왕복 테스트), 카카오 Admin 키(unlink), dmkim@nongsadama.app 수신 테스트, 운영자 admin 승격 SQL + 신고 점검 루틴,
농사로 OpenAPI 키, Supabase 인증 설정 확정, 생활정보·팁 `verified_at`/좌표 입력, 서명 키 저장소 밖 이동, Play Console(Data safety·스크린샷·테스터 초대),
파일럿 검증 언어 확정·번역 검수자, 임베딩 공급자 결정, Bing/IndexNow 등록, 외부 STT 운영 여부.

## 11. 결정 색인(docs/DECISIONS.md)
- D-001 `/select` 골격 우선 · D-002 defaultLocale 임시 `ko` · D-003 국가·언어 비종속 · D-004 anon 키만 지연 생성 · D-005 ENUM 대신 text+CHECK
- D-006 profiles 본인만·`public_profiles` 뷰 · D-007 posts 소프트·하드 삭제 병행 · D-008 admin SECURITY DEFINER+트리거 · D-009 로컬 DB 부재 · D-010 보안 어드바이저 대응 · D-011 마이그레이션 경로·버전 정합
- D-012 이웃 매칭 노출 모델 · D-013 우선순위·신선도 · D-014 기본 인증 이메일 · D-015 지도·음성 방향 전환 롤백 분석 · D-016 공식 주소+Clarity · D-017 GEO 정책(AI 크롤러 차단)
- D-019 카카오 간편로그인 · D-020 개인정보처리방침 · D-021 앱 내 계정 삭제 · D-022 신고·차단 · D-023 PWA · D-024 오류 경계+오프라인 · D-025 디자인 v0 · D-026 생활정보 실데이터
- D-027 농사 도움(farm_tips) · D-028 외부 실데이터 3종(위치·농진청·날씨) · D-029 디자인 v1 전면 개편 · D-030 `/delete-account` · D-031 `/child-safety` · D-032 법적 페이지 재검수 반영
