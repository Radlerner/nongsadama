# PRD v1.4 — 말하기 음성 입력 팝업 · 국적 기반 언어 자동 설정 (UI/UX 한정)

- 작성일: 2026-09-27 · 기준 코드: `v1.3.2` 태그(커밋 `7839af8`, `versionCode 6`) · 이전: [PRD_v1.3](PRD_v1.3.md) · 변경 이력: [CHANGELOG](../changelog/CHANGELOG.md)
- 성격: v1.3.2에 대한 **프론트엔드(`src/`) 한정 증분**. 데이터베이스·Edge Function·Android 네이티브·권한·의존성은 바꾸지 않는다.
- 출처: 「농사다마 UI/UX 디자인 수정 기획서(외주 발주용, 2026-09-17)」의 요청 1·2를 1.3.2 코드 현황에 맞게 조정한 것. 기획서는 언어 3개·국가 14개를 전제했으나, 1.3.2는 이미 화면 언어 9개(`appConfig.supportedLocales`)와 `countries` 7개국을 갖고 있으므로 이 문서가 기획서에 우선한다.
- 주의: 저장소 루트의 `PRD_v1_4.md`는 2026-07 제품 PRD 개정판(이웃 매칭 재도입)이며 릴리스 v1.4와 무관하다. 릴리스 PRD는 이 파일이다.
- 배포 맥락: 1.3.2로 Google Play 비공개 테스트를 마친 상태에서 만드는 첫 업데이트. 검증을 통과하지 못하는 항목은 넣지 않고 뺀다(P1부터 제외).

---

## 1. 배경(문제 정의)

| 화면 | 1.3.2 현재 | 문제 |
| --- | --- | --- |
| 말하기 `/talk` | "말로 하기" 알약 버튼(64px)을 누르면 최초 1회 고지 상자가 버튼 아래 펼쳐지고, 듣는 동안은 버튼 글자만 "듣고 있어요…"로 바뀌며 반투명 | 듣고 있는지, 끝났는지, 왜 실패했는지가 작게만 보임. 취소 수단 없음. 비로그인 사용자가 외부 음성 인식을 누르면 원인 안내 없이 일반 오류만 표시 |
| 언어·지역 선택 `/select` | 언어 9개를 세로 버튼 목록으로 전부 노출, 기기 언어에 "기기 언어 추천" 표시. 국적 입력 없음 | 언어 9개가 화면 절반을 차지해 지역 선택과 "계속" 버튼이 아래로 밀림. 국적에 맞는 언어를 앱이 골라 주지 못함 |
| 헤더 언어 선택 | 기본 `<select>` 드롭다운 | 기기별로 모양이 달라 급조된 인상. 언어 목록과 같은 정보를 다른 형태로 두 번 보여 줌 |
| 프로필 수정 `/profile/edit` | 국적은 국가 코드(2~3자) 자유 입력 | 코드를 모르는 사용자는 비워 둠. 1.3의 `countries` 테이블과 국적 기본 언어 트리거를 화면이 전혀 쓰지 않음 |

## 2. v1.4 목표

| 번호 | 목표 | 완료 기준 |
| --- | --- | --- |
| 목표 1 | 말하기 음성 입력을 상태가 보이는 팝업으로 바꾼다 | 고지·듣는 중·완료·취소·오류 5개 상태가 팝업으로 보이고, 인식 결과가 기존 초록 상자에 그대로 들어간다 |
| 목표 2 | 국적을 고르면 그 나라 기본 언어로 앱 언어를 자동 설정한다 | `/select`에서 국적 선택 시 `countries.default_locale`이 앱 언어가 되고, 언어 목록 창 맨 위에 그 국적의 언어가 고정된다 |
| 목표 3 | 언어·국적 선택을 하나의 "아래에서 올라오는 창"으로 통일한다 | `/select`, 헤더, `/profile/edit`가 같은 창 구성 요소를 쓴다 |

제약(불변):

- 변경은 `src/` 안의 프론트엔드 코드와 `docs/`, 버전 3곳으로 한정한다. 4장의 "손대지 않는 것"을 지킨다.
- 새 npm 의존성을 넣지 않는다. 새 라우트를 만들지 않는다. 새 이미지·글꼴 자산을 넣지 않는다.
- 우선순위: **P0** 필수 · **P1** 검증 시간이 남으면 · **P2** 이번 릴리스 제외. 자동 검사나 수동 검증에서 걸리면 P1부터 뺀다. P0가 걸리면 그 기능을 통째로 빼고 1.3.2 동작으로 되돌린다.

## 3. 변경 기능

### 3.1 말하기 음성 입력 팝업 (요청 1) — P0

대상: `src/pages/Talk.tsx`. 음성 라이브러리 `src/lib/speech.ts`는 **바꾸지 않는다**(`listenOnce`가 결과 문자열 하나를 돌려주는 구조 그대로 사용).

