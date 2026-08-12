# 주요 의사결정 기록 (DECISIONS)

PRD_v1_3.md를 기준으로 한 기술·제품 의사결정과 이유를 남긴다.

---

## 2026-07-26 · v0.1.0 기반 스캐폴딩

### D-001. `/select` 지역 선택은 골격만, 실제 선택은 데이터 모델 이후
- **결정**: 언어·지역 선택 화면(`/select`)을 추가하되, 언어는 선택 가능하게 하고
  지역 선택은 빈 상태(골격)로만 둔다.
- **이유**: 지역 목록은 `regions` 테이블에 의존한다. 해당 테이블과 RLS는 별도 "데이터 모델"
  작업 범위이며, 스캐폴딩 단계(v0.1.0 = "화면 골격과 배포 연결")에서는 화면 골격까지가 범위다.
- **영향**: PRD 5(IA)의 "언어·지역 선택" 화면 골격 요구는 충족. 실제 지역 데이터 연동은 후속.

### D-002. `defaultLocale`는 임시값(`ko`)
- **결정**: 기본 UI 언어를 `ko`로 두되 최종값으로 확정하지 않는다.
- **이유**: 대상 사용자는 한국어에 익숙하지 않은 외국인 근로자이므로 `ko`는 부적절할 수 있다.
  다만 파일럿 검증 언어는 PRD 14장의 출시 전 미확정 사항이라 임의로 확정하지 않는다.
  사용자가 선택 화면에서 언어를 고르면 기본값 대신 선택값(localStorage 저장)이 사용된다.
- **영향**: 파일럿 언어 확정 시 `src/config/app.ts`의 `defaultLocale`만 교체한다.

### D-003. 국가·언어 비종속: locale은 설정 데이터로만 관리
- **결정**: 지원 언어 목록·기본 언어·언어 라벨을 `src/config/app.ts`에 데이터로 두고,
  비즈니스 로직에서 특정 코드(`ko`/`en` 등)로 분기하지 않는다.
- **이유**: PRD 0·6.4의 국가·언어 비종속 원칙. 언어 추가는 사전 JSON 추가와 설정 등록만으로
  가능해야 하며 DB 변경이 필요 없어야 한다.

### D-004. Supabase는 anon 키만, 클라이언트 지연 생성
- **결정**: 프론트엔드는 anon 공개 키만 사용하고 `service_role` 키는 코드/저장소에 두지 않는다.
  클라이언트는 실제 호출 시점에 생성하며, 환경변수가 없으면 명확한 오류를 던진다.
- **이유**: PRD 7.3 보안 원칙. 골격 화면은 env 없이도 동작해야 한다.

---

## 2026-07-26 · 데이터 모델 + RLS

### D-005. 값 집합은 ENUM 대신 text + CHECK 제약
- **결정**: `level`/`category`/`status`/`role`을 Postgres ENUM이 아닌 `text` + `CHECK IN (...)`로 제약.
- **이유**: 값 추가·변경 시 `ALTER TYPE` 없이 마이그레이션이 간단하고, PRD 7.3 "제약조건으로 검증"에 부합.
  단, 특정 언어·국가 코드(`ko`/`vi` 등)는 CHECK로 제약하지 않는다(비종속 원칙, D-003).

### D-006. profiles는 본인만 조회, 공개 닉네임은 `public_profiles` 뷰로만 노출
- **결정**: `profiles` 원본 테이블 SELECT는 `authenticated`의 **본인 행만** 허용한다.
  게시글 작성자 닉네임 등 공개가 필요한 값은 `public_profiles(id, nickname)` 뷰로만 노출하고,
  이 뷰만 anon/authenticated에게 읽기 허용한다.
- **이유(개정)**: 최초 설계는 profiles 전체 컬럼을 anon 공개했으나, 독립 재검수(P1)에서
  `country_code`·`region_id`·`auth_provider`가 **비로그인 공개 인터넷에 노출**되어 취약 사용자층의
  국적+지역 프로파일링·표적화 위험이 지적됐다. 실제 필요한 노출은 닉네임뿐이므로 개인정보
  최소노출 원칙(PRD 9)에 따라 뷰로 좁혔다.
- **구현 메모**: 뷰는 정의자(소유자) 권한으로 실행되어 profiles RLS를 우회하나, 노출 컬럼이
  id·nickname 뿐이라 민감정보는 공개되지 않는다. Supabase 린터의 "security definer view" 경고는
  의도된 최소노출로 수용한다.
