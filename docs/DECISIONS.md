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

### D-030. 계정 삭제 안내 공개 페이지 /delete-account (2026-09-09, Play Data safety 제출 URL)
- **결정**: 인증·지역 선택·리다이렉트 무관 독립 라우트(App.tsx, AppLayout 밖). 한·영 정적 병기
  (법정 고지 — i18n 사전 예외, D-020과 동일). 요청 이메일은 config `deletionRequestEmail`
  (dmkim@nongsadama.app) — 신고용 operatorEmail과 분리. /privacy §4도 동일 이메일·문구로 정합.
- **문구 원칙**: 앱 내 즉시 삭제 경로(내 정보→계정 삭제→영구 삭제 확정) + 이메일 경로(가입 이메일
  발신·요청일로부터 10일 이내 — 시행령 §43③, D-032에서 '영업일 7일'을 정정), 삭제 데이터 전체
  목록, 법정 보관 가능 고지(관계 법령 요구 시 분리 보관 후 파기·백업 30일 순차 삭제). 실제 구현은
  delete-account Edge Function의 즉시 cascade 삭제(D-021).
- **제출 URL**: https://nongsadama.app/delete-account (Cloudflare 200). GitHub Pages는 SPA 폴백으로
  렌더되나 HTTP 404 상태이므로 제출용으로 쓰지 않는다.

### D-031. 아동 안전 표준 공개 페이지 /child-safety (2026-09-09, Play Child Safety Standards 제출 URL)
- **결정**: /privacy·/delete-account와 동일한 독립 공개 라우트(AppLayout 밖, 인증·지역 무관).
  오너 제공 한·영 문안을 그대로 게시하되 원문에 혼재한 support@/dmkim@ 중 **dmkim@nongsadama.app으로
  통일**(config childSafetyEmail — 미개설 주소 노출 방지, 한 줄로 교체 가능). 마지막 업데이트 날짜
  상수(LAST_UPDATED). 기존 페이지 무수정(라우트·config·sitemap만 추가).
- **제출 URL**: https://nongsadama.app/child-safety (Cloudflare 200).

### D-032. 공개 법적 페이지 재검수 반영 (2026-09-09, /delete-account·/child-safety 독립 검수 후속)
- **법정 기한**: 이메일 삭제 요청 처리 기한을 '영업일 7일'에서 **요청일로부터 10일 이내(통상 3일)**로
  정정 — 개인정보 보호법 시행령 §43③은 역일 10일이라 영업일 7일은 연휴 시 초과. /delete-account·
  /privacy §4·§5 세 곳 동일 문구.
- **창구 단일화**: 계정·개인정보 요청은 `deletionRequestEmail` 하나로. 앱 내 삭제 실패 안내
  (profile.deleteAccountError)에서 gmail 주소를 빼고 설정값 링크를 렌더(사전 문자열 하드코딩 제거).
  mailto 제목도 `deletionRequestMailto` 상수로 통일. /privacy 헤더는 '일반 문의 / 개인정보·계정
  삭제' 역할 명시.
