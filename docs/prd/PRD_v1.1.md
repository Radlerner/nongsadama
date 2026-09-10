# PRD v1.1 — 비공개 테스트 1.1 업데이트

> 릴리스 PRD는 "이번 버전에서 무엇이, 왜, 어떤 영향으로 바뀌는가"와 롤백 기준을 적는다.
> 제품 스펙 반복본(루트 `PRD_v1_1.md`~`PRD_v1_7.md`)과는 다른 축이다 — 그쪽은 기능 설계, 이쪽은 출시 단위.

| 항목 | 값 |
|---|---|
| 버전 | 1.1 (Android `versionName 1.1`, `versionCode 2`, 웹 `APP_VERSION '1.1'`) |
| 작성일 | 2026-09-10 |
| 이전 버전 | 1.0 — [PRD_v1.0](PRD_v1.0.md), Google Play 비공개 테스트 중(`versionCode 1`) |
| 결정 기록 | docs/DECISIONS.md D-033 |
| 검증 기록 | docs/TEST_CHECKLIST.md "v1.1" 절, [RELEASE_v1.1](../releases/RELEASE_v1.1.md) §5 |

## 1. 목적
비공개 테스트에서 드러난 세 가지(로고가 홈으로 가지 않음, 브랜드 영문 표기 혼재, 홍성군 밖에서는 지역을 고를 수 없음)를 고치고,
이번 버전부터 릴리스 단위 PRD·CHANGELOG·태그로 버전을 관리해 이후 정식 출시까지 롤백 가능한 체계를 만든다.

## 2. 변경 배경
- 테스터 20명은 홍성군 밖에도 있다. 앱은 지역 목록을 DB `regions`에서 읽는데 그 표에 홍성군(+읍·면 11개)만 있어 다른 시·군을 고를 수 없었고, "내 주변 지역 찾기"는 100km 밖에서도 홍성 읍·면을 자동 선택해 게시판·프로필·글쓰기가 모두 홍성으로 굳었다.
- 코드에 박힌 홍성 값은 지도 중심 폴백 좌표(`MapHome.tsx` 두 곳) 하나뿐이었다. 즉 원인의 대부분은 **데이터**, 나머지는 **폴백 규칙**이었다(분석: 7개 판독 에이전트 병렬 검토, 2026-09-10).
- 영문 브랜드가 `NongsaDama`(사전·공유 제목·OG·llms.txt·README)와 `NongsaDaMa`(법적 페이지·Play 앱 이름)로 갈려 있었다.

## 3. 변경 기능
| # | 기능 | 내용 |
|---|---|---|
| 1 | 로고 → 홈 | 앱 공통 헤더의 아이콘+브랜드명을 `<Link to="/home">`로 감쌈. 홈 라우트 근거: 하단 탭·뒤로가기 폴백·로그인 후 이동이 모두 `/home`. `aria-label`(nav.home), 44px, 포커스 링, `cursor-pointer`. |
| 2 | 브랜드 표기 | 사용자 노출 영문 10곳을 `NongsaDaMa`로. 식별자(nongsadama.app, com.nongsadama.myapp, 캐시 `nongsadama-v2`, localStorage 키, GitHub 경로)는 그대로. |
| 3 | 지역 확대 | `regions`에 충남 14개 시·군(city, 시·군청 좌표) 추가. 읍·면이 없는 시·군은 시·군 자체를 선택 단위로(선택 화면 "다른 시·군" 묶음, 프로필 편집 optgroup). 홍성군은 읍·면 11개 그대로 첫 그룹. |
| 4 | 폴백 일반화 | 지도 초기 보기: 선택 지역 → 부모 시·군 → `regionConfig.defaultMapCenter`(전국 보기). "첫 centroid 지역" 폴백과 홍성 좌표 상수 제거. 지역 목록 결정적 정렬. 30km 밖이면 자동 선택하지 않고 안내(`select.geoFar`). 저장된 stale 지역 id를 앱 셸에서 정리. |
| 5 | 빈 상태 | 지도 핀 0건 → "아직 등록된 정보가 없어요". 이웃: 프로필 지역 없음 → "내 지역을 정하면…" + 설정 링크. 게시판·생활정보·농사는 기존 빈 상태 재확인. 지도 핀 제외 규칙을 데이터 속성(support·주소 없음)으로 바꿔 시·군 단위 지역의 병원·마트가 지도에서 사라지지 않게 함. |
| 5-1 | 위치 기반 정합 | 카카오 지오코더가 '천안시 동남구'처럼 두 토큰을 주면 첫 토큰(시·군)만 사용 — 농촌지도사업 필터 정상화(라이브 확인 0건→22건). 시·군 단위 선택은 한 단계 넓은 줌, "내 위치"는 전국 보기에서도 최소 확대. '읍·면 단위' 전제 문구를 '읍·면 또는 시·군'으로 일반화(사전 4키, 개인정보처리방침 §1·영문 요약, 계정 삭제 안내, llms.txt — 법적 페이지 개정일 2026-09-10). |
| 6 | 버전 | `src/config/version.ts`(APP_VERSION/APP_VERSION_CODE), 내 정보 하단 `v1.1`, `package.json` 1.1.0, Android 1.1/2. |
| 7 | 문서 체계 | `docs/prd/PRD_v1.0.md`·`PRD_v1.1.md`, `docs/changelog/CHANGELOG.md`, `docs/releases/RELEASE_v1.1.md`. |

