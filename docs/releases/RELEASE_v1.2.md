# RELEASE v1.2 — Google Play 비공개 테스트 업데이트

- 버전: `versionName 1.2` / `versionCode 3` (`android/app/build.gradle`), 웹 `APP_VERSION = '1.2'` (`src/config/version.ts`), `package.json` 1.2.0
- 작성일: 2026-09-12 · 기준 문서: [PRD_v1.2](../prd/PRD_v1.2.md) · 변경 이력: [CHANGELOG](../changelog/CHANGELOG.md) · 이전: [RELEASE_v1.1](RELEASE_v1.1.md)
- 패키지 id: `com.nongsadama.myapp` (불변) · Supabase 프로젝트·인증 구조·법적 페이지 URL·환경변수 이름 불변

## 1. 이번 릴리스에 들어간 것
1. 농사 도움: 정적 상식 콘텐츠 8건 비공개 → 날씨·농촌지도사업(API) 중심, 빈 상태 정리
2. 연관 글: 관련성 게이트(의미+어휘) + 빈 상태, 임베딩 모델 기록, OpenAI 선택 경로
3. 전국 시/도 → 시·군·구 지역 선택(16/230), 충남 14개 시·군 공공기관·지역 필수시설 생활정보 94건(실데이터, 출처 URL 필수)
4. Android 1.2 / versionCode 3
5. 독립 재검수 반영(하드닝): 연관 글 어휘 헬퍼 private 스키마·입력 상한, 이웃 뷰 키 단계 기반 재정의, 생활정보 전화·주소·설명 정정, 전화 링크 정규화

## 2. AAB 재생성 전에 확인할 것
| # | 항목 | 확인 방법 |
|---|---|---|
| 1 | 웹 빌드가 v1.2인지 | `npm run build` 후 `dist/assets/index-*.js`에 `select.provincePlaceholder`·`postDetail.similarEmpty` 문자열 존재 |
| 2 | Capacitor 동기화 | `npx cap sync android` → `android/app/src/main/assets/public/index.html`이 `dist/index.html`과 동일 |
| 3 | 버전 | `android/app/build.gradle` 10~11행 `versionCode 3`, `versionName "1.2"` |
| 4 | 라이브 DB 5개 마이그레이션 적용 상태 | `regions` province 16 / city 230 / town 11, `life_info` 공개 107건(홍성 13 + 충남 94), `farm_tips` 공개 0건, `similar_posts` 함수에 `lexical` 컬럼, 헬퍼는 `private.text_bigrams`만(`public.text_bigrams` 없음, REST `rpc/text_bigrams` 404), `neighbor_profiles` 정의에 `vr.level` 포함 — 2026-09-12~13 적용 완료 |
| 5 | Edge Function | `embed-post` v2 배포(verify_jwt=true). `OPENAI_API_KEY` secret은 **선택이며 전제가 있다** — 넣기 **전에** 개인정보처리방침 §3에 OpenAI(미국) 전송·처리위탁 항목을 갱신(PRD §7, D-034), 넣은 뒤 기존 글 재임베딩. 방침 갱신 전에는 넣지 않는다 |
| 6 | 서명 키·JDK | `nongsadama-release-key.jks`는 저장소 밖. `android/gradle.properties`의 PC 전용 `org.gradle.java.home` 줄은 v1.2 작업 트리에서 제거된 상태(`git diff`에 `-org.gradle.java.home=...` 1줄) — 그대로 커밋하면 저장소에서 사라진다. 로컬 JDK 경로가 필요하면 `~/.gradle/gradle.properties`에 둔다 |
| 7 | 웹 배포 | 웹은 `git push` 시 자동. 앱은 dist 번들이라 AAB 재업로드 필요 |
| 8 | v1.1 항목 | 앱 지도 카카오 타일 확인(`https://localhost` 도메인), 앱 내 카카오 OAuth 미완료 구조(이메일 로그인 안내), 위치 권한 미선언 — RELEASE_v1.1 §2 9·10행과 PRD_v1.1 §12 그대로 |

