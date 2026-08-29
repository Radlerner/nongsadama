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

### D-019. 간편(소셜) 로그인 — 카카오 우선 (2026-08-27, kakao-login 스킬)
- **결정**: Supabase Auth 네이티브 OAuth로 카카오 간편로그인 도입. 이메일 로그인은 접힘으로
  **보존**(대체 아님 — 기존 계정·데모 계정 회귀 방지). 제공자 목록은 config(oauthProviders).
- **제공자 선정 근거**: 카카오(한국 생활 필수)→Google(안드로이드 보편)→Facebook(동남아 지배적)
  순 확장 예정. WhatsApp은 OAuth 미제공(불가), Telegram·Zalo는 Supabase 미지원(커스텀 필요,
  파일럿 후 재검토).
- **재검수 반영**: P0-1(랜딩 M-10 리다이렉트가 OAuth 복귀 해시 토큰 파괴 → initializing 게이트),
  P1-1(pending 닉네임은 이메일 흐름 전용), P2-1(bfcache 버튼 잠금 pageshow 리셋),
  P2-3(23505만 무시·실패 로그), P2-4(서로게이트 안전 절단).
- **미해결(아침 실험)**: scope의 profile_image는 GoTrue 서버 하드코딩(제거 불가) — 카카오 콘솔
  동의항목 해제 실험 후 불가 시 최소수집 이탈로 수용 기록 예정(P2-2).

### D-020. 개인정보처리방침 페이지 (2026-08-27, Play 심사 준비 1순위)
- **결정**: /privacy 정적 페이지. 법적 문서 특성상 i18n 사전 미사용 — 한국어 원문 기준 +
  영어 요약 병기(번역 오차 위험 회피, 의도된 i18n 예외). 수집·미수집 항목, 제3자 6종
  (Supabase·Kakao·OSM·GA4·Clarity·AddToAny)+음성 입력 고지, AI 학습 거부(robots) 명시.
- 계정 삭제는 현재 이메일 요청 안내 — 앱 내 삭제 기능(2순위) 완성 시 방침 갱신 예정.
- 노출: 랜딩·내 정보 하단 링크, sitemap 등재. §10-J 숙제 해소.

### D-021. 앱 내 계정 삭제 (2026-08-27, Play 심사 준비 2순위)
- **결정**: Edge Function delete-account — JWT 본인만 삭제(바디 입력 없음 → 혼동 대리자 불가),
  admin.deleteUser 1회로 profiles·posts FK cascade 원자 삭제. UI는 내 정보 하단
  경고+2단계 확인. 실패 시 이메일 대체 경로 안내. /privacy §4 갱신(앱 내 삭제 명시).
- E2E: 일회용 계정 생성→글 작성→삭제 호출→auth·프로필·글 0건, 타 계정 무손상, 재로그인 불가.

### D-022. in-app 신고·차단 (2026-08-27, Play 심사 준비 3순위 — UGC 정책)
- **결정**: reports(신고 — 본인 insert만, admin만 열람, 글당 1회)·blocks(차단 — 본인 것만
  CRUD) 테이블+RLS. 신고 사유는 코드값(spam/abuse/scam/other) 4택. 차단 필터링은
  클라이언트(게시판 목록·이웃 목록). help 글의 mailto 신고를 in-app 신고로 대체(안전 문구 유지).
- 차단 관리는 내 정보에서 목록·해제. 신고 검토는 운영자(admin role 승격 필요 — 운영 절차)
  또는 Supabase 대시보드.

### D-023. PWA 도입 (2026-08-27, Play 심사 준비 4순위 — TWA 전제)
- **결정**: manifest.webmanifest(standalone·ko·아이콘 192/512 any+maskable — 크림 여백이
  안전영역 역할)+최소 서비스워커. SW 전략은 보수적: 내비게이션 network-first(배포 전파 보장,
  오프라인 시 셸 폴백)·해시 자산만 cache-first·교차 출처 불관여. 등록은 PROD 전용,
  scope=BASE_URL(GH Pages /nongsadama/ 대응 — %BASE_URL% 치환 검증).
- 이로써 Bubblewrap TWA 패키징 가능 상태. 스토어 등록 시 assetlinks.json(디지털 자산 링크)은
  패키징 단계에서 추가 필요(후속 — play-submission 스킬 후보).