## 4. 영향 범위
- 화면: 헤더(모든 앱 화면), 지역 선택, 홈 지도, 이웃, 프로필 편집, 내 정보, 농사 도움(시·군 이름 유도), 랜딩/로그인 제목(영문).
- 데이터: `regions` 14행 추가(스키마 무변경). 다른 표 무변경.
- 서버: Edge Functions·RLS·RPC 무변경.
- 배포: 웹은 push 시 자동. 앱은 AAB 재업로드 필요.

## 5. 수정 파일
코드(19 수정 + 2 신규):
`src/components/layout/AppLayout.tsx`, `src/pages/Select.tsx`, `src/pages/MapHome.tsx`, `src/pages/Neighbors.tsx`, `src/pages/ProfileEdit.tsx`, `src/pages/Profile.tsx`, `src/pages/Privacy.tsx`(영문 표기 1곳), `src/hooks/useRegions.ts`, `src/hooks/useRegionalInfo.ts`, `src/lib/geo.ts`, `src/lib/kakaoMap.ts`(지오코더 시·군 첫 토큰, getLevel 타입), `src/pages/DeleteAccount.tsx`(지역 단위 문구·시행일), `src/config/app.ts`(regionConfig), `src/config/version.ts`(신규), `src/components/ShareButtons.tsx`, `src/i18n/dictionaries/ko.json`, `src/i18n/dictionaries/en.json`, `index.html`, `public/llms.txt`, `README.md`, `package.json`, `package-lock.json`, `supabase/migrations/20260910000000_regions_chungnam.sql`(신규), `android/app/build.gradle`(versionCode/versionName 2행).
문서: `docs/prd/PRD_v1.0.md`, `docs/prd/PRD_v1.1.md`, `docs/changelog/CHANGELOG.md`, `docs/releases/RELEASE_v1.1.md`, `docs/DECISIONS.md`(D-033), `docs/TEST_CHECKLIST.md`.

## 6. DB 변경 여부
- **스키마 변경 없음**(테이블·컬럼·제약·RLS·뷰·RPC 모두 그대로).
- **데이터 추가만**: `public.regions`에 city 14행(`a1000000-0000-4000-8000-000000000002`~`0015`, 이름 ko/en, 시·군청 좌표). `on conflict (id) do nothing`이라 재실행 안전. 2026-09-10 라이브 적용(마이그레이션 `regions_chungnam`).
- 왜 필요한가: `posts.region_id`·`life_info.region_id`는 NOT NULL FK라 지역 행이 없으면 그 지역에서 글쓰기·정보 등록이 불가능하고, 선택 화면도 DB 행만 보여 준다. 행정구역 행은 실제 공개 정보이며 생활정보·게시글 같은 콘텐츠는 만들지 않았다(가짜 데이터 금지 원칙 준수).
- 전국 확장 시 필요한 스키마 변경(이번 범위 밖, 오너 승인 후): `level` CHECK에 `province` 추가 또는 시도 컬럼 — 동명 시·군(고성군, 각 광역시의 중구·동구 등) 구분용.

