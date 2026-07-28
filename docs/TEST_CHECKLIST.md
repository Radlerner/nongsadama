# 테스트 체크리스트 및 재검수 결과 (TEST_CHECKLIST)

PRD 11.4(완료 정의)·11.5(독립 재검수) 기준으로 구현 검사와 검수 결과를 기록한다.

---

## v0.1.0 · 기반 스캐폴딩 + 재검수 반영

- 브랜치: `feat/scaffolding`
- 검증일: 2026-07-26
- 검증 환경: 로컬 dev(Vite 5) + 인앱 브라우저 375px(모바일)

### 자동 검사

| 항목 | 명령 | 결과 |
| --- | --- | --- |
| TypeScript | `npm run typecheck` | ✅ 오류 0건 |
| 프로덕션 빌드 | `npm run build` | ✅ 성공 (JS 64.96kB gzip / CSS 2.23kB gzip) |

> 자동 테스트 러너(Vitest 등)는 PRD 미명시 라이브러리라 도입하지 않고, 아래 수동 체크리스트로 대체한다.

### 수동 검증 (375px 모바일)

| # | 시나리오 | 기대 | 결과 |
| --- | --- | --- | --- |
| 1 | `/` 랜딩 진입 | 제목·부제·시작하기 버튼 표시 | ✅ |
| 2 | 랜딩 "시작하기" | `/select` 이동 | ✅ |
| 3 | `/select` 언어 목록 | 각 언어를 자기 이름(한국어/English)으로 표시 | ✅ |
| 4 | 언어 "한국어" 선택 | UI 한국어로 전환, `document.documentElement.lang="ko"` 동기화, localStorage 저장 | ✅ |
| 5 | `/select` 지역 영역 | 빈 상태 문구(준비 중) 표시(골격) | ✅ |
| 6 | "계속" | `/home` 이동, 하단 4탭(홈/게시판/생활정보/내 정보) 표시 | ✅ |
| 7 | 하단 4탭 이동 | 각 탭 페이지 렌더(제목+빈 상태) | ✅ |
| 8 | 존재하지 않는 경로(`/nonexistent`) | NotFound 렌더 | ✅ |
| 9 | 언어 전환 후 페이지 이동 | 선택 언어 유지(localStorage) | ✅ |
| 10 | 콘솔 오류 | 0건 | ✅ |
| 11 | 터치 영역 | 언어 select/버튼·탭·CTA 모두 min 44px | ✅ |
| 12 | 보안: `.env.local` | `.gitignore`로 무시, service_role 미포함, anon 전용 | ✅ |

---

## 독립 재검수 지적 반영 결과

| 지적 | 심각도 | 조치 | 재검증 |
| --- | --- | --- | --- |
| 언어·지역 선택 화면 골격 누락 | P1 | `/select` 화면·라우트 추가(언어 선택 가능, 지역은 골격). 랜딩→/select→/home 흐름 연결 | ✅ 시나리오 2~6 통과 |
| `index.html` lang 고정 + 전환 시 미동기화 | P2 | I18nProvider에서 locale 변경 시 `document.documentElement.lang` 동기화 | ✅ 시나리오 4 통과 |
| `defaultLocale:'ko'` 대상 사용자와 불일치 | P2 | 임시값임을 주석·DECISIONS(D-002)에 문서화. 값은 PRD 14장 미확정이라 임의 변경 안 함 | ✅ 문서화 |
| 언어 select 터치 영역 <44px | P2 | select에 `min-h-[44px]`·패딩 확대 | ✅ 시나리오 11 통과 |
| 의존성 audit 취약점 | P2 | 아래 "남은 위험" 참조 — 비파괴 fix 무효, major 업그레이드는 범위 밖 | ⚠️ 수용·추적 |
| 자동 테스트 부재·결과 미기록 | P2 | 본 체크리스트(docs/TEST_CHECKLIST.md) 작성으로 결과 기록 | ✅ |

---

## 남은 위험

- **npm audit 4건(moderate 3, high 1)**: 이미 최신 6.x(`react-router-dom@6.30.4`)이며 6.x에 패치 없음.
  - `vite`/`esbuild`(high 포함): **개발 서버 전용** 취약점으로 정적 프로덕션 번들에 실리지 않음. 해결에 vite 8(major) 필요.
  - `react-router`(moderate): open redirect/SSR hydration 계열. 본 앱은 **SSR 미사용·미신뢰 입력 기반 리다이렉트 없음**으로 실노출 낮음. 해결에 react-router 7(major) 필요.
  - 조치: 기존 정상 동작 보존과 범위 준수를 위해 이번엔 major 업그레이드하지 않고 **수용·추적**. 별도 의존성 업그레이드 작업(예: v1.1)에서 재평가.
