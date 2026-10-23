# RELEASE v1.5 — 우리 동네 추천 · 게시글 사진 · 다른 지역 보기 제한

- 버전: `versionName 1.5` / `versionCode 9` (`android/app/build.gradle`), 웹 `APP_VERSION = "1.5"` · `APP_VERSION_CODE = 9` (`src/config/version.ts`), `package.json` 1.5.0
- 작성일: 2026-10-23 · 요구: [PRD_v1.5](../prd/PRD_v1.5.md) · 변경 이력: [CHANGELOG](../changelog/CHANGELOG.md) · 결정: DECISIONS D-043·D-044·D-045·D-046 · 이전: [RELEASE_v1.4.1](RELEASE_v1.4.1.md)
- **commit·tag·push는 오너가 확인한 뒤 한다**(아래 §4 명령). `main`에 push하면 웹(nongsadama.app, Cloudflare)이 바로 배포된다.

## 1. 순서(지키지 않으면 생기는 일)
| # | 할 일 | 상태 | 어기면 |
|---|---|---|---|
| 1 | DB 마이그레이션 2개 적용 | ✅ 2026-10-23 적용(`20261023004038_posts_category_recommend`, `20261023004059_post_images`). 1.4.1로 다시 점검 — 이상 없음 | 새 앱의 추천 글 저장 실패. 사진 열이 없으면 앱이 사진 없이 동작하도록 해 두었다 |
| 2 | 오너 검토: 개인정보처리방침·계정 삭제 안내의 사진 문구와 새 삭제 경로(계정 설정 → 본인 확인)(`src/pages/Privacy.tsx`, `DeleteAccount.tsx`, 개정일 2026-10-23) | ⬜ | 사진을 받으면서 고지 없음, 안내 경로가 앱과 다름 |
| 3 | Edge Function `delete-account` 배포(사진 폴더를 먼저 비움) | ✅ 2026-10-23 버전 5(JWT 검증 유지). 로그인 없는 호출 401, 사전 요청 200 확인 | 새 앱으로 사진을 올린 사람이 계정을 지우면 사진이 공개로 남는다 |
| 4 | Play Console → 앱 콘텐츠 → 데이터 보안: "사진" 수집·공유(공개 게시) 추가 | ⬜ | 심사 거절·정책 위반 |
| 5 | push하는 날짜로 `src/pages/DeleteAccount.tsx` `EFFECTIVE_DATE`, `src/pages/Privacy.tsx` `REVISED_DATE`·§6 이력 날짜를 맞춘 뒤 commit·tag·push(§4) → 웹 자동 배포 | ⬜ | 고지 날짜가 실제 시행과 다름 |
| 6 | 서명 AAB 빌드·업로드(§5) | ⬜ | |
| 7 | 출시 뒤 점검(§6), 사진 정리 스크립트 주 1회 미리보기 | ⬜ | |

```bash
npx supabase functions deploy delete-account --project-ref ikusdwursvbdrznbcjtw
```

## 2. 미리 알아 둘 것
- **음성 입력(이전부터)**: 이 PC의 `.env.local`에 `VITE_STT_ENDPOINT`가 있어 어느 빌드든 외부 음성 인식(OpenAI)이 들어간다. 출시된 1.4.1 번들에도 들어 있다. 개인정보처리방침에는 OpenAI가 없다(화면 안 동의 문구에는 있다). 1.5도 같은 상태로 나간다 — 정리 여부는 오너 결정(RELEASE_v1.4 §2).
- 1.4.1을 쓰는 사람: 추천 글의 종류 이름 자리에 `board.category.recommend`가 보이고, 사진이 안 보이며, 다른 지역 제한이 없다. 업데이트하면 사라진다.
- 카메라로 바로 찍기는 없다(갤러리에서 고르기). `CAMERA` 권한은 넣지 않았다.

## 3. 빌드 전 확인
| # | 항목 | 방법 |
|---|---|---|
| 1 | 소스 | `git describe --tags` → `v1.5`, `git status --short`에 1.5 파일이 남아 있지 않음 |
| 2 | 버전 | `android/app/build.gradle` `versionCode 9`, `versionName "1.5"` |
| 3 | 웹 빌드·동기화 | `npm ci` → `npm run build` → `npx cap sync android`(플러그인 3개, 줄바꿈만 바뀐 `capacitor.build.gradle`·`capacitor.settings.gradle`은 `git checkout --`) |
| 4 | 번들에 1.5가 들어갔는지 | `android/app/src/main/assets/public/assets/index-*.js`에 `post-images`가 있음 |
| 5 | 비밀값 | `git status --short`·커밋 목록에 `.jks`·`.env*`·`local.properties` 없음 |

