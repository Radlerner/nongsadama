# 농사다마 (NongsaDama)

농촌 지역 외국인 계절근로자가 자신의 언어로 지역 생활정보와 지역 게시글을 찾는 모바일 우선 웹앱.

- 제품 요구사항: [PRD_v1_3.md](./PRD_v1_3.md)
- 현재 버전: `v0.1.0` (화면 골격과 배포 연결)

## 기술 스택

- React + TypeScript + Vite
- React Router (SPA)
- TanStack Query (서버 상태/캐시)
- React Hook Form + Zod (입력/검증)
- Tailwind CSS (모바일 우선)
- Supabase (Auth / Postgres / Storage, anon 키만 프론트 사용)

상태관리 라이브러리는 추가하지 않고 React Context로 처리한다.

## 요구 사항

- Node.js 18 이상
- npm

## 환경변수

`.env.example` 을 복사해 `.env.local` 을 만들고 값을 채운다. **`.env*` 는 커밋하지 않는다.**

```bash
cp .env.example .env.local
```

| 변수 | 설명 |
| --- | --- |
| `VITE_SUPABASE_URL` | Supabase 프로젝트 URL (공개 값) |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon 공개 키 |

> `service_role` 키는 브라우저/저장소에 절대 넣지 않는다. anon 키만 사용한다.
> 환경변수가 없어도 골격 화면은 동작하며, Supabase 클라이언트를 실제로 호출하는
> 시점에만 명확한 오류를 던진다.

## 실행

```bash
npm install
npm run dev
```

## 스크립트

| 명령 | 설명 |
| --- | --- |
| `npm run dev` | 로컬 개발 서버 |
| `npm run build` | 타입 검사 후 프로덕션 빌드 |
| `npm run typecheck` | TypeScript 검사 (`tsc --noEmit`) |
| `npm run preview` | 빌드 결과 미리보기 |

## 화면 구조 (v0.1.0)

```text
/            랜딩 (언어 전환, 시작하기)
/select      언어·지역 선택 (언어 선택 가능, 지역은 골격)
/home        홈            ┐
/board       지역 게시판    │
/board/:id   게시글 상세    ├─ 하단 4탭 레이아웃 (홈·게시판·생활정보·내 정보)
/life-info   생활정보       │
/life-info/:id 생활정보 상세 │
/profile     내 정보        ┘
*            NotFound
```

현재 각 화면은 번역된 제목과 빈 상태만 보여주는 골격이며, 실제 데이터 목록/상세와
로그인·작성 기능은 후속 작업에서 채운다.

`/select`의 **지역 선택은 `regions` 데이터가 필요하므로 골격(빈 상태)만** 두었고, 실제
지역 선택은 데이터 모델 작업 이후 채운다. 결정 근거는 [docs/DECISIONS.md](./docs/DECISIONS.md) 참고.

## 다국어 (i18n)

- 정적 번역 사전 방식. 사전은 `src/i18n/dictionaries/<locale>.json`.
- 지원 언어와 기본 언어는 `src/config/app.ts` 의 설정값으로 관리한다.
- 비즈니스 로직은 특정 언어 코드로 분기하지 않는다.
- 언어 추가 = 사전 JSON 추가 + `dictionaries/index.ts` 등록 + `app.ts` 목록 추가 (DB 변경 불필요).

## 데이터베이스 (Supabase)

스키마와 RLS 정책은 `supabase/migrations/` 에 SQL로 관리한다.

| 파일 | 내용 |
| --- | --- |
| `migrations/20260726000000_initial_schema.sql` | 테이블·제약·인덱스·함수·트리거 |
| `migrations/20260726000100_rls_policies.sql` | RLS 활성화 및 정책 |
| `migrations/20260726000200_security_hardening.sql` | 보안 어드바이저 WARN 하드닝 |
| `tests/rls_check.sql` | 역할 시뮬레이션 RLS 수동 검증(비파괴) |
| `seed.sql` | 시딩 데이터(파일럿: 홍성군) — 지역 + 샘플 생활정보 |

> 초기 스키마·시드는 데모 Supabase 프로젝트에 적용 완료. 원격 마이그레이션 버전과
> 저장소 파일명 타임스탬프 차이 및 시드 방침은 [docs/DECISIONS.md](./docs/DECISIONS.md) D-011 참고.

### 적용

Supabase CLI가 있으면:

```bash
supabase db push
```

없으면 Supabase 대시보드 **SQL Editor**에 두 마이그레이션을 파일명 순서대로 붙여넣어 실행한다.

### 권한 요약 (RLS)

- 활성 지역·공개 게시글·공개 생활정보는 비로그인 포함 누구나 읽는다.
- 로그인 사용자는 자신의 프로필·게시글만 생성/수정/삭제한다.
- 생활정보 생성·수정·삭제는 `admin` 역할만 가능하다.
- 최초 `admin` 지정은 운영자가 대시보드/서비스 역할로 수행한다(RLS 우회).
- `service_role` 키는 RLS를 우회하므로 서버·저장소에 노출하지 않는다.

## 배포

### Vercel
- Vercel 정적 배포. SPA 라우팅은 `vercel.json` 의 rewrite로 처리한다. base는 기본값 `/`.
- 환경변수는 Vercel 프로젝트 설정에 등록한다.

### GitHub Pages
- `.github/workflows/deploy-pages.yml` 가 `main` 푸시 시 자동 빌드·배포한다.
  Tailwind CSS는 이 빌드 단계에서 생성되므로 저장소에 CSS/`dist`를 커밋하지 않는다.
- **1회 설정**: 저장소 Settings → Pages → Source를 **"GitHub Actions"** 로 지정.
- 배포 URL: `https://radlerner.github.io/nongsadama/`
- 하위 경로(`/nongsadama/`) 대응: 워크플로가 `BASE_PATH=/nongsadama/` 를 주입하고
  (`vite.config.ts` 가 이를 읽음), `BrowserRouter` basename도 이에 맞춘다.
- 딥링크 새로고침: Pages에는 rewrite가 없어 `404.html`(= `index.html` 복사본)로 폴백한다.
- 데이터 연동(후속) 시 Vite가 빌드에 인라인하는 `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY`
  를 워크플로 env(저장소 Variables)로 추가해야 한다. 현재 골격 단계에선 불필요.