- **지역 선택 실기능 미구현**: `regions` 테이블·RLS(데이터 모델 작업) 이후 채운다. (DECISIONS D-001)
- **자동 회귀 테스트 부재**: 현재 수동 체크리스트에 의존. 핵심 흐름 확장 시 자동화 도입 검토.

---

## 데이터 모델 + RLS (feat/data-model-rls)

- 검증일: 2026-07-26
- 산출물: `supabase/migrations/*.sql`, `supabase/tests/rls_check.sql`

### 정적 검토 (이 환경에서 수행)

| 항목 | 결과 |
| --- | --- |
| 스키마가 PRD 8.1 필드와 일치 | ✅ regions/profiles/posts/life_info 4개 테이블 |
| 값 집합 CHECK 제약 | ✅ level/category/status/role |
| 국가·언어 코드 하드코딩 없음 | ✅ locale/country_code/source_locale 자유 텍스트 |
| RLS 정책이 PRD 8.2와 일치 | ✅ 공개 읽기 / 본인 쓰기 / admin 전용 life_info |
| 권한 상승 방지 | ✅ role 자기변경 차단 트리거 + insert role='user' 고정 |

### DB 적용/실행 검증 — 라이브 통과 (2026-07-26)

Supabase 프로젝트 **nongsadama**(`ikusdwursvbdrznbcjtw`, ap-northeast-2)에 마이그레이션 2개를
적용하고, `rls_check.sql` 로직을 라이브 DB에서 실행(비파괴 ROLLBACK)해 아래를 확인했다.
(MCP `execute_sql`로 역할 시뮬레이션, 결과를 표로 반환)

| # | 검증 | 기대 | 결과 |
| --- | --- | --- | --- |
| R1 | 마이그레이션 2개 적용 | 오류 없이 테이블·정책 생성 | ✅ PASS (4테이블 RLS 활성) |
| R2 | anon: 공개 게시글/생활정보/활성 지역 + 공개 프로필(뷰) 읽기 | 각 공개분만 조회 | ✅ PASS |
| R3 | anon: 게시글 작성 시도 | 거부 | ✅ PASS (permission denied) |
| R4 | 사용자 B가 A의 글 수정/삭제 | 0건(거부), A 글 온전 | ✅ PASS |
| R5 | 사용자 A가 자기 글 수정 | 성공(1행) | ✅ PASS |
| R6 | 일반 사용자가 life_info 작성 | 거부 | ✅ PASS (RLS 위반) |
| R7 | 일반 사용자가 자기 role='admin' 변경 | 트리거 차단 | ✅ PASS (not allowed to change role) |
| R8 | admin이 미공개 포함 life_info 조회(2건)·작성 | 성공 | ✅ PASS |
| R9 | anon이 profiles 원본 테이블 직접 조회 | 거부(공개는 public_profiles 뷰만) | ✅ PASS (permission denied) |

> 재현: `supabase/tests/rls_check.sql`(비파괴, ROLLBACK) 또는 두 실제 계정 앱 테스트(Week 3).
> D-009(로컬 미실행)는 라이브 검증으로 해소됨.

### 보안 어드바이저 (적용 직후)

- ERROR `security_definer_view`(public_profiles): **의도된 최소노출 뷰**(D-006). id·nickname만 노출.
- WARN `is_admin()` RPC 실행 가능(anon/authenticated): RLS 정책 평가에 필요하여 **불가피**(반환은 본인 admin 여부뿐).
- WARN `prevent_profile_role_change()` RPC 실행 가능: **해소** — `revoke execute`(20260726000200_security_hardening.sql).
- WARN `set_updated_at` search_path 미고정: **해소** — `set search_path=''`(동 마이그레이션).

하드닝 적용 후 재점검: 위 WARN 2건 사라짐, R7(role 승격 차단)·updated_at 트리거 회귀 없음 확인.
남은 항목은 ERROR(의도된 뷰) + `is_admin` WARN ×2(정책 평가에 필요, 수용)뿐.

---

## PRD v1.4 매칭 기반 DB 확장 (feat/matching-db) — 라이브 통과 (2026-07-26)

마이그레이션 `20260726000300_matching_base.sql` 적용 + 중심좌표 시딩(12/12) 후
라이브 역할 시뮬레이션(비파괴 ROLLBACK)으로 검증.

