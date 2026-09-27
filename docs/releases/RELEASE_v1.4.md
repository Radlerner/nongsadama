# RELEASE v1.4 — UI/UX: 말하기 음성 입력 팝업 · 국적 기반 언어 자동 설정

- 버전: `versionName 1.4` / `versionCode 7` (`android/app/build.gradle`), 웹 `APP_VERSION = "1.4"` · `APP_VERSION_CODE = 7` (`src/config/version.ts`), `package.json` 1.4.0
- 작성일: 2026-09-27 · 기준 문서: [PRD_v1.4](../prd/PRD_v1.4.md) · 변경 이력: [CHANGELOG](../changelog/CHANGELOG.md) · 결정: DECISIONS D-040 · 이전: [RELEASE_v1.3](RELEASE_v1.3.md)(1.3.2는 별도 RELEASE 문서 없이 태그 `v1.3.2` = `7839af8`, `versionCode 6`)
- 브랜치: `feat/v1.4-uiux`(`main` = `v1.3.2`에서 분기). **아직 push하지 않았다** — §4
- 범위: 프론트엔드(`src/`)·문서·버전 3곳. 패키지 id `com.nongsadama.myapp`, Supabase 프로젝트·마이그레이션·Edge Function, Android 권한·플러그인, 의존성, keystore, 환경변수, 법적 페이지는 **그대로**다

## 1. 이번 릴리스에 들어간 것
1. 말하기(`/talk`) 음성 입력 팝업 — 고지 창 · 듣는 중(덮개·원·파형) · 완료 · 취소 · 오류(원인별 문구 3종)
2. `/select` 국적(선택) 줄과 국적 창 — 국적을 고르면 `countries.default_locale`로 앱 언어를 맞춤
3. 언어 선택 창 — "내 국적 언어" + 전체 9개. `/select` 언어 줄, 헤더·랜딩의 언어 버튼이 같은 창을 씀
4. `/profile/edit` 국적을 창에서 고름("다른 나라" 코드 직접 입력, "국적 지우기" 유지)
5. P1 3종 — 프로필 수정에서 국적 선택 시 언어 연동, 가입 전 고른 국적을 새 프로필에 저장, 창을 닫으면 포커스 복귀
6. 화면 문구 키 22개 × 9개 언어(한국어·영어 외 7개 언어는 원어민 검수 전)
7. Android 1.4 / versionCode 7