| 구분 | 1.3.2 현재 | 1.4 |
| --- | --- | --- |
| 진입 | "말로 하기" 알약 버튼(높이 64px)이 음성 시작. 하단 중앙 마이크 탭은 화면 이동만 | 같음. 알약 버튼 누름 반응(0.96배 축소, 100ms)만 추가 |
| 고지 | 버튼 아래 안내 상자, "알겠어요, 말하기"·"안 할래요" | 아래에서 올라오는 창(3.3)으로 교체. **문구·버튼 라벨은 기존 키 그대로**(`talk.micNotice` 또는 `talk.micNoticeExternal`, `talk.micAgree`, `talk.micCancel`). 화면당 1회만(`noticeAccepted` 상태 유지) |
| 듣는 중 | 버튼 글자만 "듣고 있어요…", 반투명 | 화면 전체 덮개(검정 40%) 위에 지름 96px 진초록 원(마이크 아이콘), 원 둘레에 동심원 파형 3겹이 일정한 간격으로 번짐, 아래에 "듣고 있어요…"와 "그만하기" 버튼 |
| 완료 | 초록 상자에 문장이 바로 나타남 | 원 안 아이콘이 체크로 바뀌고 700ms 뒤 덮개가 사라지며, 초록 상자에 문장이 나타남(기존 상자·`talk.transcriptHint` 그대로) |
| 취소 | 없음 | "그만하기" 또는 덮개 바깥 탭. 덮개가 닫히고, 늦게 도착하는 인식 결과는 버린다 |
| 오류 | 빨간 글씨 한 줄 | 원 안에 느낌표, 안내 문구, "다시 말하기"·"닫기" 버튼. 원인별 문구 3종(아래) |

상태와 전이:

| 출발 | 조건 | 도착 |
| --- | --- | --- |
| 대기 | 말로 하기 누름, 이 화면에서 고지 미확인 | 고지 창 |
| 고지 창 | "알겠어요, 말하기" | 듣는 중 |
| 고지 창 | "안 할래요" 또는 바깥 탭 | 대기 |
| 대기 | 말로 하기 누름, 고지 확인 뒤 | 듣는 중 |
| 듣는 중 | `listenOnce` 성공(빈 문자열 포함) | 완료(빈 문자열이면 오류 문구 없이 바로 대기) |
| 듣는 중 | "그만하기" 또는 바깥 탭 | 대기(취소 표시, 결과 무시) |
| 듣는 중 | `listenOnce` 실패 | 오류 |
| 오류 | "다시 말하기" | 듣는 중 |
| 오류 | "닫기" | 대기 |

오류 문구 분기(`Talk.tsx`의 `catch`에서 판정, 라이브러리 무변경):

| 판정 | 문구 키 |
| --- | --- |
| `error.message === 'stt-login-required'` | `talk.speechErrorLogin` (신규) |
| `error.name === 'NotAllowedError'` 또는 `error.message === 'not-allowed'` | `talk.speechErrorPermission` (신규) |
| 그 외 | `talk.speechError` (기존) |

모션 사양(전부 CSS, `src/index.css`의 `@keyframes`와 Tailwind 유틸리티만):

| 요소 | 값 | 시간·곡선 |
| --- | --- | --- |
| 알약 버튼 누름 | `scale(0.96)` | 100ms, ease-out |
| 덮개 등장 | 불투명도 0에서 1, 배경 `rgba(0,0,0,0.4)` | 250ms, ease-out |
| 원 등장 | `scale(0.6)`·불투명도 0에서 `scale(1)`·1, 그림자 `0 6px 18px rgba(0,0,0,0.25)` | 250ms, `cubic-bezier(.2,.8,.2,1)` |
| 파형 1겹 | `scale(1)`·불투명도 0.6에서 `scale(1.6)`·0, 색 `rgba(21,128,61,0.38)` | 1,200ms, ease-out, 무한 반복, 3겹은 0·400·800ms 지연 |
| 완료 | 마이크 아이콘이 체크로 교체(150ms 페이드) 뒤 원 `scale(0.6)`·불투명도 0 | 아이콘 150ms, 원 200ms ease-in, 700ms 유지 뒤 닫힘 |
| 취소 | 원 축소 소멸, 덮개 밝아짐 | 200ms, ease-in |
| 오류 | 원이 좌우 6px 흔들림, 아이콘 느낌표 | 400ms, ease-in-out 1회 |
| 감속 모션 설정 | `@media (prefers-reduced-motion: reduce)`: 파형은 정지된 1겹(불투명도 0.35, `scale(1.3)`), 전이는 즉시 | — |

구현 규칙:

