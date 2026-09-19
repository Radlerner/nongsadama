# RELEASE v1.3 — Google Play 비공개 테스트 업데이트

- 버전: `versionName 1.3` / `versionCode 4` (`android/app/build.gradle`), 웹 `APP_VERSION = '1.3'` · `APP_VERSION_CODE = 4` (`src/config/version.ts`), `package.json` 1.3.0
- 작성일: 2026-09-20 · 기준 문서: [PRD_v1.3](../prd/PRD_v1.3.md) · 변경 이력: [CHANGELOG](../changelog/CHANGELOG.md) · 이전: [RELEASE_v1.2](RELEASE_v1.2.md)
- 출처: [PR #1](https://github.com/Radlerner/nongsadama/pull/1) 병합 커밋 `285ce29`. PR 본문의 "v1.4" 표기는 릴리스 버전이 아니며 이 병합본은 v1.3이다
- 패키지 id: `com.nongsadama.myapp` (불변) · Supabase 프로젝트·keystore·법적 페이지 URL 불변 · 환경변수는 `VITE_STT_KEY`만 제거

## 1. 이번 릴리스에 들어간 것
1. STT Edge Function `stt` 연동 — OpenAI STT 프록시, 로그인 사용자만, 음성 미저장
2. 사용자별 STT rate limit(`stt_rate_windows` + `stt_try_consume`, 한도는 secret)
3. 국가/기본 언어 구조(`countries` 7개국, `profiles.preferred_locale_explicit`, 트리거)
4. Android 카카오 OAuth 콜백 딥링크 `com.nongsadama.myapp://auth/callback` + 네이티브 PKCE
5. Capacitor `@capacitor/app` 8.1.1 · `@capacitor/browser` 8.0.4, Android 권한 `RECORD_AUDIO`·`MODIFY_AUDIO_SETTINGS`
6. `VITE_STT_KEY` 제거(키는 Supabase secret에만)
7. Android 1.3 / versionCode 4

## 2. AAB 재생성 전에 확인할 것
| # | 항목 | 확인 방법 |
|---|---|---|
| 1 | **의존성 설치** | PR 병합 후 `npm install`을 먼저 실행. `node_modules/@capacitor/app`·`@capacitor/browser`가 없으면 typecheck가 실패하고, 그 상태의 `npx cap sync android`는 `android/app/capacitor.build.gradle`·`android/capacitor.settings.gradle`에서 플러그인 줄을 지운다(이번 작업 중 재현). 지워졌다면 `npm install` 후 다시 sync |
| 2 | 웹 빌드가 v1.3인지 | `npm run build` 후 `dist/assets/index-*.js`에 `talk.micNoticeExternal` 문자열 존재, `VITE_STT_KEY` 문자열 없음 |
| 3 | Capacitor 동기화 | `npx cap sync android` 출력에 `Found 2 Capacitor plugins for android` — `@capacitor/app@8.1.1`, `@capacitor/browser@8.0.4`. `android/app/src/main/assets/public/index.html`이 `dist/index.html`과 동일, `android/app/src/main/assets/capacitor.plugins.json`에 `AppPlugin`·`BrowserPlugin` 등록(빠지면 앱 로그인 화면에 오류 배너가 뜨고 콜백이 동작하지 않음). sync 뒤 `android/app/capacitor.build.gradle`·`android/capacitor.settings.gradle`이 `M`으로 보여도 `git diff`가 비어 있으면 줄바꿈(LF/CRLF) 차이뿐이다 — `git checkout --`로 되돌리고 커밋에 넣지 않는다 |
| 4 | 버전 | `android/app/build.gradle` 10~11행 `versionCode 4`, `versionName "1.3"` |
| 5 | AndroidManifest | `com.nongsadama.myapp` scheme · `auth` host · `/callback` path intent-filter 존재, `RECORD_AUDIO`·`MODIFY_AUDIO_SETTINGS` 권한 존재 |
| 6 | 라이브 DB | 마이그레이션 `20260918000000`·`000100`·`000200` 적용 완료(2026-09-19). `countries` 7행, `profiles.preferred_locale_explicit` 존재, `stt_try_consume` EXECUTE는 service_role만 — 2026-09-20 읽기 전용 확인 |
| 7 | Edge Function | `stt` ACTIVE(`verify_jwt=false`, 함수 내부 검증). 토큰 없는 POST → 401 `unauthorized` 확인. secret은 §3 |
| 8 | 앱에 STT를 넣을지 | AAB에는 빌드 PC의 `.env.local` 값이 들어간다. 앱에서 음성 입력을 쓰려면 빌드 **전에** `.env.local`에 `VITE_STT_ENDPOINT`를 넣는다(§3의 전제 완료 후). 비우면 앱은 v1.2와 같은 음성 동작. **기본은 `.env.local`에 `VITE_STT_ENDPOINT` 없이 1.3 (4)를 빌드하는 것**이다 — `v1.3` 태그 소스의 앱 내 `/privacy`는 아직 OpenAI 전송을 고지하지 않는다 |
| 9 | 서명 키·JDK | `nongsadama-release-key.jks`는 작업 트리 루트에 있고 `.gitignore`의 `*.jks`로만 추적에서 제외된다(공개 저장소). `git add -A`·`git add -f`는 쓰지 않고 §4의 경로 지정 `git add`만 쓰며, 커밋 전 `git status --short`에 `.jks`가 없는지 확인한다. `local.properties`·keystore·`.env*`는 이번 작업에서 손대지 않았다 |
| 10 | 웹 배포 상태 | 운영 웹은 병합 시점(2026-09-20)에 이미 PR 코드로 자동 배포됐다(버전 표기 1.2, STT 엔드포인트 없음). 릴리스 커밋을 push하면 표기가 1.3이 된다 |
| 11 | v1.1·v1.2 이월 | 앱 지도 카카오 타일(`https://localhost` 도메인), 위치 권한 미선언 — RELEASE_v1.2 §2 8행 그대로. "앱 내 카카오 OAuth 미완료"는 이번 릴리스의 콜백으로 대체되며 §6에서 실기기 확인 |

## 3. 운영 설정(오너)
값(secret)은 어디에도 기록하지 않는다. **3번(Redirect URL)·6번(데이터 보안)은 이번 1.3 (4) AAB에 필수**이며 다른 번호와 무관하게 먼저 진행한다. **1·2·4·5번은 STT를 켤 때만** 필요하고 v1.3 릴리스 커밋 범위 밖이다. 그 안에서는 1 → 2 → 4·5 순서를 지킨다. 1번만 저장소 코드 변경이고 나머지는 저장소 밖 설정이다.

1. **개인정보처리방침 §3 선갱신(전제)** — STT를 켜면 음성이 OpenAI(미국)로 전송된다. 현재 방침은 "브라우저 제공사(예: Google)"만 적혀 있다. 또 `OPENAI_API_KEY`는 `embed-post`와 공용이라 키를 넣으면 게시글 제목·본문 임베딩도 OpenAI로 간다(D-034). 방침 본문은 저장소의 `src/pages/Privacy.tsx`에 하드코딩돼 있다(ko §3 목록, `REVISED_DATE`, §6 변경 이력, 영문 요약). 두 항목을 여기에 반영하고, OpenAI 전송 결정을 DECISIONS에 새 D-0xx로 기록한다(D-034의 전제). 이 수정은 코드 변경이므로 §4의 v1.3 릴리스 커밋에 넣지 않고 **별도 커밋**으로 만든다. push한 뒤 `https://nongsadama.app/privacy`에 새 문구가 배포된 것을 확인하고 나서 2번(secret)·4번(`VITE_STT_ENDPOINT`)으로 간다. 이 페이지는 AAB에도 번들된다 — 앱에 STT를 넣는 AAB는 그 커밋이 포함된 소스로 빌드하며, 1.3 (4)를 이미 업로드했다면 versionCode 5 이상으로 올린다.
2. **Supabase → Edge Functions → Secrets**: `OPENAI_API_KEY`, `STT_RATE_LIMIT_MAX`, `STT_RATE_LIMIT_WINDOW_SECONDS`(예: 20과 3600 = 사용자당 1시간 구간 20회), 선택 `STT_MODEL`. rate limit 두 값은 **공백·개행 없는 정수**여야 하며 없거나 형식이 틀리면 함수는 500으로 막힌다. 키를 넣은 뒤에는 기존 글 재임베딩(PRD_v1.2 §7). 기본 모델 `gpt-transcribe`가 계정에서 거절되면(모든 호출 502) `STT_MODEL`을 `whisper-1` 등으로 지정한다.
3. **Supabase → Authentication → URL Configuration → Redirect URLs**에 추가:
   ```
   com.nongsadama.myapp://auth/callback
   ```
   카카오 개발자 콘솔의 Redirect URI는 Supabase 콜백 그대로 둔다.
4. **웹 운영 환경변수 `VITE_STT_ENDPOINT`**(값: `<VITE_SUPABASE_URL>/functions/v1/stt`) — 두 곳에 등록한다. (a) **Cloudflare 빌드 변수**: 공식 `nongsadama.app`은 Cloudflare Workers Git 연동 빌드다(DECISIONS 163~164행). (b) GitHub 저장소 → Settings → Secrets and variables → Actions → **Variables**: 보조 GitHub Pages용. Secret으로 넣으면 워크플로의 `vars.`에서 읽히지 않는다. 빌드 타임 상수라 등록 후 재배포해야 적용된다. 비워 두면 웹은 브라우저 Web Speech를 계속 쓴다. **켜면 음성 입력이 로그인 전용이 된다** — 비로그인 사용자는 일반 오류 문구만 본다(PRD §11). 예전에 `VITE_STT_KEY`를 등록한 곳이 있으면 지운다.
5. **앱 빌드 환경변수** — 앱에도 STT를 넣으려면 1번의 방침 커밋이 포함된 소스에서 같은 값을 빌드 PC의 `.env.local`에 넣고 §5를 진행한다. 작업 트리가 깨끗한지 `git status`로 확인한다.
6. **Play Console → 앱 콘텐츠 → 데이터 보안** — 새 권한 `RECORD_AUDIO`와 음성의 외부 전송에 맞춰 오디오 항목을 검토한다.

## 4. Git 커밋·태그(오너가 직접 실행)
```bash
git status
```
```bash
git add README.md package.json package-lock.json src/config/version.ts android/app/build.gradle docs/changelog/CHANGELOG.md docs/prd/PRD_v1.3.md docs/releases/RELEASE_v1.3.md
```
```bash
git commit -m "release: NongsaDaMa v1.3"
```
```bash
git tag -a v1.3 -m "NongsaDaMa v1.3 - Play closed test (versionCode 4)"
```
commit·tag·push는 오너 승인 전 실행하지 않는다. `v1.0`·`v1.1`·`v1.2` 태그는 그대로 둔다.

## 5. Google Play 비공개 테스트 v1.3 AAB 재생성·업로드
1. §2 표 확인 → `npm install` → `npm run build` → `npx cap sync android`.
2. Android Studio → Build → Generate Signed App Bundle로 서명된 AAB 생성(릴리스 키 선택). 출력은 `android/app/release/app-release.aab`이며 v1.2 때 만든 같은 이름의 파일을 덮어쓰므로 수정 시각으로 새 파일인지 확인한다. `android/app/build.gradle`에는 `signingConfig`가 없어 `gradlew bundleRelease` 산출물은 미서명이고 Play Console이 거부한다 — 그 경로는 쓰지 않는다.
3. Play Console → 테스트 → 비공개 테스트 → 새 버전 만들기 → AAB 업로드 → 버전명 `1.3 (4)` 확인.
4. 출시 노트(§7)를 붙여 저장 → 검토 → 출시 시작.
5. 테스터 기기에 설치되면 §6 절차로 확인.
6. 문제 시 [PRD_v1.3 §12 롤백 조건·§13 롤백 방법](../prd/PRD_v1.3.md) — 롤백 빌드는 `versionCode 5` 이상, versionName은 1.3과 구분(예: 1.3.1).

## 6. Android 실기기 확인 절차
전제: §3의 3번(Redirect URL)이 끝나 있어야 한다. Play 비공개 테스트로 설치한 서명 빌드에서 확인한다.

**카카오 로그인 → 앱 복귀 → 세션 유지**
1. 앱 실행 → 로그인 화면 → "카카오로 시작하기".
2. 시스템 브라우저(Custom Tab)가 열리고 카카오 로그인·동의 화면이 나온다.
3. 동의를 마치면 브라우저가 닫히고 앱이 앞으로 나오며 홈(`/home`)으로 이동한다.
4. "내 정보" 탭에 닉네임·이메일이 보이고 하단에 버전 `1.3`이 표시된다.
5. 세션 유지: 앱을 최근 앱 목록에서 밀어 완전히 종료 → 다시 실행 → 로그인 상태 유지. 5분 이상 백그라운드에 뒀다가 돌아와도 유지.
6. 취소 경로 a: 2번에서 동의하지 않고 브라우저를 닫는다 → 앱 로그인 화면으로 돌아오고 버튼을 다시 누를 수 있다(오류 문구 없음, 멈춤·crash 없음).
   취소 경로 b: 카카오 동의 화면에서 "취소"를 누른다 → 앱 로그인 화면으로 돌아오고 빨간 오류 문구("간편 로그인이 안 됐어요…")가 뜨는 것이 **정상**이다. 버튼을 다시 눌러 재시도할 수 있고 문구는 다음 시도 때 사라진다.
7. 로그아웃 → 이메일 로그인 → 정상(회귀 확인).
8. 콜드 스타트 복귀(수행 가능한 경우만): 개발자 옵션 "활동 유지 안함"을 켠 상태로 로그인 → 동의 완료 → 앱이 새로 뜨면서 로그인 완료되는지 확인. 최근 앱 목록에서 밀어 종료하면 같은 태스크의 브라우저도 함께 닫힐 수 있어 그 방법으로는 재현되지 않을 수 있다.
9. 업데이트 회귀: v1.2에서 이메일로 로그인해 둔 기기를 1.3으로 업데이트 → 로그인 상태 유지.
10. 신규 계정 언어(PRD §11): 언어 버튼을 누르지 않고 새 계정을 만든 뒤 프로필을 저장 → 앱 언어가 영어로 바뀌는지 기록해 둔다.

**증상별 원인**
- 동의 후 앱으로 돌아오지 않고 브라우저에 웹사이트(nongsadama.app)가 열린다 → Redirect URL 허용 목록 누락(§3-3).
- 카카오 화면에 KOE205 → `account_email` 동의 항목(비즈앱 전환) 문제. v1.2에서 이월된 별개 이슈.
- 앱으로 돌아왔지만 로그인 화면에 오류 문구 → 동의를 취소했다면 정상(취소 경로 b). 동의를 끝냈는데도 뜨면 코드 교환 실패 — 같은 계정으로 한 번 더 시도하고, 반복되면 롤백 조건(PRD §12) 검토.

**음성 입력(§3의 1·2·5번을 끝내고 앱에 엔드포인트를 넣은 경우만)**
1. 로그인 상태에서 말하기 화면 → 마이크 버튼 → "OpenAI 서버로 보내요" 고지 → 동의.
2. 첫 사용 시 Android 마이크 권한 요청 → 허용 → 5초 녹음 → 인식된 문장이 표시된다.
3. 실패하면 화면에는 원인과 무관하게 같은 문구("잘 못 들었어요…")만 나온다. 원인은 Supabase 대시보드의 `stt` 함수 로그·호출 기록에서 상태 코드로 구분한다: 500 = secret 누락·형식 오류(또는 OpenAI 타임아웃), 429 = 횟수 초과, 502 = OpenAI 실패(모델 접근 권한이면 `STT_MODEL` 교체). 앱은 비로그인일 때 서버를 호출하지 않으므로 401은 직접 호출로만 볼 수 있다.
4. 비로그인 상태에서 마이크를 누르면 오류 문구만 나오는 것이 현재 동작이다(로그인 안내 없음).

## 7. 출시 노트(비공개 테스트용)
기본 문안에는 음성 문장이 없다. §3의 STT 설정을 끝내고 엔드포인트를 넣어 빌드한 AAB일 때만 "추가 문장"을 붙인다.

**한국어**
농사다마 1.3 업데이트입니다. 앱에서 카카오로 로그인하면 로그인 후 앱으로 바로 돌아오도록 고쳤습니다. 국적에 맞는 기본 언어를 다루기 위한 준비 작업이 들어갔습니다.

추가 문장(STT를 넣은 AAB만): 음성 입력은 로그인한 뒤 사용할 수 있습니다. 음성은 글자로 바꾸기 위해 OpenAI 서버로 전송되며 농사다마 서버에는 저장하지 않습니다.

**English**
NongsaDaMa 1.3. Signing in with Kakao inside the app now returns you to the app when you finish. This update also lays groundwork for choosing a default language by country.

Extra sentence (only for an AAB built with STT): Voice input is available after you sign in. Your voice is sent to OpenAI to be turned into text, and NongsaDaMa does not store the audio.

## 8. 검증 결과(2026-09-20, 오너 PC)
- 작업 전: `main` = `origin/main` = 병합 커밋 `285ce29`, 작업 트리 깨끗, 태그 `v1.2` = `5031534` 유지.
- `npm install`(누락 플러그인 2개 설치, lock 변경 없음) → `npm run typecheck` 오류 0 → `npm run build` 성공 → `npx cap sync android` 성공(플러그인 2개 인식, android 자산 = dist).
- 버전: build.gradle `versionCode 4`·`versionName "1.3"`, version.ts `'1.3'`·`4`, package.json·package-lock `1.3.0`(lock diff는 버전 2줄).
- `node --test tests/client-integration.test.mjs supabase/functions/stt/*.test.ts` → 15건 통과(Node 22.23.1).
- 번들: `talk.micNoticeExternal` 포함, `VITE_STT_KEY` 없음.
- 라이브(읽기 전용): 마이그레이션 3건 적용, `countries` 7행(KH·KR·MN·NP·TH·UZ·VN), 프로필 9건 모두 `preferred_locale_explicit = true`(언어 ko 8·en 1 무변경), `stt_rate_windows` RLS on·정책 0, `stt_try_consume` EXECUTE = service_role. `stt` 함수 ACTIVE — OPTIONS 200, 토큰 없는 POST 401, GET 405.
- 운영 웹 `nongsadama.app` 번들(2026-09-20): PR 코드 배포됨(`talk.micNoticeExternal` 포함), 버전 상수 `1.2`, `functions/v1/stt` 문자열 없음.
- PR 분석 워크플로(5개 영역 판독 + 영역별 반박 검증 = 10 에이전트) 결과를 PRD·이 문서에 반영: 공용 `OPENAI_API_KEY`, 방침 선갱신, Cloudflare 빌드 변수, secret 형식, 로그인 전용 전환, 신규 사용자 언어 기본값, 롤백 스위치.
- 문서 독립 검수(4개 관점 + 지적별 반박 검증 = 15 에이전트): 확정 10건 반영 — PRD 본문 중복 삽입 손상(패치 스크립트의 치환 특수문자, 복구 후 136행·절 13개 확인), 서명 AAB 경로, keystore 위치 서술, 운영 설정 필수/선택 구분과 방침 커밋 분리, 롤백 전 엔드포인트 제거, `.gitignore`·워크플로 서술, 신규 사용자 언어 변화의 CHANGELOG 기재. 기각 1건. 미검증 지적 중 타당한 5건(테스트 건수 표기, DB drop 시점, 취소 경로, 출시 노트 문구, D-0xx 기록)도 반영.
- 미실측: STT 실제 인식(secret·모델 접근), Android 실기기 카카오 로그인·마이크 권한, Play 업로드. 빌드 PC `.env.local`에는 `VITE_STT_ENDPOINT`가 아직 없다(이 상태로 만든 AAB는 `stt`를 호출하지 않는다).
- 이 릴리스 작업에서 기능 코드·마이그레이션·Edge Function·keystore·`.env` 값은 변경하지 않았다. commit·tag는 오너 승인 후 실행했다(2026-09-20). push는 오너가 직접 한다.