## 2. AAB 재생성 전에 확인할 것
| # | 항목 | 확인 방법 |
|---|---|---|
| 1 | 소스가 `v1.4`인지 | `git describe --tags` → `v1.4`, `git status --short`가 비어 있음(무시되는 `.env.local`·`*.jks` 제외) |
| 2 | 의존성 | `npm ci`. 이번 릴리스의 lock 변경은 버전 2줄뿐이다(새 패키지 없음) |
| 3 | **앱에 음성 입력을 넣을지 — `.env.local`의 `VITE_STT_ENDPOINT`** | AAB에는 빌드 PC의 `.env.local` 값이 들어간다. **2026-09-27 현재 이 PC의 `.env.local`에는 `VITE_STT_ENDPOINT`가 들어 있다**(값은 확인·기록하지 않았고 형식만 확인). 이대로 빌드하면 앱에 음성 카드와 팝업이 보이고, 음성은 외부 인식(OpenAI)으로 가며, 음성 입력은 로그인 사용자 전용이 된다. 그러려면 [RELEASE_v1.3 §3](RELEASE_v1.3.md)의 1번(개인정보처리방침 §3에 OpenAI 전송 고지)·2번(Supabase secret)이 먼저 끝나 있어야 한다. `v1.4` 소스의 `src/pages/Privacy.tsx`에는 OpenAI 문구가 **없다**(v1.4는 법적 페이지를 바꾸지 않는다). 전제가 안 끝났으면 `.env.local`에서 그 줄을 빼고 빌드한다 — 그 AAB에는 음성 카드가 보이지 않는다(Android WebView는 Web Speech 미지원, 1.3.2와 같음) |
| 4 | 웹 빌드 | **음성이 들어가는지는 명령이 아니라 3번(`.env.local`의 `VITE_STT_ENDPOINT` 유무)이 정한다.** `npm run build`도 그 줄이 있으면 음성이 들어간 번들을 만든다. 음성 없이: `.env.local`에서 그 줄을 뺀 뒤 `npm run build`, 빌드 뒤 `grep -l "functions/v1/stt" dist/assets/*.js`가 아무것도 출력하지 않는지 확인한다. 음성 포함: 그 줄을 둔 채 필수 환경변수 검사를 켜고 빌드한다(검사만 더할 뿐 결과물은 `npm run build`와 같다). 검사를 켜는 `npm run build:release`는 **Windows에서는 cmd·PowerShell·Git Bash 어디에서 실행해도 `'REQUIRE_RELEASE_ENV'은(는) … 명령이 아닙니다`로 실패한다**(스크립트가 POSIX 문법인데 npm은 Windows에서 스크립트를 cmd.exe로 실행한다). 대신 Git Bash에서는 `REQUIRE_RELEASE_ENV=true npm run build`, PowerShell에서는 `$env:REQUIRE_RELEASE_ENV='true'; npm run build`를 쓴다 |
| 5 | Capacitor 동기화 | `npx cap sync android` 출력에 `Found 3 Capacitor plugins for android` — `@capacitor/app@8.1.1`, `@capacitor/browser@8.0.4`, `@capacitor/geolocation@8.2.2`. `android/app/src/main/assets/public/`이 `dist/`와 같아야 한다. sync 뒤 `android/app/capacitor.build.gradle`·`android/capacitor.settings.gradle`이 `M`으로 보여도 `git diff`가 비어 있으면 줄바꿈 차이뿐이다 — `git checkout -- android/app/capacitor.build.gradle android/capacitor.settings.gradle` |
| 6 | 버전 | `android/app/build.gradle` 10~11행 `versionCode 7`, `versionName "1.4"` |
| 7 | Android 네이티브 | `git diff v1.3.2..v1.4 -- android capacitor.config.ts`는 `build.gradle` 버전 2줄뿐이어야 한다(권한·Manifest·플러그인 무변경) |
| 8 | 라이브 DB·Edge Function | 바꾼 것이 없다. 화면이 `countries`(7행, 공개 읽기)를 **읽기만** 한다 |
| 9 | 서명 키 | `nongsadama-release-key.jks`는 작업 트리 루트에 있고 `.gitignore`의 `*.jks`로만 추적에서 제외된다(공개 저장소). `git add -A`·`git add -f`를 쓰지 않는다 |
| 10 | 웹 배포 | 운영 웹(`nongsadama.app`)은 `main`에 병합돼야 1.4가 된다. 브랜치만 push하면 운영은 1.3.2 그대로다. 웹에는 두 기능이 모두 보인다(음성은 Cloudflare 빌드 변수에 `VITE_STT_ENDPOINT`가 없으면 브라우저 Web Speech) |

## 3. 운영 설정(오너)
이번 릴리스가 새로 요구하는 설정은 **없다**. 1.3의 미완 설정(방침 §3 갱신, STT secret, `VITE_STT_ENDPOINT`, Redirect URL)은 [RELEASE_v1.3 §3](RELEASE_v1.3.md)의 별개 결정이다. 다만 §2의 3번처럼 빌드 PC의 `.env.local` 상태에 따라 1.4 AAB가 그 결정의 영향을 받는다.

## 4. Git 커밋·태그·push
커밋과 태그는 작업 지시에 따라 만들어져 있다. **push는 오너가 확인한 뒤 직접 한다.**

