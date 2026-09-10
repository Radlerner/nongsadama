# RELEASE v1.1 — Google Play 비공개 테스트 업데이트

- 버전: `versionName 1.1` / `versionCode 2` (`android/app/build.gradle`), 웹 `APP_VERSION = '1.1'` (`src/config/version.ts`), `package.json` 1.1.0
- 작성일: 2026-09-10 · 기준 문서: [PRD_v1.1](../prd/PRD_v1.1.md) · 변경 이력: [CHANGELOG](../changelog/CHANGELOG.md)
- 패키지 id: `com.nongsadama.myapp` (불변)

## 1. 이번 릴리스에 들어간 것
1. 좌측 상단 로고·브랜드 클릭 → 홈(`/home`) 이동
2. 사용자 노출 브랜드명 NongsaDaMa 통일
3. 홍성군 종속 제거·충남 15개 시·군으로 지역 확대(데이터 기반)
4. 데이터 없는 지역의 빈 상태 처리
5. Android 1.1 / versionCode 2

## 2. AAB 재생성 전에 확인할 것
| # | 항목 | 확인 방법 |
|---|---|---|
| 1 | 웹 빌드가 v1.1인지 | `npm run build` 후 `dist/assets/index-*.js`에 `NongsaDaMa`·`select.geoFar` 문자열 존재 |
| 2 | Capacitor 동기화 | `npx cap sync android` → `android/app/src/main/assets/public/index.html`이 `dist/index.html`과 같은 크기·시각 |
| 3 | 버전 | `android/app/build.gradle` 10~11행 `versionCode 2`, `versionName "1.1"` (Play는 versionCode가 이전 업로드보다 커야 받는다) |
| 4 | 서명 키 | `nongsadama-release-key.jks`는 저장소 밖에 보관(.gitignore에 `*.jks` 있음). Play App Signing에 등록된 업로드 키와 같은 키인지 |
| 5 | 기기 고유 설정 | `android/gradle.properties`의 `org.gradle.java.home=C:/Users/.../.jdks/jbr-21.0.11`은 이 PC 전용 — 다른 PC·CI에서 빌드하려면 제거하고 `JAVA_HOME`(JDK 21) 사용 |
| 6 | 위치 권한(선택) | `AndroidManifest.xml`에 `ACCESS_COARSE_LOCATION`이 없어 앱에서 "내 위치" 버튼이 항상 실패한다(v1.0부터 동일). 추가하려면 Play Console **데이터 보안** 양식의 위치 항목도 함께 갱신해야 하므로 이번 1.1에는 넣지 않았다 |
| 7 | 라이브 DB | `regions`에 city 15행(충남)·town 11행(홍성)이 있고 모두 centroid가 있다 — 2026-09-10 적용 완료(`supabase/migrations/20260910000000_regions_chungnam.sql`) |
| 8 | 웹 배포 | 웹(nongsadama.app)은 `git push` 시 자동 배포. 앱 번들은 로컬 dist를 싣는 방식이라 **웹 배포만으로는 앱이 갱신되지 않는다** — AAB 재업로드 필요 |
| 9 | 앱 지도 제공자 | 실기기/에뮬레이터에서 앱 홈 지도가 카카오 타일인지 1회 확인. OSM으로 뜨면 developers.kakao.com → 앱 → 플랫폼 → Web 사이트 도메인에 `https://localhost` 추가(WebView origin) |
| 10 | 앱 카카오 로그인 | 앱(WebView)에서는 카카오 OAuth가 시스템 브라우저로 나갔다가 `https://localhost/`로 돌아오지 못한다(v1.0부터). 테스터 안내는 이메일 로그인 우선. 수정은 다음 버전(PRD §12) |

