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

## Week 3 작업 2~4 — 검증 (2026-07-26 야간)

| # | 시나리오 | 기대 | 결과 |
| --- | --- | --- | --- |
| B1 | 프로필 수정: 국적 vn 입력 | VN으로 정규화 저장 | ✅ (SQL 확인) |
| B2 | 작목·매칭 동의 저장 + 동의 고지 문구(비로그인 국적 공개 포함) | 반영·표시 | ✅ |
| C1 | 이웃 목록(A: 홍동면·딸기·VN·ko) | B(홍성읍·사과·VN·ko) 노출, "약 4km", 언어/작목/국적 칩 | ✅ |
| C2 | 홈 "내 이웃" 상위 3명 + 모두 보기 | 표시 | ✅ |
| C3 | 비로그인/미동의 상태 안내(상호성 설명 포함) | CTA 표시 | ✅ (코드 경로) |
| D1 | 글 작성(질문/제목/본문, 지역=선택 지역, source_locale=UI 언어) | 상세로 이동, 메타(카테고리·읍면·작성자·국적·날짜) | ✅ |
| D2 | 목록 카드 거리·국적 | "우리 동네"(같은 읍면)·테스트A · VN | ✅ |
| D3 | 본인 글 수정 | 프리필→저장→제목 갱신 | ✅ |
| D4 | 본인 글 삭제(소프트, status=deleted) | 목록에서 즉시 사라짐 | ✅ |
| D5 | anon: 삭제 글 숨김·공개 글만 | RLS 강제 | ✅ (REST 확인) |
| D6 | anon: 국적은 동의자만 | public_profiles 경유 | ✅ (REST 확인) |
| D7 | typecheck / 빌드 | 0 / 성공 | ✅ |

### Week 3 완료 기준 — 두 계정 교차 권한 (라이브, 비파괴)

| # | 시나리오 | 결과 |
| --- | --- | --- |
| X1 | B가 A의 글 UPDATE | ✅ 0행(차단) |
| X2 | B가 A의 글 소프트 삭제 | ✅ 0행(차단) |
| X3 | B가 A의 글 DELETE | ✅ 0행(차단) |
| X4 | B가 A 명의로 글 작성(author 위조) | ✅ RLS 위반 거부 |
| X5 | B가 A의 프로필 수정 | ✅ 0행(차단) |
| X6 | B 본인 글 작성 | ✅ 성공 |
| X7 | A의 글 온전 | ✅ |

> 병합 전 독립 재검수는 세션 한도(2:20am 리셋)로 중단됨 → 한도 리셋 후 자동 재시도 예정.
> 위 X 검증은 구현자가 수행한 것으로, 독립 재검수를 대체하지 않는다(PRD 11.5).

## 아침 재검증 — 실제 배포 사이트(GitHub Pages) 항목별 (2026-07-29)

| # | 항목 | 결과 |
| --- | --- | --- |
| E1 | 가입(신규 이메일·닉네임 테스트C) | ✅ 확인 메일 안내 + pending 닉네임 저장 |
| E2 | (메일 확인 SQL 대체 후) 로그인 → profiles 자동 생성 | ✅ 닉네임 테스트C·ko·role user (DB 확인) |
| E3 | 내 정보 표시 + 로그아웃 | ✅ (아래 E7 수정 후 정상 표시) |
| E4 | zod 필드 오류(이메일 형식·비밀번호 길이) | ✅ 표시 |
| E5 | 중복 이메일 가입 | ⚠️ Confirm email ON에서는 Supabase 열거 방지로 "확인 메일" 안내로 응답(정상). OFF 전환 시 중복 오류 매핑 동작 |
| E6 | 비로그인 게시판 읽기(국적·거리 포함) + 글쓰기→로그인 유도 | ✅ (PRD 4.1 읽기 비로그인 유지) |
| E7 | **발견·수정**: 첫 로그인 직후 내 정보 "—" 표시(프로필 insert 전 null 캐시) | ✅ 커밋 79cb76f로 수정·배포·재확인 |

### ⚠️ 운영자 조치 필요 (아침 확인)

- [ ] Supabase 대시보드 → Authentication → Sign In / Up → **Confirm email 끄기**
  (데모 기간 신규 가입 마찰 제거. 내장 메일은 rate limit이 낮아 확인 메일 의존 불가)
- [ ] Supabase 대시보드 → Authentication → **Leaked Password Protection 켜기** (재검수 P2-10)
- [ ] (선택) 데모 계정 비밀번호 변경/관리

### 독립 재검수(Week3 사후, 2026-07-29) 결과 및 반영

- **P0 없음**. 보안 주장(X1~X7·anon·상호성·거리) 리뷰어가 라이브 재현으로 전부 확인.
- P1-1 이웃→공개 글 동선 부재 → ✅ 이웃 카드 탭 시 `/board?author=` 필터(+해제 칩)
- P1-2 이웃 범위 미스코프/동의 문구 과소 고지 → ✅ 뷰 "같은 시/군" 스코프(마이그레이션
  20260726000400, S1~S3 라이브 PASS) + 문구 "같은 시/군" 정합화
- P1-3 프로필 무음 no-op 체인 → ✅ ProfileEdit upsert 전환
- P2-1(pending 오염)·P2-5(상세 거리) → ✅ 반영 / P2-2(첫 로그인 캐시) → ✅ 아침 선반영(79cb76f)
- P2-8 전체 피드 폴백 → 의도된 동작으로 확정(D-014) / P2-10 → 운영자 조치 등록
- **백로그(Week 4)**: P2-3(onAuthStateChange 잠금 방어), P2-4(zod 메시지 키 규칙),
  P2-6(로그인 후 returnTo), P2-7(작성자 조회 오류 표면화), P2-9(코드 스플리팅 — 번들
  563kB/160kB gzip), P2-12(칩 key·이웃 캐시 키)