- **방어심화(재재검수 N-1 반영)**: RLS 정책만으로는 anon이 테이블 권한을 보유할 수 있어(기본권한),
  마이그레이션에서 anon/authenticated의 권한을 먼저 `revoke all` 후 필요한 것만 `grant` 한다.
  이로써 anon은 profiles 원본 테이블 권한 자체가 없어 GRANT 계층에서도 노출이 봉쇄되고,
  `rls_check.sql`의 R9(anon profiles 직접조회 거부)가 permission-denied로 결정적으로 통과한다.

### D-007. posts 삭제는 소프트·하드 병행, 소유자는 상태 무관 조회
- **결정**: 소유자에게 `UPDATE`(status='deleted' 소프트 삭제)와 `DELETE`(하드 삭제)를 모두 허용.
  공개 SELECT는 `status='published'`만, 소유자는 자기 글을 상태와 무관하게 조회.
- **이유**: 작성 UI(후속 작업)에서 삭제 방식을 선택할 수 있게 열어 두고, 초안/숨김 관리도 가능하게 함.

### D-008. admin 판별은 SECURITY DEFINER 함수 + role 변경 방지 트리거
- **결정**: `public.is_admin()`을 `SECURITY DEFINER`로 두어 RLS 재귀 없이 admin 여부 확인.
  일반 사용자의 자기 `role` 승격은 트리거로 차단하고, 자기 프로필 insert 시 `role='user'`로 고정.
- **이유**: RLS만으로는 old/new 비교가 불가해 권한 상승을 막지 못한다. `auth.uid()`가 null인
  서비스 역할/대시보드(운영자)는 트리거 검사를 건너뛰어 admin 승격을 정상 수행한다.

### D-009. 로컬 DB 부재로 SQL 미실행
- **결정**: 개발 머신에 Supabase CLI/Docker/psql이 없어 SQL을 이 환경에서 실행·검증하지 못했다.
  마이그레이션은 리뷰까지 완료 상태이며, 실제 적용·RLS 통과는 사용자 Supabase에서 수행한다.
- **적용 방법**: Supabase CLI `supabase db push` 또는 SQL Editor에 마이그레이션을 순서대로 실행.
  RLS 검증은 `supabase/tests/rls_check.sql` 또는 두 실제 계정 앱 테스트(Week 3).
- **해소(2026-07-26)**: Supabase MCP로 프로젝트 nongsadama(`ikusdwursvbdrznbcjtw`)에 적용하고
  R1~R9 라이브 검증을 전부 통과했다(docs/TEST_CHECKLIST.md). D-009의 미실행 위험은 해소됨.

### D-010. 보안 어드바이저 대응
- **하드닝(적용)**: `set_updated_at`에 `search_path=''` 고정, 트리거 전용 함수
  `prevent_profile_role_change`의 EXECUTE를 public/anon/authenticated에서 회수
  (마이그레이션 `20260726000200_security_hardening.sql`). 트리거는 EXECUTE 권한과 무관하게 작동한다.
- **수용(미변경)**:
  - `is_admin()`의 EXECUTE는 유지한다. RLS 정책(life_info)이 이 함수를 평가하려면 호출 역할에
    EXECUTE가 필요하며, 회수 시 anon/authenticated의 정책 평가가 깨진다. 반환값은 "본인이 admin인가"
    뿐이라 정보 노출이 미미하다(어드바이저 WARN 수용).
  - `public_profiles` security-definer 뷰 ERROR는 의도된 최소노출 설계다(D-006).

### D-011. 마이그레이션 적용 경로와 버전 정합
- **현황**: 초기 부트스트랩은 Supabase MCP `apply_migration`으로 수행해, 원격
  `supabase_migrations.schema_migrations`의 버전이 저장소 파일명 타임스탬프와 다르다.
  (예: 저장소 `20260726000000_initial_schema` ↔ 원격 `20260725170556_initial_schema`.)
  내용은 동일하다.
- **방침**: 원격 스키마가 실제 적용 상태의 기준이다. 이후 Supabase CLI를 도입하면
  `supabase migration repair`로 원격 이력과 저장소 파일명을 일치시킨다. 재검수 P2-1 반영.
- **P2-2 반영**: `set_updated_at`의 `search_path=''`를 원본 `initial_schema`에도 반영해
  단독 재실행 시에도 어드바이저 경고가 재발하지 않게 했다.