- **카카오 연결 해제**: delete-account Edge Function은 auth.identities만 지우고 카카오 측 unlink는
  호출하지 않는다. 문구를 사실대로("농사다마 저장 연결 정보 삭제 + 카카오 연결된 서비스 관리에서
  직접 해제")로 고치고, 삭제 목록에 카카오 전달 닉네임·프로필 이미지 URL을 명시. **후속**: 카카오
  Admin 키를 Supabase secret으로 받으면 deleteUser 전에 `POST kapi.kakao.com/v1/user/unlink`
  (target_id_type=user_id) 호출, 실패는 로그만 남기고 삭제 진행.
- **날짜·이력**: 게시일보다 앞선 시행일 금지 — DeleteAccount 시행일·ChildSafety LAST_UPDATED를
  2026-09-09로. /privacy는 시행일(08-27) + 최종 개정(09-09) 병기와 §6 변경 이력 신설(§30 요건).
  문안 변경 시 해당 상수를 같이 올린다(각 파일 상단 주석).
- **접근성·제목**: 세 페이지 홈 링크 44px(inline-flex) + 화살표 aria-hidden, 한·영 섹션 lang 속성,
  아동 안전 연락처 블록의 독립 이메일 링크 44px, `useDocumentTitle`로 페이지 제목(탭·북마크·심사
  스크린샷). min-h-screen으로 크림 배경이 화면 끝까지.
- **가용성 분리**: AuthProvider 초기화가 Supabase 환경변수 없을 때 throw→ErrorBoundary로 전체 트리가
  죽던 결합을 끊음(`isSupabaseConfigured` 가드). 공개 법적 페이지는 인증 설정과 무관하게 렌더.
- **저장소 보호(범위 외 관찰)**: 오너의 Capacitor 작업으로 저장소 루트에 `nongsadama-release-key.jks`
  (untracked)가 생겼고 공개 저장소에 `*.jks` 규칙이 없었다. `.gitignore`에 `*.jks`·`*.keystore`·
  `keystore.properties` 추가(이력에 커밋된 적 없음 확인). 키 파일은 저장소 밖으로 옮기고 향후 Gradle
  signingConfigs는 무시 대상 keystore.properties/환경변수를 참조할 것 — 파일 이동은 오너 작업.
- **기각 유지**: 보관 데이터 수치 미기재·문체 혼용·Card 컴포넌트 미사용·정적 HTML 부재 등은 검증
  단계에서 기각(Play 요건·실질 영향 없음) — 변경하지 않음.

### D-033. v1.1 — 지역 일반화(홍성 → 충남 15 시·군), 로고 홈 링크, 브랜드 표기, 릴리스 버전 체계 (2026-09-10)
- **원인 진단**: 7개 판독 에이전트 병렬 분석 결과 코드의 홍성 상수는 지도 중심 폴백 `[36.6,126.66]`(MapHome 2곳)뿐.
  홍성 밖에서 안 되던 진짜 원인은 `regions`에 홍성군 1개 city만 있었다는 **데이터 상태**와, "내 주변 지역
  찾기"가 30km 밖이어도 최근접 읍·면(=홍성)을 자동 저장하던 **폴백 규칙**.
- **데이터로 확장**: 충남 14개 시·군을 city 행으로 추가(스키마 무변경, 마이그레이션 `20260910000000_regions_chungnam.sql`,
  라이브 적용). 좌표는 시·군청 위치를 카카오 Places로 검색하고 coord2RegionCode로 시·군 일치를 확인해 기록 —
  기억에 의존한 숫자 없음. 콘텐츠(생활정보·게시글)는 만들지 않는다(가짜 데이터 금지). 읍·면은 실데이터가
  생길 때 parent_id로 추가(홍성 패턴).
- **선택 단위 규칙**: 읍·면이 있는 시·군은 읍·면으로, 없는 시·군은 시·군 자체로 고른다(`selectableRegions`·
  `groupRegionsByCity`). 선택 화면은 읍·면 그룹(홍성) 먼저, 나머지는 "다른 시·군" 한 묶음 — 시·군 수만큼
  화면이 길어지지 않게. `countyRegionIds`는 city 선택을 이미 처리하므로 게시판·생활정보·이웃 뷰·글쓰기는 그대로.
- **폴백 설정값화**: `regionConfig`(defaultMapCenter 전국 보기·줌·outOfAreaKm). 지도 초기 보기는
  선택 지역 → 부모 시·군 → 설정값 순이며 "DB 순서상 첫 centroid 지역" 폴백은 제거(다지역에서 비결정적).
  `fetchRegions`는 시·군 먼저·이름순으로 결정적 정렬.
- **자동 선택 금지**: 30km 밖이면 `select.geoFar`로 가장 가까운 시·군과 거리만 알리고 저장하지 않는다.
  홈의 "이 지역으로 보기"는 사용자 클릭이 있으므로 유지.
- **stale id 정리**: `useStaleRegionCleanup`을 AppLayout(앱 셸)과 Select에서 호출 — 비활성·삭제 id가
  조용히 전체 범위로 바뀌던 경로 차단.
- **빈 상태**: 지도 핀 0건 문구(lifeInfo.empty 재사용), 이웃 "내 지역 정하기"(프로필 지역 없으면 DB 뷰가
  항상 0행이라 원인 안내), 프로필 편집 optgroup(시·군 없는 읍·면 나열로 인한 오선택 방지).
- **시·군 이름 조회**: `regionName(names,'ko')` — 농진청 센터명 부분일치는 한국어 행정명이 전제. 데이터 규칙:
  시·군 names에 `ko` 필수. 시도 단계가 없어 sido는 지오코더 경로에서만 안다(동명 시·군은 전국 확장 시 과제).
- **로고 홈 링크**: 헤더 로고+브랜드를 `Link to="/home"`(하단 탭·뒤로가기 폴백·로그인 후 이동과 동일 근거).
  Landing·Login 로고는 그대로(랜딩은 자기 자신, 로그인은 하단에 홈 링크 기존재).
- **브랜드**: 사용자 노출 영문은 `NongsaDaMa`. 식별자(도메인·패키지 id·캐시명·저장 키·GitHub 경로)는 불변.
  Privacy 영문 요약의 표기 교정은 실질 변경이 아니라 개정일을 올리지 않았다.
- **버전 체계**: `src/config/version.ts`가 웹 단일 기준, Android는 build.gradle(versionCode 2·"1.1"),
  package.json 1.1.0. 릴리스 문서 `docs/prd/PRD_v<버전>.md`·`docs/changelog/CHANGELOG.md`·
  `docs/releases/RELEASE_v<버전>.md`, git 태그 `v1.1`. 루트 `PRD_v1_x.md`는 기능 스펙 반복본으로 별도 축.
- **누락 점검(critic) 반영**: ① 지도 핀 제외 규칙을 '시·군 행+주소 없음'에서 '시·군 행+주소 없음+support'로 —
  읍·면 없는 시·군은 모든 정보가 시·군 행이라 병원·마트까지 지도에서 사라지던 무언 누락 차단(홍성 핫라인 4건은
  그대로 제외). ② 카카오 지오코더 `region_2depth_name`이 '천안시 동남구'처럼 두 토큰이면 첫 토큰만 시·군으로
  (라이브 확인: center='천안시 동남구' 0건 → '천안시' 22건; sido '충청남도'는 전체명 일치 확인). ③ 시·군 단위
  선택은 한 단계 넓은 줌(`cityMapKakaoLevel 10`), "내 위치"는 전국 보기에서도 최소 확대(`locateKakaoLevel 8`,
  Leaflet은 기존 12 유지). ④ '읍·면 단위' 전제 문구 일반화(map.unlocated·privacyNote·matchingConsentDetail·
  Same town→Same area·Privacy §1·DeleteAccount 프로필 항목·llms.txt) — 법적 페이지는 개정일 2026-09-10 갱신·
  §6 이력 추가. 기각/보류: 선택 화면 그룹 순서(홍성 우선은 파일럿 의도), 전국 시딩·시도 컬럼(스키마 결정 선행).
- **독립 재검수(4차원 + 반박 검증) 반영**: 읍·면 정렬을 이름순에서 등록(id)순으로 되돌려 홍성읍이 v1.0처럼
  맨 위(시·군만 이름순); 위치 안내를 키+데이터로 저장해 언어 전환 시 문구 동기(텍스트 저장 회귀 수정);
  시·군 묶음을 `<details>`로 접어 '계속' CTA가 멀어지지 않게(선택된 시·군이 있거나 읍·면 그룹이 없으면 펼침);
  `splitRegionGroups` 공용 헬퍼로 Select·ProfileEdit이 같은 분할·순서(ProfileEdit은 시·군 14개를 optgroup
  하나로); `useStaleRegionCleanup`은 목록 0행이면 건드리지 않음(일시적 RLS 오류로 전원 지역 해제 방지);
  시·군 이름은 `ko` 키만 읽고 폴백 없음(다른 언어 이름이 API 파라미터로 새지 않게); 지도 빈 상태 키를
  목록 화면과 동일 기준(items 유무)으로; 헤더 링크 접근성 이름에 보이는 브랜드명 포함(WCAG 2.5.3);
  내 정보 버전 줄은 `app.name` 사전 사용; 캡션 '다른 시·군'→'시·군 단위로 고르기'(절대 표현);
  geoError 문구에서 '브라우저' 삭제(앱에도 맞게); 롤백 문서에 profiles FK(set null) 부수효과·확인 쿼리 추가;
  릴리스 절차는 android/ 전체 커밋(gradle.properties 경로 제거·app/release/ ignore 선행) 권장.
  기록만(코드 무변경): 앱 WebView 카카오 OAuth 미완료 구조, 카카오맵 도메인 `https://localhost` 등록 확인.
- **하지 않은 것**: Android 위치 권한 추가(Play 데이터 보안 양식 연동 — 오너 결정), 전국 시·군 시딩(시도 단계
  스키마 결정 선행), 지역 미선택 시 범위 라벨, similar_posts 지역 한정, Kakao unlink(D-032 후속).

### D-034. v1.2 — 연관 글 추천 관련성 게이트 (2026-09-12)
- **진단(추측 아님, 라이브 측정)**: 추천은 OpenAI가 아니라 Supabase 내장 gte-small(384) 임베딩 + `similar_posts`
  RPC(코사인 상위 3, 임계값 없음, 공개 글 5건 이상 게이트)였다. 캐시·mock·하드코딩 추천은 없다. 한국어 글끼리
  코사인이 0.85~0.95에 몰려 변별력이 없다: "몸이 아파요 병원 추천"의 1위가 "일요일 풋살 멤버 구해요"(0.949),
  실제 관련 글 "읍내 내과"는 0.928. 임계값이 없으니 무관한 글이 항상 3건 노출됐고 "풋살"이 허브처럼 모든 글의
  상위에 걸렸다. 공개 글 10건 중 2건은 임베딩이 없어(초기 글) 후보에서도 빠진다.
- **대책**: ① `posts.embedding_model` 컬럼 — 같은 모델의 벡터끼리만 비교. ② 확장 없이 SQL로 문자 바이그램
  자카드(`text_bigrams`/`bigram_jaccard`, 조사·상투어 제외)를 계산해 **의미(코사인)+어휘 이중 근거** 게이트:
  gte-small은 코사인 ≥ 0.92 AND 어휘 ≥ 0.02(라이브 코퍼스 실측 — "몸이 아파요→읍내 내과", "풋살→축구"만
  남고 무관 쌍 전부 제외, 임금·월급·덥네요 글은 빈 결과). ③ OpenAI `text-embedding-3-small`(dimensions=384)
  경로: Supabase secret `OPENAI_API_KEY`가 있을 때만 사용(키는 코드·저장소에 없음), 실패 시 gte-small로 조용히
  대체하지 않고 502(벡터 미저장). 이 모델은 코사인 ≥ 0.45만 적용. ④ 클라이언트: 후보 0건이면 "아직 비슷한 글이
  없어요" 빈 상태(억지 추천 금지), 로딩·오류 중 숨김.
- **후속(오너)**: OPENAI_API_KEY를 secret으로 넣으면 기존 글 재임베딩 필요(embed-post를 글별 호출). 임베딩 없는
  글 2건도 같은 절차로 채운다. 지역 한정 추천은 여전히 설계 결정 사항.
- **키 활성화 전제(재검수 확정 P1→P2)**: OpenAI 경로는 게시글 제목·본문(UGC)을 미국 OpenAI로 보내므로 v1.6 §1.2-A
  "UGC 외부 미전송" 원칙의 변경이다. secret을 넣기 **전에** (a) 개인정보처리방침 §3에 "OpenAI(임베딩 생성, 미국) —
  게시글 제목·본문 전송·처리위탁·국외 이전" 항목과 개정일·§6 이력 추가, (b) 이 결정을 D-0xx로 기록, (c) 재임베딩.
  그 전까지 키를 넣지 않는다(RELEASE_v1.2 §2 5행). 현재 배포본은 키가 없어 gte-small만 쓴다.
- **하드닝(재검수 확정 P0)**: `text_bigrams`가 공백 없는 긴 입력에서 임시파일을 O(N²)로 쓰고(라이브 5000자 무공백
  → 144MB) public 스키마라 PostgREST로 anon이 직접 호출할 수 있었다. 20260912000400에서 입력 1500자·단어 40자 상한,
  바이그램만 프로젝션, 헬퍼를 PostgREST 미노출 `private` 스키마로 이동(similar_posts만 호출), 원문 바이그램 1회 계산.

### D-035. v1.2 — 전국 시·도 → 시·군·구 지역 구조 (2026-09-12)
- **결정**: `regions.level`에 'province' 추가(CHECK 확장 — 비파괴 DDL). 시·도 16행 + 시·군·구 215행 추가(기존 충남
  15행은 parent_id만 채움, 홍성 읍·면 11행 무변경). 선택 단위는 시·군·구(읍·면이 있으면 읍·면), 시·도는 묶음.
- **데이터 출처**: 카카오맵 SDK addressSearch(대표점) → coord2RegionCode 역지오코딩으로 229건 전수 일치 확인,
  **카카오가 돌려준 현행 행정구역명**을 그대로 채택. 그 결과 광주광역시+전라남도='전남광주통합특별시',
  인천 중구·동구·서구 → 제물포구·영종구·검단구·서해구(11개), 강원·전북 특별자치도. 농진청 API(rural-programs)의
  atptName도 '전남광주통합특별시'를 쓰는 것을 라이브로 확인(전라남도·광주광역시는 0건).
- **콘텐츠 분리**: 지역 목록(전국)과 지역 콘텐츠(데이터 있는 곳만)는 별개 — 데이터 없는 지역은 빈 상태. 가짜 콘텐츠
  없음.
- **클라이언트**: 선택 화면에 시/도 `<select>` 한 단계 추가(최소 UI 변경), 시/도 미선택 시 안내. `provinceOf`·
  `groupSelectableByProvince` 헬퍼, 프로필 편집은 시·도별 optgroup. 농진청 필터에 시·도를 함께 보내 동명 시·군
  (강원·경남 고성군) 구분; 0건이면 접미 제거('제주시'→'제주농업기술센터')·시·도 제외 순으로 재시도.
- **롤백**: 마이그레이션 헤더의 SQL(행 삭제 + CHECK 복원). v1.1 코드는 province 행을 무시하므로 코드만 되돌려도
  동작하지만, 시·군·구 230행은 모두 그린다(충남 15만 보이려면 데이터 롤백까지 필요).
- **이웃 뷰 키 전제 변경(재검수 확정 P1)**: `neighbor_profiles`의 "같은 시/군" 키가 `coalesce(parent_id,id)`라
  시·군·구의 부모가 시·도가 된 v1.2 데이터에서 같은 시·도 전체로 넓어졌다. 20260912000400에서 단계 기반 키
  (읍·면→부모 시·군·구, 시·군·구→자기 자신)로 재정의(D-012 절차). 라이브 발현 0건(프로필 지역이 모두 홍성 읍·면).

### D-036. v1.2 — 정적 농사 도움 콘텐츠 비공개 (2026-09-12)
- **출처 분석**: /farm의 팁 목록은 `farm_tips` 테이블(시드 8건, 2026-08-28) — 하드코딩 배열·JSON·mock·API 폴백은
  없다. 날씨(koreaConnect)·농촌지도사업(농진청 data.go.kr)은 API 실데이터.
- **결정**: 8건(폭염·농약·농기계·하우스 환기·허리·딸기·사과·주간 농사정보 안내)을 `is_published=false`로 비공개(삭제 아님,
  복원 가능). 한 번 읽으면 반복 가치가 낮은 일반 상식이며 지역·상황 맞춤 실데이터 목적과 맞지 않는다.
  /farm은 날씨·교육·사업 카드가 본문이 되고, 지역이 없으면 안내, 있는데 둘 다 없으면 빈 상태. 팁 목록은 실데이터
  (농사로 OpenAPI 연동 후)가 생길 때만 렌더. API 실패 시 정적 팁으로 대체하지 않는다.

### D-037. v1.2 — 충남 14개 시·군 공공기관 생활정보 실데이터 (2026-09-12)
- **원칙**: 가짜 장소·연락처 금지. 시·군별 수집 에이전트가 공식 페이지(시·군청·보건소·공공의료원·코레일·가족센터·
  공식 관광 페이지·기관 자체 사이트)를 WebFetch로 직접 열어 읽은 주소·전화만 기록하고, 항목별 독립 검증 에이전트가
  같은 URL을 다시 열어 이름·주소·전화를 재대조. 통과분 + 정정값이 명확한 7건만 수록. 좌표는 카카오 지오코딩 후
  시·군 일치 확인. verified_at=2026-09-12는 "공식 페이지 2회 확인"이며 전화 통화 확인이 아님(D-026 절차로 운영자
  재확인 시 갱신). 확인 못 한 항목은 넣지 않고 PRD_v1.2 §데이터 확충 필요에 기록.
- **정정(재검수 확정 P1 등)**: 전화 4건(범위 '~'·'(대표)'·전국대표번호 앞 지역번호)을 단일 발신 번호로, 시·군 없는
  주소 11건 보정, 보령중앙시장 장날 오독 제거, 민간 병원 4건에 '민간' 명시(20260912000400). 클라이언트 tel: 링크는
  숫자·+만 남기도록 정규화(표시는 원문).
