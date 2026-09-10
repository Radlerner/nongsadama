# Changelog

농사다마(NongsaDaMa) 릴리스 변경 이력. [Keep a Changelog](https://keepachangelog.com/ko/1.1.0/)를 단순화한 형식이며,
버전 번호는 Google Play `versionName`·`src/config/version.ts`의 `APP_VERSION`과 같다.
릴리스별 상세는 `docs/prd/PRD_v<버전>.md`(요구·영향·롤백)와 `docs/releases/RELEASE_v<버전>.md`(빌드·업로드 절차)에 있다.

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