| 커밋 | 내용 |
|---|---|
| `5d8599c` | 공용 아래 창 `BottomSheet`, 창을 여는 줄 `PickerRow`, 아이콘 등록 |
| `9fcf3c7` | 국적 선택과 국적 기반 언어 자동 설정, 언어 선택 창 통일 |
| `14c2572` | 말하기 음성 입력 팝업 |
| `42bd4ae` | i18n 신규 키 22개 × 9개 사전 |
| `bb9b562` | (P1) 아래 창을 닫으면 포커스 복귀 |
| `9cf04c8` | (P1) 말하기 덮개가 닫히면 포커스 복귀 |
| `24490c8` | (P1) 가입 전 고른 국적을 새 프로필에 저장 |
| `b05bf7f` | (P1) 프로필 수정에서 국적 → 언어 연동 |
| `67bcc7e` | 검수 반영 — 아래 창(쌓임 순서, 두 번 누름 보호, 닫기·고정 바닥·설명 연결) |
| `32e9f5e` | 검수 반영 — 국적·언어 창(늦게 온 목록, 닫기, 프로필 행 없는 사용자 저장) |
| `a181a2b` | 검수 반영 — 말하기 덮개(아래쪽 바깥 탭, 두 번 누름 보호) |
| `2a6ea72` | 헤더 언어 창이 열린 채 화면이 바뀌면 닫음 |
| `939dd44` | 2차 검수 반영 — 아래 창(높이 고정 옵션, 포커스가 창 밖으로 떨어지면 되돌림) |
| `15e8fae` | 2차 검수 반영 — 국적·언어 창(읽기 실패·늦은 도착에도 줄이 움직이지 않게, 초점 가로채기 방지) |
| `e4cc9f7` | 2차 검수 반영 — 말하기 덮개(상태가 바뀐 직후 버튼 누름 무시) |
| 릴리스 커밋 | `release: NongsaDaMa v1.4` — 버전 3곳·lock·문서. 태그 `v1.4`(annotated)가 가리킨다 |

```bash
git log --oneline v1.3.2..v1.4
```
```bash
git push origin feat/v1.4-uiux --tags
```
`main` 병합(PR 또는 fast-forward)은 push 뒤 오너가 결정한다. `v1.0`~`v1.3.2` 태그는 그대로 둔다.

기능을 빼야 할 때의 되돌리기 순서(마지막 줄을 뺀 나머지는 충돌 없이 되돌려지고 typecheck·테스트가 통과하는 것을 별도 작업 폴더에서 확인):

| 빼려는 것 | `git revert` 순서 |
|---|---|
| 말하기 팝업 전체 | `e4cc9f7` → `a181a2b` → `9cf04c8` → `14c2572` |
| 국적·언어 전체 | `15e8fae` → `2a6ea72` → `32e9f5e` → `b05bf7f` → `24490c8` → `9fcf3c7` |
| P1 가입 국적 저장만 | `24490c8` |
| 헤더 창의 화면 전환 시 닫힘만 | `2a6ea72` |
| P1 프로필 언어 연동만 | `b05bf7f` — **충돌이 난다**(`src/pages/ProfileEdit.tsx` 두 곳. 뒤의 `32e9f5e`가 같은 자리를 고쳤다). 손으로 풀어야 한다: `stopLocaleFollow`·`pickCountry`를 지우고, 국적 창의 `onSelect`는 `(country) => applyCountry(country.iso_code)`, `onOther`·`onNone`에서는 `stopLocaleFollow()` 호출을 뺀다 |

공용 아래 창(`5d8599c`·`bb9b562`·`67bcc7e`·`939dd44`)과 사전 키(`42bd4ae`)는 두 기능이 같이 쓰므로 남긴다.

## 5. AAB 재생성·업로드
1. §2 표 확인(특히 3번 — `.env.local`에 `VITE_STT_ENDPOINT`가 있으면 어느 명령으로 빌드해도 음성이 들어간다) → `npm ci` → `npm run build`(음성을 넣을 때는 §2의 4번 방법) → `npx cap sync android`.
2. Android Studio → Build → Generate Signed App Bundle로 서명된 AAB 생성(릴리스 키 선택). 출력은 `android/app/release/app-release.aab`이며 이전 버전의 같은 이름 파일을 덮어쓰므로 수정 시각으로 새 파일인지 확인한다. `gradlew bundleRelease` 산출물은 미서명이라 Play Console이 거부한다.
3. Play Console → 테스트 → **내부 테스트**(권장) → 새 버전 만들기 → AAB 업로드 → 버전명 `1.4 (7)` 확인 → 출시 노트(§7) → 검토 → 출시.
4. 테스터 기기에 설치되면 §6을 확인하고, 통과하면 같은 버전을 프로덕션(또는 비공개 테스트)으로 승격한다.
5. 문제 시 [PRD_v1.4 §12·§13](../prd/PRD_v1.4.md) — 롤백 빌드는 `v1.3.2` 소스에서 `versionCode 8`, `versionName "1.3.3"`. DB·Edge Function은 되돌릴 것이 없다.