## 4. Git(오너 실행, 경로 지정 `git add`만)
먼저 지금 `main`이 `origin/main`보다 2커밋(1.4.1) 앞서 있다. push하면 1.4.1과 1.5가 함께 웹에 나간다.

```bash
git add src/lib/digits.ts src/lib/postCategories.ts src/lib/postImagePaths.ts src/lib/postImages.ts src/lib/regionGate.ts src/hooks/useBoardGate.ts src/hooks/usePosts.ts src/pages/Board.tsx src/pages/BoardPostDetail.tsx src/pages/PostForm.tsx src/pages/LifeInfo.tsx src/pages/Privacy.tsx src/pages/DeleteAccount.tsx src/pages/Profile.tsx src/pages/Login.tsx src/components/ui/Card.tsx src/components/ui/icons.tsx src/types/database.ts src/i18n/dictionaries supabase/migrations/20261023004038_posts_category_recommend.sql supabase/migrations/20261023004059_post_images.sql supabase/functions/delete-account/index.ts scripts/cleanup-post-images.mjs tests/board.test.mjs tests/board-rules.test.mjs tests/e2e/lib/cdp.mjs tests/e2e/local-tips-check.mjs tests/e2e/account-check.mjs
```
```bash
git commit -m "feat(v1.5): 우리 동네 추천·게시글 사진·다른 지역 보기 제한·가입/탈퇴 확인 단계 (D-043~046)"
```
```bash
git add supabase/migrations/20261013000000_life_info_foreign_resident_content.sql docs/DECISIONS.md docs/TEST_CHECKLIST.md docs/prd/PRD_v1.5.md docs/releases/RELEASE_v1.5.md docs/changelog/CHANGELOG.md docs/outreach/2026-10-23_gmigrant_link_request.md
```
```bash
git commit -m "docs(v1.5): D-042~046 결정·점검 기록, PRD·RELEASE v1.5, 경기도 센터 협조 요청 초안"
```
```bash
git add src/config/version.ts android/app/build.gradle package.json package-lock.json
```
```bash
git commit -m "release: NongsaDaMa v1.5"
```
```bash
git tag -a v1.5 -m "NongsaDaMa v1.5"
```
```bash
git push origin main v1.5
```
전국 생활정보 기반 작업(`pipeline/`, `tests/pipeline/`, `tests/e2e/nationwide-check.mjs`, `content/`, `docs/reports/`, `docs/plans/`)은 위 커밋에 넣지 않았다. 따로 넣을지는 오너 결정. 조사 폴더 2개와 `run_nongsadama*.ps1`은 넣지 않는다(D-042 참고).

## 5. AAB 빌드·업로드
1. §3 확인 → Android Studio → Build → Generate Signed App Bundle(릴리스 키) → `android/app/release/app-release.aab` 수정 시각 확인.
2. Play Console → 1.4.1을 올린 트랙 → 새 버전 → AAB 업로드 → `1.5 (9)` → 출시 노트 → 출시.

**출시 노트**
- 한국어: 농사다마 1.5 — 게시판에 "우리 동네 추천"이 생겼어요. 글에 사진을 3장까지 붙일 수 있어요(위치 정보는 지우고 올려요). 다른 지역 글은 내 지역에 글을 5개 쓰면 볼 수 있어요. 회원가입은 비밀번호를 두 번 넣고, 계정 삭제는 내 정보 맨 아래에서 본인 확인 뒤에 해요.
- English: NongsaDaMa 1.5 — new "Local tips" board, up to 3 photos per post (location data removed), and other areas' posts open after you write 5 posts in your own area. Sign-up asks for the password twice, and account deletion (bottom of Profile) now asks you to confirm it is you.

