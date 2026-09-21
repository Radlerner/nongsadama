# 농사다마 (NongsaDaMa)

농촌 지역 외국인 계절근로자가 자신의 언어로 지역 생활정보와 지역 게시글을 찾는 모바일 우선 웹앱.

- 제품 요구사항(기능 스펙 반복본): [PRD_v1_3.md](./PRD_v1_3.md) ~ [PRD_v1_7.md](./PRD_v1_7.md)
- 현재 릴리스: **v1.3** (Google Play 비공개 테스트, `versionCode 4`) — 릴리스 PRD [docs/prd/PRD_v1.3.md](./docs/prd/PRD_v1.3.md),
  변경 이력 [docs/changelog/CHANGELOG.md](./docs/changelog/CHANGELOG.md), 릴리스 절차 [docs/releases/RELEASE_v1.3.md](./docs/releases/RELEASE_v1.3.md)
- 이전 릴리스: v1.2 (`versionCode 3`) — [PRD_v1.2](./docs/prd/PRD_v1.2.md) · [RELEASE_v1.2](./docs/releases/RELEASE_v1.2.md)
- 버전 기준: `src/config/version.ts`(웹) · `android/app/build.gradle`(Android) · `package.json` — 세 곳을 함께 올린다

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
| `npm run build` | 타입 검사 후 로컬 프로덕션 빌드 |
| `npm run build:release` | 필수 운영 환경변수 확인 후 배포용 빌드 |
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
- 화면 사전은 `ko`, `en`, `vi`, `km`, `th`, `ne`, `mn`, `uz`, `ru`를 지원한다. 기기 언어를 처음 추천하며 저장된 사용자 선택이 우선한다.
- 개인정보처리방침·계정 삭제·아동 안전 페이지는 기존 한·영 고지를 유지한다. 지역 이름과 생활정보 본문은 DB에 번역이 없는 경우 기본 언어로 표시된다.

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

### Cloudflare Workers (공식 운영 — https://nongsadama.app)
- 방식: Workers 정적 자산(Static Assets). Worker 스크립트 없이 `dist`만 올린다. 설정은 루트 `wrangler.jsonc`
  (`assets.directory: ./dist`, `not_found_handling: single-page-application` = SPA 폴백).
  Vite 5 그대로 쓴다 — `@cloudflare/vite-plugin`·Vite 6 은 필요 없다(D-038).
- Cloudflare 대시보드(Workers & Pages → nongsadama → Settings → Build):

  | 항목 | 값 |
  | --- | --- |
  | Production branch | `main` |
  | Root directory | 저장소 루트(`/`, 비움) |
  | Build command | `npm run build:release` |
  | Deploy command | `npx wrangler deploy --config wrangler.jsonc` |
  | Non-production branch deploy command | `npx wrangler versions upload --config wrangler.jsonc` |

- 빌드 변수는 Settings → Build → **Variables and secrets**에 넣는다(런타임 Variables 아님, `wrangler.jsonc`의 `vars` 아님):
  `VITE_SUPABASE_URL`·`VITE_SUPABASE_ANON_KEY`·`VITE_STT_ENDPOINT`(필수), `VITE_KAKAO_MAP_KEY`·`VITE_GA_MEASUREMENT_ID`(선택).
  Kakao 지도 키는 Supabase `map_config`의 공개 설정을 기본으로 사용하며 환경변수는 로컬 폴백이다.
  `BASE_PATH`는 넣지 않는다. 빌드 타임 상수라 값을 바꾼 뒤 다시 배포해야 적용된다.
- 도메인(`nongsadama.app`, workers.dev)은 대시보드에서 관리한다 — `wrangler.jsonc`에 `routes`·`workers_dev`를 넣지 않는다.
- 로컬 검증(실제 배포 없음): `npm run build` 후 `npx wrangler deploy --config wrangler.jsonc --dry-run`
  → `Read N files from the assets directory … --dry-run: exiting now.` Workers 런타임으로 직접 보려면
  `npx wrangler dev --config wrangler.jsonc`(로컬 전용). `--dry-run` 없는 `wrangler deploy`는 로컬 `dist`를 운영에 올리므로 쓰지 않는다.
- 문제 해결: `The version of Vite used in the project ("5.4.x") cannot be automatically configured … at least "6.0.0"`
  는 wrangler가 설정 파일을 찾지 못해 자동 설정(autoconfig)에 들어갔다는 뜻이다. **Vite를 올리지 말고** 실패한 빌드의
  커밋에 `wrangler.jsonc`가 있는지(2026-08-01 이전 커밋·`40254b5`·태그 `v0.1.0`·`v0.3.0`에는 없다 — 빌드 기록의 `40254b5` 실패가 바로 이 오류이며 옛 빌드 "Retry"도 실패한다),
  Root directory, Deploy command를 확인한다. `--config`를 명시하면 자동 설정은 실행되지 않는다.

### Vercel
- Vercel 정적 배포. SPA 라우팅은 `vercel.json` 의 rewrite로 처리한다. base는 기본값 `/`.
- 환경변수는 Vercel 프로젝트 설정에 등록한다.
- 보조 배포다. 저장소에 연결된 Vercel 프로젝트가 push마다 Production 배포를 만들지만 공식 도메인은 Cloudflare다.

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
