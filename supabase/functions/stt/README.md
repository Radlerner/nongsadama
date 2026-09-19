# STT 운영 계약

POST multipart/form-data의 `file`과 `language`를 받아 `{"text":"인식 결과"}`를 반환한다.
`Authorization: Bearer <Supabase 사용자 access_token>`이 필수다. `auth.getUser`로 사용자를 검증하고 익명 로그인은 거절한다.
OpenAI 키와 service role 키는 클라이언트에 전달하지 않는다.

## 환경변수

| 이름 | 용도 |
| --- | --- |
| SUPABASE_URL | Supabase가 제공하는 프로젝트 주소 |
| SUPABASE_SERVICE_ROLE_KEY | Supabase가 제공하는 서버 전용 키 |
| OPENAI_API_KEY | 서버 Secret으로 설정할 OpenAI 키 |
| STT_MODEL | 생략 시 parse.ts의 gpt-transcribe 사용 |
| STT_RATE_LIMIT_MAX | 고정 시간 구간당 사용자별 허용 횟수 |
| STT_RATE_LIMIT_WINDOW_SECONDS | 시간 구간의 초 단위 길이 |

Rate Limit 설정 2개는 모두 1부터 2147483647 사이 정수여야 한다. 누락 또는 오류 시 500으로 차단한다.
예를 들어 20과 3600이면 사용자별 고정 3600초 구간당 20회다. 운영 정책에 맞게 설정한다.
이 제한은 이동 시간창이 아니므로 구간 경계 전후로 각각 제한 횟수만큼 호출할 수 있다.
RPC 장애 시에도 OpenAI 호출을 막는다. OpenAI 실패도 이미 소비한 호출 횟수에 포함된다.
`stt_rate_windows`는 사용자와 구간별로 쌓이며 이번 변경에는 만료 행 정리 작업이 없다.

## 파일 처리

현재 앱 계약인 WebM만 허용한다. audio/webm, video/webm 또는 빈 MIME이나 application/octet-stream의 .webm 파일을 받는다.
파일은 1048576 bytes 이하, multipart 전체는 1064960 bytes 이하로 제한한다.
Content-Length와 별개로 수신 본문을 세어 제한을 적용한다. 파일 내용의 실제 코덱과 재생 시간은 검사하지 않는다.
앱의 5000ms 녹음 타이머는 목표 시간이며 기기 지연 때문에 정확히 5초 이하를 보장하지는 않는다.
짧은 녹음 계약과 크기 제한으로 처리하며, 미디어 분석 의존성은 추가하지 않는다.
음성은 메모리에서 OpenAI로 전송하고 Storage, DB, 디스크에 보관하지 않는다.
OpenAI 요청은 30초 뒤 중단하며 오류 본문과 전사 내용은 로그나 오류 응답에 싣지 않는다.

## 국가와 언어

20260918000000, 20260918000100, 20260918000200 migration을 순서대로 적용해야 한다.
기존 migration은 보존했고 마지막 migration에서 기본 언어 함수를 보완한다.
기존 프로필은 preferred_locale_explicit=true로 보호하며 데이터 backfill은 하지 않는다.
신규 프로필에서 preferred_locale을 생략하면 국적 기본 언어를 쓰고, 국적 정보가 없으면 en을 쓴다.
국적 기본값을 계속 따라가려면 preferred_locale_explicit=false를 사용한다.
직접 언어를 고르면 preferred_locale과 preferred_locale_explicit=true를 함께 보낸다.
특히 현재 값과 같은 언어를 직접 선택한 경우 DB는 값 비교만으로 선택 의도를 알 수 없으므로 true가 필요하다.
다른 언어로 값을 변경하면 플래그가 그대로여도 직접 선택으로 처리한다.
기존 앱은 신규 프로필에 현재 언어를 명시하므로 그 값을 보존한다.
국가 기준 데이터는 countries에만 있으며 기존 국가 자유 입력과 지원하지 않는 국가 코드는 막지 않는다.

## 연결과 검증

src/lib/speech.ts는 auth.getSession으로 현재 access_token을 얻어 Bearer 헤더로 보낸다.
VITE_STT_KEY는 제거했다. VITE_STT_ENDPOINT는 함수 배포가 확인된 뒤 웹 빌드 환경에 설정한다.
후속 클라이언트 및 Android 통합 상태는 docs/INTEGRATION_STATUS.md에 기록한다.

```sh
node --test supabase/functions/stt/*.test.ts
npx --yes --package=deno deno check --no-lock --node-modules-dir=none supabase/functions/stt/index.ts
npx --yes --package=deno deno lint --rules-exclude=no-import-prefix supabase/functions/stt/index.ts supabase/functions/stt/parse.ts
psql "$LOCAL_TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/stt_and_countries.sql
npm run typecheck
npm run build
```

Node 테스트는 Node 24에서 실행했으며 Auth, RPC, OpenAI 응답을 모의 처리한다.
Deno lint는 기존 Edge Function의 JSR 직접 import 패턴에 맞춰 no-import-prefix만 제외한다.
SQL 검증은 격리한 PostgreSQL 16.13에서 기존 프로필 관련 migration과 최신 neighbor_profiles 정의를 적용하고 실행했다.
Supabase의 auth.users와 auth.uid는 로컬 시험용으로 구성했다. 전체 Supabase migration 체인과 실제 Auth 서비스 검증은 아니다.
별도 동시성 검증에서 40개 요청 중 제한 5회만 허용되고 35개는 거절됐다.
운영 DB 차이, 실제 JWT 검증 서비스, OpenAI 모델 접근 권한과 언어별 인식 품질, 배포 게이트웨이는 미검증이다.
공식 API 규격은 https://developers.openai.com/api/docs/guides/speech-to-text 에서 확인했다.
운영 migration 적용, 함수 배포, Secret 및 Auth 설정 변경은 수행하지 않았다.
