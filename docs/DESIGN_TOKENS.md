# 농사다마 디자인 토큰·구성 요소 (v5)

원칙은 [DESIGN.md](DESIGN.md). 토큰 원본은 `tailwind.config.js`, 구성 요소는 `src/components/ui/`(묶음 `ui/index.ts`).

## 1. 토큰 (Tailwind 클래스)

| 무리 | 클래스 | 값 |
|---|---|---|
| 면 | `bg-white` · `bg-surface` · `bg-surface-2` | #ffffff · #f6f7f9 · #eef0f3 |
| 선 | `border-line` · `border-line-strong` · `border-line-input` | #e6e8ec · #d3d6dc · #8a8e96(3:1) |
| 글자 | `text-ink` · `text-ink-body` · `text-ink-muted` · `text-ink-disabled` | #16181d · #3f434b · #6b6f78 · #9a9ea6 |
| 오류 | `text-danger` · `border-danger` | #c0392b |
| 농사(green) | `nong-50/100/200/500/600/700` | #f2f5ec #e4ead8 #c9d3b4 #70834b **#5b6c3a** #46552b |
| 다(purple) | `da-50/100/200/500/600/700` | #f3f2fa #e5e3f3 #cfcce8 #6f6aad **#5a5596** #47437a |
| 마(ochre) | `ma-50/100/200/500/600/700` | #fcf4ea #f6e3cc #ecc9a3 #bc7530 **#9a5d22** #7b4a1a |
| 카카오 | `bg-kakao` · `text-kakao-ink` | 카카오 로그인 버튼 전용 |
| 글자 크기 | `text-hero` `text-title` `text-section` `text-body` `text-label` `text-small` `text-caption` | 26 · 22 · 19 · 16 · 15 · 14 · 13 (줄높이·굵기 포함) |
| 굵기 | `font-normal` · `font-bold` · `font-extrabold` | 400 · 700 · 800 (그 밖 금지) |
| 모서리 | `rounded-lg` · `rounded-xl` · `rounded-2xl` · `rounded-full` | 8 · 12 · 16 · 999 |
| 그림자 | `shadow-raised` · `shadow-float` · `shadow-sheet` | 말하기 원 · 토스트 · 바텀시트 **만** |
| 유틸 | `.skel` · `.glass` · `.anim-fade` · `.anim-sheet-up` · `.min-h-app` · `.scrollbar-none` | 반짝이는 로딩 면 · 사진 위 반투명 알약·원(잉크 65% + 흐림 8px, 흰 글자 — 사진 위에서만) · 나타남 · 시트 · 100dvh · 스크롤바 숨김 |
| CSS 변수 | `--safe-top` `--safe-bottom` `--header-h` `--nav-h` `--float-bottom` | DESIGN.md §5 |

영역 정체성 클래스는 `ui/tone.ts`의 표(`TONE_TEXT`, `TONE_SOFT`, `TONE_BORDER`)에서 꺼낸다(문자열을 조합하지 않는다).

## 2. 구성 요소 (`import { … } from '../components/ui'`)

| 이름 | 쓰임 | 주요 속성 |
|---|---|---|
| `Icon` | 선 아이콘(키트 + 키트에 없는 이름만 lucide) | `name` `size=24` `strokeWidth=1.75` `filled` `title` |
| `Button` / `buttonClasses()` / `IconButton` | 48px 주·보조 버튼, 링크를 버튼처럼, 44px 아이콘 버튼 | `variant: primary·secondary·tertiary·ghost·danger` `size: md·sm` `fullWidth` `wrap` `tone` `loading` `loadingLabel` `icon` |
| `Spinner` | 20px 링(혼자 쓰지 말고 글자와 함께) | `tone` `size` |
| `Skeleton` / `SkeletonBlock` | 내용과 같은 모양의 로딩 자리 | `variant: lines·rows·post·rail` `count` `lead` |
| `LoadingState` | 스피너 + 글자, 8초 뒤 느림, 오프라인이면 연결 대기 | `label` `offlineLabel` `fallback` `variant: page·inline` `children`(스켈레톤) |
| `ErrorState` | 오류 + 다시 시도 + 다른 길 | `title` `body` `onRetry` `retrying` `retryLabel` `fallback` |
| `EmptyState` | 비어 있음 + 행동 하나 | `icon` `title` `body` `action{label,to/onClick,primary,icon,state}` |
| `SlowHint` | 바쁜 버튼 아래 느림/연결 대기 줄 | `busy` `offlineLabel` |
| `SectionHeader` | 섹션 제목(+ 전체 보기) | `title` `seeAll{to,label}` `tone` |
| `PillTabs` | 알약 필터(radiogroup) | `options` `value` `onChange` `ariaLabel` `variant: soft·outline` `tone` `bleed` |
| `ChoiceRow` | 56px 고르는 줄(체크 원) | `selected` `trailing` `semantics: pressed·radio` |
| `Avatar` | 머리글자 원(사진·얼굴 없음) | `name` `tone`/`seed` `size: 32·40·48` |
| `BottomNav`(셸) | 5탭 | `activePath`(`null` = 활성 없음, 404처럼 셸 밖에서 빌려 쓸 때) |
| `BottomSheet` / `PickerRow` | 아래 창 / 창을 여는 입력 줄 | `open` `onClose` `title` `description` `descriptionId` `footer` `fill` `closeLabel` `initialFocus` `returnFocusRef` `onEscape` |
| `Toast` | 잉크 토스트(셸이 이미 하나 둔다) | `open` `message` `onClose` `action` `icon` `showKey` |
| `CategoryGlyph` / `categoryGlyphSrc` | 생활정보 카테고리 그림 | `category` `size` |
| `LogoMark` / `Wordmark` | 원본 로고 이미지 / 글자 워드마크 | `size: header·large` |
| `IndicatorBar` / `toneForPath` | 3색 바 / 경로 → 정체성 | |
| `useOnline` / `useSlow` | 연결 상태 / N ms 지남 | |

