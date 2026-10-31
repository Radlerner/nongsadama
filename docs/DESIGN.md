# 농사다마 DESIGN.md (v5)

디자인 v5(결정 기록 D-047 예정)가 v1 크림 시스템(이 파일의 옛 판, v1 ~ v1.6)을 대체한다. 토큰과 구성 요소의 정확한 이름·속성은
[DESIGN_TOKENS.md](DESIGN_TOKENS.md), 원본 키트는 `brand-v5/kit.md`(작업 폴더)다. 코드가 기준이다:
`tailwind.config.js`, `src/index.css`, `src/components/ui/`, `src/components/layout/`.

## 1. 원칙 (협상 불가)

- **바탕은 흰색 `#ffffff`**. 크림·살구·베이지·호박·노랑 면은 어디에도 없다.
- **색은 로고에서만**: 농사 = 초록 `nong`(홈·생활정보·농사 도움), 다 = 보라 `da`(게시판), 마 = 황토 `ma`(이웃).
  진한 색은 정체성·선택·브랜드 행동에만 쓴다. 장식으로 쓰지 않는다.
- **로고는 원본 이미지**(`src/assets/brand/logo-*.png`, `<LogoMark>`) 그대로. 다시 그리거나 색을 바꾸지 않는다.
  퍼즐 모양은 로고 안에만 있다(아이콘·빈 화면·버튼·구분 표시에 퍼즐 금지).
- **글꼴은 NanumSquareRound 400 / 700 / 800만**(`font-normal` / `font-bold` / `font-extrabold`). 500·600 금지.
  - 알려진 한계(고치지 않음): 번들 NanumSquareRound에는 한글·ASCII·기본 키릴 문자만 있다. 라틴-1 악센트, 베트남어 글자
    (ơ ư Đ ạ ế …), 몽골어 Ө ө Ү ү가 없다. 이 글자들은 글자 하나씩 글꼴 목록의 다음 글꼴로 넘어가서, 베트남어 낱말과
    몽골어 낱말의 약 4분의 1은 한 낱말 안에 두 글꼴이 섞인다. km·th·ne는 낱말 전체가 다음 글꼴로 나온다.
    주인 결정이 필요한 선택지(적용하지 않음): `src/index.css` base 층에
    `:lang(vi), :lang(mn) { font-family: system-ui, 'NanumSquareRound', 'Apple SD Gothic Neo', 'Noto Sans KR', sans-serif; }`.
    NanumSquareRound를 두 번째에 두어 한글과 워드마크는 그대로 이 글꼴로 남긴다.
- **그림자 금지**. 예외 셋: 솟은 말하기 원(`shadow-raised`), 토스트(`shadow-float`), 바텀시트(`shadow-sheet`).
  흰 면 위 깊이는 1px 선(`border-line`)과 중립 사다리(white → surface → surface-2)로 만든다.
- **모든 기다림은 상태를 보인다**: 글자+스피너/스켈레톤, 8초 뒤 느린 연결 안내(오프라인이면 그 대신 연결 대기 줄),
  오류 + 다시 시도 + 다른 길, 비어 있음 + 행동 하나, 올리는·보내는·저장하는 중(알면 진행률), 오프라인 배너.
- **크기**: 누르는 곳 44px 이상, 주 버튼 48px, 글자 13px 이상(`text-xs`, `text-[10~12px]` 금지).
  주 버튼(초록 채움)은 접힘 한 번에 하나. 좌우 여백 20px.
- **앱 셸**: 모든 앱 화면에 헤더(상태 표시줄 높이 + 원본 로고 + 글자 워드마크 + 3색 인디케이터 바)와
  5탭 하단 메뉴(홈 · 게시판 · 말하기(솟은 초록 원) · 이웃 · 내 정보).
- 새 npm 의존성 없이 만든다. main의 기능·동작이 기준이고, v5는 모양과 상태를 정한다.

## 2. 색

| 역할 | 토큰 | 규칙 |
|---|---|---|
| 바탕·헤더·탭·카드 | `bg-white` | 기본 면 |
| 검색칸·타일·tertiary 버튼·상태 아이콘 원 | `bg-surface` #f6f7f9 | 한 단계 들어간 면 |
| 스켈레톤·선택 알약·오프라인 배너·비활성 버튼 | `bg-surface-2` #eef0f3 | 두 단계 |
| 구분선·카드 테두리 / 보조 버튼 테두리 | `border-line` / `border-line-strong` | 1px |
| 입력칸·선택 원 테두리 | `border-line-input` | 비텍스트 대비 3:1 |
| 글자 | `text-ink` 제목·UI · `text-ink-body` 문단 · `text-ink-muted` 메타(가장 옅은 글자) · `text-ink-disabled` 비활성만 | |
| 오류 | `text-danger` / `border-danger` | 오류 글자·아이콘·칸 |
| 주 버튼 | `bg-nong-600 text-white` | **어느 탭이든 초록 하나**(브랜드 행동) |
| 영역 정체성 | `nong/da/ma-600` 글자·선택 테두리, `-100` 아바타 바탕, `-500` 그래픽·바, `-200` 얇은 바 | `ma-500`은 글자색 금지 |
| 카카오 로그인 | `bg-kakao text-kakao-ink` | 카카오 버튼에만 |

Tailwind 기본 팔레트(`gray-*`, `green-*`, `amber-*`, `rose-*` …)는 새 코드에서 쓰지 않는다.

## 3. 글자

