# 농사다마 디자인 토큰·컴포넌트 인벤토리 (v0)

PRD v1.7 §3 산출물. **피그마 프레임 명세·디자인 프롬프트에 그대로 붙여 쓸 수 있는 단일 기준.**
코드 원본: `tailwind.config.js`(토큰), `src/components/ui/`(공통 컴포넌트).

## 1. 색 토큰 (리브랜딩 v0 D-030 — Deep Forest Green / Warm Apricot / Warm Gray)

| 토큰 | 값 | 용도 |
|---|---|---|
| `brand-greenDark` / `green-700` | `#1B4D3E` | **Primary — 주 CTA 배경**, 지도 실좌표 핀 링 |
| `green-50`~`900` | `#EAF4F0`~`#0E2921` | Primary 스케일(배지·강조 배경·텍스트) |
| `amber-500` | `#E87A40` | Secondary(Warm Apricot) — 경고·강조 배지 |
| `amber-50`~`900` | `#FDF1E9`~`#542712` | Secondary 스케일 |
| `brand-purple` | `#6C5CE7` | Accent(Soft Violet) — 지도 읍·면 묶음 핀 링(좌표 미검수) |
| gray-50 `#F8F9FA` | — | **앱 전체 배경**(랜딩·로그인 포함, 카드 white와 분리) |
| gray-900 `#1F2937` | — | 본문 진한 텍스트(Dark Slate Gray) |
| 카카오 `#FEE500`/`#191919` | — | 카카오 버튼 전용(브랜드 가이드) |

폰트: Pretendard(CDN, `index.html`) — `font-sans` 기본값.

## 2. 형태 토큰

| 토큰 | 값 | 용도 |
|---|---|---|
| `rounded-card` | 12px | 모든 카드·주 CTA |
| `shadow-card` | 0 1px 3px rgba(0,0,0,.06) | 카드 |
| 터치 최소 | 44px (주 CTA 56px) | 전 인터랙션 요소 |
| 페이지 폭 | max-w-screen-sm, px-4~6 | 모바일 우선 |

## 3. 공통 컴포넌트 (src/components/ui/)

| 컴포넌트 | 명세 | 적용 현황 |
|---|---|---|
| `CardLink(to)` | white card + active:bg-gray-50, 탭 항목 | FarmTips·Board(PostCard)·**LifeInfo** ✅ / NeighborCard ⬜ 후속 |
| `Card` | 정적 컨테이너(현재 동일 스타일 — 플랫 변형은 v1) | ⬜ |
| `LoadingBox(text)` | gray-50, py-8 중앙 | Farm·Board·Neighbors·**LifeInfo** ✅ / 나머지 ⬜ |
| `PrimaryButton`·`DangerButton`·`SectionTitle`·`Chip`·`EmptyState`(아이콘+CTA형) | PRD §3 명시 잔여 추출 대상 | ⬜ 미추출 |
| `ErrorBox(text,onRetry)` | red-50 + **재시도 필수**(무언 실패 금지 표준형) | 동일 ✅/⬜ |
| `EmptyBox(text)` | gray-50 | 동일 ✅/⬜ |
| 기존: `NeighborCard`·`ShareButtons`·`FreshnessBadge`·`SafetyBanner`·`OfflineBanner`·`ErrorBoundary` | 도메인 컴포넌트 | — |

## 4. 화면 인벤토리 (피그마 프레임 목록)

랜딩 / 언어·지역 선택 / 로그인(간편+이메일 접힘) / 지도 홈(필터 칩·핀·시트·농사 진입 카드) /
게시판 목록·상세(신고·차단·비슷한 글)·작성 / 생활정보 목록·상세 / 🌾 농사 도움 목록·상세 /
🎤 말하기(4택+STT) / 이웃 목록 / 내 정보(차단 관리·계정 삭제) / 프로필 수정 / privacy / 404

## 5. 피그마 디자인 프롬프트 템플릿 (예시)

> "모바일 375px, 농촌 외국인 근로자용 앱. 배경 gray-50(#F8F9FA, 앱 전체 공통), 카드 white·radius 12·
> 그림자(0 1 3, 6%). 주 CTA #1B4D3E(Deep Forest Green)·높이 56·radius 12. 강조는 Warm Apricot(#E87A40).
> 터치 최소 44px, 이모지 아이콘(🗺️💬🎤👥👤🌾), 화면당 1과업, 텍스트 최소화, 폰트 Pretendard.
> [화면명]을 위 토큰으로 그려줘: (§4에서 프레임 선택 + 해당 화면 구성요소 나열)"

## 6. 규칙

- 새 화면·수정 시 **raw 클래스 대신 §3 컴포넌트 우선** 사용. 없는 패턴이면 ui/에 추가 후 사용.
- 색·radius·그림자를 임의 값으로 넣지 말 것(토큰만). 카카오 버튼 색만 예외.
- 오류 상태는 항상 ErrorBox(재시도 포함) — 텍스트만 있는 오류 금지.
