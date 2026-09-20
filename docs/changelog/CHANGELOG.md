# Changelog

농사다마(NongsaDaMa) 릴리스 변경 이력. [Keep a Changelog](https://keepachangelog.com/ko/1.1.0/)를 단순화한 형식이며,
버전 번호는 Google Play `versionName`·`src/config/version.ts`의 `APP_VERSION`과 같다.
릴리스별 상세는 `docs/prd/PRD_v<버전>.md`(요구·영향·롤백)와 `docs/releases/RELEASE_v<버전>.md`(빌드·업로드 절차)에 있다.

## [1.3] - 2026-09-20

[PR #1](https://github.com/Radlerner/nongsadama/pull/1) 병합분(STT 프록시·국가 기본 언어·Android 카카오 콜백)의 공식 릴리스.
PR 본문의 "v1.4" 표기는 릴리스 버전이 아니며 이 병합본의 릴리스 버전은 1.3이다.
운영 설정(Supabase secret·Redirect URL·`VITE_STT_ENDPOINT`)이 끝나야 실제로 동작하는 항목이 있다 — RELEASE_v1.3 §3.

### Added
- 음성 인식(STT) Edge Function `stt`: 로그인 사용자(익명 로그인 제외)만 호출. multipart `file`(WebM, 1 MiB 이하) + `language` → `{"text": ...}`. OpenAI `audio/transcriptions`로 중계하는 프록시이며 음성·인식 결과를 저장하거나 로그에 남기지 않는다.
- 사용자별 STT 호출 횟수 제한: 테이블 `stt_rate_windows` + RPC `stt_try_consume`(service_role 전용, 고정 시간 구간). 허용 횟수·구간은 Supabase secret `STT_RATE_LIMIT_MAX`·`STT_RATE_LIMIT_WINDOW_SECONDS`가 정하고, 없거나 잘못되면 호출을 500으로 막는다. 초과 시 429.
- 국가/기본 언어 구조: `countries` 테이블 7개국 시드(KR·VN·KH·TH·NP·MN·UZ — 기본 언어·지원 언어 코드), `profiles.preferred_locale_explicit` 컬럼, 트리거 `profiles_apply_country_locale`. 언어를 직접 고르지 않은 프로필에만 국적 기본 언어(없으면 `en`)를 채우고, 기존 프로필은 `true`로 보호한다. 클라이언트는 아직 `countries`를 읽지 않으며 프로필의 국가 입력은 자유 입력 그대로다.
- Android 카카오 OAuth 콜백: 딥링크 `com.nongsadama.myapp://auth/callback`(AndroidManifest intent-filter). 앱에서는 시스템 브라우저로 동의 화면을 열고, 앱으로 돌아오면 PKCE 코드를 세션으로 교환한 뒤 홈으로 이동한다. 실패하면 로그인 화면에 오류를 표시한다.
- Capacitor 플러그인 `@capacitor/app` 8.1.1, `@capacitor/browser` 8.0.4.
- Android 권한 `RECORD_AUDIO`, `MODIFY_AUDIO_SETTINGS`(음성 입력용).
- 외부 STT 사용 시 음성 입력 고지 문구 `talk.micNoticeExternal`(ko/en).
- 테스트(`node --test`, 세 파일 합계 15건): `tests/client-integration.test.mjs`, `supabase/functions/stt/*.test.ts`. SQL 검증 스크립트 `supabase/tests/stt_and_countries.sql`·`supabase/tests/preflight_stt_and_countries.sql`. npm script·CI에는 연결돼 있지 않다(수동 실행).

### Changed
- 클라이언트 STT 호출이 정적 키 대신 로그인 세션 access token을 Bearer로 보낸다. 비로그인 상태면 요청을 만들지 않는다. 45초 타임아웃, 응답 형식 검증, 녹음 MIME 협상(`audio/webm;codecs=opus` → `audio/webm`).
- 인증 클라이언트 옵션: 네이티브 앱에서만 PKCE(`flowType: 'pkce'`, `detectSessionInUrl: false`). 웹 로그인 흐름은 그대로다.
- 프로필 생성·수정: 사용자가 언어를 직접 고른 경우에만 `preferred_locale`을 보내고(`preferred_locale_explicit = true`), 로그인 상태에서 언어를 바꾸면 프로필에 반영한다. 프로필 저장은 upsert 대신 update/insert로 나뉜다.
- v1.2 대비 동작 변화(신규 사용자): 언어를 한 번도 직접 고르지 않고(기본 한국어 화면 그대로) 가입하면 프로필 언어가 v1.2의 `ko`(당시 UI 언어) 대신 `en`으로 기록된다(가입 시점에는 국적 값이 없다). 이 상태에서 국적을 비우거나 `countries`에 없는 코드로 프로필을 저장하면 저장된 `en`이 앱 언어로 반영돼 UI가 영어로 바뀔 수 있다(국적 KR이면 `ko`). 코드 분석 기준이며 미실측이다 — PRD_v1.3 §4·§11. 기존 프로필은 영향 없음.
- GitHub Pages(보조 배포) 워크플로 `deploy-pages.yml`이 저장소 Variable `VITE_STT_ENDPOINT`를 빌드에 주입한다(비어 있으면 브라우저 Web Speech 사용). 공식 `nongsadama.app`은 Cloudflare 빌드라 이 워크플로와 무관하며 Cloudflare 빌드 변수에 따로 등록해야 한다 — RELEASE_v1.3 §3. 엔드포인트를 켜면 음성 입력은 로그인 사용자 전용이 된다.
- `capacitor.config.ts` `loggingBehavior: 'none'`. 루트 `.gitignore`에 Supabase CLI 로컬 상태(`supabase/.temp/`)·에이전트 도구 폴더 추가, `android/.gitignore`의 키스토어 패턴(`*.jks`·`*.keystore`) 주석 해제(루트 `.gitignore`에는 이전부터 있음).
- Android `versionName 1.3` / `versionCode 4`, `package.json` 1.3.0.
- 배포용 빌드는 Supabase·STT 필수 환경변수가 없으면 실패해 브라우저 음성 입력으로 조용히 대체된 릴리스가 배포되지 않게 한다.
- Kakao Maps JavaScript 키는 공개 읽기 전용 Supabase `map_config`에서 실행 중에 가져오며 `VITE_KAKAO_MAP_KEY`는 선택적 폴백으로 유지한다.

### Fixed
- 로그인 전에 직접 고른 언어가 기존 계정 프로필에 저장되지 않던 문제.

### Removed
- `VITE_STT_KEY` 환경변수(정적 STT 키를 클라이언트 번들에 싣던 경로). OpenAI 키는 저장소·번들에 없고 Supabase secret에만 둔다.

## [1.2] - 2026-09-12

### Added
- 전국 지역 선택: 시/도 16개 → 시·군·구 230개(카카오 현행 행정구역명 기준, 좌표 포함). 지역 목록과 지역 콘텐츠는 분리 — 데이터 없는 지역은 빈 상태.
- 충남 14개 시·군 공공기관 생활정보 94건(청사·보건소·공공의료원·터미널·역·가족센터·외국인지원·전통시장). 공식 페이지 2회 교차 확인 항목만, 출처 URL 필수.
- 연관 글: 임베딩 모델 기록(`embedding_model`), OpenAI `text-embedding-3-small` 선택 경로(Supabase secret `OPENAI_API_KEY`가 있을 때만), 후보 없을 때 "아직 비슷한 글이 없어요" 빈 상태.
- 농사 도움: 지역이 없을 때 안내, 날씨·교육 정보 둘 다 없을 때 빈 상태.

### Changed
- 연관 글 추천에 관련성 게이트 적용 — 의미(코사인) + 어휘(문자 바이그램) 이중 근거를 통과한 글만 표시. 무관한 글을 억지로 채우지 않음.
- 지역 선택 화면에 시/도 드롭다운 한 단계 추가, 프로필 편집 지역 목록을 시/도별로 묶음.
- 농촌지도사업 조회에 시/도를 함께 보내 동명 시·군(고성군 등)을 구분하고, 0건이면 접미 제거·시/도 제외 순으로 재시도.
- Android `versionName 1.2` / `versionCode 3`, `package.json` 1.2.0.

### Removed
- 정적 농사 상식 콘텐츠 8건(폭염·농약·농기계·하우스 환기·허리·딸기·사과·주간 농사정보 안내)을 비공개 처리 — API·실데이터 기반 정보만 노출.

### Fixed
- 농업 질문에 "풋살 멤버 구해요" 같은 무관한 글이 연관 글로 반복 노출되던 문제(임계값 없는 상위 3건 반환이 원인).
- 충남 외 시/도의 시·군·구를 고를 수 없던 문제(v1.1은 충남 15개 시·군만 제공).
- 이웃 목록 범위 키가 시·도 도입 후 "같은 시/도"로 넓어질 수 있던 문제 — 단계 기반 키로 재정의(같은 시·군·구 유지).
- 연관 글 어휘 헬퍼가 공개 스키마에 노출되고 긴 무공백 입력에서 임시파일이 폭증하던 문제 — private 스키마 이동·입력 상한.
- 충남 생활정보 전화 4건(범위·접미·잘못된 지역번호)·주소 11건(시·군 누락) 정정, 민간 병원 4건 '민간' 명시.

## [1.1] - 2026-09-10

### Added
- 서비스 지역 확대: 충청남도 14개 시·군을 `regions` 데이터로 추가(홍성군 포함 15개). 읍·면이 아직 없는 시·군은 시·군 단위로 선택.
- 지역 선택 화면에 "시·군 단위로 고르기" 묶음(접힘식), 이웃 화면에 "내 지역 정하기" 안내(프로필 지역 없을 때).
- 웹앱 버전 상수 `src/config/version.ts`(`APP_VERSION = '1.1'`), 내 정보 하단에 버전 표기.
- 릴리스 문서 체계: `docs/prd/`, `docs/changelog/`, `docs/releases/`.

### Changed
- Header brand text standardized to NongsaDaMa (모든 사용자 노출 영문 표기 통일; URL·패키지 id 등 식별자는 그대로).
- Header logo now navigates to home (`/home`, react-router Link, 44px 터치·aria-label).
- Region-specific logic generalized beyond Hongseong: 지도 중심 폴백을 홍성 좌표 상수에서 설정값(`regionConfig`, 전역 보기)으로, 지역 목록 결정적 정렬, 시·군 이름 조회를 공용 헬퍼로.
- "내 주변 지역 찾기"가 30km 밖이면 가장 가까운 지역을 자동 선택하지 않고 안내만 한다.
- Android `versionName 1.1` / `versionCode 2`, `package.json` 1.1.0.

### Fixed
- Fixed issue where services did not operate correctly outside Hongseong (지역 데이터가 홍성군 1개뿐이어서 다른 시·군을 고를 수 없던 문제).
- Improved empty-state handling for unsupported regions: 지도 핀 0건·이웃 지역 미설정을 오류가 아닌 안내로 표시.
- 비활성·삭제된 지역 id가 저장돼 있을 때 조용히 전체 범위로 바뀌던 동작을 앱 셸에서 정리.
- 시·군 단위 지역의 주소 없는 생활정보(병원·마트 등)가 지도에서 빠지던 규칙을 데이터 속성 기준으로 수정(전화 전용 핫라인만 제외).
- "내 위치"에서 카카오 지오코더가 '천안시 동남구'처럼 구까지 주면 농촌지도사업 카드가 비던 문제(시·군 첫 토큰만 사용).
- '읍·면 단위' 전제 안내 문구를 '읍·면 또는 시·군'으로 일반화(개인정보처리방침·계정 삭제 안내·이웃 안내).

## [1.0] - 2026-09-09

- Google Play 비공개 테스트 최초 버전(`versionCode 1`). 기능 범위는 `docs/prd/PRD_v1.0.md` 참고.