- 팝업은 `src/components/talk/VoicePopup.tsx`로 분리하고 `Talk.tsx`는 상태(`'idle' | 'notice' | 'listening' | 'done' | 'error'`)만 관리한다.
- 취소는 `useRef`로 "취소됨" 표식을 두고, 이후 도착하는 `listenOnce` 결과·오류를 무시하는 방식으로 처리한다. 브라우저 인식은 침묵 뒤 스스로 끝나고 외부 인식은 5초 뒤 끝나므로 마이크 표시등이 몇 초 더 켜져 있을 수 있다(11장).
- 파형은 음성 크기와 무관하게 일정하게 번진다. 실시간 인식 문장 미리보기는 넣지 않는다(둘 다 `speech.ts` 변경이 필요하므로 P2 제외).
- `isSpeechAvailable()`이 거짓이면 1.3.2처럼 음성 카드 자체를 그리지 않는다(변경 없음). STT 엔드포인트 없이 만든 Android AAB에서는 Android WebView가 Web Speech를 지원하지 않아 이 팝업이 보이지 않는다(8장).
- 덮개 위 버튼 2개("그만하기", "다시 말하기"·"닫기")는 하단 탭 위쪽 엄지 범위(화면 아래 64px 이상 위)에 둔다.
- 아이콘은 `src/components/ui/icons.tsx`에 등록된 lucide 아이콘만 쓴다. 체크·느낌표가 필요하면 `Check`, `AlertCircle`을 `lucide-react`에서 가져와 그 파일에 등록해 쓴다(이모지 금지).

### 3.2 국적 기반 언어 자동 설정 (요청 2)

데이터 출처는 1.3에서 만든 `public.countries`(공개 읽기 정책 `countries_select_all`, 비로그인 포함)이며 화면은 읽기만 한다.

| 열 | 쓰임 |
| --- | --- |
| `iso_code` | 국적 값(2자). `profiles.country_code`에 그대로 저장 |
| `name_ko`, `name_native` | 목록 표기(한국어 이름 위, 현지어 이름 아래 작게) |
| `default_locale` | 국적 선택 시 앱 언어로 설정할 값 |
| `supported_locales` | 언어 창 맨 위 "내 국적 언어" 구역에 고정할 언어들(`default_locale`을 맨 앞에) |

현재 7행: KR·VN·KH·TH·NP·MN·UZ. 이 국가들의 `default_locale`은 모두 `appConfig.supportedLocales`(9개)에 있다. 국가 추가는 DB 행 추가만으로 화면에 반영돼야 하며, 화면 코드에 국가 코드를 적지 않는다(PRD v1.3 §6.4 원칙).

공용 조각:

| 파일 | 내용 | 우선순위 |
| --- | --- | --- |
| `src/hooks/useCountries.ts` | `useQuery(['countries'])`로 `countries` 전체를 `name_ko` 순으로 읽음. `staleTime` 1시간(useRegions와 같은 방식). 실패 시 예외를 던지고 창 안에서 오류·다시 시도 표시 | P0 |
| `src/types/database.ts` | `countries` Row 타입 추가(타입만) | P0 |
| `src/lib/country.ts` | localStorage 키 `nongsadama.country`(ISO 2자) 읽기·쓰기·삭제, `pickLocaleForCountry(country, supportedLocales)` 순수 함수 | P0 |
| `src/components/CountrySheet.tsx` | 국적 선택 창(3.3 위에 구성). 목록 = `countries` 행 + "고르지 않을래요" | P0 |
| `src/components/LanguageSheet.tsx` | 언어 선택 창(3.3 위에 구성). "내 국적 언어" 고정 구역 + "전체 언어" | P0 |

화면 (1) `/select` — `src/pages/Select.tsx`, 수정:

| 구성 | 내용 |
| --- | --- |
| 제목 | `select.title` 그대로 |
| 국적 (선택) 줄 | 흰 입력 줄 모양(높이 44px 이상, 테두리 gray-300, 오른쪽 `ChevronRight`). 미선택이면 `select.nationalityPlaceholder`(회색), 선택하면 `name_ko`와 `name_native` |
| 언어 줄 | 같은 모양. 현재 언어의 endonym(`getLocaleLabel`). 누르면 언어 창 |
| 안내 한 줄 | 국적 선택 직후에만 표시. `select.nationalityLangSet`(`{lang}` 치환) 또는 `select.nationalityLangEnglish`. 사용자가 언어 창에서 직접 언어를 고르면 사라짐 |
| 지역 | `RegionPicker` 그대로 |
| 계속 | 기존 알약 버튼 그대로 |

동작: 국적을 고르면 `nongsadama.country`에 저장하고, `default_locale`이 `supportedLocales`에 있으면 `setLocale(default_locale, false)`, 없으면 `setLocale('en', false)`. "고르지 않을래요"는 저장값을 지우고 언어는 유지한다. 기존 세로 언어 버튼 목록은 제거하고 창으로 옮긴다(기기 언어 추천 `select.recommended` 표시는 창 안에서 유지). `explicit=false`로 두는 이유: 1.3의 `I18nProvider`가 `nongsadama.locale.explicit`을 저장하고 `AuthContext.ensureProfile`이 이 값을 `preferred_locale_explicit`으로 보내므로, 가입 시 프로필의 언어가 국적 기본 언어를 따라갈 수 있다(트리거 `profiles_apply_country_locale`).

