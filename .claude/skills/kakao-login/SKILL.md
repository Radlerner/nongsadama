---
name: kakao-login
description: 농사다마에 카카오(및 OAuth 소셜) 로그인을 구현할 때 사용. 로그인 화면 Linktree식 개편, Supabase OAuth 연동, 수정 대상 파일별 반영 지점, 운영자 콘솔 선행 작업, 검증 절차를 안내한다.
---

# 카카오 로그인 구현 스킬 (농사다마)

Supabase Auth의 **네이티브 kakao provider**를 사용한다(`signInWithOAuth({ provider: 'kakao' })`).
커스텀 OAuth 코드를 작성하지 않는다 — 토큰 교환·세션 발급은 전부 Supabase가 대행한다.

## 0. 전제 확인 (구현 시작 전 반드시)

- Supabase 프로젝트: `ikusdwursvbdrznbcjtw` (ap-northeast-2)
- 공식 도메인: `https://nongsadama.app` (D-016). 배포 2곳: Cloudflare Workers + GitHub Pages(`BASE_PATH=/nongsadama/`)
- 기존 자산(재사용, 새로 만들지 말 것):
  - `profiles.auth_provider` 컬럼 — **초기 스키마부터 존재**. 소셜 로그인 시 여기에 provider를 기록
  - `src/context/AuthContext.tsx`의 `ensureProfile` — 첫 로그인 시 profiles 자동 생성(+ `['profiles','own']` 캐시 무효화 필수, 커밋 79cb76f 회귀 주의)
  - Kakao Developers 앱 — **지도용으로 이미 보유**. 같은 앱에 "카카오 로그인" 제품만 추가한다.
    단, 지도는 JavaScript 키·로그인은 **REST API 키 + Client Secret**으로 서로 다른 키를 쓴다
- PRD 준수: **전화번호 동의항목을 켜지 않는다**(PRD v1.3 §9 — 전화번호 요구 금지).
  카카오 동의항목은 닉네임(필수)·이메일(선택)까지만.

## 1. 운영자(사용자) 선행 작업 — 코드 작업 전 안내할 것

코드가 먼저 배포되어도 이 설정 없이는 버튼이 실패한다. 반드시 다음 순서로 안내:

1. **Kakao Developers** (developers.kakao.com → 기존 앱):
   - 제품 설정 → 카카오 로그인 → **활성화 ON**
   - Redirect URI 등록: `https://ikusdwursvbdrznbcjtw.supabase.co/auth/v1/callback` (정확히 이 하나)
   - 동의항목: 프로필(닉네임) 필수 동의, 카카오계정(이메일) 선택 동의. **전화번호는 설정 금지**
   - 카카오 로그인 → 보안 → **Client Secret 생성 + 활성화**
   - 앱 키에서 **REST API 키** 확보 (JavaScript 키 아님!)
2. **Supabase 대시보드** (Authentication → Providers → Kakao):
   - Enabled ON, Client ID = REST API 키, Client Secret = 위 시크릿
3. **Supabase 대시보드** (Authentication → URL Configuration):
   - Site URL: `https://nongsadama.app`
   - Additional Redirect URLs: `https://nongsadama.app/**`, `https://radlerner.github.io/nongsadama/**`,
     `https://nongsadama.casualpe.workers.dev/**`, `http://localhost:5173/**`

## 2. 수정 대상 파일과 반영 지점 (꼼꼼 체크리스트)

### 2.1 `src/pages/Login.tsx` — 핵심 수정
- 화면을 Linktree식 첫 화면으로 개편: 세로 스택 대형 버튼(min-h 56px, PRD 저사양·10세 사용성)
  - 🟡 "카카오로 시작하기"(카카오 브랜드 노랑 `#FEE500`, 검정 텍스트 — 카카오 디자인 가이드)
  - (향후) Google·Facebook 버튼 — 같은 패턴으로 추가만 하면 되게 배열 기반으로 작성
  - 기존 이메일 로그인/가입 폼은 삭제하지 말고 **"이메일로 계속하기" 접기/펼치기 아래로 이동**(기존 계정·데모 계정 회귀 방지)
