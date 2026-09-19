# PRD v1.3 — 음성 인식 프록시 · 국가 기본 언어 · Android 카카오 콜백

| 항목 | 값 |
|---|---|
| 버전 | 1.3 (Android `versionName 1.3`, `versionCode 4`, 웹 `APP_VERSION '1.3'`, `package.json` 1.3.0) |
| 작성일 | 2026-09-20 |
| 이전 버전 | 1.2 — [PRD_v1.2](PRD_v1.2.md), Git tag `v1.2`(유지), Play 비공개 테스트 `versionCode 3` |
| 출처 | [PR #1](https://github.com/Radlerner/nongsadama/pull/1) `feat/stt-country-android-oauth` — 기능 커밋 `23ba849`, 병합 커밋 `285ce29`(2026-09-20). 이 릴리스 작업은 버전·문서 정리만 했고 기능 코드는 손대지 않았다 |
| 버전 표기 | PR 본문의 "v1.4" 표기는 릴리스 버전이 아니다. 이 병합본의 공식 릴리스 버전은 **1.3**이다. 저장소 루트의 `PRD_v1_3.md`(기능 스펙 반복본)와 이 문서(릴리스 PRD)는 다른 문서다 |
| 결정 기록 | 이번 릴리스로 새로 추가한 DECISIONS 항목 없음. 관련 기존 결정: D-034(OpenAI 키 활성화 전제 — 개인정보처리방침 §3 선갱신) |
| 검증 기록 | [RELEASE_v1.3](../releases/RELEASE_v1.3.md) §8 |
| UI 원칙 | Figma/v0 디자인 브랜치(`origin/v0/figma-ui-refresh`)와 분리 — 이번 릴리스의 UI 변경은 문구 1개와 오류 표시 조건뿐(§9) |

## 1. 배경(문제 정의)
1. **외부 음성 인식 경로의 키 구조** — v1.2까지 외부 STT는 `VITE_STT_ENDPOINT` + `VITE_STT_KEY` 구조였다. `VITE_` 변수는 클라이언트 번들에 그대로 실리므로 정적 키를 쓰면 누구나 꺼내 쓸 수 있다. 운영 엔드포인트도 없어 실제로는 브라우저 Web Speech만 동작했다.
2. **앱 안 카카오 로그인 미완료 구조** — v1.1·v1.2의 알려진 이슈. 앱(WebView)에서 카카오 로그인을 시작하면 OAuth 리다이렉트가 웹 주소로 돌아가 앱으로 복귀하지 못했다(RELEASE_v1.2 §2 8행, 이메일 로그인 안내로 우회).
3. **국적 기준 기본 언어를 담을 구조 없음** — `profiles.preferred_locale`은 NOT NULL이고 클라이언트가 항상 현재 UI 언어를 넣었다. "사용자가 직접 고른 언어"와 "아직 안 고른 상태"를 구분할 수 없어 국적 기본 언어를 적용할 자리가 없었다.

## 2. v1.3 목표
- OpenAI 키를 서버(Supabase secret)에만 두는 STT 프록시로 전환하고, 로그인 사용자만·사용자별 횟수 제한으로 남용을 막는다.
- Android 앱에서 카카오 로그인 → 앱 복귀 → 세션 유지가 되도록 딥링크 콜백과 PKCE를 넣는다. 웹 로그인 흐름은 바꾸지 않는다.
- 국가 기준 데이터와 "직접 고른 언어" 플래그를 DB에 두되, 기존 프로필의 언어는 덮지 않는다.
- 버전·문서·롤백 체계 유지(versionCode 4).

## 3. 변경 기능
| # | 기능 | 내용 |
|---|---|---|
| 1 | STT Edge Function `stt` | `POST` multipart `file` + `language` → `{"text": string}`. `Authorization: Bearer <사용자 access_token>` 필수 — 함수가 `auth.getUser`로 직접 검증하고 익명 로그인은 거절(401). WebM만 허용(`audio/webm`·`video/webm`, 또는 MIME이 비었거나 `application/octet-stream`인 `.webm`), 파일 1,048,576 bytes 이하·본문 전체 1,064,960 bytes 이하(수신 바이트를 직접 세어 413). OpenAI `https://api.openai.com/v1/audio/transcriptions`로 중계(30초 타임아웃), 실패 시 502 `stt_failed`. 음성·인식 결과·오류 본문은 저장·로그하지 않는다. |
| 2 | 사용자별 rate limit | 테이블 `stt_rate_windows(user_id, window_start, hit_count)` + RPC `stt_try_consume(p_user_id, p_max, p_window_seconds)`(SECURITY DEFINER, EXECUTE는 service_role만). 고정 시간 구간 단위 upsert로 동시 요청도 합산. 허용 횟수·구간은 secret `STT_RATE_LIMIT_MAX`·`STT_RATE_LIMIT_WINDOW_SECONDS`(각 1~2147483647 정수) — 둘 중 하나라도 없거나 잘못되면 500으로 막는다(무제한 개방 없음). 초과 시 429 `rate_limited`. |
| 3 | OpenAI STT 모델 선택 | secret `STT_MODEL`이 없으면 `parse.ts` 기본값 `gpt-transcribe`. 언어 힌트는 모델에 따라 `language`(`whisper-1`·`gpt-4o-*`) 또는 `languages[]`로 보낸다. |
| 4 | 클라이언트 STT 연동 | `src/lib/speech.ts`: `VITE_STT_ENDPOINT`가 있으면 5초 녹음 후 세션 access token을 Bearer로 전송. 비로그인·익명이면 요청 없이 `stt-login-required`. 45초 타임아웃, `{text}` 형식 검증, 녹음 MIME 협상. `VITE_STT_KEY`는 제거. 엔드포인트가 비어 있으면 기존처럼 브라우저 Web Speech. |
| 5 | 음성 고지 문구 | 외부 STT일 때 마이크 고지가 `talk.micNoticeExternal`("OpenAI 서버로 보내요… 음성을 저장하지 않아요")로 바뀐다(ko/en). |
| 6 | 국가/기본 언어 구조 | `countries` 7개국 시드(KR·VN·KH·TH·NP·MN·UZ: `default_locale`, `supported_locales`), 공개 읽기 전용. `profiles.preferred_locale_explicit boolean not null default true`. 트리거 `profiles_apply_country_locale`: INSERT에서 `preferred_locale`이 비면 `explicit=false`로 보고 국적 기본 언어(없으면 `en`)를 채움, UPDATE에서 언어 값이 바뀌면 직접 선택으로 간주(`true`), `explicit=false`인 행은 국적이 바뀔 때 기본 언어를 다시 채움. 기존 9개 프로필은 모두 `true`라 언어가 덮이지 않는다. 클라이언트는 아직 `countries`를 읽지 않는다 — `supported_locales`·국가명은 저장만 되고, 프로필의 국가 입력은 자유 입력 그대로다(국가 선택 UI 아님). |
| 7 | 클라이언트 언어 플래그 | `I18nContext`: `nongsadama.locale.explicit` 저장, `setLocale(locale, explicit)`. `AuthContext`: 직접 고른 경우에만 프로필 생성 시 `preferred_locale`을 보냄, 로그인 상태에서 언어를 바꾸면 프로필에 `preferred_locale` + `explicit=true`를 즉시 UPDATE(v1.2는 프로필 저장 때만, 실패는 콘솔 로그뿐. 로그인 전에 고른 언어는 기존 프로필에 동기화되지 않음). `ProfileEdit`: 언어 select를 건드린 경우에만 언어를 저장, upsert → update/insert 분기. |
| 8 | Android 카카오 OAuth 콜백 | 네이티브에서만: `signInWithOAuth({ redirectTo: 'com.nongsadama.myapp://auth/callback', skipBrowserRedirect: true })` → `@capacitor/browser`로 동의 화면 → `appUrlOpen`(`@capacitor/app`, 콜드 스타트는 `getLaunchUrl`) → `exchangeCodeForSession(code)` → 브라우저 닫기 → `/home`. 콜백 URL은 scheme·host·path·`code` 1개·길이를 검증하고 같은 코드는 한 번만 교환한다. 실패 시 `/login` + 오류 문구. MainActivity는 기존 `singleTask`라 콜백이 실행 중인 앱으로 전달된다. |
| 9 | 인증 클라이언트 옵션 | `Capacitor.isNativePlatform()`일 때만 `flowType: 'pkce'`, `detectSessionInUrl: false`. 웹 빌드는 옵션 무변경(기존 세션·이메일 로그인·웹 카카오 흐름 그대로). |
| 10 | Capacitor 플러그인·권한 | `@capacitor/app` 8.1.1, `@capacitor/browser` 8.0.4. AndroidManifest: 딥링크 intent-filter(`scheme=com.nongsadama.myapp`, `host=auth`, `path=/callback`), 권한 `RECORD_AUDIO`·`MODIFY_AUDIO_SETTINGS`. `capacitor.config.ts` `loggingBehavior: 'none'`. |
| 11 | 빌드·저장소 설정 | `deploy-pages.yml`이 저장소 Variable `VITE_STT_ENDPOINT`를 웹 빌드에 주입. `.env.example`에서 `VITE_STT_KEY` 삭제. 루트 `.gitignore`에 `supabase/.temp/`·에이전트 도구 폴더 추가, `android/.gitignore`의 키스토어 패턴(`*.jks`·`*.keystore`) 주석 해제(루트에는 이전부터 있음). `deploy-pages.yml`은 보조 GitHub Pages용이며 공식 웹은 Cloudflare 빌드다(§7). |
| 12 | 버전 | Android 1.3/4, 웹 1.3, package 1.3.0. |

## 4. 영향 범위
- 화면: 말하기(Talk — 마이크 고지 문구 분기), 로그인(네이티브 OAuth 대기 상태 해제·콜백 오류 표시), 프로필 편집(언어 저장 조건), 내 정보(버전 표기 1.3), 앱 셸(`App.tsx` — 콜백 결과에 따라 `/home`·`/login` 이동).
- 웹 사용자: `VITE_STT_ENDPOINT` Variable을 넣기 전까지 동작 변화 없음(Web Speech 유지). 넣으면 음성 입력이 **로그인 필수**로 바뀐다.
- 앱 사용자: 카카오 로그인 흐름이 시스템 브라우저 경유로 바뀐다. 음성 입력은 AAB를 빌드하는 PC의 `.env.local`에 `VITE_STT_ENDPOINT`가 있어야 앱에 들어간다(§8).
- **v1.2 대비 동작 변화(신규 사용자)**: 언어 버튼을 한 번도 누르지 않은 신규 사용자의 프로필은 `preferred_locale`이 v1.2의 `ko`(당시 UI 언어) 대신 트리거 기본값 `en`(국적 미입력 시)으로 만들어진다. 이 값은 내 정보의 언어 표기, 이웃 카드 칩, 이웃 매칭 점수(같은 언어 +3)에 쓰인다(§11).
- **개인정보 영향**: `stt_rate_windows`는 사용자 id·시간 구간·호출 횟수(사용 메타데이터)를 새로 저장한다. 음성·인식 결과는 저장하지 않는다. 계정 삭제 시 `auth.users` cascade로 함께 지워지며 그 밖의 보존 기한은 없다.
- **웹은 이미 배포됨**: 병합 커밋이 `origin/main`에 올라간 시점(2026-09-20)에 자동 빌드가 돌아 운영 웹은 이미 PR 코드로 서비스 중이다(버전 표기는 아직 1.2, STT 엔드포인트 미포함). 릴리스 커밋을 push하면 표기가 1.3이 된다. DB 마이그레이션은 그보다 먼저(09-19) 적용돼 순서 문제는 없었다.
- 헤더·하단 탭·카드·색상 체계·네비게이션은 변경 없음.

## 5. 데이터 변경(Supabase, 2026-09-19 라이브 적용 확인)
| 마이그레이션 | 종류 | 내용 | 롤백 |
|---|---|---|---|
| `20260918000000_stt_rate_limit.sql` | 테이블·함수 추가 | `stt_rate_windows`(RLS on, 정책 0, anon/authenticated 권한 회수), `stt_try_consume`(service_role만 EXECUTE) | `drop function public.stt_try_consume(uuid,integer,integer); drop table public.stt_rate_windows;`(호출 기록만 사라짐) |
| `20260918000100_countries.sql` | 컬럼·테이블·트리거 추가 | `profiles.preferred_locale_explicit`(default true), `countries` + 시드 7행 + 공개 읽기 정책, `apply_country_default_locale()` + 트리거 | 트리거 → 함수 → (선택) 컬럼·테이블 drop 순. v1.2 코드는 이 객체들을 무시하므로 그대로 둬도 동작 |
| `20260918000200_country_locale_defaults.sql` | 함수 교체 | 트리거 함수 보완(INSERT에서 언어 미지정 처리, 기본값 `en`), 두 함수 `search_path = ''` | 000100 정의로 재적용 |
- 파괴적 변경(drop·기존 데이터 덮어쓰기) 없음. 기존 프로필 9건은 `preferred_locale_explicit = true`, 언어 값 무변경(라이브 확인: ko 8·en 1, explicit=false 0건).
- 원격 마이그레이션 버전 번호는 파일명과 다르다(MCP 적용, D-011) — 적용 여부는 객체 존재로 확인한다. 세 파일은 순서 의존이다(000200이 `stt_try_consume`을 alter, 000100만으로는 언어 미지정 신규 프로필 insert가 NOT NULL 위반).
- **배포 순서 전제**: v1.3 클라이언트는 `preferred_locale_explicit` 컬럼과 트리거가 없는 DB에서 프로필 생성·저장이 모두 실패한다. DB 먼저, 클라이언트 나중(이번에는 충족).
- 라이브 확인(2026-09-20, 읽기 전용): `countries` 7행, `stt_rate_windows` RLS on·정책 0·행 0, `stt_try_consume` EXECUTE = postgres·service_role, 트리거 1개.

## 6. API 변경
- 신규 Edge Function `stt`(라이브 ACTIVE, 게이트웨이 `verify_jwt=false` — 함수 내부에서 사용자 토큰을 검증). 오류 코드: 401 `unauthorized`, 405 `method_not_allowed`, 413 `payload_too_large`, 400 `multipart_required`·`multipart_invalid`·`language_missing`·`language_invalid`·`file_missing`·`file_unsupported`, 429 `rate_limited`, 502 `stt_failed`, 500 `server_error`.
- 기존 Edge Function(`embed-post`·`weather`·`rural-programs`·`delete-account`)과 RPC `similar_posts`는 무변경.
- 클라이언트 → Supabase: `profiles` insert/update 페이로드에 `preferred_locale_explicit`가 추가되고 `preferred_locale`이 선택 사항이 됐다(`src/types/database.ts` 반영).
- 외부 API: OpenAI Audio Transcriptions — secret이 설정되고 `VITE_STT_ENDPOINT`가 빌드에 들어간 경우에만 호출된다.

## 7. Supabase 변경 요약 / 운영 설정(오너)
- Edge Function secrets: `OPENAI_API_KEY`(필수), `STT_RATE_LIMIT_MAX`·`STT_RATE_LIMIT_WINDOW_SECONDS`(필수 — 없으면 500. 마이그레이션 헤더 주석의 "둘 다 없으면 이 테이블을 쓰지 않는다"는 코드와 다르다), `STT_MODEL`(선택). rate limit 두 값은 trim 없이 `^[0-9]+$`로 검사하므로 **공백·개행 없이** 넣는다. 값은 저장소·문서에 적지 않는다.
- Authentication → URL Configuration → Redirect URLs에 `com.nongsadama.myapp://auth/callback` 추가. 카카오 개발자 콘솔의 Redirect URI는 Supabase 콜백 그대로다(변경 없음).
- 웹 빌드 환경변수 `VITE_STT_ENDPOINT` = `<VITE_SUPABASE_URL>/functions/v1/stt`. 등록 위치 세 곳: **Cloudflare 빌드 변수**(공식 `nongsadama.app`, DECISIONS 163~164행), GitHub 저장소 **Variable**(보조 GitHub Pages — Secret으로 넣으면 `vars.`에서 읽히지 않는다), AAB를 빌드하는 PC의 `.env.local`. 빌드 타임 상수라 넣거나 뺄 때마다 재빌드·재배포가 필요하다.
- 예전에 `VITE_STT_KEY`를 Cloudflare·GitHub에 등록한 적이 있으면 지우고, 실제 키였다면 폐기한다(옛 번들에 노출됐을 수 있음).
- **전제 1 — `OPENAI_API_KEY`는 프로젝트 공용 secret이다.** `embed-post`도 같은 이름을 읽으므로 STT용으로 키를 넣는 순간 연관 글 임베딩도 OpenAI 경로로 바뀐다(D-034). 같이 해야 할 일(D-034의 세 전제): (a) 개인정보처리방침 §3 갱신 — 방침 본문은 `src/pages/Privacy.tsx`에 하드코딩돼 있어 코드 변경이며 v1.3 릴리스 커밋과 **별도 커밋**으로 한다, (b) OpenAI 전송 결정을 DECISIONS에 새 D-0xx로 기록, (c) 기존 글 재임베딩(PRD_v1.2 §7). 재임베딩 전까지는 새 글과 기존 글의 모델이 달라 서로 연관 글 후보에서 빠진다.
- **전제 2 — 개인정보처리방침.** 현재 방침 §3은 음성 입력을 "브라우저 제공사(예: Google) 서버로 전송"으로만 설명한다. `VITE_STT_ENDPOINT`를 운영에 넣으면 음성이 OpenAI(미국)로 전송되므로 그 **전에** 방침 §3(항목·수탁자·국외 이전)과 개정일을 갱신한다. 사용 시점 고지(`talk.micNoticeExternal`)는 이미 들어 있다.

## 8. Android 영향
- `versionCode 4`, `versionName "1.3"`. package id·keystore 무변경. v1.2는 "권한·플러그인 무변경" 릴리스였지만 v1.3은 **권한 2개 + 네이티브 플러그인 2개가 바뀌는** 릴리스다.
- 새 네이티브 의존성 2개(`capacitor-app`, `capacitor-browser`) — `android/app/capacitor.build.gradle`·`android/capacitor.settings.gradle`에 포함. **PR 병합 후 `npm install`을 먼저 해야 한다.** `node_modules`에 두 플러그인이 없는 상태로 `npx cap sync android`를 돌리면 이 두 파일에서 플러그인 줄이 지워지고 앱에서 콜백이 동작하지 않는다(이번 릴리스 작업 중 실제로 재현, 재설치 후 복구).
- 새 권한 `RECORD_AUDIO`·`MODIFY_AUDIO_SETTINGS` → Play Console 데이터 보안 양식(오디오 항목) 검토 필요.
- 앱의 음성 입력은 웹 번들에 구워진 `VITE_STT_ENDPOINT`에 달려 있다. GitHub Variable은 웹 배포에만 적용되고, AAB에는 빌드 PC의 `.env.local` 값이 들어간다. 비어 있으면 앱에는 음성 버튼이 나오지 않을 수 있다(WebView의 Web Speech 지원은 실기기 미확인).
- v1.1·v1.2 이월: 위치 권한 미선언, 카카오맵 앱 도메인.

## 9. UI 변경 범위(Figma/v0 분리 원칙)
문구 키 1개(`talk.micNoticeExternal`)와 로그인 화면의 오류 표시 조건뿐이다. 레이아웃·색상·컴포넌트 구조는 그대로다. Figma/v0 작업과 충돌 가능성이 있는 파일: `src/pages/Login.tsx`, `src/pages/Talk.tsx`, `src/pages/ProfileEdit.tsx`, `src/App.tsx`, `src/i18n/dictionaries/*.json`.

## 10. 테스트 항목
| 항목 | 결과 |
|---|---|
| `npm run typecheck` 오류 0 · `npm run build` 성공 | ✅ |
| `npx cap sync android` 성공 — 플러그인 2개 인식(`@capacitor/app@8.1.1`, `@capacitor/browser@8.0.4`), android 자산 = dist | ✅ |
| 버전 일치: build.gradle 4/"1.3", version.ts '1.3'/4, package.json·package-lock 1.3.0(lock 변경은 버전 2줄뿐) | ✅ |
| `node --test tests/client-integration.test.mjs supabase/functions/stt/*.test.ts` 15건 통과(Node 22.23.1) | ✅ |
| 번들: `talk.micNoticeExternal` 포함, `VITE_STT_KEY` 문자열 없음 | ✅ |
| 라이브 DB(읽기 전용): 마이그레이션 3건 적용, §5 객체 상태 | ✅ |
| 라이브 `stt`: OPTIONS 200, 토큰 없는 POST 401 `unauthorized`, GET 405 | ✅ |
| 운영 웹 `nongsadama.app` 번들: PR 코드 배포됨(`talk.micNoticeExternal` 포함), 버전 표기 `1.2`, `functions/v1/stt` 문자열 없음(= Web Speech 유지) | ✅(2026-09-20 실측) |
| PR 분석 워크플로(5개 영역 판독 + 영역별 반박 검증) 결과를 §4·§7·§11·§13에 반영 | ✅ |
| STT 실제 인식(로그인 토큰 + secret + OpenAI 모델 접근) | 미실측 — secret 설정은 오너 작업 |
| Android 실기기: 카카오 로그인 → 앱 복귀 → 세션 유지, 마이크 권한 | 미실측 — RELEASE_v1.3 §6 절차 |
| 웹 회귀(이메일 로그인·웹 카카오·지역 선택·게시판) | 코드 검토 — 웹 인증 옵션 무변경 |

## 11. 알려진 이슈
- **공용 secret 결합**: `OPENAI_API_KEY`를 넣으면 STT와 함께 `embed-post`도 OpenAI 임베딩으로 전환된다(§7 전제 1).
- **개인정보처리방침 선갱신 필요**: OpenAI로 가는 음성(STT)·게시글(임베딩) 모두 현재 방침 §3에 없다(§7 전제 2).
- **신규 사용자 언어 기본값(코드 분석 기준, 미실측)**: 언어 버튼을 누르지 않고(기본 한국어 그대로) 가입한 사용자는 DB 언어가 `en`으로 만들어진다. 이 사용자가 국적을 비우거나 `countries`에 없는 코드로 프로필을 저장하면 `ProfileEdit`이 저장된 값(`en`)을 앱 언어로 되가져와 **UI가 영어로 바뀔 수 있다**(국적 KR이면 `ko`). 기존 프로필 9건은 해당 없음. 비공개 테스트에서 먼저 확인할 항목이다.
- **엔드포인트를 켜면 음성 입력이 로그인 전용이 된다.** 비로그인 사용자는 마이크 버튼은 보이지만 누르면 일반 오류 문구만 나온다(Web Speech로 되돌아가지 않고 로그인 안내도 없음). 화면은 STT 오류를 구분하지 않는다 — 로그인 필요·429·500·502·형식 미지원이 모두 같은 문구다.
- 녹음은 WebM만 시도한다. MediaRecorder가 `audio/webm`을 지원하지 않는 브라우저는 엔드포인트가 켜져 있으면 폴백 없이 실패한다. 녹음은 5초 고정이다.
- 기본 모델명 `gpt-transcribe`와 `languages[]` 힌트 필드는 모의 테스트로만 확인됐다. OpenAI 계정에서 거절되면 모든 호출이 502가 되며 secret `STT_MODEL`(예: `whisper-1`)로 교체한다.
- rate limit은 고정 시간 구간이라 구간 경계 앞뒤로 각각 한도만큼 호출될 수 있다. 횟수는 OpenAI 호출·키 검사보다 먼저 차감되므로 OpenAI 실패(502)·타임아웃(500)·키 누락(500)도 횟수에 포함된다. 반대로 401·400·413은 차감 전에 끝난다. 429 응답에 재시도 시점 정보가 없다. `stt_rate_windows`의 오래된 행을 지우는 작업이 없다. 000000 마이그레이션에는 롤백 SQL 헤더가 없고 `search_path` 강화는 000200에 의존한다(000000만 재실행하면 `public`으로 돌아감).
- `stt`는 게이트웨이 JWT 검증을 끄고(`verify_jwt=false`) 함수 안에서 검증한다. CORS는 `*`다.
- 앱 UI 사전은 ko·en뿐이다. `countries`의 기본 언어(vi·km·th·ne·mn·uz)는 DB `preferred_locale`에만 기록되고 UI 언어는 바뀌지 않는다(`setLocale`이 미지원 언어를 무시). 국가 입력은 여전히 자유 입력이며 `countries`에 없는 코드도 막지 않는다.
- 네이티브 콜백: 커스텀 스킴이라 다른 앱·링크가 같은 주소를 보낼 수 있다. PKCE로 세션 탈취는 막히지만 교환 실패 시 `/login` 이동과 오류 배너가 뜬다(기존 세션은 유지). 오류 배너는 다음 OAuth 시작·성공 전까지 남고, `cap sync`가 빠져 플러그인이 등록되지 않은 빌드에서는 시도하지 않아도 배너가 뜬다. 교환 실패(네트워크 포함) 시 재시도 없이 로그인을 다시 시작해야 한다. 네이티브 PKCE는 이메일 가입 확인 링크에도 적용되는데 이 경로는 미검증이다.
- `src/types/database.ts`에 `countries` 타입이 없고 `profiles.Insert.preferred_locale`을 선택 항목으로 손으로 바꿔 두었다. 운영 스키마에서 타입을 재생성하면 typecheck가 깨질 수 있다.
- PR의 테스트는 npm script·CI에 연결돼 있지 않다(수동 실행, Node 22 이상 필요).
- 앱 카카오 로그인은 실기기 미검증이다. Redirect URL을 허용 목록에 넣지 않으면 Supabase가 Site URL(웹)로 보내 앱으로 돌아오지 않는다. 카카오 `account_email` 동의 항목(KOE205, 비즈앱 전환)은 v1.2에서 이월된 별개 이슈다.
- `supabase/functions/stt/README.md`가 가리키는 `docs/INTEGRATION_STATUS.md`는 저장소에 없다.
- SQL 검증 스크립트는 격리 PostgreSQL 기준이며 운영 DB 전체 마이그레이션 체인 검증이 아니다(PR 작성자 기록).
- v1.2 이월: gte-small 게이트 보수성, 임베딩 없는 글 2건, 충남 외 지역 콘텐츠 없음, Android 위치 권한.

## 12. 롤백 조건
다음 중 하나라도 v1.3 비공개 테스트에서 재현되면 롤백한다.
- 앱 실행 불가 / 이메일 로그인 불가 / 홈 라우팅 오류(`/home` 도달 불가, 콜백 후 무한 이동)
- 앱에서 카카오 로그인을 시도한 뒤 앱이 멈추거나 로그인 화면으로 돌아오지 못함(취소 포함)
- 웹에서 기존 로그인 세션이 풀리거나 웹 카카오 로그인이 깨짐
- 프로필 저장 오류, 기존 사용자의 언어가 의도치 않게 바뀜
- 음성 입력 시 앱 crash 또는 마이크 권한 거부 후 복구 불가
- STT 비용·호출 남용(rate limit 미동작)

## 13. 롤백 방법(v1.2 코드 기준, versionCode 재증가)
1. **STT만 끄기(코드 롤백 불필요)**: 즉시 차단 스위치는 secret `STT_RATE_LIMIT_MAX` 또는 `STT_RATE_LIMIT_WINDOW_SECONDS`를 비우는 것이다 — RPC·OpenAI 호출 전에 500으로 끝나고 횟수도 차감되지 않으며 `embed-post`에 영향이 없다. `VITE_STT_ENDPOINT` 제거는 빌드 타임 상수라 즉시 스위치가 아니다: Cloudflare 빌드 변수·GitHub Variable·빌드 PC `.env.local` 세 곳에서 비우고 재배포해야 웹이 Web Speech로 돌아가고, 설치된 앱은 새 AAB가 나갈 때까지 엔드포인트를 계속 호출한다. `OPENAI_API_KEY`는 STT를 끄려고 지우지 않는다 — 지우면 `embed-post`가 gte-small로 돌아가 임베딩 모델이 섞인다(지워야 한다면 PRD_v1.2 §13-2를 함께 수행).
2. **코드**: **전제 — `VITE_STT_ENDPOINT`를 넣은 적이 있으면 revert를 push하기 전에 Cloudflare 빌드 변수와 빌드 PC `.env.local`에서 먼저 지운다.** v1.2 코드는 이 값이 있으면 외부 STT 경로로 고정되는데 사용자 토큰 없이 `stt`를 호출하므로 모든 음성 입력이 401로 실패하고 Web Speech로 돌아가지 않는다. revert가 main에 올라가면 Cloudflare가 자동 재빌드하므로 변수 제거가 먼저다(GitHub Pages는 revert가 워크플로의 주입 줄을 되돌려 자동으로 빠진다). 그다음 `git revert -m 1 285ce29`(PR 병합 되돌리기, 첫 번째 부모 = `v1.2`) 후 버전 파일을 맞춰 커밋(오너 실행, force push 없음). revert는 AndroidManifest의 딥링크·권한과 추적 중인 `capacitor.build.gradle`·`capacitor.settings.gradle`도 함께 되돌린다. 되돌린 뒤 `npm install` → `npm run build` → `npx cap sync android`.
3. **DB(선택)**: v1.2 클라이언트는 항상 `preferred_locale`을 보내므로 트리거가 있어도 기존처럼 동작한다(컬럼 기본값 true). 그대로 둬도 된다. v1.3 클라이언트가 만든 `preferred_locale_explicit = false` 행은 롤백 뒤에도 남아 국적 변경 때 언어가 계속 덮인다 — 필요하면 `update public.profiles set preferred_locale_explicit = true where preferred_locale_explicit = false;`. 객체를 지울 때는 의존 역순(000200 → 000100 → 000000)이며 원격 마이그레이션 기록은 실제 기록된 버전을 조회해 정리한다(D-011). `stt` 함수가 배포된 채 DB 객체만 지우면 모든 STT가 500이 되므로 1번을 먼저 한다. 플래그만 true로 바꾸면 v1.3 기간에 `en`으로 만들어진 언어 값은 남는다 — 해당 사용자에게 확인하거나 오너 판단으로 정정한다. **트리거·함수·컬럼 drop과 000100 정의 재적용은 롤백 웹 재배포와 롤백 AAB(5번)가 테스터 기기에 반영된 뒤에만 실행한다** — 그 전에는 설치된 v1.3 앱의 프로필 생성·저장이 실패한다(§5 배포 순서 전제). 완전 복구가 필요하면 `drop trigger profiles_apply_country_locale on public.profiles;` → `drop function public.apply_country_default_locale();` → (선택, 오너 승인 후) `alter table public.profiles drop column preferred_locale_explicit; drop table public.countries; drop function public.stt_try_consume(uuid,integer,integer); drop table public.stt_rate_windows;`.
4. **Edge Function**: `stt`는 호출하는 클라이언트가 없으면 비용이 없다. 그대로 두거나 대시보드에서 삭제.
5. **앱**: v1.2 코드로 빌드하되 `versionCode`는 **5**(현재 4보다 큰 값), `versionName`은 `"1.3.1"`처럼 1.3과 구분되는 값으로 올려 AAB 재업로드(`src/config/version.ts`·package.json도 같이). Play는 versionCode를 낮출 수 없다. 빌드 전에 `.env.local`에 `VITE_STT_ENDPOINT`가 없는지 확인한다 — 남아 있으면 롤백 AAB의 음성 입력이 전부 401이 되어 versionCode를 하나 더 써야 한다. PRD_v1.2 §13·RELEASE_v1.2 §4가 v1.2 롤백 빌드용으로 안내한 `versionCode 4`는 v1.3이 4를 쓰면서 무효가 됐다.
6. Supabase Redirect URL에 넣은 딥링크는 남겨 둬도 무해하다.
7. CHANGELOG에 "[1.3] 롤백 — 사유" 기록, 태그 `v1.3-rolled-back`.