## 3. Git 커밋·태그(오너가 직접 실행)
```bash
git status
```
권장은 **Android 프로젝트 전체를 함께 커밋**하는 것이다(빌드 재현 가능한 저장소 — `build.gradle` 한 파일만 넣으면 반쪽 프로젝트가 남는다). 그 전에 두 가지만 정리한다:
```bash
grep -n "org.gradle.java.home" android/gradle.properties
```
위 줄(이 PC 전용 JDK 경로)은 `android/gradle.properties`에서 지우고 `%USERPROFILE%\.gradle\gradle.properties`로 옮긴다. 그리고 `android/.gitignore`에 `app/release/` 한 줄을 추가한다(Android Studio 부산물 제외). 그 뒤:
```bash
git add README.md index.html package.json package-lock.json public/llms.txt src supabase/migrations/20260910000000_regions_chungnam.sql docs capacitor.config.ts android
```
`git add -A`를 써도 결과는 같다(`*.jks`·`keystore.properties`·`android/app/build/`·`.gradle/`·`local.properties`·`assets/public/`은 .gitignore로 제외). 커밋 전 `git status --short`로 `nongsadama-release-key.jks`가 목록에 없는지 확인한다.
```bash
git commit -m "release: NongsaDaMa v1.1"
```
```bash
git tag -a v1.1 -m "NongsaDaMa v1.1 — Play closed test (versionCode 2)"
```
v1.0 기준선 태그가 아직 없으므로, 롤백 대상을 남기려면 v1.1 커밋 **이전** 커밋에 먼저 태그를 단다:
```bash
git tag -a v1.0 2183579 -m "NongsaDaMa v1.0 baseline (web state before v1.1 work; Play versionCode 1)"
```
푸시(`git push origin main --tags`)는 오너 판단으로 실행한다. 이 문서의 어떤 단계도 자동으로 push·reset·force 하지 않는다.

## 4. Google Play 비공개 테스트 1.1 업로드 절차
1. 위 2번 표를 모두 확인한 뒤 Android Studio(또는 `cd android && ./gradlew bundleRelease`)로 **서명된 AAB**를 만든다. 서명 키는 저장소 밖 경로를 지정한다.
2. Play Console → 앱 → **테스트 → 비공개 테스트** → 기존 트랙 선택 → **새 버전 만들기**.
3. AAB 업로드 → 버전 이름이 `1.1 (2)`로 보이는지 확인.
4. 출시 노트(ko/en)는 CHANGELOG의 [1.1] 항목을 요약해 붙인다. 예:
   - ko: 로고를 누르면 홈으로 이동합니다. 충남 15개 시·군을 고를 수 있고, 정보가 없는 지역은 빈 화면 대신 안내가 나옵니다.
   - en: Tap the logo to go home. Choose any of 15 cities and counties in Chungnam; areas without data now show a clear notice.
5. **저장 → 버전 검토 → 비공개 테스트 트랙으로 출시 시작**. 심사(보통 수 시간~수 일) 후 테스터에게 자동 배포된다.
6. 배포 후 테스터 확인 항목: 앱 실행·로그인·로고 홈 이동·`/select`에서 "다른 시·군" 표시·홍성 외 시·군 선택 시 지도 중심과 빈 상태·내 정보 하단 `v1.1` 표기.
7. 문제 시 [PRD_v1.1 §12 롤백](../prd/PRD_v1.1.md)을 따른다. Play는 versionCode를 낮출 수 없으므로 롤백 빌드도 `versionCode 3` 이상으로 올려 업로드한다.

## 5. 검증 결과(2026-09-10, 오너 PC)
- `npm run typecheck` 오류 0, `npm run build` 성공, i18n ko/en 키 패리티·플레이스홀더 불일치 0.
- `npx cap sync android` 성공(dist → android assets 동기화 확인).
- 브라우저(dev 서버) 실측: 로고 클릭 SPA 홈 이동, 지역 선택 "홍성군(읍·면 11) + 다른 시·군(14)", 서울 좌표에서 자동 선택 없음(당진시 81km 안내), 예산 좌표에서 예산군 자동 선택, 예산군 홈 지도 중심·핀 0·빈 상태 문구, 게시판·생활정보 빈 상태(오류 0), 농사 화면 날씨 "예산군"·농촌지도사업 23건, 홍성읍 복귀 시 핀·생활정보 13건·게시글 10건·홍성군 날씨/34건 그대로, 모바일(375px) 가로 넘침 없음, 새 탭 콘솔 오류 0.
- 라이브 DB: `regions` city 15 / town 11, centroid 누락 0.
- 독립 재검수(4차원 병렬 검수 + 발견별 2인 반박 검증) 및 지역 종속 누락 점검 반영 후 재검증: 홍성읍 순서 유지, 시·군 묶음 접힘, 언어 전환 시 안내 동기, 천안 좌표 '내 위치' → 농촌지도사업 22건, 개인정보처리방침·계정 삭제 안내 개정일 2026-09-10 — 상세는 docs/TEST_CHECKLIST.md "v1.1".
