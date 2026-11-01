# RELEASE v1.6 — 지금 보는 지역과 내 지역 · 지역 동기화

- 버전: `versionName 1.6` / `versionCode 10` (`android/app/build.gradle`), 웹 `APP_VERSION = "1.6"` · `APP_VERSION_CODE = 10` (`src/config/version.ts`), `package.json` 1.6.0
- 작성일: 2026-10-24 · 요구: [PRD_v1.6](../prd/PRD_v1.6.md) · 변경 이력: [CHANGELOG](../changelog/CHANGELOG.md) · 결정: DECISIONS D-047 · 이전: [RELEASE_v1.5](RELEASE_v1.5.md)
- 작업 브랜치: `feat/region-sync-v1.6`(아직 commit 없음). **commit·merge·tag·push는 오너가 확인한 뒤 한다**(§4). `main`에 push하면 웹(nongsadama.app, Cloudflare)과 GitHub Pages가 바로 배포된다.

## 1. 순서
| # | 할 일 | 상태 | 어기면 |
|---|---|---|---|
| 1 | DB·RLS·Edge Function | 해당 없음(변경 없음) | — |
| 2 | 오너 확인: 표시줄·저장 제안 문구(9개 언어, `src/i18n/dictionaries/*.json`의 `region.*`·`farm.*`), 동작(PRD_v1.6 §1) | ⬜ | |
| 3 | commit(§4) → merge·push → 웹 자동 배포 | ⬜ | |
| 4 | 서명 AAB 빌드·업로드(§5) | ⬜ | |
| 5 | 출시 뒤 점검(§6) | ⬜ | |

## 2. 미리 알아 둘 것
- **음성 입력(이전부터)**: 이 PC의 `.env.local`에 `VITE_STT_ENDPOINT`가 있어 빌드에 외부 음성 인식(OpenAI)이 들어간다. 개인정보처리방침에는 OpenAI가 없다 — 1.6도 같은 상태(오너 결정 대기, RELEASE_v1.4 §2).
- 가입할 때 지역을 프로필에 넣지 않는다(B안). 새 회원은 로그인 뒤 "내 지역으로 저장"을 눌러야 이웃 찾기·거리 표시·D-045 잠금이 내 지역 기준으로 동작한다. 저장 전에는 게시판·글쓰기가 보는 지역을 쓴다(D-045 문구 그대로).
- 지역이 없으면 생활정보를 조회하지 않는다. 1.5까지는 지역 없이 들어오면 전국 146건이 보였다 — 이제는 "지역 없이 전국 둘러보기"를 눌러야 한다.
- 오너 기기처럼 1.5 기기 지역(부천)과 프로필(밀양)이 다르면 자동으로 바뀌지 않는다(M1). 표시줄의 "내 지역으로"를 한 번 누르면 된다.

## 3. 빌드 전 확인
| # | 항목 | 방법 |
|---|---|---|
| 1 | 소스 | `git describe --tags` → `v1.6`, `git status --short`에 1.6 파일이 남아 있지 않음 |
| 2 | 버전 | `android/app/build.gradle` `versionCode 10`, `versionName "1.6"` |
| 3 | 웹 빌드·동기화 | `npm ci` → `npm run build` → `npx cap sync android`(줄바꿈만 바뀐 `capacitor.build.gradle`·`capacitor.settings.gradle`은 `git checkout --`) |
| 4 | 번들에 1.6이 들어갔는지 | `android/app/src/main/assets/public/assets/index-*.js`에 `nongsadama.regionChoice`가 있음 |
| 5 | 비밀값 | `git status --short`·커밋 목록에 `.jks`·`.env*`·`local.properties` 없음 |

## 4. Git(오너 실행, 경로 지정 `git add`만 — 미확인 다운로드 `insane-search-main*`·`imnotai*`·`design-md*`·`awesome-design-md-main/`은 넣지 않는다)
```bash
git add src/lib/regionScope.ts src/lib/regionChoice.ts src/lib/regionChoiceStore.ts src/context/RegionChoiceContext.tsx src/context/AuthContext.tsx src/context/SelectedRegionContext.tsx src/main.tsx src/config/app.ts src/components/RegionViewBar.tsx src/components/RegionNeededBox.tsx src/components/RegionSaveOffer.tsx src/components/layout/AppLayout.tsx src/components/ui/icons.tsx src/hooks/useTapGuard.ts src/hooks/useRegions.ts src/hooks/useLifeInfo.ts src/hooks/useRegionalInfo.ts src/hooks/useBoardGate.ts src/lib/regionName.ts src/lib/kakaoMap.ts src/pages/MapHome.tsx src/pages/LifeInfo.tsx src/pages/FarmTips.tsx src/pages/Landing.tsx src/pages/Select.tsx src/pages/ProfileEdit.tsx src/pages/Profile.tsx src/pages/Neighbors.tsx src/pages/Board.tsx src/pages/BoardPostDetail.tsx src/pages/PostForm.tsx src/i18n/dictionaries tests/region-choice.test.mjs tests/e2e/region-sync-check.mjs tests/e2e/local-tips-check.mjs tests/e2e/account-check.mjs
```
```bash
git commit -m "feat(v1.6): 지금 보는 지역과 내 지역 분리·지역 동기화 (D-047)"
```
```bash
git add docs/DECISIONS.md docs/TEST_CHECKLIST.md docs/prd/PRD_v1.5.md docs/prd/PRD_v1.6.md docs/releases/RELEASE_v1.6.md docs/changelog/CHANGELOG.md
```
```bash
git commit -m "docs(v1.6): D-047 결정·점검 기록, PRD·RELEASE v1.6"
```
```bash
git add src/config/version.ts android/app/build.gradle package.json package-lock.json
```
```bash
git commit -m "release: NongsaDaMa v1.6"
```
그다음 `main`으로 merge(또는 브랜치 push 후 PR) → `git tag -a v1.6 -m "NongsaDaMa v1.6"` → `git push origin main v1.6`.
`tests/e2e/local-tips-check.mjs`·`account-check.mjs`에는 1.6 전부터 있던 `LIVE_URL` 변경(운영 주소로 점검)이 함께 들어간다. 따로 넣으려면 `git add -p`로 나눈다.
전국 생활정보 기반 작업(`pipeline/`, `tests/pipeline/`, `tests/e2e/nationwide-check.mjs`, `content/`, `docs/reports/`, `docs/plans/`)과 조사 폴더·`run_nongsadama*.ps1`은 넣지 않는다.