## 6. Android 실기기 확인 절차
Play로 설치한 서명 빌드에서 확인한다. 이 항목들은 이번 작업에서 **실측하지 못했다**(PC의 브라우저 375×812 검증만 했다).

1. 업데이트 회귀: 1.3.2가 설치·로그인된 기기를 1.4로 업데이트 → 로그인 상태, 고른 언어·지역 유지. "내 정보" 하단 버전 `1.4`.
2. `/select`: 국적 줄을 누르면 창이 아래에서 올라온다. 창 바닥의 버튼("고르지 않을래요"·"닫기")이 기기 하단 제스처 막대에 가리지 않는다. 목록을 위아래로 밀 수 있다. 나라를 고르면 창이 닫히고 화면 언어가 바뀐다.
3. `/select` 언어 줄, 헤더 언어 버튼: 같은 언어 창. 고르면 바로 바뀐다. 홈(`/home`)에서 열었을 때 지도의 "내 위치" 버튼이 창 위에 보이지 않는다.
4. `/profile/edit`: "국적 고르기" → 나라 선택 → 저장 → 다시 들어가면 그 나라가 보인다. "다른 나라 (코드 직접 입력)"을 누르면 입력칸이 나타나고 키보드가 올라온다.
5. 기기 뒤로 가기: 돌아갈 화면이 있을 때 창이 열린 상태에서 누르면 **이전 화면으로 이동**하고 창은 닫힌다(창만 닫는 처리는 이번에 넣지 않았다). 앱이 종료되지 않아야 한다. 앱을 막 켜서 돌아갈 화면이 없을 때는 눌러도 아무 일도 일어나지 않는다(앱도 닫히지 않는다 — `@capacitor/app` 기본 처리를 소스로 확인했고 1.3.2와 같다). 그 상태에서 연 창은 "닫기" 버튼이나 바깥 탭으로 닫는다.
6. 글자 크기를 "크게"로 바꾼 기기, 작은 화면(360×640급)에서 국적 창: 나라 줄이 3줄 이상 보이고 바닥 버튼이 잘리지 않는다.
7. TalkBack: 국적 창·언어 창에서 "닫기" 버튼으로 값을 바꾸지 않고 닫을 수 있다. 고지 창을 열면 제목 다음에 고지 문구가 읽힌다.

**음성 입력(§2의 3번에서 엔드포인트를 넣고 빌드한 경우만)**
1. 비로그인: "말로 하기" → 고지 창("OpenAI 서버로 보내요" 문구) → "알겠어요, 말하기" → 덮개에 느낌표와 "음성 입력은 로그인한 뒤 쓸 수 있어요." → "닫기".
2. 로그인: "말로 하기" → 고지 → 마이크 권한 허용 → 덮개·원·파형, "듣고 있어요…" → 5초 뒤 체크 표시 → 초록 상자에 문장.
3. 듣는 중 "그만하기" 또는 덮개의 어두운 곳(원 옆, 카드 아래 포함)을 누르면 바로 닫힌다. 마이크 표시등은 5초까지 더 켜져 있을 수 있다(알려진 제한). 늦게 온 문장은 나타나지 않는다.
4. 마이크 권한을 거부하면 "마이크 권한을 허용해 주세요."와 "다시 말하기"·"닫기".

## 7. 출시 노트
기본 문안에는 음성 문장이 없다. 엔드포인트를 넣어 빌드한 AAB일 때만 "추가 문장"을 붙인다.

**한국어**
농사다마 1.4 업데이트입니다. 처음 화면에서 국적을 고르면 그 나라 말로 화면이 바뀝니다. 언어와 국적은 아래에서 올라오는 창에서 고릅니다. 국적은 고르지 않아도 되고, 확인하지 않습니다.

추가 문장(STT를 넣은 AAB만): 말하기 화면에서 듣고 있는지, 다 들었는지가 크게 보이고, 도중에 그만둘 수 있습니다. 음성 입력은 로그인한 뒤 쓸 수 있습니다.

**English**
NongsaDaMa 1.4. Pick your nationality on the first screen and the app switches to that country's language. Language and nationality are now chosen from a sheet that slides up from the bottom. Choosing a nationality is optional and is not verified.

