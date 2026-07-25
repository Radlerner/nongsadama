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
