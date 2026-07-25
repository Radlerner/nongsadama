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
