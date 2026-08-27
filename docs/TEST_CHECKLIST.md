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