## 3. Git 커밋·태그(오너가 직접 실행)
```bash
git status
```
```bash
git add README.md package.json package-lock.json src supabase/functions/embed-post/index.ts supabase/migrations/20260912000000_similar_posts_relevance.sql supabase/migrations/20260912000100_farm_tips_unpublish_static.sql supabase/migrations/20260912000200_regions_nationwide.sql supabase/migrations/20260912000300_life_info_chungnam_public.sql supabase/migrations/20260912000400_v12_hardening.sql docs android/app/build.gradle android/gradle.properties
```
```bash
git commit -m "release: NongsaDaMa v1.2"
```
```bash
git tag -a v1.2 -m "NongsaDaMa v1.2 - Play closed test (versionCode 3)"
```
push·force push·reset --hard·branch delete는 오너 승인 전 실행하지 않는다. `v1.1` 태그는 그대로 둔다.

## 4. Google Play 비공개 테스트 v1.2 AAB 재생성·업로드
1. 위 2번 표 확인 → `npm run build` → `npx cap sync android`.
2. Android Studio(또는 `cd android && ./gradlew bundleRelease`)로 서명된 AAB 생성(서명 키는 저장소 밖 경로).
3. Play Console → 테스트 → 비공개 테스트 → 새 버전 만들기 → AAB 업로드 → 버전명 `1.2 (3)` 확인.
4. 출시 노트(아래 §5)를 붙여 저장 → 검토 → 출시 시작.
5. 배포 후 테스터 확인: 시/도 → 시·군·구 선택, 예산군 선택 시 생활정보 7건·지도 핀, 홍성 기존 데이터, 농업 질문 글 상세에서 무관한 연관 글 미노출, 농사 도움에 정적 팁 없음.
6. 문제 시 [PRD_v1.2 §12 롤백 조건·§13 롤백 방법](../prd/PRD_v1.2.md) — 롤백 빌드도 `versionCode 4` 이상, versionName은 1.2와 구분(예: 1.2.1).

## 5. 출시 노트(비공개 테스트용)
**한국어**
농사다마 1.2 업데이트입니다. 전국 시/도와 시·군·구를 고를 수 있게 되었고, 충남 14개 시·군의 청사·보건소·병원·터미널·역·가족센터·시장 정보 94건을 공식 자료에서 확인해 넣었습니다(전화·주소는 각 기관 공식 페이지 기준). 게시판의 비슷한 글은 정말 관련 있는 글만 보여 주고, 없으면 없다고 알려 드립니다. 농사 도움은 오늘 날씨와 우리 지역 교육·사업 정보 중심으로 정리했습니다.

**English**
NongsaDaMa 1.2. You can now choose any province and city/county in Korea, and we added 94 listings for 14 cities and counties in Chungnam (offices, health centers, hospitals, terminals, stations, family centers, markets), each checked against official sources. Related posts now show only truly related ones, or say when there are none. Farm Help focuses on today's weather and local programs.

## 6. 검증 결과(2026-09-12~13, 오너 PC)
- `npm run typecheck` 오류 0, `npm run build` 성공, ko/en 키 패리티 0, `npx cap sync android` 성공 — 상세는 docs/TEST_CHECKLIST.md "v1.2".
- 브라우저(dev): 시/도 16개 드롭다운, 충남 → 홍성군 읍·면 11 + 시·군·구 14, 경기도 → 31, 수원시 선택 → 홈 빈 상태·농사 도움 "수원시 날씨 + 사업 7건", 정적 팁 0.
- 라이브 SQL: `similar_posts('몸이 아파요 병원 추천')` → "읍내 내과"만, `'임금 체불'` → 0건, anon 역할로도 동일. `farm_tips` anon 가시 0건. `regions` 16/230/11, centroid 누락 0.
- 재검수 하드닝(09-13): 4차원 병렬 검수 + 발견별 반박 → 확정 5건(P0 임시파일·노출 1, P1 3, P2 1) 전부 반영, 기각 39건 중 문서·주석·데이터 표현 9건 자발 반영. 적용 후 헬퍼 위치·REST 404·Temp Written 0·RPC 결과 동일·뷰 키·데이터 정정을 라이브에서 재확인(TEST_CHECKLIST "v1.2").