상태 3개: 국적 미선택(기본) · 국적 선택·지원 언어 있음(안내 문구 A) · 국적 선택·지원 언어 없음(English로 두고 안내 문구 B). 현재 7개국은 모두 A이지만 B 분기도 구현한다(국가 추가 대비).

화면 (2) 언어 창 — `LanguageSheet`:

| 구역 | 내용 |
| --- | --- |
| 내 국적 언어 | 저장된 국적의 `supported_locales` 중 `supportedLocales`에 있는 것. `default_locale`이 맨 위. 국적이 없으면 `select.languagePinHint` 한 줄 |
| 전체 언어 | `supportedLocales` 순서대로 endonym. 현재 언어에 체크 표시(`Check` 아이콘)와 green-50 배경. 기기 언어에 `select.recommended` 배지 |
| 선택 | `setLocale(code, true)` 뒤 창 닫힘. 로그인 상태면 `AuthContext`가 기존대로 프로필에 반영한다(1.3 동작, 코드 변경 없음) |

쓰는 곳: `/select` 언어 줄, 헤더 `LanguageSwitcher`(P0: `<select>`를 현재 언어 endonym 버튼으로 바꾸고 이 창을 연다. `aria-label`은 `language.label` 유지), `/profile/edit` 언어 항목(P2: 폼과 묶인 `<select>`라 이번엔 유지).

화면 (3) 국적 창 — `CountrySheet`:

| 구성 | 내용 |
| --- | --- |
| 제목·안내 | `select.nationalitySheetTitle`, `select.nationalitySheetHelp`("안 골라도 모든 기능을 쓸 수 있어요. 국적은 확인하지 않아요.") |
| 목록 | `countries` 행마다 한 줄: `name_ko` 위, `name_native` 아래 작게, 선택 표시는 원형 라디오 모양(CSS). 국기 없음(이미지 자산·이모지 금지) |
| 보조 | "고르지 않을래요"(`select.nationalityNone`) |
| 상태 | 불러오는 중(`select.regionLoading` 문구 재사용 대신 신규 `select.countryLoading`), 실패(`select.countryError` + `common.retry`), 선택·미선택 |

화면 (4) `/profile/edit` — `src/pages/ProfileEdit.tsx`, 수정:

| 우선순위 | 내용 |
| --- | --- |
| P0 | 국적 자유 입력칸을 "국적 고르기" 줄(`profileEdit.countryPick`)과 `CountrySheet`로 교체. 선택값은 기존 폼 필드 `country_code`에 `setValue`로 넣어 저장 로직·zod 검사·DB 컬럼을 그대로 쓴다. 창에 "다른 나라 (코드 직접 입력)"(`profileEdit.countryOther`) 줄을 두어 누르면 기존 텍스트 입력칸이 나타난다(다른 국적 사용자의 기존 기능 유지). "국적 지우기"(`profileEdit.countryClear`)로 비운다 |
| P1 | 국적을 고르면 언어 `<select>` 값을 `default_locale`로 바꾸고 안내 한 줄(`select.nationalityLangSet`)을 보인다. 저장 시 `preferred_locale: default_locale, preferred_locale_explicit: false`를 보내 트리거가 국적 기본 언어를 적용하게 하고, 응답의 `preferred_locale`·`preferred_locale_explicit`으로 `setLocale`한다(기존 코드 경로). 사용자가 언어 `<select>`를 직접 바꾸면 1.3.2처럼 `explicit: true` |
| P1 | `AuthContext.ensureProfile`의 `insert` 객체에 `country_code: readStoredCountry()` 한 줄 추가(가입 전 `/select`에서 고른 국적을 프로필에 옮김). 이 파일의 다른 줄은 바꾸지 않는다 |

### 3.3 공용 "아래에서 올라오는 창" — `src/components/ui/BottomSheet.tsx` — P0

| 항목 | 사양 |
| --- | --- |
| 속성 | `open`, `onClose`, `title`, `titleId`(선택), `children` |
| 구조 | `fixed inset-0 z-50`. 배경 `bg-black/35`(누르면 닫힘). 창은 하단 고정, 흰색, 위쪽 모서리 16px, 상단 손잡이 막대(36×4px, gray-300), 안쪽 여백 16px, 하단에 `env(safe-area-inset-bottom)` 추가 여백, 최대 높이 78vh, 내부 세로 스크롤 |
| 접근성 | `role="dialog"`, `aria-modal="true"`, `aria-labelledby`(제목). 열리면 첫 버튼에 포커스, Escape로 닫힘. 닫히면 열기 전 요소로 포커스 복귀(P1) |
| 스크롤 | 열려 있는 동안 `document.body.style.overflow = 'hidden'`, 닫히면 원복(정리 함수) |
| 모션 | `translateY(100%)`에서 `0`, 280ms `cubic-bezier(.2,.8,.2,1)`. 배경 불투명도 200ms. 감속 모션 설정이면 즉시 |
| 렌더 | `open`이 거짓이면 아무것도 그리지 않는다(포털 불필요, `AppLayout` 헤더 `z-10`보다 위) |