## v1.5 MVP 야간 구현 — 종합 독립 재검수 결과·반영 (2026-07-30)

- **P0 없음.** 공개경고 우회 불가·인적 핀 없음·위치 좌표 유출 0건·CHECK 안전·i18n 파리티 등 리뷰어 교차검증 통과.
- P1-1 라우터 ② 경로 배너 누락 → ✅ `?from=talk` 시 카테고리 무관 SafetyBanner
- P1-2 전화 핫라인이 군 중심 핀으로 오표시 → ✅ 좌표·주소 없는 시/군 항목은 지도 핀 제외
- P1-3 **핫라인 4건이 검수(verified_at) 전 라이브 공개 중** → ⚠️ 아침 승인 E에서 사후 추인 필요
  (번호는 공개 상식 수준으로 정확·미검수 배지 정직 노출 — 리뷰어 확인)
- P2 반영: 상세 화면 support 3개월 기준+배너, 지도 파괴·재생성 버그, OSM 어트리뷰션 링크,
  마이크 고지 명시 상태, 신고 이메일 설정화, outOfArea 지역명 하드코딩 제거, 죽은 home.* 키 정리
- P2 백로그: 타일 실패 자동 폴백, support 상세 "전화 전 확인" 전용 문구, help 상세 배너,
  타일 로딩의 제3자 위치 노출 고지(§10-J 처리방침과 연동)
- 리뷰어 정정: "메인 번들 무증가" 보고는 부정확 — 실측 +4.4kB gz(라우터A 코드분), 지도는 별도 청크

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

## 카카오맵 활성화 검증 (2026-08-01, 라이브)

- 운영자 JS 키 발급·JavaScript SDK 도메인 등록(github.io·localhost) 완료 → SDK 200 확인
- 라이브(/home): kakao SDK 활성, 다음 타일 13, 이모지 핀 7(카테고리 아이콘), Leaflet 미사용
- 상호작용: 핀 탭→시트(6건), 병원 필터→3핀 — OSM과 동일 UX
- 폴백 회귀: 도메인 미등록 상태에서 OSM 자동 전환 검증됨(커밋 e40fa7e 전후)
- §10-B(지도 제공자) 사실상 확정: kakao(기본, 키 존재 시) + OSM(폴백)

## PRD v1.6 §1 비슷한 글 (feat/similar-posts, 2026-08-02)

- 마이그레이션 similar_posts: pgvector+posts.embedding(384)+similar_posts RPC(invoker=RLS 적용,
  공개 5건 미만 빈 결과). Edge Function embed-post 배포(내장 gte-small, 외부 API 0, verify_jwt).
- 검증: 7건 임베딩 전부 384차원 성공. anon RPC 실측 — 병원쌍·축구쌍 파트너 1위 ✅,
  **임금쌍 top-3 밖 ❌ (품질 게이트 2/3)**. 유사도 0.90~0.94 밀집 = gte-small 한국어 변별력 한계.
  → PRD §1.5 규정대로 공급자 B(유료 다국어) 재논의 항목으로 상정(오너 결정 대기).
- UI: 상세 하단 비슷한 글 3건(결과 없으면 섹션 숨김), 목록/상세 조회에서 embedding 컬럼 제외
  (페이로드 보호). 작성·수정 시 비동기 임베딩(실패해도 저장 성공).
- typecheck 0 / 빌드 성공 / dev 상세 화면 섹션 렌더 확인.

### 독립 재검수 결과 (f2be378, 사후)
- P0/P1 없음. 라이브 재현: hidden 글 source→0행, 결과 published만, 본문 미반환,
  5건 게이트 동작, select('*') 잔존 0, CORS 적정(verify_jwt), 회귀 없음.
- P2-a 반영: similar_posts search_path=public,pg_catalog 고정(D-010 정합,
  ''는 pgvector <=> 미해석이라 불가) — 라이브 적용 완료.
- P2-b(anon embedding 컬럼 SELECT 가능 — 공개 본문 파생값이라 수용)·P2-c(임의
  post_id 재계산 — 멱등·무누출, 레이트리밋은 선택) 인지 기록.
- 리뷰어 재측정: 병원쌍도 역방향에선 3위 — 품질 게이트 실질 1~2/3.
  공급자 결정(①현행 유지·파일럿 재평가 / ②유료 다국어)은 오너 대기.
- 문서 이탈 기록: PRD §1.3의 match_posts(query_embedding) 대신 similar_posts(source_id)
  구현 — 원시 임베딩 왕복 제거로 더 안전(리뷰어 "개선" 평가).

## 카카오 간편로그인 (feat/kakao-login, 2026-08-27 야간, kakao-login 스킬 준수)