- OAuth 호출:
  ```ts
  await getSupabaseClient().auth.signInWithOAuth({
    provider: 'kakao',
    options: { redirectTo: `${window.location.origin}${import.meta.env.BASE_URL}` },
  })
  ```
  - `redirectTo`에 **`import.meta.env.BASE_URL` 포함 필수** — GitHub Pages는 `/nongsadama/` 프리픽스가 있어 origin만 쓰면 404
  - 오류는 기존 `auth.error.*` i18n 패턴으로 표시(무언 실패 금지 — 재검수 이월 원칙)

### 2.2 `src/context/AuthContext.tsx`
- `onAuthStateChange`가 OAuth 복귀(`SIGNED_IN`)를 이미 받으므로 **새 리스너를 추가하지 않는다**
- `ensureProfile` 수정 지점:
  - nickname 기본값: `user.user_metadata.name ?? user.user_metadata.preferred_username ?? 'pending'`
    (카카오는 `user_metadata`에 프로필 닉네임을 넣어줌 — 이메일 가입의 pending 로직은 유지)
  - `auth_provider: user.app_metadata.provider ?? null` 을 insert에 포함
  - 기존 insert 성공 시 `queryClient.invalidateQueries({ queryKey: ['profiles','own'] })` 반드시 유지
- 이미 profiles가 있는 재로그인 사용자는 덮어쓰지 않는다(닉네임 사용자 수정분 보존)

### 2.3 `src/i18n/dictionaries/ko.json` / `en.json` — **두 파일 동시**(키 패리티 원칙)
- 추가 키: `auth.kakaoStart`("카카오로 시작하기"/"Continue with Kakao"),
  `auth.orEmail`("이메일로 계속하기"/"Continue with email"),
  `auth.oauthError`("소셜 로그인에 실패했습니다. 다시 시도해 주세요."/"Social sign-in failed. Please try again.")
- 커밋 전 키 패리티 검사(node 스크립트로 두 dict 키 diff = 0 확인)

### 2.4 `src/config/app.ts`
- 하드코딩 금지 원칙에 따라 제공자 목록을 config로: `oauthProviders: ['kakao']` (활성화된 것만).
  Google/Facebook 추가 시 이 배열만 수정하면 되게 Login.tsx는 이 배열을 순회

### 2.5 수정하지 **않는** 것 (오작업 방지)
- `index.html` — 카카오 로그인 SDK를 넣지 않는다(지도 SDK와 무관, Supabase 리다이렉트 방식이라 JS SDK 불필요)
- `.env.local`·GitHub Variables·Cloudflare 변수 — 새 키 불필요(시크릿은 Supabase 서버에만 있음)
- DB 마이그레이션 — 불필요(`auth_provider` 이미 존재). RLS도 변경 없음
- `src/lib/kakaoMap.ts` — 지도용 JS 키 로직과 절대 섞지 않는다

## 3. 검증 절차 (기존 절차 준수: 구현 → 검증 → 독립 재검수)

1. typecheck 0 / build 성공
2. dev(localhost:5173): 카카오 버튼 → 카카오 동의 화면 → 복귀 → `/home` 세션 확인
3. SQL로 profiles 자동 생성 확인: `auth_provider='kakao'`, nickname이 카카오 닉네임, role='user'
4. 이메일 데모 계정(test.a/b) 로그인 **회귀 확인**(접힌 폼에서 정상 동작)
5. 배포 후 `https://nongsadama.app`에서 2~3 반복 (Pages 프리픽스 redirectTo 확인 포함)
6. `docs/TEST_CHECKLIST.md`에 결과 기록, 독립 재검수(중점: redirectTo 조작 가능성,
   ensureProfile 중복 insert 경합, 동의항목 최소수집 준수) 후 P0/P1/P2 반영
7. `docs/DECISIONS.md`에 D-0XX로 결정 기록(제공자 선정 근거: WhatsApp 불가·Telegram 보류 포함)

## 4. 이후 확장 (이 스킬 재사용)

- Google: Cloud Console OAuth 클라이언트 → Supabase Providers → `oauthProviders`에 'google' 추가
- Facebook: Meta 개발자 앱 → 동일 패턴. 동남아 사용자 커버리지 목적(PRD 타깃)
- WhatsApp은 OAuth 미제공(불가), Telegram/Zalo는 Supabase 미지원(커스텀 필요 — 파일럿 후 재검토)