## 6. 출시 뒤 점검
1. 웹: `npm run build && node tests/e2e/local-tips-check.mjs`를 운영 주소 대신 빌드로 다시 돌려도 되고, 실제 계정으로 nongsadama.app에서 추천 글 1개(사진 1장) 쓰기 → 목록 작은 그림·상세 큰 그림 → 삭제 → Supabase Storage `post-images`에서 그 파일 2개가 사라졌는지 본다.
2. 실기기(Android): 갤러리에서 사진 고르기(여러 장), 올리기, 상세 보기. HEIC로 찍는 기기면 "이 사진은 이 휴대폰에서 열 수 없어요" 안내가 나오는지.
3. 다른 지역: 글이 5개 안 되는 계정에서 "다른 지역 보기" → n/5 안내, 5개 이상 계정에서 시·도 → 시·군·구 고르기.
4. 계정 삭제(시험 계정): 사진 올린 뒤 내 정보 맨 아래 계정 설정 → 계정 삭제 → 본인 확인(이메일 계정은 비밀번호, 카카오 계정은 숫자 4개) → 영구 삭제 확정 → `post-images/<계정 id>/` 비어 있음.
5. 회원가입(시험 이메일): 비밀번호 확인을 다르게 넣으면 안내만 나오고 가입되지 않는지.
6. 주 1회: `$env:SUPABASE_SERVICE_ROLE_KEY='…'; node scripts/cleanup-post-images.mjs`(미리보기) → 이상 없으면 `--apply`.

## 7. 검증 결과(2026-10-23, 이 PC)
- `npm run typecheck` 0 · `node --test` 앱 5파일 28건 통과 · 파이프라인 4파일 48건 통과 · `npm run build` 성공 · 번들에 정규식 뒤보기 없음(iOS 16.4 전 Safari 대비) · `npx cap sync android` 플러그인 3개.
- `tests/e2e/account-check.mjs`(D-046): **20/20 통과** — 첫 화면에 계정 설정·회원탈퇴 없음(제목 882px / 화면 812px), 스크롤한 채 들어와도 맨 위, 계정 설정에는 회원탈퇴 글자만(빨간 칸 없음) → 누르면 펼침(펼친 직후 누름 무시)·다시 누르면 접힘, 이메일 가입 비밀번호 확인(틀림 → 안내·삭제 요청 0, 모를 때 이메일 줄, 맞음 → 취소 왼쪽·영구 삭제 1초 흐림 → 삭제 1·로그아웃), 카카오 숫자 4개(틀림 안내, 크메르 숫자 통과, 나타난 직후 확정 누름 무시), 취소 두 번 누름, 회원가입 비밀번호 확인(다르면 가입 요청 0). 로그인·삭제·로그아웃 요청은 브라우저 안에서 가짜로 받음. 독립 검수 3관점 20건 → 확인 18건 모두 반영.
- `tests/e2e/local-tips-check.mjs`(빌드 번들, 헤드리스 Chrome 375×812, 마이그레이션 적용 뒤 운영 DB 읽기): **47/47 통과**. 운영 DB로 나간 쓰기 0건(시험용 쓰기 5건은 브라우저 안에서 막음). 사진 흐름은 쓰기를 브라우저 안에서 가짜로 받아 확인: GPS EXIF 제거, 1280×960 + 360×270, 내 지역에 저장, 삭제 때 두 파일 삭제.
- 출시된 1.4.1 번들 + 바뀐 운영 DB: 게시판 10건·상세·생활정보 26건, 요청 모두 200, 화면 오류 0.
- 독립 검수: 1차(추천) 4관점 25건 중 21건 확인 → 모두 반영. 2차(사진·지역 제한) 5관점 47건 중 40건 확인 → 33건 반영(중복 포함, 남은 사진 파일 3건은 정리 스크립트로), 7건 남김: 카메라로 찍기, 숨긴 글 사진·작성자 숨김 해제(이전부터 있던 RLS 틈 — 별도 작업), 프로필 조회 실패 때 기기 지역을 내 지역으로 봄, 늦게 실패한 사진 칸이 사라지며 버튼이 움직임, 다른 지역에서 또 다른 지역으로 가려면 3번 누름, 사진 고르는 동안 Android가 앱을 닫으면 쓰던 글이 사라짐, 사진 올리기 시간 제한 없음.
- 미실측: 실기기 설치, 실제 계정으로 사진 올리기(운영 Storage에 실제 파일), 계정 삭제 함수 배포 뒤 동작, Play 업로드.