| # | 검증 | 결과 |
|---|---|---|
| K1 | /login 개편: 카카오 버튼(#FEE500, 56px) 렌더 | ✅ dev 실측 rgb(254,229,0)/56px |
| K2 | 이메일 폼 기본 접힘 + "이메일로 계속하기" 펼침 시 기존 폼 온전(간편로그인 방식 — 대체 아님) | ✅ |
| K3 | Supabase authorize?provider=kakao → 302 kauth.kakao.com(client_id·callback 정상) | ✅ |
| K4 | 카카오가 요청 수용 — KOE 오류 0, 실제 로그인 페이지 반환(scope: nickname·email·image) | ✅ |
| K5 | typecheck 0 / i18n 패리티 0 / 빌드 성공 | ✅ |
| K6 | 실계정 동의 완료→복귀→profiles(auth_provider='kakao') 생성 | ⬜ **아침 실사용 테스트**(운영자 카카오 계정 필요) |
- ensureProfile: 소셜 닉네임(user_metadata.name) 기본값 + app_metadata.provider 기록,
  캐시 무효화 유지(79cb76f 회귀 방지). redirectTo에 BASE_URL 포함(Pages 프리픽스 대응).

### 독립 재검수 결과 (0b4b62c, 사후) + 반영
- **P0-1 반영**: 랜딩 M-10 리다이렉트가 OAuth 복귀 해시(#access_token)를 supabase 소비 전에
  파괴 → Landing에 `initializing` 게이트 추가. 지역 저장 단말에서 무언 로그인 실패를 사전 차단.
  이메일 확인 링크 복귀의 잠복 결함도 함께 해소. 게이트 후 M-10 정상 재확인(/ → /home).
- **P1-1 반영**: pending 닉네임을 provider==='email'일 때만 읽고·소비(소셜 첫 로그인의
  교차 계정 닉네임 오염 차단).
- **P2 반영**: P2-1 bfcache 버튼 잠금(pageshow 리셋), P2-3(23505만 무시, 실제 실패는 로그),
  P2-4(서로게이트 안전 절단), P2-5(D-019 기록).
- **P2-2 미해결(아침 실험)**: scope profile_image는 GoTrue 하드코딩 — 콘솔 동의항목 해제 실험.
- 교차검증 확인: redirectTo 고정값(조작 불가)·카카오 메타키(name/preferred_username) 정확·
  email 거부 시 fallback 안전·RLS insert 통과 가능·이메일 폼 회귀 없음.

#### 아침 실계정 테스트 목록 (K6 + 재검수 지정)
1. 카카오 동의 완료 전체 왕복(지역 저장된 단말로) → profiles(auth_provider='kakao') 확인
2. localhost 테스트 시 복귀가 localhost에 머무는지(허용목록 검증 — 프로덕션으로 가면 목록 문제)
3. 카카오 페이지에서 뒤로가기 → 버튼 잠금 해제 확인(P2-1)
4. profile_image 동의항목 해제 실험(KOE 오류 여부) → 결과를 D-019에 추기

## Play 심사 준비 1·2순위 (2026-08-27)

| # | 검증 | 결과 |
|---|---|---|
| PR1 | /privacy 렌더(수집·미수집·제3자 6종·삭제·권리·영문 요약) + 랜딩·내정보 링크 + sitemap | ✅ |
| PR2 | 계정 삭제 E2E: 일회용 계정→글 시드→delete-account 호출 {ok:true} | ✅ |
| PR3 | 연쇄 삭제: auth 0·profiles 0·posts 0, 타 계정 5명 무손상 | ✅ (SQL) |
| PR4 | 삭제 후 재로그인 invalid_credentials | ✅ |
| PR5 | typecheck 0 / 빌드 성공 / i18n 패리티 | ✅ |

### 독립 재검수 결과(39e2e27·c22227e) + 반영
- P0 없음. 실측 통과: 타인 삭제 경로 전무(JWT 본인만), verify_jwt=true, FK cascade 10개
  전부 확인(잔존물 0 — 롤백 시뮬레이션), storage 버킷 0, CSRF 불가, 방침-구현 정합.
- **P1-1 반영**: /privacy#delete 전용 섹션 — 앱 내·웹(이메일) 삭제 경로, 삭제되는 데이터
  전체 범위, 삭제 후 보관 데이터 없음 명시(Play Data safety 제출 URL: nongsadama.app/privacy#delete).
- **P2-1 반영**: 국외 이전·호스팅(Cloudflare·GH Pages·GA4·Clarity·AddToAny) 고지 추가.
- **P2-3·P2-4 반영**: delete-account 오류 일반화(delete_failed)+전 응답 Content-Type (v2 재배포).
- **P2-5 반영**: signOut 시 queryClient.clear()(공용 단말 캐시 방어).
- P2-2(소프트 삭제 보관 기간): 방침에 "계정 삭제 시 완전 파기" 명시로 부분 해소,
  주기적 하드 삭제는 후속 검토.

## Play 심사 준비 3순위: in-app 신고·차단 (2026-08-27)

| # | 검증 | 결과 |
|---|---|---|
| RB1~2 | 신고: 본인 명의 성공·타인 명의 위조 거부(RLS) | ✅ |
| RB3·6 | 신고 열람: 일반 사용자 0행·admin 1행(롤백 시뮬레이션) | ✅ |
| RB4~5 | 차단: 본인 CRUD·타인에게 비가시 | ✅ |
| RB7 | UI: 신고→사유4택→접수, 재신고→"이미 접수" | ✅ dev E2E |
| RB8 | UI: 차단 확정→게시판 복귀+차단 작성자 글 숨김 | ✅ (1차 시도에서 신고 후 차단 버튼 소실 결함 발견→영역 분리 수정 후 통과) |
| RB9 | 내 정보: 차단 목록 표시→해제→섹션 숨김 | ✅ |
| RB10 | typecheck 0·i18n 패리티 0·빌드 성공, 테스트 잔여 행 정리(reports/blocks 0) | ✅ |

### 신고·차단 독립 재검수(5c01dff) + 반영
- P0 없음. RLS 적대 실측 8건 전부 의도대로 거부(신고 위조 42501·anon 차단·blocks 상호 비가시,
  update/delete 정책 부재도 실제 차단 동작 확인).
- **P1-1 반영**: (a) 차단 작성자 글 상세 직접 접근 → 본문 대신 안내+해제 버튼(dev E2E 통과:
  차단→직접 URL 재접근→본문 숨김→해제→복원) (b) similar_posts에 author_id 추가(함수 재생성,
  grant·search_path 재적용) + 추천 클라 필터 — "차단했는데 앱이 추천"하는 경로 제거.
- **P2-1 반영**: reports.reason 코드값 4택 DB CHECK(자유 텍스트 저장 차단).
- **P2-2 반영**: 차단 낙관 갱신(refetch 전 노출 틈 제거).
- **P1-2(운영 조치·코드 아님)**: admin 0명 — 아침 목록에 추가. P2-3(신고 rate limit): 후속 수용.

#### 아침 목록 추가
5. 운영자 계정 admin 승격(가입 후 대시보드 SQL: update profiles set role='admin' where id='<운영자uid>')
   + 신고 주기 점검 루틴 확정 — Play UGC "검토·조치" 요건

## Play 심사 준비 4순위: PWA (2026-08-27)
- manifest·sw.js·아이콘 192/512 라이브 content-type 검증(초기 200이 SPA 폴백인 함정 확인 후
  재빌드 대기→ application/manifest+json·text/javascript·image/png 확인) ✅
- BASE_PATH(/nongsadama/) 빌드에서 %BASE_URL% 치환 검증 ✅. SW는 PROD 전용 등록,
  내비게이션 network-first(배포 전파 보장). 설치 프롬프트·TWA 패키징은 아침/후속.

## 디자인 v0 (feat/design-v0 → main 166482c + 재검수 반영, 2026-08-27 야간)
- 토큰(brand-*·rounded-card 12px·shadow-card) 적용 실측, 카드 13개소 통일(잔여 불일치 0 grep).
- 랜딩(로고+크림+기능 3칩)·로그인(로고+카드 패널) 개편, i18n 신규 키 0(기존 키 재사용).
### 독립 재검수(P0 없음) + 반영
- P1-1 반영: 페이지 배경 gray-50 + 카드 bg-white 명시(13개소) — 야외·저가 단말 카드 경계 확보.
- P1-2 반영: 랜딩 기능 3칩을 /select Link로 승격(오인 클릭 = 정답 동작).
- P2-2 반영: 지도 컨테이너 overflow-hidden 명시(SDK 내부 동작 비의존).
- P2-4 반영: 로그인 로고 icon-192로 교체(DPR 2~3 선명).
- 후속(v1): P2-1 brand 토큰 실사용 확대·greenDark/green-700 정리, P2-3 플랫 컨테이너 규칙,
  maskable 아이콘 안전영역 패딩(icon-512=og-image 동일 파일 지적 — PWA 소관 추적).

## Play 심사 준비 5순위: 실데이터 시딩 (2026-08-27)
- 샘플 16건 제거 → 실데이터 9건 시딩(카테고리: hospital 2·market 2·government 1·
  transport 3·support 5). dev UI 확인: 목록 표시·상세 전화 tel: 버튼·주소·
  "검수 확인일 없음" 배지 전부 정상, [샘플] 잔존 0.
- 전 항목 공식 source_url 보유, verified_at=null(운영자 검수 대기 — D-026 절차).

## PRD v1.7 §1: 농사 도움 (feat/farm-tips, 2026-08-28)
- FT1 anon 읽기 8건 ✅ / FT2 anon 쓰기 거부 ✅ (롤백 시뮬레이션)
- UI(dev): 홈 진입 카드·목록 8건·작목 칩(딸기)·상세 TTS·출처 링크·관리자 확인 문구 ✅
- typecheck 0·i18n 패리티 0·빌드 성공

### 농사 도움 독립 재검수(291604d) + 반영
- P0 없음. 통과 실측: RLS(미공개 anon 비가시·쓰기 42501), select per-observer(캐시 오염 없음),
  line-clamp 빌드 생성, 비로그인 전 화면, MapHome 순수 추가, 출처 3도메인 200,
  콘텐츠=공공 캠페인 수준·면책 문구 상시.
- **P1-1 반영**: 시드를 supabase/seeds/20260828_farm_tips_seed.sql로 저장소 보존(안전 문구
  변경 이력 = git diff — D-026 컨벤션 복원).
- **P1-2 반영**: FarmTipDetail isError+재시도(네트워크 오류를 "정보 없음"으로 오표시하던
  무언 실패 제거).
- **P2 반영**: 작목 매칭 norm() 통일(P2-3), 출처 라벨 "(농사로)" 하드코딩 제거(P2-4),
  상세 "검수 확인일 없음" 표시(P2-5), 마이그레이션 주석 키 정정(P2-7).
- 후속: rls_check.sql farm_tips 케이스(P2-6), 영문 작목 태그 확충(자유 텍스트 한계 — D-027 기록).

## PRD v1.7 §3: 컴포넌트 체계 (2026-08-28 야간)
- src/components/ui/ 신설: Card·CardLink, LoadingBox·ErrorBox(재시도 필수)·EmptyBox.
- 적용: FarmTips(전체)·Board(상태 3종+PostCard)·Neighbors(상태 3종) — 시각 동일성 실측
  (radius 12px·bg white 유지). 나머지 화면은 docs/DESIGN_TOKENS.md §3 채택 현황표로 추적.
- docs/DESIGN_TOKENS.md 신설: 토큰·컴포넌트 인벤토리·화면 프레임 목록·피그마 프롬프트 템플릿.

### v1.7 야간 일괄 재검수(2e0ed15·1744ba5·67e61b8)
- P0 없음, 코드·시각 회귀 0(클래스 집합 전수 대조·tsc 0·maskable 픽셀 실측 — 콘텐츠 반경
  191px < 안전영역 205px). 반영: 채택표 LifeInfo ✅ 갱신·키릴 동형문자 정정·잔여 컴포넌트
  ⬜ 등재. 후속: maskable 흰 카드 모서리 미감 판단, nongsaro 스킬 문구 보강(키 발급 시점).

## v1.7 항목1·2·3 실데이터 연동 (2026-08-28 밤샘)
| 검증 | 결과 |
|---|---|
| rural-programs: 캐시 구축 18s(3,058건)→적중 0.4s, 홍성 필터 34건 | ✅ 라이브 |
| weather: MCP 왕복 5.4s→캐시 0.6s, 홍성 25.6°C·서울 25.8°C(전국) | ✅ 라이브 |
| 키 잠금: api_keys/api_cache RLS 정책0+revoke | ✅ |
| UI(dev): 날씨 카드 실온도·사업 34건·내위치 버튼·팁 공존, typecheck 0·패리티 0 | ✅ |

### 외부 연동 3종 재검수 + 반영 (v4/v2 재배포)
- 키 잠금 3중 실측 통과(REST 401·스키마 미노출·payload 무키). P0 없음.
- 반영 후 라이브: 해외 좌표 400 out_of_service_area ✅ / 정밀 좌표 입력→반올림 응답 ✅ /
  연도 기본 2026(34건)·1999→2015 클램프(39건)·명시 2026(34건) ✅ — v3의 연도 기본값
  회귀(Number(null)=0)를 실측으로 발견·수정한 결과 포함.

## 디자인 v1 (6f81602) + 독립 재검수 반영
- 실측: 크림 그라운드·카드 16px·CTA 알약 16곳·제목 800/20px·탭 활성 알약·날씨 이모지+30px
  온도·ko 76키 humanize(파라미터 불일치 0, 파리티 0). P0 없음.
- P1 반영: Select/NotFound/ErrorBoundary 크림 통일, 수정 Link·내주변 버튼 알약(반경 혼재 해소),
  ko 과교정 2키 의미 복원(freshnessNotice·farm.sourceNotice — en 정합), DESIGN.md §4를
  코드 실측으로 정정(보조=gray 테두리·white/80·56px 완화).
- P2 반영: 카카오 버튼 알약, 잔존 gray-50 박스 white/80+border 이관(야외 대비 강화),
  자체 레이아웃 제목 extrabold, report.done·consentWhy 카피 손질, Card 주석 갱신.
- 후속: Talk 4택 색상 §2 등재 판단, PagePlaceholder 삭제 후보, landing.subtitle en 대응.

## 디자인 v1.5 — 아이콘 타일 시스템 (2026-08-29, 로컬 레퍼런스 정독 기반)
- awesome-design-md-main(airbnb 실파일: ink #222·48px 버튼·라운드 카드·단일 브랜드색) 정독 반영.
- IconTile 신설: 이모지→틴트 rounded-2xl 타일(카테고리 식별색 6종 — 색+그림 이중 부호화).
  적용: 홈 필터(타일 행+활성 ring)·생활정보 카드·농사 진입. Talk 4택 색은 §2 등재로 정식화.
- 랜딩 히어로 확대(로고 112px·타이틀 30px). 스크린샷 실측: 홈·생활정보 완전 전환 확인.
- 캐시 강제 갱신: SW nongsadama-v2·파비콘 ?v=2 (라이브 CSS에 v1 토큰 실재 확인 —
  "안 보임" 원인은 클라이언트 캐시로 진단).

## 디자인 v1.6 — 아이콘 전면 교체 (2026-08-29, 오너 지적 반영)
- 이모지 UI 아이콘 전량 → lucide 라인 세트(단일 레지스트리 ui/icons.tsx): 하단 5탭·홈 필터
  타일·생활정보 카드/칩·지도 핀(SVG 정적 렌더)·내위치·날씨 9종·Talk 4택/마이크/읽어주기·
  신고/차단·안전배너 전화 3종·랜딩 3칩·카카오 버튼·뒤로가기·오류 퍼즐.
- 실측: /home lucide svg 15개 렌더, 지도 핀 SVG 정상(1차에서 kakao overlay textContent로
  마크업 텍스트 유출 발견 → innerHTML(자체 생성 마크업 한정)로 수정 후 통과), 빌드 성공.
- lucide-react 도입(MIT·트리셰이킹) — DESIGN.md §7 아이콘 원칙 갱신(이모지 UI 금지).

## /delete-account 공개 페이지 (cd8cb70)
| 검증 | 결과 |
|---|---|
| dev 익명(세션·지역 제거) 직접 접근: 제목·이메일·한/영·보관 고지·로그인 벽 없음·mailto 2 | ✅ |
| 라이브 nongsadama.app/delete-account: HTTP 200 + 렌더 텍스트 전 항목 | ✅ |
| workers.dev 200 / GH Pages는 404 상태(SPA 폴백 렌더) — 제출 URL은 nongsadama.app | ✅ 기록 |
| sitemap 등재(라이브 확인), typecheck 0·빌드 성공 | ✅ |

## /child-safety 공개 페이지 (7aa56e8)
| 검증 | 결과 |
|---|---|
| dev 익명(세션·지역 제거) 직접 접근: 제목·업데이트 날짜·한/영·mailto 4·홈 링크·로그인 벽 없음 | ✅ |
| 새로고침(신규 로드) 시 404 없음(dev) | ✅ |
| 라이브 nongsadama.app/child-safety 200, workers.dev 200 | ✅ |
| npm run build 성공, typecheck 0, sitemap 등재(라이브 확인) | ✅ |

## 공개 법적 페이지 독립 재검수(2 워크플로, 208 에이전트) + 반영 (D-032)
- P0 없음. 확정 16건(중복 포함) → 코드 반영 12건, 후속 1건(카카오 unlink — Admin 키 필요), 오너 작업 1건(키스토어 이동).
| 검증 | 결과 |
|---|---|
| /delete-account(dev 익명): 'My Profile' 0건·'Sign in → Profile → Delete account' 일치, 10일 기한 ko/en, '7일/business' 0건, 시행일 2026-09-09, 카카오 '연결된 서비스 관리/Connected services' ko/en, section lang ko/en, 홈 링크 44px, mailto 2건 제목 통일, document.title = 페이지 제목 | ✅ |
| /child-safety(dev 익명): LAST_UPDATED 2026-09-09, 연락처 블록 이메일 링크 높이 44px(문장 내 18px은 인라인 예외), section lang ko/en, 화살표 aria-hidden, document.title | ✅ |
| /privacy(dev): 헤더 '시행일·최종 개정 + 일반 문의/개인정보·계정 삭제', §4 10일(시행령 §43), §5 dmkim@ 명시, §6 변경 이력, English summary 'Profile → Delete account → Permanently delete'·10 days, '영업일' 0건, 홈 링크 44px | ✅ |
| 페이지 이탈 시 document.title 공통 제목 복원, 콘솔 오류 0 | ✅ |
| 내 정보 삭제 실패 안내: ko/en 사전에 gmail 0건(패리티 0), dmkim@ 링크는 설정값에서 렌더 | ✅(코드·사전) |
| Supabase 환경변수 없는 빌드에서 공개 페이지 렌더(isSupabaseConfigured 가드) | 코드 검토(런타임 미실측 — 라이브는 env 존재) |
| .gitignore: `git check-ignore` → `.gitignore:39:*.jks nongsadama-release-key.jks`, `git log --all --diff-filter=A -- '*.jks' '*.keystore'` 0건 | ✅ |
| typecheck 0 · i18n 패리티 0 · 빌드 성공 | ✅ |

## v1.1 — Play 비공개 테스트 업데이트 (2026-09-10, D-033)
사전 분석: 7개 판독 에이전트 병렬(지역 데이터 모델·클라이언트 흐름·지도/위치·콘텐츠 쿼리·브랜드/헤더·Android/Capacitor·v1.0 인벤토리) + 누락 점검.
| 검증 | 결과 |
|---|---|
| `npm run typecheck` 0 · `npm run build` 성공 · ko/en 키 패리티 0 · 플레이스홀더 불일치 0 | ✅ |
| 로고 클릭: `/board`에서 헤더 링크(href=/home, aria-label '홈', 44px, cursor pointer) → 클릭 후 `/home`, window 마커 유지(SPA, 새로고침 없음) | ✅ |
| 브랜드: `NongsaDama` 잔존 0(src·index.html·public·README), 식별자(nongsadama.app·com.nongsadama.myapp·nongsadama-v2·저장 키) 무변경 | ✅ |
| 라이브 DB: 마이그레이션 `regions_chungnam` 적용 → city 15 / town 11, centroid 누락 0(1차 적용은 커넥터 응답 없음 → 미적용 확인 후 재시도 성공) | ✅ |
| `/select`(dev 익명): 그룹 "홍성군"(읍·면 11) + "다른 시·군"(14, 이름순) | ✅ |
| 위치 추천 — 서울(37.57,126.98) 모의: "가장 가까운 서비스 지역은 당진시(약 81km)…" 안내만, regionId 저장 없음 | ✅ |
| 위치 추천 — 예산(36.68,126.84) 모의: 예산군 자동 선택·저장 | ✅ |
| 예산군 홈: 지도 중심 예산군(스크린샷), 핀 0, "아직 등록된 정보가 없어요", 오류 문구 0 | ✅ |
| 예산군 `/board` 빈 상태 · `/life-info` 빈 상태 · 오류 0 | ✅ |
| 예산군 `/farm`: "오늘 날씨 · 예산군 17.6°", "우리 지역 교육·사업 · 예산군(23건)" 실데이터, 팁 8건 | ✅ |
| 홍성읍 복귀: 홈 핀 3개 요소, 생활정보 13건, 게시글 10건, 날씨 "홍성군"·사업 34건 — v1.0과 동일 | ✅ |
| 모바일 375px: `/select`·`/home` 가로 넘침 없음, 헤더 링크 44px | ✅ |
| 새 탭 클린 로드 `/home`(홍성읍, 핀 3)·`/select` 콘솔 오류 0 (편집 중 HMR 과도기 오류는 기존 탭에만 누적, 클린 탭 재현 없음) | ✅ |
| `npx cap sync android` 성공, `android/app/src/main/assets/public/index.html` = dist(6038B, 동일 시각) | ✅ |
| 미실측(로그인 필요): 이웃 "내 지역 정하기" 분기, 프로필 편집 optgroup — 코드 검토 | 코드 검토 |
| 누락 점검(critic) 반영 후: 홍성읍 홈 핀 3(불변), 천안 좌표(36.815,127.114) 모의 '내 위치 정보 보기' → "우리 지역 교육·사업 · 천안시(22건)"(지오코더 첫 토큰; 수정 전 라이브 프로브 '천안시 동남구' 0건), Privacy 헤더 최종 개정 2026-09-10 + §6 이력 행, DeleteAccount 시행일 2026-09-10 + en 'town or city/county level', typecheck 0, 패리티 0 | ✅ |

### 독립 재검수(4차원 병렬 + 발견별 2인 반박) 반영
- P0 없음. 발견 20건(P1 1건은 Android 위치 권한 '권고' — 코드 무변경) 중 코드 반영 12건, 문서 반영 6건, 기록만 2건. 세부는 D-033 "독립 재검수 반영".
- 반박 검증 최종(44 에이전트): **확정 3건** — 위치 안내 텍스트 저장 회귀, 읍·면 정렬 회귀(홍성읍 맨 아래), ProfileEdit 14개 단일 optgroup — 모두 반영·재검증 완료. 기각 17건은 "데이터·심사 실질 영향 없음" 판정이었으나 수정 비용이 작은 항목(stale 정리 0행 가드, ko 키 폴백 차단, 지도 빈 상태 키, 헤더 접근성 이름, 버전 줄 사전화, CTA 접힘, 캡션 절대 표현, geoError 문구, 롤백 문서 FK 주석)은 함께 반영했고, Android 권한·gradle.properties·WebView OAuth·카카오맵 도메인은 문서 기록만.

| 검증 | 결과 |
|---|---|
| `/select`(홍성읍 선택): 읍·면 순서 "✓홍성읍, 광천읍, 홍북읍, 금마면, 홍동면…"(v1.0 순서), 시·군 묶음 `<details>` 기본 접힘·summary 44px·캡션 "시·군 단위로 고르기 (14)", '계속' CTA 상단 1004px(접기 전 ≈1,500px) | ✅ |
| 서울 좌표 모의 → ko 안내 "가장 가까운 서비스 지역은 당진시(약 81km)이에요. 지역은 아래에서 직접 골라 주세요." → 'English' 탭 → 같은 안내가 영어로 갱신, 기존 선택(홍성읍) 유지 | ✅ |
| 예산군 선택 상태 `/select`: 시·군 묶음 펼침(open), ✓예산군 | ✅ |
| 예산군 홈에서 '병원' 타일 → "아직 등록된 정보가 없어요"(emptyFiltered 아님), 헤더 링크 aria-label "농사다마 · 홈" | ✅ |
| typecheck 0 · 패리티 0 · 플레이스홀더 0 · 빌드 성공 · `npx cap sync android` 재실행(번들 동일) · 클린 탭 콘솔 앱 오류 0(백그라운드 탭 네트워크 중단 메시지만) | ✅ |
| 미실측(로그인 필요): ProfileEdit optgroup(홍성군 그룹 + '시·군 단위로 고르기' 그룹), 내 정보 버전 줄 `{app.name} v1.1` — 코드 검토 | 코드 검토 |

## v1.2 — 기능·데이터 품질 개선 (2026-09-12, D-034~D-037)
원인 분석은 라이브 측정 기반: 연관 글 = gte-small 임베딩 코사인 상위 3(임계값 없음, OpenAI 미사용), 정적 팁 = farm_tips 시드 8건, 지역 = 충남 15 city만·시도 단계 없음.
| 검증 | 결과 |
|---|---|
| `npm run typecheck` 0 · `npm run build` 성공 · ko/en 패리티 0 · 플레이스홀더 0 · `npx cap sync android` 성공(android 자산 = dist) | ✅ |
| 라이브 마이그레이션 4건 적용: similar_posts_relevance, farm_tips_unpublish_static, regions_nationwide, life_info_chungnam_public | ✅ |
| 라이브 DB: regions province 16 / city 230(parent·centroid 100%) / town 11, 충남 자식 15, 홍성 읍·면 parent 유지 | ✅ |
| 라이브 DB(anon 역할): life_info 공개 107(홍성 13 + 충남 94, 좌표 94/94), farm_tips 공개 0, regions 257 | ✅ |
| 연관 글 RPC(라이브·anon): "몸이 아파요"→"읍내 내과"(0.928/0.030)만, "풋살"→"축구"(0.927/0.045)만, "임금 체불"·"월급"·"덥네요"→0건, 헬퍼 bigram_jaccard 동작 | ✅ |
| 브라우저 글 상세: "임금 체불" → 비슷한 글 섹션에 "아직 비슷한 글이 없어요", 풋살 미노출; "몸이 아파요" → 링크 1건(읍내 내과) | ✅ |
| embed-post v2 배포(verify_jwt=true), OPENAI 키 없는 상태에서 gte-small 경로 유지(코드 검토; 키 있는 경로는 미실측) | ✅/코드 |
| `/select`: 시/도 미선택 시 안내만(버튼 0), 시/도 16개 옵션, 충남 → 홍성군 읍·면 11 + 시·군·구 14(접힘), 경기도 → 31(펼침), 수원시 선택·저장 | ✅ |
| 수원시(데이터 없음): 홈 지도 중심 수원·핀 0·"아직 등록된 정보가 없어요", crash 0, 가짜 정보 0; 농사 도움 "수원시 날씨 + 사업 7건" | ✅ |
| 예산군: 생활정보 7건(청·보건소·종합병원·상설시장·가족센터·역·터미널) + "최근 확인됨" 배지, 지도 핀 7 | ✅ |
| 홍성읍 회귀: 생활정보 13건, 읍·면 11 첫 그룹 | ✅ |
| 농사 도움: 정적 팁 문구 0(번들·화면), 부제 "오늘 날씨와 우리 지역 교육·사업 정보", 홈 진입 카드 문구 갱신 | ✅ |
| 카카오맵: 홈 지도·핀·내 위치 코드 무변경, 지오코더(coordToRegion) 무변경 | ✅(코드) |
| 기존 로그인: AuthContext·Login 무변경 | ✅(코드) |
| 클린 로드 콘솔: 앱 오류 0(편집 중 HMR 500은 과도기) | ✅ |
| 미실측(로그인 필요): 프로필 편집 시·도별 optgroup 렌더·저장 — 코드 검토 | 코드 검토 |
| 독립 재검수(4차원 병렬 + 발견별 반박, 워크플로 wb5tifm56): 확정 5 — P0 `text_bigrams` O(N²) 임시파일(5000자 무공백 → 144MB)·public 노출, P1 OpenAI 경로 UGC 국외 전송(방침 §3 전제), P1 이웃 뷰 범위가 시·도로 확대, P1 문서 누락, P2 발신 불가 전화 문자열. 기각 39 중 staleTime·주석·주소 접두·'민간' 표기·장날 오독·롤백 문서 등 9건 자발 반영 | ✅ 반영 |
| 하드닝 마이그레이션 `20260912000400_v12_hardening` 라이브 적용(09-13): pg_proc에 `private.text_bigrams`·`private.bigram_jaccard`만, `public.text_bigrams` 0; REST `rpc/text_bigrams` → 404 PGRST202, `rpc/similar_posts` → 200; `explain (analyze,buffers) select private.text_bigrams(repeat('가',5000))` Temp Written 0(적용 전 144MB) | ✅ |
| 하드닝 후 연관 글 회귀(anon): "몸이 아파요"→"읍내 내과"(0.928/0.030)만, "풋살"→"축구"(0.927/0.045)만, "임금 체불"→0 — 적용 전과 동일 | ✅ |
| `neighbor_profiles`: 정의에 단계 기반 키(`vr.level = 'town'`) 포함, `security_barrier=true`, 권한 authenticated SELECT만(anon 조회 permission denied) | ✅ |
| life_info 정정: 범위·접미·잘못된 지역번호 전화 0건(남은 비표준 4건은 `1422-xx` 공식 시청 콜센터), 시·군 없는 주소 0건, 우편번호 접두 0건, '민간' 명시 4건, 보령중앙시장 장날 문구 0건 | ✅ |
| `LifeInfoDetail` `tel:` 링크 숫자·+만 남김(표시 원문) — typecheck·빌드 | ✅ |

## Cloudflare 배포 오류 진단 — wrangler 자동 설정 / Vite 5 유지 (2026-09-20, D-038)
실제 배포·`wrangler login`은 하지 않았다. wrangler 실행은 전부 저장소 밖 사본에서 `--dry-run`.
| 검증 | 결과 |
|---|---|
| HEAD(`df30608`) 사본 + `npx wrangler@4.135.0 deploy --dry-run` → "Read 20 files from the assets directory … --dry-run: exiting now."(자동 설정 없음). 4.134.0·4.133.0·4.131.2·4.129.0, `CI=true WORKERS_CI=1`에서도 동일 | ✅ |
| 같은 사본에서 `wrangler.jsonc`만 숨김 → "Detected Project Settings … Framework: Vite" 뒤 오너의 Vite 6 오류가 글자 그대로 재현 | ✅ 재현 |
| 설정 없는 디렉터리 + `deploy --config wrangler.jsonc` → "Could not read file: wrangler.jsonc"(자동 설정 미실행), `--no-autoconfig` → "Missing entry-point …" | ✅ |
| 설정 있음 + `deploy --config wrangler.jsonc --dry-run`, `versions upload --config wrangler.jsonc --dry-run` | ✅ 둘 다 통과 |
| 주석을 추가한 `wrangler.jsonc`: 주석 제거 후 JSON이 원본과 동일, `deploy --config wrangler.jsonc --dry-run` 통과 | ✅ |
| 빌드 타임 주입: `VITE_STT_ENDPOINT=<더미> npx vite build --outDir <사본>` → 번들에 더미 값 1건, 실제 `dist`는 무변경(mtime 동일) | ✅ |
| 운영 실측: `nongsadama.app` = Cloudflare, 번들 버전 `1.3`, `/home`·`/privacy` 200. `df30608`(v1.3) 빌드 성공(2026-09-19T23:08:57Z) | ✅ |
| GitHub 체크 "Workers Builds: nongsadama" 전 커밋 조회: 실패 2건 — `40254b5`("Delete wrangler.jsonc", 2026-08-01, Build `a2cca8e7…`, 설정 파일 없음 + 당시 wrangler 4.118.0 = 오너 오류와 조건 일치), `80a6d7e`(`v0/figma-ui-refresh`, 2026-09-12, Build `41082f6a…`, 설정 파일 있음·원인 미확인). 2026-09-12 이후 실패 0 | ✅ 확인 |
| 로컬 Workers 런타임(`npx wrangler dev --config wrangler.jsonc`): `/`·`/home`·`/privacy`·`/board/123`·`/delete-account` 200 text/html(SPA 폴백), 해시 자산 200 text/javascript, `sw.js`·manifest·robots·sitemap 정상 MIME, `/privacy` 딥링크 렌더·콘솔 오류 0 | ✅ |
| 독립 검증 워크플로(소스 감사·웹 조사·설정 검토 + 반박): 설정 파일이 있는데 자동 설정이 도는 경로 미발견(깨진·빈 설정도 폴백 안 함, 4.118.0·4.131.1 동일), 동일 오류 이슈는 workers-sdk #14541(설정 파일 없는 저장소) 1건. 반박 단계가 "GitHub에 실패 기록 없음"이라는 최초 진단을 정정 | ✅ |
| `npm run typecheck`·`npm run build` | ✅(기능 코드 무변경) |
| 미확인: 오너가 본 실패 화면이 Build `a2cca8e7…`(`40254b5`)인지(대시보드 로그 필요), `80a6d7e` 실패 원인, Cloudflare 실제 빌드에서의 `VITE_STT_ENDPOINT` 인라인 | 오너 확인 |