### D-024. 오류 경계 + 오프라인 안내 (2026-08-27, Play 심사 준비 7순위)
- 최상위 ErrorBoundary(Provider 크래시 포함 — i18n 비의존 한/영 정적 병기, 새로고침 CTA 56px).
- OfflineBanner: online/offline 이벤트 기반, AppLayout 헤더 아래(농촌 통신 환경 대응).
- 오프라인 배너 dev 검증 통과. 오류 경계는 코드 검토 수준(크래시 주입 테스트는 생략 — 후속).

### D-025. 디자인 v0 (2026-08-27 야간, 경기도 이주민 포털 벤치마크)
- **벤치마크**: 경기도 이주민 포털(26.7.8 개통 — AI챗봇·다국어 번역·국적/지역 커뮤니티·
  위치기반, 반응형 웹). 데이터·챗봇은 단기 추격 불가 → 우리의 우위는 "10세도 쓰는 단순함"
  (화면당 1과업·큰 터치·이모지)로 설정.
- **토큰**: 로고 퍼즐 팔레트를 brand-*(green/purple/orange/cream/ink)로 테마화.
  기존 green-* 호환 유지, rounded-card(12px)·shadow-card 통일. 점진 적용.
- 적용 순서: 랜딩(로고+크림+기능 3칩) → 로그인(로고+카드 패널) → 카드·목록 일관화 → 상세.
- AI 챗봇·자동번역 접목은 LLM 비용 결정 필요 — 밤샘 범위 제외, 오너 결정 항목.

### D-026. 생활정보 실데이터 시딩 (2026-08-27, Play 심사 준비 5순위)
- **결정**: [샘플] 16건 전량 제거 → 공공·대형 기관 실데이터 9건(+기존 핫라인 4건 = 13건).
  홍성의료원·보건소·홍성/광천전통시장·군청·홍성/광천역·종합터미널·군가족센터.
- **정확성 원칙**: 공식 출처(source_url 필수 — 의료원·군청·문화관광·가족센터 공식 페이지,
  역은 위키·터미널은 나무위키로 출처 등급 명시), 전화는 공식 확인분만(미확인은 null),
  좌표 미입력(오좌표 위험 차단 — 읍·면 중심 핀+"위치 검수 전"), verified_at=null
  ("검수 확인일 없음" 표시 → 운영자 검수 후 갱신). 시드 보존: supabase/seeds/.
- **검수 절차**: 운영자가 source_url 대조(권장: 전화 1통) 후 verified_at=now() 갱신.
  소상공인(개별 마트·식당)은 오류 위험이 높아 파일럿 협의 후 추가.

#### D-019 추기 (2026-08-28, KOE205 실측)
- P2-2 실험 결론: 카카오 동의항목에서 profile_image를 해제하면 **KOE205**(scope-동의항목
  불일치)로 로그인 자체가 거부됨 — Supabase(GoTrue)가 nickname·email·image 3-scope를
  고정 요청하기 때문. → **profile_image 수집 수용**(처리방침 §1에 기고지, 정합).
  동의항목 3종은 항상 켜 둘 것: 닉네임(필수)·프로필 사진(선택)·이메일(선택).
- 참고: KOE 오류 페이지의 "OO 서비스"는 카카오 앱 이름 표기(지도용 앱 재사용 중).
  Site URL 미설정(localhost:3000 폴백) 문제는 URL Configuration 설정으로 별도 해결.

### D-027. 🌾 농사 도움(farm_tips) (2026-08-28, PRD v1.7 §1 — 야간 범위)
- **결정**: 생활정보와 대칭인 농업기술·안전 팁. life_info 패턴 복제(공개 읽기 RLS·admin
  쓰기·localized_content name/description 통일·verified_at 검수 모델·출처 필수).
  비로그인 열람(§2), TTS 읽어주기, 작목 태그(프로필 crop_type 문자열 매칭 — 코드 비하드코딩),
  내 작목 팁 우선 정렬. 진입: 홈 지도 아래 카드(하단 5탭 불변 — 10세 원칙).
- **시드 8건**: 폭염·농약·농기계·하우스 환기·근골격 안전(공통 5) + 딸기·사과(작목 2) +
  주간농사정보 안내 1. 전부 일반적 공공 안전 지식 수준 + 농사로/농약안전정보시스템 출처.
- **농사로 OpenAPI 실연동은 키 발급 후**(Edge Function 프록시 — PRD v1.7 §7-B 오너 액션).