Extra sentence (only for an AAB built with STT): The voice screen now shows clearly when it is listening and when it is done, and you can stop at any time. Voice input is available after you sign in.

## 8. 검증 결과(2026-09-27, 오너 PC · Windows 10 · Node 22.23.1)
- 작업 전: `main` = `origin/main` = 태그 `v1.3.2` = `7839af8`, 작업 트리 깨끗. `npm ci`(lock 변경 없음) → typecheck 오류 0 → `node --test` 3파일 12건 통과 → `npm run build` 성공(기준값과 같음).
- 릴리스 시점 자동 검사: typecheck 오류 0 · `node --test tests/i18n.test.mjs tests/client-integration.test.mjs tests/geo.test.mjs` 12건 통과 · `npm run build` 성공 · `npx cap sync android` 플러그인 3개 인식, android 자산 = dist · `git status --short`에 `.jks`·`.env*` 없음.
- 커밋마다: 15개 커밋 각각의 시점을 별도 작업 폴더에서 typecheck 오류 0·테스트 12건 통과로 확인. §4의 되돌리기 조합도 같은 방법으로 확인.
- 번들: `index-*.js` 745.56 kB(gzip 219.83) → 774.91 kB(gzip 228.30), `index-*.css` 16.78 → 19.92 kB. `MapHome-*.js`는 같다(231.85 kB).
- 화면 검증: 헤드리스 Chrome 375×812(일부 360×640)에서 개발 서버에 **실제 입력 이벤트**(좌표 탭, 가려짐 검사 포함)를 보내 PRD §10 수동 1~19와 검수에서 나온 경우를 시나리오 100개로 실행했고 전부 통과했다. 결과는 TEST_CHECKLIST v1.4 절, 화면 갈무리는 저장소 밖 `C:\Users\Dongmin Kim\Documents\nongsadama-screenshots\v1.4\`(97장). 음성은 브라우저 음성 인식을 대역(stub)으로 바꿔 결과·오류·침묵·지연을 만들었고, 로그인과 프로필 쓰기는 브라우저 단에서 가로챈 모의 응답을 썼다. **라이브 Supabase에는 읽기(GET)만 나갔고 쓰기·SQL·함수 배포·설정 변경은 하지 않았다.**
- 독립 검수: 1차(P0 커밋 대상, 5개 관점 + 지적별 반박 검증, 17 에이전트) 확정 11건(중복을 빼면 7건)·미검증 7건(1건만 새 내용)을 전부 반영(`67bcc7e`·`32e9f5e`·`a181a2b`). 2차(1차 수정 커밋 대상, 3개 관점 + 반박 검증, 13 에이전트) 확정 10건(중복을 빼면 5건, 모두 P2)을 전부 반영(`939dd44`·`15e8fae`·`e4cc9f7`). 3차(2차 수정 커밋 대상, 2개 관점)는 지적 0건.
- 미실측: Android 실기기(§6 전부), 실제 음성 인식·마이크 권한 창, 실제 계정 로그인과 프로필 저장, TalkBack·VoiceOver, 7개 언어 문구의 원어민 검수.
- 검증용으로 잠시 바꾼 추적 파일: `.claude/launch.json`에 화면 검증용 개발 서버 3개(포트 5176·5177·5178)를 넣어 썼고, 릴리스 커밋 전에 `git checkout -- .claude/launch.json`으로 v1.3.2 상태로 되돌렸다(커밋에 없음).
- 문서 사실 확인 검수(2개 관점 + 지적별 반박 검증, 9 에이전트): 확정 7건(중복을 빼면 4건)을 반영 — `build:release`가 Git Bash에서도 실패, 음성 포함 여부는 명령이 아니라 `.env.local`이 정함, 돌아갈 화면이 없을 때의 뒤로 가기 동작, 검증용 `launch.json` 변경.
- 손대지 않은 것: `supabase/`, `android/`(버전 2줄 제외), `capacitor.config.ts`, 의존성, `.env*`, `*.jks`, `src/lib/speech.ts`·`supabase.ts`·`nativeOAuth.ts`·`tts.ts`, `src/i18n/I18nContext.tsx`, `src/config/app.ts`, `src/App.tsx`, 법적 페이지, `talk.micNotice*` 문구, README.