고지 창(3.1)·국적 창·언어 창이 모두 이 구성 요소 위에 만든다.

## 4. 영향 범위

수정하는 파일:

| 파일 | 변경 |
| --- | --- |
| `src/pages/Talk.tsx` | 상태 기계·팝업 연결·오류 분기 |
| `src/pages/Select.tsx` | 언어 목록을 줄+창으로 교체, 국적 줄·안내 추가 |
| `src/pages/ProfileEdit.tsx` | 국적 입력을 창으로 교체(P0), 언어 연동(P1) |
| `src/components/layout/LanguageSwitcher.tsx` | `<select>`를 버튼+언어 창으로 교체 |
| `src/components/ui/icons.tsx` | `Check`, `AlertCircle`, `ChevronRight` 등록 |
| `src/index.css` | 파형·등장 `@keyframes`, 감속 모션 규칙 |
| `src/types/database.ts` | `countries` Row 타입 |
| `src/context/AuthContext.tsx` | (P1) `insert`에 `country_code` 한 줄 |
| `src/i18n/dictionaries/*.json` 9개 | 부록 A의 키 추가(전 언어 동일 키, 빈 값 금지 — `tests/i18n.test.mjs`가 검사) |
| `src/config/version.ts`, `android/app/build.gradle`(10~11행), `package.json`, `package-lock.json` | 버전만 |
| `docs/changelog/CHANGELOG.md`, `docs/releases/RELEASE_v1.4.md`(신규), `docs/TEST_CHECKLIST.md`, `docs/DECISIONS.md` | 문서 |

새로 만드는 파일: `src/components/ui/BottomSheet.tsx`, `src/components/talk/VoicePopup.tsx`, `src/components/CountrySheet.tsx`, `src/components/LanguageSheet.tsx`, `src/hooks/useCountries.ts`, `src/lib/country.ts`.

손대지 않는 것(이번 릴리스의 안전 경계):

| 경로 | 이유 |
| --- | --- |
| `supabase/` 전체(마이그레이션·Edge Function·테스트 SQL) | 데이터·API 무변경. 라이브 DB에 어떤 SQL도 실행하지 않는다 |
| `android/` 전체(`build.gradle` 버전 2줄 제외), `capacitor.config.ts`, `AndroidManifest.xml` | 권한·플러그인·패키지 id 무변경 |
| `package.json`의 `dependencies`·`devDependencies` | 새 의존성 금지. `version` 필드만 |
| `src/lib/speech.ts`, `src/lib/supabase.ts`, `src/lib/nativeOAuth.ts`, `src/lib/tts.ts` | 음성·인증·네이티브 경로 무변경 |
| `src/config/app.ts`의 `supportedLocales`·`speechLangTags`, `src/i18n/I18nContext.tsx` | 언어 구조 무변경(키 추가만) |
| `src/App.tsx` 라우트 | 새 화면 없음 |
| `.env*`, `*.jks`, `local.properties`, `.github/workflows/` | 비밀값·서명·배포 설정 |
| `src/pages/Privacy.tsx` 등 법적 페이지, `talk.micNotice*` 문구 | 법적 고지 무변경 |

## 5. 데이터 변경

없음. `countries`는 1.3 마이그레이션 `20260918000100_countries.sql`로 이미 있고 공개 읽기 정책이 있어 비로그인 `/select`에서도 읽힌다. `profiles.country_code`·`preferred_locale`·`preferred_locale_explicit`도 기존 컬럼이다. 마이그레이션 파일을 추가하지 않고, 라이브 DB에 아무것도 실행하지 않는다.

## 6. API 변경

없음. Edge Function 호출 규격(`stt`)과 클라이언트 호출부(`speech.ts`) 그대로.

## 7. Supabase 운영 설정(오너)

없음. 1.3의 미완 설정(STT secret·`VITE_STT_ENDPOINT`·Redirect URL)은 [RELEASE_v1.3 §3](../releases/RELEASE_v1.3.md)의 별개 결정이며 이 릴리스의 전제가 아니다.

## 8. Android 영향