| # | 검증 | 기대 | 결과 |
| --- | --- | --- | --- |
| M1 | anon: public_profiles 국적 노출 | 동의자(1명)만 값, 미동의 null | ✅ PASS |
| M2 | anon: 미동의자 국적 | null | ✅ PASS |
| M3 | anon: neighbor_profiles 조회 | 거부(permission denied) | ✅ PASS |
| M4 | 미동의 로그인 사용자: neighbor 조회 | 0행(상호성) | ✅ PASS |
| M5 | 동의 사용자: neighbor 조회 | 동의자만(2명) | ✅ PASS |
| M6 | 미동의자 목록 미노출 | 0행 | ✅ PASS |
| R7 | (회귀) role 자기 승격 | 트리거 차단 | ✅ PASS |
| M7 | 본인 동의·작목 수정 | 성공(1행) | ✅ PASS |
| M8 | 동의 후 neighbor 조회 | 전체 동의자(3명) | ✅ PASS |

어드바이저: 신규 ERROR(neighbor 뷰)·WARN(is_matching_opted_in authenticated)은 D-012 수용.
`is_matching_opted_in`의 anon EXECUTE는 회수됨(anon WARN 없음).

독립 재검수(P0/P1 없음) 반영: 두 뷰 `security_barrier` 적용(사이드채널 pushdown 차단),
뷰 재생성 시 revoke-then-grant 필수 규칙 명문화(D-012), §2.4 보수적 이탈 문서화.

---

## Week 3 작업 1 · 로그인 (feat/auth-login) — 검증 (2026-07-26 야간)

| # | 시나리오 | 기대 | 결과 |
| --- | --- | --- | --- |
| A1 | /login 로그인 폼, 가입 전환 시 닉네임 필드 | 표시 | ✅ |
| A2 | 데모 계정 로그인 | /home 이동, 세션 저장 | ✅ |
| A3 | 첫 로그인 시 profiles 자동 생성 | 닉네임(가입 시 입력분)·현재 언어(ko)·선택 지역 저장, role=user, 매칭 기본 비공개 | ✅ (SQL 확인) |
| A4 | 내 정보 탭(로그인) | 닉네임·이메일·언어·지역 표시 | ✅ |
| A5 | 로그아웃 | 세션 제거, 로그인 유도 CTA | ✅ |
| A6 | 잘못된 비밀번호 | "이메일 또는 비밀번호가 올바르지 않습니다" | ✅ |
| A7 | typecheck / 빌드 | 0건 / 성공 | ✅ |

- 데모 계정: `nongsadama.test.a@gmail.com`, `nongsadama.test.b@gmail.com`
  (확인 완료 상태로 SQL 시딩. 비밀번호는 저장소에 기록하지 않음 — 운영자에게 별도 전달)
- 가입 흐름은 이메일 확인 ON + 내장 메일 rate limit 환경에서도 동작하도록
  "확인 메일 안내" 분기와 첫 로그인 시 프로필 생성(pending 닉네임)을 구현함.

### ⚠️ 운영자 조치 필요 (아침 확인)

- [ ] Supabase 대시보드 → Authentication → Sign In / Up → **Confirm email 끄기**
  (데모 기간 신규 가입 마찰 제거. 내장 메일은 rate limit이 낮아 확인 메일 의존 불가)
- [ ] (선택) 데모 계정 비밀번호 변경/관리

### Week 3 이월 요건 (재검수 지적)

- [ ] **동의 화면 문구**: `is_matching_visible` 동의 시 "게시글에 국적이 비로그인 방문자에게도
  표시됩니다"를 명시할 것(단일 플래그가 이웃 노출+공개 국적 표시를 겸함).

### 독립 재검수 지적 반영 결과

| 지적 | 심각도 | 조치 |
| --- | --- | --- |
| profiles 전체 컬럼 anon 노출 | P1 | 원본 profiles를 본인 조회로 제한, 공개 닉네임은 `public_profiles(id,nickname)` 뷰로만 노출(D-006 개정) |
| rls_check 거부 케이스 미검증(주석) | P2 | DO 블록 예외 처리로 R3/R6/R7/R9 능동 검증 |
| life_info 좌표 범위 CHECK 없음 | P2 | `latitude ±90`, `longitude ±180` CHECK 추가 |
| 마이그레이션 멱등성 없음 | P2 | `create ... if not exists` / `create or replace` / `drop policy if exists` 적용 |
| auth.users seed 실패 가능 | P2 | 스크립트 주석으로 조정 안내 유지(수용) |
| (재재검수) anon 원본 profiles REVOKE 부재 | P2(N-1) | GRANT 전 `revoke all ... from anon, authenticated` 추가 → anon 테이블 권한 봉쇄, R9 결정적 통과 |