## 7. API 변경 여부
없음. Supabase 쿼리 조건(`in('region_id', …)`), Edge Function(weather·rural-programs·embed-post·delete-account) 무변경. 클라이언트가 보내는 값만 시·군 단위로 넓어졌다(예: `rural-programs?center=예산군`).

## 8. 사용자 영향
- 홍성군 사용자: 동작 동일. 선택 화면에서 홍성군 그룹이 첫 번째, 그 아래 "다른 시·군"이 추가로 보인다. 지도·목록·글쓰기 범위 변화 없음.
- 홍성 밖(충남) 사용자: 자기 시·군을 고를 수 있고, 지도는 그 시·군청 중심, 생활정보·게시판은 빈 상태(등록 전), 날씨·농촌지도사업은 그 시·군 실데이터, 글쓰기·이웃은 그 시·군 범위.
- 충남 밖 사용자: "내 주변 지역 찾기"가 가장 가까운 시·군과 거리를 알려 주되 자동 선택하지 않는다. 지역 없이 계속하면 전체 범위(현재 충남)로 둘러볼 수 있고 글쓰기는 지역 선택을 요구한다.
- 카카오 로그인 등 인증 흐름 변화 없음.

## 9. 테스트 항목(결과는 RELEASE_v1.1 §5·TEST_CHECKLIST)
1. `npm run build` 성공 ✅ 2. TypeScript 오류 없음 ✅ 3. 로고 클릭 → 홈(SPA, 새로고침 없음) ✅ 4. NongsaDaMa 표기 잔존 0(grep) ✅ 5. 홍성군 기존 기능(핀·생활정보 13·게시글 10·날씨/사업) ✅ 6. 홍성 외 지역 선택·검색 시 오류 0 ✅ 7. 데이터 없는 지역 빈 상태(지도·게시판·생활정보) ✅ 8. Supabase 연결(regions 26행 조회, 라이브 DB 확인) ✅ 9. 모바일 375px 레이아웃 가로 넘침 없음 ✅ 10. `npx cap sync android` 성공 ✅
추가: 서울 좌표 자동 선택 없음 ✅, 예산 좌표 자동 선택 ✅, i18n 패리티 ✅. 미실측: 로그인 필요한 이웃 지역 안내·프로필 편집 optgroup(코드 검토), Android 실기기.

## 10. 롤백 조건
다음 중 하나라도 비공개 테스트에서 재현되면 v1.0 기준으로 롤백한다.
- 앱 실행 불가(스플래시 후 흰 화면·즉시 종료)
- 로그인 불가(이메일·카카오 모두)
- 홈 라우팅 오류(로고·하단 탭·뒤로가기로 `/home`에 도달 못 함, 무한 리다이렉트)
- 기존 홍성군 데이터 접근 불가(홍성 읍·면 선택 시 생활정보 13건·게시글이 보이지 않음)
- 다른 지역 선택 시 앱 crash(ErrorBoundary "문제가 생겼어요" 화면)
- Supabase query 오류(지역 목록·게시판·생활정보가 오류 박스로 떨어짐)