| 항목 | 내용 |
| --- | --- |
| 버전 | `versionCode 7`, `versionName "1.4"` (`android/app/build.gradle` 10~11행). `src/config/version.ts`는 `'1.4'`·`7`, `package.json`은 `1.4.0` |
| 권한·플러그인 | 변경 없음. `npx cap sync android` 결과에 플러그인 3개(`@capacitor/app`, `@capacitor/browser`, `@capacitor/geolocation`)가 그대로 보여야 한다 |
| 말하기 팝업 노출 | Android WebView는 Web Speech API를 지원하지 않는다. AAB를 만드는 PC의 `.env.local`에 `VITE_STT_ENDPOINT`가 없으면 앱에서는 음성 카드가 아예 보이지 않아 팝업도 보이지 않는다(1.3.2와 같은 동작). 엔드포인트를 넣고 빌드하면(`npm run build:release`는 이 값을 요구한다) 앱에서도 팝업이 보이며, 그 경우 [RELEASE_v1.3 §3](../releases/RELEASE_v1.3.md)의 방침·secret 전제가 먼저 끝나 있어야 한다 |
| 웹 | `nongsadama.app`에는 두 기능이 모두 보인다(브라우저 Web Speech) |
| 아래 창 | 하단 제스처 영역과 겹치지 않도록 `env(safe-area-inset-bottom)` 여백. 기기 뒤로 가기 버튼으로 창을 닫는 처리는 넣지 않는다(P2, 라우트 이력을 건드리지 않기 위해) |

## 9. UI 규칙(DESIGN.md v1 요약 — 임의 색·둥글기·그림자 금지)

