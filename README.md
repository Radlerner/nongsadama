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

## 다국어 (i18n)

- 정적 번역 사전 방식. 사전은 `src/i18n/dictionaries/<locale>.json`.
- 지원 언어와 기본 언어는 `src/config/app.ts` 의 설정값으로 관리한다.
- 비즈니스 로직은 특정 언어 코드로 분기하지 않는다.
- 언어 추가 = 사전 JSON 추가 + `dictionaries/index.ts` 등록 + `app.ts` 목록 추가 (DB 변경 불필요).

## 배포

- Vercel 정적 배포. SPA 라우팅은 `vercel.json` 의 rewrite로 처리한다.
- 환경변수는 Vercel 프로젝트 설정에 등록한다.
