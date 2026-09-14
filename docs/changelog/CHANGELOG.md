# Changelog

농사다마(NongsaDaMa) 릴리스 변경 이력. [Keep a Changelog](https://keepachangelog.com/ko/1.1.0/)를 단순화한 형식이며,
버전 번호는 Google Play `versionName`·`src/config/version.ts`의 `APP_VERSION`과 같다.
릴리스별 상세는 `docs/prd/PRD_v<버전>.md`(요구·영향·롤백)와 `docs/releases/RELEASE_v<버전>.md`(빌드·업로드 절차)에 있다.

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