| 항목 | 값 |
| --- | --- |
| 기준 화면 | 375×812 세로, 모바일 우선. PC는 같은 화면이 가운데 놓일 뿐 |
| 배경 | `bg-brand-cream`(#f5f1e8). 회색 페이지 배경 금지 |
| 카드·창 | 흰색, `rounded-card`(16px), `shadow-card`, 테두리 gray-100 |
| 주 행동색 | `bg-brand-greenDark`(#15803d). 화면당 주 버튼 1개, 알약(`rounded-full`) 높이 56px |
| 보조 초록 | `bg-green-50`·`text-green-800`(선택 상태·안내), `border-green-300` |
| 보조 버튼 | 알약, `border-gray-300`, `text-gray-700` |
| 글꼴 | 시스템 기본. 페이지 제목 `text-xl font-extrabold tracking-tight`, 구역 라벨 `text-sm font-semibold text-gray-700`, 본문 `text-base` |
| 아이콘 | `icons.tsx`에 등록된 lucide 선 아이콘만(선 2, 둥근 끝, `currentColor`). 이모지·이미지 아이콘 금지 |
| 터치 영역 | 44px 이상, 화면 대표 버튼 56px |
| 문구 | 짧은 해요체, 한 문장 한 호흡. 번역투("~할 수 있습니다", "~를 통해") 금지 |
| 다국어 길이 | 크메르어·태국어·네팔어는 글자 높이가 크고 베트남어·러시아어는 한국어보다 30% 이상 길다. 줄·버튼은 두 줄까지 접히게 두고 `truncate`를 쓰지 않는다 |

## 10. 테스트 항목

자동 검사(전부 통과해야 커밋한다. 1.3.2 기준값: typecheck 오류 0, `node --test` 3파일 12건 통과, `npm run build` 성공):

| 항목 | 명령 | 기준 |
| --- | --- | --- |
| 의존성 | `npm ci` | lock 변경 없음(버전 커밋 제외) |
| TypeScript | `npm run typecheck` | 오류 0 |
| 웹 빌드 | `npm run build` | 성공 |
| 사전·언어·좌표 테스트 | `node --test tests/i18n.test.mjs tests/client-integration.test.mjs tests/geo.test.mjs` | 12건 전부 통과(신규 키가 9개 사전에 모두 있고 비어 있지 않아야 통과) |
| Capacitor | `npx cap sync android` | 플러그인 3개 인식, `android/app/src/main/assets/public/index.html`이 `dist/index.html`과 동일. `capacitor.build.gradle`·`capacitor.settings.gradle`의 줄바꿈 차이만 나면 `git checkout --`로 되돌린다 |
| 비밀값 | `git status --short` | `.jks`·`.env*`·`local.properties` 없음 |

수동 검증(`npm run dev`, 375px, 한국어·English·Tiếng Việt 세 언어로 각각):

| # | 화면 | 시나리오 | 기대 |
| --- | --- | --- | --- |
| 1 | `/select` | 첫 진입 | 국적 줄(비어 있음)·언어 줄(현재 언어)·지역·계속. 언어 세로 목록 없음 |
| 2 | `/select` | 국적 줄 누름 | 창이 올라오고 7개국이 한국어·현지어로 보임. 바깥 탭·Escape로 닫힘 |
| 3 | `/select` | 베트남 선택 | 창 닫힘, 언어 줄이 Tiếng Việt, 안내 A 표시, 화면 전체가 베트남어. 새로고침해도 유지, `localStorage`에 `nongsadama.country=VN`, `nongsadama.locale.explicit=false` |
| 4 | `/select` | 언어 줄 누름 | "내 국적 언어"에 Tiếng Việt·English, 아래 전체 9개, 현재 언어 체크, 기기 언어 추천 배지 |
| 5 | `/select` | 언어 창에서 한국어 직접 선택 | 한국어로 전환, 안내 문구 사라짐, `explicit=true` |
| 6 | `/select` | "고르지 않을래요" | 국적 줄 비움, 언어 유지, `nongsadama.country` 삭제 |
| 7 | `/select` | 국적 창에서 네트워크 끊김(개발자 도구 오프라인) | 오류 문구와 다시 시도 버튼. 화면은 계속 사용 가능 |
| 8 | 헤더 | 언어 버튼 | 같은 언어 창. 선택 즉시 전환, 로그인 상태면 프로필 언어 반영(1.3.2 동작) |
| 9 | `/talk` | 첫 "말로 하기" | 고지 창(문구는 1.3.2와 동일). "안 할래요"로 닫으면 아무 일 없음 |
| 10 | `/talk` | "알겠어요, 말하기" | 덮개·원·파형 3겹, "듣고 있어요…", 그만하기 버튼. 두 번째부터는 고지 없이 바로 |
| 11 | `/talk` | 말하기 | 체크 아이콘 뒤 닫히고 초록 상자에 문장. 4개 선택 버튼에 `prefill`로 전달(기존) |
| 12 | `/talk` | 듣는 중 그만하기·바깥 탭 | 즉시 닫힘. 늦게 온 결과가 상자에 나타나지 않음 |
| 13 | `/talk` | 마이크 권한 거부 | 느낌표·권한 문구·다시 말하기·닫기 |
| 14 | `/talk` | 외부 STT 켠 로컬(`VITE_STT_ENDPOINT` 설정)에서 비로그인 | 로그인 안내 문구 |
| 15 | `/talk` | 감속 모션 설정 켬 | 파형 정지, 전이 즉시 |
| 16 | `/profile/edit` | 국적 고르기 | 창에서 선택 시 줄에 표시, 저장 후 `/profile`에 국적 코드. "다른 나라"로 코드 직접 입력·"국적 지우기" 동작 |
| 17 | `/profile/edit` | (P1) 국적 선택 뒤 저장 | 앱 언어가 국적 기본 언어로 바뀜. 언어를 직접 고른 뒤 저장하면 그 언어 유지 |
| 18 | 회귀 | 로그인·글쓰기·이웃·지도·생활정보 | 1.3.2와 동일 |
| 19 | 회귀 | 언어 9개 전부에서 `/select`·`/talk` | 문구 누락(키 이름 노출) 없음, 두 줄 접힘 정상 |
| 20 | Android(오너, AAB 설치 후) | `/select`·헤더·프로필 국적 | 창 동작, 하단 여백, 뒤로 가기 시 앱 종료 아님(라우트 이력 정상) |

## 11. 알려진 이슈·이번 제외

| 항목 | 내용 | 처리 |
| --- | --- | --- |
| 취소 뒤 마이크 표시등 | 취소해도 브라우저 인식은 침묵까지, 외부 인식은 5초까지 녹음이 이어진다(결과는 버림). 중단 기능은 `speech.ts` 변경이 필요 | 1.5 검토 |
| 음성 크기 연동 파형·실시간 미리보기 | 마이크 스트림 접근·중간 결과 노출이 필요 | 1.5 검토 |
| 게시글 자동 번역 | 번역 기능·비용 결정 없음 | 범위 밖 |
| Lottie 등 애니메이션 파일 | CSS로 충분, 의존성 금지 | 범위 밖 |
| 국가 추가(필리핀·인도네시아·미얀마 등) | `countries` 행 추가는 DB 작업 | 별도 마이그레이션으로 검토, 화면은 행이 늘어도 그대로 동작 |
| 국기 표시 | 이미지 자산 추가·이모지 금지 원칙 | 범위 밖 |
| 기존 프로필의 언어 | `preferred_locale_explicit=true`인 기존 프로필은 국적을 골라도 서버 언어가 바뀌지 않는다(3.2 P1을 넣으면 그 저장부터 따라감) | 의도된 동작 |
| 언어 이름의 한국어 병기 | `localeLabels`는 endonym만 있음 | P2, 넣으려면 `app.ts`에 표기 데이터만 추가 |
| Android 뒤로 가기로 창 닫기 | 라우트 이력 조작 필요 | P2 |

## 12. 롤백 조건

- 자동 검사 4종 중 하나라도 실패한 채로는 커밋하지 않는다.
- 수동 검증 1~13·16·18 중 하나라도 실패하면 해당 기능(3.1 또는 3.2)을 통째로 빼고 1.3.2 동작으로 되돌린 뒤 나머지만 릴리스한다.
- Play 업로드 뒤 `/select`·`/talk`·로그인 흐름에서 1.3.2에 없던 crash·빈 화면이 보고되면 롤백한다.

## 13. 롤백 방법

- 코드: `v1.3.2` 태그 소스에서 `versionCode 8`, `versionName "1.3.3"`으로 올려 AAB를 다시 만든다(Play는 `versionCode` 증가만 받는다). DB·Edge Function은 바꾸지 않았으므로 되돌릴 것이 없다.
- 부분 롤백: 3.1과 3.2는 서로 독립이므로 한쪽만 `git revert`할 수 있게 **기능별로 커밋을 나눈다**.

## 부록 A. i18n 신규 키(한국어·영어 원문)

9개 사전(`ko, en, vi, km, th, ne, mn, uz, ru`)에 같은 키를 넣는다. 나머지 7개 언어는 아래 뜻에 맞춰 채우고 CHANGELOG에 "원어민 검수 전"으로 적는다(1.3.2와 같은 방식). `{lang}` 자리표시자는 전 언어에 그대로 둔다.

| 키 | 한국어 | English |
| --- | --- | --- |
| `common.close` | 닫기 | Close |
| `talk.popupStop` | 그만하기 | Stop |
| `talk.popupRetry` | 다시 말하기 | Try again |
| `talk.popupDone` | 다 들었어요 | Got it |
| `talk.sheetTitle` | 말하기 전에 알려드려요 | Before you speak |
| `talk.speechErrorPermission` | 마이크 권한을 허용해 주세요. | Please allow microphone access. |
| `talk.speechErrorLogin` | 음성 입력은 로그인한 뒤 쓸 수 있어요. | Sign in to use voice input. |
| `select.nationality` | 국적 (선택) | Nationality (optional) |
| `select.nationalityPlaceholder` | 국적을 고르면 언어를 맞춰 드려요 | Pick your nationality and we'll set the language |
| `select.nationalitySheetTitle` | 국적을 골라 주세요 | Choose your nationality |
| `select.nationalitySheetHelp` | 안 골라도 모든 기능을 쓸 수 있어요. 국적은 확인하지 않아요. | You can skip this and still use everything. We don't verify it. |
| `select.nationalityNone` | 고르지 않을래요 | Skip for now |
| `select.nationalityLangSet` | 국적에 맞춰 {lang}로 바꿨어요. 아래에서 바꿀 수 있어요. | We set the language to {lang} for your nationality. You can change it below. |
| `select.nationalityLangEnglish` | 이 나라 언어는 아직 준비 중이에요. 우선 English로 두었어요. | We don't have this language yet, so English is set for now. |
| `select.languagePinned` | 내 국적 언어 | Languages for my nationality |
| `select.languageAll` | 전체 언어 | All languages |
| `select.languagePinHint` | 국적을 고르면 여기에 고정돼요 | Pick a nationality to pin its languages here |
| `select.countryLoading` | 나라 목록을 가져오고 있어요… | Loading countries… |
| `select.countryError` | 나라 목록을 못 가져왔어요. | Couldn't load the country list. |
| `profileEdit.countryPick` | 국적 고르기 | Choose nationality |
| `profileEdit.countryOther` | 다른 나라 (코드 직접 입력) | Other country (enter code) |
| `profileEdit.countryClear` | 국적 지우기 | Clear nationality |

기존 키 재사용: `talk.micNotice`, `talk.micNoticeExternal`, `talk.micAgree`, `talk.micCancel`, `talk.micButton`, `talk.listening`, `talk.speechError`, `talk.transcriptHint`, `select.language`, `select.recommended`, `language.label`, `profileEdit.country`, `profileEdit.countryPlaceholder`, `profileEdit.countryHelp`, `common.retry`.

## 부록 B. 릴리스 절차 요약(코드 작업자 → 오너)

1. 브랜치 `feat/v1.4-uiux`(`main` = `v1.3.2`에서 분기). 기능별 커밋: (1) 공용 창, (2) 국적·언어, (3) 말하기 팝업, (4) 사전 키, (5) 문서·버전 `release: NongsaDaMa v1.4`.
2. 버전 3곳: `src/config/version.ts`(`'1.4'`, `7`), `android/app/build.gradle`(`7`, `"1.4"`), `package.json`(`1.4.0`) 뒤 `npm install --package-lock-only`.
3. 문서 4곳: `CHANGELOG.md` `[1.4]` 항목(상단의 `Updated upstream`·`Stashed changes`·중복 `[Unreleased]` 잔재는 이때 정리), `docs/releases/RELEASE_v1.4.md`(RELEASE_v1.3 형식, §2 AAB 전 확인표·§5 절차·§6 실기기 확인·§7 출시 노트 ko/en), `docs/TEST_CHECKLIST.md`에 v1.4 절, `docs/DECISIONS.md`에 D-040(팝업·국적 창 결정과 제외 항목).
4. 태그 `v1.4`(annotated, "NongsaDaMa v1.4 - UI/UX: voice popup, nationality-based language (versionCode 7)"). push는 오너가 확인 뒤 직접 한다.
5. 오너: `npm ci` → `npm run build`(또는 STT를 넣는 경우 `build:release`) → `npx cap sync android` → Android Studio에서 서명 AAB 생성(`android/app/release/app-release.aab`, 수정 시각 확인) → Play Console 업로드. 권장 경로는 내부 테스트에 올려 §10의 20번을 실기기에서 확인한 뒤 같은 버전을 프로덕션으로 승격하는 것이다.