셸(`src/components/layout/`): `AppLayout`(앱 화면 헤더·바·오프라인 배너·하단 탭·토스트), `EntryHeader`(앱 셸 밖 화면의 머리줄),
`BottomNav`, `LanguageSwitcher`(언어 창), `RouteErrorBoundary`(지도 청크 실패), `flash.ts`(`flashToast`, `FROM_DETAIL_STATE`, `cameFromDetail`).
도메인: `OfflineBanner`, `SafetyBanner`, `LanguageSheet`, `CountrySheet`.

## 3. 지운 옛 이름(main v1.6 크림 시스템 → v5)

v5 이관을 마치며 아래 이름은 코드와 `tailwind.config.js`에서 지웠다. main에서 가져오는 코드에 남아 있으면 오른쪽으로 바꾼다.

| 옛 이름 | 새 코드 |
|---|---|
| `bg-brand-cream`, `brand-greenDark`, `brand-green/purple/orange/ink` | `bg-white`, `Button`(primary = `bg-nong-600`), `nong/da/ma-500`·`ink` |
| `rounded-card` / `shadow-card` | `rounded-xl border border-line`(그림자 없음) |
| `ui/Card`의 `Card`·`CardLink` | 키트 줄·카드를 직접(`rounded-xl border border-line bg-white`) |
| `ui/IconTile` | `CategoryGlyph`(생활정보) 또는 `bg-surface rounded-xl` 타일 안의 `Icon` |
| `ui/StateBoxes`의 `LoadingBox`·`EmptyBox`·`ErrorBox` | `LoadingState`·`EmptyState`·`ErrorState` |
| `ui/icons.tsx`(lucide 목록 `NAV_ICONS`·`CATEGORY_ICONS`·`WEATHER_ICONS`), `lib/pinIcons.tsx` | `<Icon name>` · 지도 표시는 `categoryGlyphSrc()` |

lucide 이름 → `Icon` 이름: Map→map · MessagesSquare→board · Mic→mic · Users→neighbors · UserRound→me · MapPin→pin ·
List→list · LayoutGrid→grid · Volume2→speaker · Flag→flag · Ban→block · Phone→phone · Share2→share · ChevronRight→chevron ·
Check→check-plain · AlertCircle→alert · Lock→lock · X→x · Info→info · ImagePlus→photo-add · Sprout→sprout · School→school ·
Coffee→coffee · LifeBuoy→help · MessageCircleQuestion→question · Thermometer→thermometer · 날씨는 §2 `Icon`의 sun·cloud-sun·cloud·
cloudy·cloud-rain·cloud-sun-rain·cloud-lightning·snowflake·cloud-fog. 퍼즐 모양은 어디에도 쓰지 않는다(로고 안만).

## 4. 하지 말 것

DESIGN.md §8의 목록. 확인: `grep -rnE "text-xs|text-\[1[0-2]px\]|font-(medium|semibold)|shadow-(sm|md|lg|xl|2xl|card)|shadow([^-]|$)|brand-|rounded-card|(amber|yellow|orange|gray|green|red|blue)-[0-9]|bg-\[#|#f5f1e8|from 'lucide-react'" src`
(`ui/Icon.tsx`가 키트에 없는 이름을 그리려고 lucide를 가져오는 것만 예외).