| 역할 | 클래스 | 값 |
|---|---|---|
| 사진 위 큰 제목 | `text-hero` | 26/34 800 |
| 화면 제목 | `text-title` | 22/30 800 |
| 섹션 제목 | `text-section` | 19/26 800 |
| 본문 | `text-body` | 16/25 400 (강조·줄 제목은 `font-bold`) |
| 라벨·버튼 | `text-label` | 15/20 700 |
| 작은 글 | `text-small` | 14/21 400 |
| 메타 | `text-caption` | 13/19 400 (가장 작은 글자) |

문장은 짧은 해요체. 번역투("~를 통해", "~하실 수 있습니다") 금지. 한국어는 `word-break: keep-all`.

## 4. 모양

- 모서리: `rounded-lg` 8(입력칸·작은 버튼) · `rounded-xl` 12(카드·사진·버튼) · `rounded-2xl` 16(시트·타일) · `rounded-full`(알약·아바타) · 0(가장자리까지 닿는 사진).
- 간격: 좌우 20 · 섹션 사이 32 · 헤더 → 내용 12 · 줄 56(아바타·타일이 있으면 64).
- 아이콘: `<Icon name>` 선 아이콘(24 격자, 굵기 1.75, 둥근 끝). 활성 탭만 채운다. 이모지는 UI에 쓰지 않는다.
- 생활정보 카테고리: `<CategoryGlyph>` 그림. 사진 자리는 늘 `.skel`을 깐다(느린 사진 = 반짝이는 회색 면).
- 사진 위 글자는 어두운 유리 `.glass`(잉크 65% + 흐림)에만. 얼굴·신분증·외국인등록증이 보이는 예시 사진 금지.

## 5. 앱 셸 치수 (`src/index.css`)

| 변수 | 값 | 쓰임 |
|---|---|---|
| `--safe-top` / `--safe-bottom` | Android(Capacitor)가 넣는 `--safe-area-inset-*`, 없으면 `env(safe-area-inset-*)` | 상태 표시줄·홈 인디케이터 |
| `--header-h` | 56 + 4(인디케이터) + safe-top | sticky 헤더 높이 |
| `--nav-h` | 64 + safe-bottom | 하단 탭 높이 |
| `--float-bottom` | 108 + safe-bottom | 토스트·떠 있는 버튼의 bottom(솟은 말하기 원 위) |

쌓임: 헤더·하단 탭 z-30 · 토스트 z-[900] · 바텀시트·말하기 덮개 z-[1000]. 화면 안의 떠 있는 버튼은 z-20 이하.
인디케이터 바: `/home`·`/life-info*`·`/farm*` = 초록, `/board*` = 보라, `/neighbors*` = 황토, `/talk`·`/profile*` = 없음
(키트 2c `bar-none`: 바는 그대로 두고 세 칸 모두 2px 200색 — 바가 곧 헤더 구분선이라 지우지 않는다).
붙어 있는 머리줄·아래 탭 밑으로 초점·앵커가 숨지 않게 `html`에 `scroll-padding`을 둔다(`src/index.css`) — 화면마다 scroll-margin을 따로 달지 않는다.

## 6. 상태 (기다림·오류·비어 있음)

| 상황 | 구성 요소 |
|---|---|
| 처음 불러오기 | `LoadingState`(+ 같은 모양의 `Skeleton`). 8초 뒤 `state.slow`, 오프라인이면 바로 `state.waitingNetwork` |
| 오프라인으로 멈춘 조회(`fetchStatus === 'paused'`) | 비어 있음이 아니라 `LoadingState`(연결 대기) |
| 실패 | `ErrorState`(다시 시도 = `refetch`, 다른 길 링크) |
| 결과 없음 | `EmptyState`(상황 아이콘 + 한 줄 + 행동 하나) |
| 보내기·저장·삭제 | `Button loading loadingLabel={t('state.saving')}` + 아래 `SlowHint` |
| 완료 알림 | `navigate(to, { state: { toast: 'state.posted' } })` 또는 `flashToast('state.saved')` → 셸의 `Toast` |
| 오프라인 | 셸이 헤더 아래 `OfflineBanner`를 늘 보여 준다. 쓰기는 바로 실패하고(`networkMode: 'always'`) 오류 줄을 보인다 |

## 7. 안전

- 정확한 GPS는 저장·전송하지 않는다. 거리 대신 읍·면·시간 같은 말을 쓴다.
- 국적은 공개 화면(게시판 목록·상세·비슷한 글·추천)에 보이지 않는다. `public_profiles`에서는 `id, nickname`만 읽는다.
  이웃 목록은 공개 화면이 아니다(로그인 + 서로 동의, 동의 문구 `profileEdit.matchingConsentDetail`이 국적이 보인다고 알린다): 국적을 코드가 아닌 나라 이름으로 보인다.
- 위급 연락(`SafetyBanner`: 1345 · 112 · 1577-1366)은 말하기 결과마다 늘 보인다.

## 8. 하지 말 것 (grep 목록)

`text-xs` · `text-[10px]`~`text-[12px]` · `font-medium` · `font-semibold` · `shadow` `shadow-sm|md|lg|xl|2xl` `shadow-card` ·
`bg-brand-*` `text-brand-*` · `rounded-card` · `*-amber-*` `*-yellow-*` `*-orange-*` · `bg-[#…]` 직접 색 · 크림 hex `#f5f1e8` ·
`lucide-react` 직접 import(→ `<Icon>`) · `Puzzle` · 이모지 UI 아이콘. grep 명령은 DESIGN_TOKENS.md §4.