- **시딩**: `supabase/seed.sql`(파일럿 홍성군) — 지역은 실제 행정정보, 생활정보는
  "[샘플] 검수 필요" 데이터(전화·주소 비움, 출처 없이 지어내지 않음, PRD 6.3).

---

## 2026-07-26 · PRD v1.4 매칭 기반 DB 확장

### D-012. 이웃 매칭 노출 모델 (PRD_v1_4.md)
- **결정**: 매칭 관련 노출은 전부 opt-in(`profiles.is_matching_visible`, 기본 false)이며
  뷰·GRANT로 DB에서 강제한다.
  - `public_profiles` 개정: `country_code`는 동의자 행만 값 노출(게시글 국적 표시용, 미동의 null).
  - 신규 `neighbor_profiles` 뷰: 동의자의 닉네임·읍면·국적·작목·언어만. GRANT는 authenticated 한정,
    뷰 정의에 `is_matching_opted_in()`(상호성: 열람자 본인도 동의자) 내장.
  - `regions.centroid_lat/lng`: 근사 거리("약 N km") 계산용 **지역** 중심좌표(±1~2km 오차 가능,
    공개 행정 지리정보). 사용자 위치는 여전히 수집·저장하지 않는다.
  - `profiles.crop_type`: 재배 작목(선택, 자유 텍스트 — 작목 코드 하드코딩 없음).
  - `life_info.opening_hours/language_support`: 재검수 발견5(PRD 4.3-3) 반영, 운영자 검수 입력용.
- **함수 권한 학습**: 뷰에 참조된 함수는 호출자 권한으로 실행된다. `is_matching_opted_in()`은
  authenticated에 EXECUTE 필요(회수 시 뷰가 깨짐 — 라이브에서 확인). anon/public은 회수.
  어드바이저의 신규 ERROR(neighbor 뷰 security-definer)·WARN(is_matching_opted_in authenticated)은
  D-010과 동일한 근거(의도된 최소노출·정책 평가 필요)로 수용한다.
- **검증**: 라이브 M1~M8 통과 — anon 국적은 동의자만/neighbor 접근 거부, 미동의 사용자 0행(상호성),
  동의 사용자는 동의자만 조회, 본인 동의 토글 가능, 기존 R7(권한 상승 차단) 회귀 없음.
- **재검수 반영(P2)**:
  - 두 뷰에 `security_barrier` 설정(leaky qual pushdown 차단). 자동갱신 가능성은 남으므로
    **뷰 재생성 시 revoke-then-grant(SELECT만)+barrier를 반드시 반복**한다 — 누락 시 정의자 권한으로
    profiles 전체가 노출/쓰기 가능해지는 P0 경로가 된다.
  - PRD v1.4 §2.4 문면은 public_profiles에 crop_type·region_id까지 확장이나, 구현은 **의도적으로 더 좁게**
    country_code만 public에 두고 crop_type·region_id는 neighbor_profiles(로그인+상호성)로 한정했다.
    게시글 거리는 게시글의 region_id로 계산하므로 기능 결손 없음.
  - `is_matching_visible` 동의 하나가 (a) 이웃 목록 노출 + (b) 게시글 국적의 **비로그인 포함 공개**를
    겸한다. Week 3 동의 화면 문구에 (b)를 명시할 것(TEST_CHECKLIST 요건 등록).

### D-014. 기본 인증 1종: 이메일+비밀번호 (2026-07-26 야간, Week 3)
- **결정**: PRD 7.4의 "1종 선택" — 이메일+비밀번호. 매직링크는 매 로그인마다 이메일 수신함
  접근이 필요해 대상 사용자(이메일 사용률 낮음)에 부적합, SMS는 비용으로 제외(PRD 명시).
- **제약 발견**: Supabase 내장 메일은 rate limit이 매우 낮아 확인 메일 의존 불가 →
  운영자 조치로 Confirm email OFF 필요(TEST_CHECKLIST). 데모 계정은 SQL 시딩(확인완료+bcrypt).
- **재검수 P1-2 반영(2026-07-29)**: neighbor_profiles 뷰에 "같은 시/군" 스코프 추가
  (마이그레이션 20260726000400). 동의 고지 문구도 "같은 시/군"으로 정합화.
  라이브 검증: 같은 군 보임/타군 상호 숨김(S1~S3 PASS).