## 5. AAB 빌드·업로드
1. §3 확인 → Android Studio → Build → Generate Signed App Bundle(릴리스 키) → `android/app/release/app-release.aab` 수정 시각 확인.
2. Play Console → 1.5를 올린 트랙 → 새 버전 → AAB 업로드 → `1.6 (10)` → 출시 노트 → 출시.

**출시 노트**
- 한국어: 농사다마 1.6 — 지도·생활정보 위에 "지금 보는 지역"을 보여 주고, 내 지역과 다르면 한 번에 돌아갈 수 있어요. 지역을 고르지 않으면 전국 대신 지역을 고르라고 안내해요(전국은 직접 고를 수 있어요). 둘러보는 지역을 내 지역으로 저장할지 물어봐요.
- English: NongsaDaMa 1.6 — the map and Life Info now show the area you're viewing, with a one-tap way back to your area. Without an area you're asked to pick one (you can still browse all of Korea), and you can save the area you're viewing as your area.

## 6. 출시 뒤 점검
1. 웹: `npm run build && node tests/e2e/region-sync-check.mjs`(로컬 번들, 41건) — 운영 주소로는 돌리지 않는다(쓰기 흉내가 있음).
2. 오너 기기: 부천으로 남아 있던 브라우저에서 표시줄 "지금 보는 지역: 부천시 · 내 지역은 밀양시" → "내 지역으로" → 밀양 21건.
3. 새 시험 계정(이메일·카카오 각각): 가입 직후 프로필 지역이 비어 있고(Supabase 표에서 확인), 홈 표시줄에 "내 지역으로 저장" → 저장 → 닉네임이 가입 때 넣은 그대로인지.
4. 로그아웃 → 홈: 프로필에서 온 지역이면 "지역을 골라 주세요", 직접 고른 지역이면 그대로.
5. 실기기(Android): 1.5에서 1.6으로 업데이트한 뒤 고른 지역이 그대로인지, /farm 날씨 카드의 "보는 지역 기준".

## 7. 검증 결과(2026-10-24, 이 PC, 로컬 번들)
- `npx tsc --noEmit` 0 · `node --test` 앱 6파일 48건 통과(새 `tests/region-choice.test.mjs` 20건 포함, 9개 언어 키·자리표시자 일치, 정규식 뒤보기 없음) · `npm run build` 성공.
- `tests/e2e/region-sync-check.mjs`: **41/41 통과** — 구버전 값 옮김(M1)·지도와 목록 같은 범위·같은 캐시, 지역 없음 → 조회 0건 → 전국 둘러보기(상한 501, 146건), 지역 선택 "계속" 머묾, 회원 프로필 동기화, M1 부천 유지 → "내 지역으로" → 밀양 21건, 프로필 8초 지연 → 5초에 안내·늦은 응답은 버튼만, 프로필 실패 → 안내·조회 0, 저장 제안 PATCH(`region_id=is.null`, 지역만)·insert 0, "나중에" 유지, 닉네임만 수정 → 보는 지역 그대로, 로그아웃(프로필 지역 지움·직접 고른 지역 유지), 두 탭 동기화, 9개 언어 중 6개 320·375px 표시줄·저장 제안 넘침 없음, /farm, 게시판 전용 안내, 첫 화면 이동. 운영 DB로 나간 쓰기 0(로그아웃 요청 2건은 브라우저 안에서 막음).
- 기존 점검: `local-tips-check.mjs` **47/47**, `account-check.mjs` **20/20(3회)**. 바꾼 점: 게시판 지역 없음 문구 키(게시판 전용), 가짜 로그인의 "프로필 없음" 응답을 빈 결과로(공개 키로 운영 DB에 물으면 권한 오류 — 1.5는 이 오류를 기기 지역으로 감췄다), 회원탈퇴 다시 누르기 전 350ms 대기(D-046 탭 보호와 스크린샷 속도에 따라 흔들리던 시간 문제).
- 미실측: 실기기, 실제 계정 가입·저장, Play 업로드, 운영 배포 뒤 확인.