## 11. 롤백 방법
1. **웹(즉시)**: `git revert <v1.1 커밋>` 또는 `git checkout v1.0 -- src index.html public package.json package-lock.json` 후 커밋·푸시(자동 배포). 오너가 실행하며 force push는 쓰지 않는다.
2. **앱**: v1.0 코드로 `npm run build && npx cap sync android` 후 `android/app/build.gradle`의 `versionCode`를 **3**(현재보다 큰 값)으로 올려 AAB 재업로드. Play는 versionCode를 낮출 수 없다.
3. **DB(선택)**: v1.0 코드는 city 행이 있어도 정상 동작하므로(읍·면만 보여 줌) 데이터 롤백은 필수가 아니다. 되돌리려면 먼저 참조 여부를 확인한다:
   ```sql
   -- 1) 참조 확인. posts·life_info는 FK restrict(참조 있으면 delete가 오류로 중단)지만
   --    profiles.region_id는 on delete set null이라 delete가 성공하면서 그 사용자의 프로필 지역이 조용히 비워진다.
   select
     (select count(*) from public.posts     where region_id between 'a1000000-0000-4000-8000-000000000002' and 'a1000000-0000-4000-8000-000000000015') as posts_n,
     (select count(*) from public.life_info where region_id between 'a1000000-0000-4000-8000-000000000002' and 'a1000000-0000-4000-8000-000000000015') as life_info_n,
     (select count(*) from public.profiles  where region_id between 'a1000000-0000-4000-8000-000000000002' and 'a1000000-0000-4000-8000-000000000015') as profiles_n;
   -- 2a) 셋 다 0이면 삭제
   delete from public.regions where id between 'a1000000-0000-4000-8000-000000000002' and 'a1000000-0000-4000-8000-000000000015';
   -- 2b) 하나라도 있으면 삭제 대신 숨김
   update public.regions set is_active = false where id between 'a1000000-0000-4000-8000-000000000002' and 'a1000000-0000-4000-8000-000000000015';
   ```
   숨김(is_active=false) 후 부수효과: 그 시·군을 골랐던 사용자는 앱을 열 때 지역이 해제되어(useStaleRegionCleanup) 게시판·생활정보·지도가 '전체 범위'로 보이고, 프로필 편집을 저장하면 지역이 비워진다. 원인 추적이 쉽도록 필요하면 `update public.profiles set region_id = null where region_id between … and …;`로 명시 정리한다. 오류·crash는 없다.
4. 롤백 후 `docs/changelog/CHANGELOG.md`에 "[1.1] 롤백 — 사유" 한 줄과 태그 `v1.1-rolled-back`를 남긴다.

## 12. 알려진 이슈(이번 범위 밖, 기록)
- Android 매니페스트에 위치 권한이 없어 **앱**에서는 "내 위치"가 항상 실패한다(v1.0부터). 추가 시 Play 데이터 보안 양식 갱신 필요 → 오너 결정.
- 지역 미선택 상태의 게시판·생활정보·지도는 "전체 범위"인데 화면에 범위 라벨이 없다.
- 비슷한 글 추천(similar_posts RPC)은 전국 단위라 다른 시·군 글이 섞일 수 있다.
- 프로필 편집에서 저장된 지역이 목록에 없으면(비활성) 조용히 '지역 미선택'으로 저장된다.
- 한국 밖 좌표에서 "동네 이름을 못 찾아서 날씨만 보여드려요" 문구가 뜨지만 날씨 카드도 숨겨진다(문구 불일치).
- `regions`에 시도 단계가 없어 동명 시·군 구분이 안 된다(전국 확장 전 스키마 결정 필요).
- `android/gradle.properties`의 JDK 절대경로는 이 PC 전용(커밋 전 제거).
- 앱(WebView)에서 카카오 OAuth는 현재 구조로 완료될 수 없다 — Supabase가 `https://localhost/`로 되돌리는데 외부 호스트는 시스템 브라우저에서 열린다(v1.0부터, 이메일 로그인은 정상). 다음 버전에서 `server.allowNavigation` 또는 앱 딥링크로 처리.
- 카카오맵 JS 키가 앱 번들에 들어가지만 WebView origin(`https://localhost`)이 카카오 콘솔 Web 도메인에 등록돼 있지 않으면 앱 지도는 OSM 폴백으로 뜬다 — AAB 전 실기기 확인 항목.
- 지역 선택 화면의 시·군 묶음은 기본 접힘(홍성 읍·면 그룹이 있을 때). 시·군 사용자는 한 번 펼쳐야 하고, 위치 추천으로 자동 선택되면 펼친 채로 열린다.
- 카카오 로그인 `account_email` 동의항목(비즈앱 전환) 승인 대기 — 인증 구조 변경 없음.