- **재검수 반영 기타**: 이웃 카드→그 이웃의 공개 게시글(P1-1, /board?author=),
  ProfileEdit upsert로 무음 no-op 제거(P1-3), pending 닉네임 가입 실패 시 정리(P2-1),
  게시글 상세 거리 표시(P2-5). 지역 미선택/무효 시 게시판 전체 피드 폴백은 **의도된
  graceful fallback**으로 확정(P2-8 의견 수용, 단일 시/군 데모 기준).

### D-015. 지도·음성 방향 전환 검토 — 롤백 분석 (2026-07-29 야간)
- **지시**: 지도 홈·포켓몬고식 직관 UX(10세 사용성)·음성 고민 라우터(4-way)·이웃 호출로 개정 검토.
- **산출물**: PRD_v1_5.md **초안(승인 대기)** — IA 재설계, 라우터 단계화(A 가이드→C/D LLM은
  v1.1 비용 승인 별도), 안전 원칙(위기 신호 상담기관 우선·음성 원본 미저장), 범위 재편성.
- **롤백 결론**: 코드 롤백 불필요 — 기존 자산(중심좌표·매칭·게시판·생활정보)이 전부 새 방향의
  토대. 홈/탭 구성만 대체됨. 앵커로 `v0.3.0` 태그(0d463eb) 생성·푸시. 실험 실패 시 브랜치 폐기로
  충분(main 안정 유지).
- **구현 미착수**: PRD 11.7에 따라 승인 전 코드 변경 없음(태그·문서만).

### D-013. 우선순위·신선도 재확인 (2026-07-26, 제품 오너 결정)
- **채팅(DM)**: 데모 범위는 이웃 목록까지(v1.4 유지). DM은 검증 후 v1.1에서 안전장치(차단·신고)와
  함께 검토한다.
- **Week 3 순서**: 매칭 우선 — 로그인 → 프로필(작목·매칭 동의) → 이웃 목록 → 게시글 작성.
  (게시판 쓰기보다 이웃 연결이 먼저 나오도록 조정)
- **생활정보 신선도**: 현재 시딩은 전부 "[샘플] 검수 필요"이며 실정보가 아니다(의도됨).
  대책: ① 신선도 배지 즉시 추가 — verified_at 기준 "N개월 전 확인"/"검수 확인일 없음",
  6개월 이상·미기재는 경고색(STALE_AFTER_MONTHS=6, src/lib/freshness.ts) ② 파일럿 전 출처·확인일
  있는 실검수 데이터로 교체(기존 체크리스트) ③ 신고 버튼·공공 API 연동은 도입하지 않고 백로그 유지.

### D-016. 공식 데모 주소 확정 + Microsoft Clarity (2026-08-01, 제품 오너 결정)
- **공식 웹서비스**: https://nongsadama.app (커스텀 도메인, 2026-08-02 승격. 구주소 workers.dev는 유지) (Cloudflare Workers, Git 연동 자동 빌드).
  GitHub Pages는 보조 배포로 유지. env는 양쪽(GitHub Variables / Cloudflare 빌드 변수)에 중복 관리.
- **Microsoft Clarity(xvb0klm2wu)**: index.html에 삽입(SPA라 전 페이지 커버, 라우트 자동 추적).
  localhost 가드로 개발 트래픽 제외. 세션 녹화·히트맵은 제3자 전송 — GA·Web Speech·카카오맵·
  OSM 타일과 함께 개인정보 처리방침(§10-J) 고지 목록에 포함.

### D-017. GEO(생성엔진 최적화) 정책 (2026-08-02, 제품 오너 승인)
- **접근 정책**: AI 검색·인용 봇(OAI-SearchBot·Claude-SearchBot·Claude-User·ChatGPT-User) 허용.
  **학습 수집 봇(GPTBot·ClaudeBot·Google-Extended·CCBot)은 /board 차단** — 취약 사용자층
  UGC의 학습 데이터 흡수 방지(PRD 9). 공익 정보(생활정보·상담기관)는 학습 허용.
- **콘텐츠**: public/llms.txt(서비스 요약+공공 핫라인 — CSR 본문 비가시성 우회),
  JSON-LD FAQPage(라우터 안전 안내와 동일한 공공 사실만, 핫라인은 자사 ContactPoint로
  오표기하지 않음). 프리렌더는 v1.1 백로그.
- **실측**: Cloudflare가 AI 봇 UA를 차단하지 않음 확인(전부 200). Bing Webmaster+IndexNow
  등록은 운영자 계정 작업으로 이관.