### D-028. 외부 실데이터 연동 3종 (2026-08-28 밤샘, PRD v1.7 항목1·2·3)
- **키 보관**: 대시보드 secret 대신 public.api_keys(RLS 정책0+grant 회수=service_role 전용)
  — private 스키마는 PostgREST 미노출로 Edge Function 접근 불가(실측 후 전환). 키는
  저장소·클라이언트 미노출, api_cache로 상류 보호.
- **rural-programs**(농진청 농촌지도사업정보): 실검증 스펙(getExtensionList, pageSize≤100,
  31p, JSON) → 연도 전체 24h 캐시 → sido/center 부분일치 필터. 홍성 34건 0.4s.
- **weather**(koreaConnect 날씨 MCP): SSE→JSON-RPC(initialize→tools/call current_weather)
  왕복을 서버측 고정, 좌표 0.1° 반올림 30분 캐시(위치 정밀도 미저장). verify_jwt=false
  2종 = 공개 데이터·비로그인 원칙(무료 티어 invocation 소모는 캐시로 완화, 수용).
- **위치기반(항목1)**: 기본=선택 지역 중심좌표(파일럿), "내 위치"=geolocation→카카오
  지오코더(coord2RegionCode, libraries=services)→실제 시도·시군 → 전국 테스터가 자기
  지역 날씨·사업을 봄. 좌표는 조회에만 사용(v1.3 §4.1). UI는 FarmTips 상단 2카드.
- 커뮤니티(게시판·이웃)는 파일럿 지역 유지 — 정보성 콘텐츠만 전국화(단계적 확장).

#### D-028 추기 — 재검수 반영 (2026-08-28 새벽)
- **승인 근거(P2-6)**: 외부 API 실연동은 PRD v1.7에서 "승인 필요"였으나, 오너가 2026-08-28
  /loop 지시문으로 엔드포인트·키를 직접 제공하며 항목 2·3 구현을 명시 지시 — 사후 승인 성립.
- **P1 반영**: ①저장소↔배포본 역동기화(+배포 절차 주석 — 재배포 시 무언 503 방지)
  ②좌표 프라이버시 — 클라이언트·서버 이중 0.1° 반올림(상류에도 정밀 좌표 미전송),
  /privacy §1 문구·§3 날씨 제공자 고지 갱신 ③비용 상한 — 한국 bbox(33~39/124~132) 거부,
  연도 2015~내년 클램프, 부분 수집 미캐시(P2-1), 로그 키 마스킹(P2-7), 지오코더 실패
  안내 문구(P2-3).
- **자기 회귀 수정**: v3의 Number(null)=0 → 연도 미지정이 2015로 클램프되던 결함을
  라이브 실측(34→39 불일치)으로 잡아 v4에서 4자리 검사로 수정, 3케이스 재검증.
- **후속(전국 확장·상류 변경 시)**: SSE 파서 CRLF·멀티라인(P2-2), 동명 시군(고성군 실증,
  P2-4)·시도 축약형(P2-5) — region 데이터에 시도 필드 추가로 해소, 캐시 청소 주기(P2-8),
  날씨 카드 영문 지역명(P2-9).

### D-029. 디자인 v1 전면 개편 (2026-08-28, 오너 지시 — 레퍼런스 2종 실측 반영)
- **배경**: v0 컴포넌트 추출은 "시각 동일"이 목표라 사용자 눈엔 개선이 없었음(오너 지적 정당).
- **레퍼런스**: im-not-ai(Humanize KR — AI 한국어 패턴 70종: 번역투·형식명사·기계 존댓말),
  VoltAgent/awesome-design-md(Stitch DESIGN.md 형식 — 철학+구체 제약).
- **산출**: docs/DESIGN.md 9섹션("햇살 아래 밭 한 뙤기" — DESIGN_TOKENS.md 흡수·대체) +
  전 화면 적용: 크림 그라운드 전면(회색 배경 폐지)·카드 16px·주 CTA 알약(rounded-full)
  16곳·제목 20px extrabold·헤더 로고·하단 탭 활성 연초록 알약·필터 칩 흰 배경·
  날씨 큰 이모지+30px 온도(다국적 직관성 — 글자 없이 이해).
- **문구**: ko.json 76키 humanize(해요체 통일·번역투 제거·짧게 — 의미·수치·법적 고지 보존).
- 실측: 크림 #f5f1e8·radius 16px·CTA 9999px·제목 800/20px·온도 30px·34건 렌더.
