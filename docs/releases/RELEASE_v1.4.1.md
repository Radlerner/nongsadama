# RELEASE v1.4.1 — Android 런처 아이콘 교체

- 버전: `versionName 1.4.1` / `versionCode 8` (`android/app/build.gradle`), 웹 `APP_VERSION = "1.4.1"` · `APP_VERSION_CODE = 8` (`src/config/version.ts`), `package.json` 1.4.1
- 작성일: 2026-10-03 · 변경 이력: [CHANGELOG](../changelog/CHANGELOG.md) · 결정: DECISIONS D-041 · 이전: [RELEASE_v1.4](RELEASE_v1.4.md)
- 성격: 1.4(`versionCode 7`, Play 출시됨)에 대한 Android 리소스 전용 수정. 웹 코드(`src/`)는 버전 상수 말고 바뀐 것이 없다
- 브랜치: `feat/v1.4-uiux` 이어서. **push는 오너가 확인한 뒤 직접 한다**

## 1. 문제와 원인
Play로 설치한 1.4 앱의 런처 아이콘이 농사다마 로고가 아니었다. 출시한 AAB(`android/app/release/app-release.aab`, 2026-09-27 17:23)를 열어 확인한 결과 아이콘 리소스는 비어 있지 않았고, **Capacitor 템플릿 기본 아이콘(흰 바탕 + 연한 격자 + 파란 X)** 이었다. v1.1에서 `android/` 폴더가 들어올 때 템플릿 그대로 커밋된 뒤 한 번도 로고로 바뀐 적이 없다(`git log -- android/app/src/main/res/mipmap-xxxhdpi/ic_launcher.png` → v1.1 커밋뿐). 적응형 아이콘 마스크(원·둥근 사각형)로 잘리면 거의 흰 타일처럼 보인다.

## 2. 고친 것
| 파일 | 내용 |
|---|---|
| `android/app/src/main/res/mipmap-{mdpi,hdpi,xhdpi,xxhdpi,xxxhdpi}/ic_launcher_foreground.png` | 적응형 아이콘 앞면(108dp: 108·162·216·324·432px). 투명 바탕에 퍼즐 로고를 긴 변 50dp로 배치 — 안전 영역(지름 66dp 원) 안에 모서리까지 들어간다 |
| 같은 폴더의 `ic_launcher.png` | Android 7.1 이하 런처용(48dp: 48·72·96·144·192px). 크림 둥근 사각형 + 퍼즐 74% |
| 같은 폴더의 `ic_launcher_round.png` | 같은 용도의 원형. 크림 원 + 퍼즐 66% |
| `android/app/src/main/res/values/ic_launcher_background.xml` | 적응형 아이콘 배경 `#FFFFFF` → `#F5F1E8`(로고 바탕 크림, `tailwind.config` `brand.cream`과 같은 값) |

원본은 `public/icons/icon-512.png`(퍼즐 로고 + 크림 바탕). 바깥 바탕을 경계 연결 플러드필로 투명하게 만들어 퍼즐만 남긴 뒤 축소했다(파비콘을 만들 때와 같은 방식). 새 npm 의존성은 넣지 않았다 — 생성 스크립트는 저장소 밖(세션 작업 폴더)의 헤드리스 Chrome canvas 이며, 결과 PNG만 커밋했다. `mipmap-anydpi-v26/ic_launcher.xml`·`AndroidManifest.xml`·템플릿 벡터(`drawable-v24/ic_launcher_foreground.xml`, `drawable/ic_launcher_background.xml`)는 그대로다.

## 3. AAB 재생성 전에 확인할 것
| # | 항목 | 확인 방법 |
|---|---|---|
| 1 | 소스가 `v1.4.1`인지 | `git describe --tags` → `v1.4.1`, `git status --short` 비어 있음 |
| 2 | 버전 | `android/app/build.gradle` 10~11행 `versionCode 8`, `versionName "1.4.1"` |
| 3 | 음성 포함 여부 | 1.4와 같다 — [RELEASE_v1.4 §2](RELEASE_v1.4.md)의 3·4번. `.env.local`의 `VITE_STT_ENDPOINT`가 있으면 어느 명령으로 빌드해도 음성이 들어간다. 1.4 AAB를 만들 때와 같은 상태로 두면 앱 동작은 1.4와 같다 |
| 4 | 웹 빌드·동기화 | `npm ci` → `npm run build`(음성 포함이면 RELEASE_v1.4 §2 4번의 명령) → `npx cap sync android`(플러그인 3개, 줄바꿈만 바뀐 `capacitor.build.gradle`·`capacitor.settings.gradle`은 `git checkout --`) |
| 5 | 아이콘이 AAB에 들어갔는지 | 서명 AAB를 만든 뒤 `unzip -l android/app/release/app-release.aab \| grep ic_launcher` 에 `mipmap-*-v4/ic_launcher*.png` 15개가 있고, 예를 들어 `unzip -p android/app/release/app-release.aab base/res/mipmap-xxxhdpi-v4/ic_launcher_foreground.png > /tmp/fg.png` 로 꺼낸 그림이 퍼즐 로고인지 본다 |
| 6 | Play 스토어 등록정보 아이콘 | 별개다. Play Console → 스토어 등록정보 → 앱 아이콘(512×512)은 `public/icons/icon-512.png`를 올린다. 이 파일은 APK와 무관하다 |

## 4. Git
```bash
git log --oneline v1.4..v1.4.1
```
```bash
git push origin feat/v1.4-uiux v1.4.1
```
`main` 병합은 push 뒤 오너가 결정한다. 아이콘만 되돌리려면 아이콘 커밋 하나를 `git revert` 한다(§7의 해시).

## 5. AAB 재생성·업로드
1. §3 확인 → Android Studio → Build → Generate Signed App Bundle(릴리스 키) → `android/app/release/app-release.aab`의 수정 시각이 새것인지 확인.
2. Play Console → 내부 테스트(또는 1.4를 올린 트랙) → 새 버전 → AAB 업로드 → 버전명 `1.4.1 (8)` → 출시 노트(§6) → 출시.
3. 기기에 설치 → §6의 확인.

## 6. 실기기 확인
1. 런처(홈 화면·앱 서랍)에 크림 바탕(원·둥근 사각형 등 기기 모양) 안의 퍼즐 로고가 보인다. 기기 테마가 어두워도 같다.
2. 설정 → 앱 → 농사다마 → 아이콘이 같은 로고다.
3. 1.4에서 업데이트한 기기에서 아이콘이 그대로 흰 타일이면 런처 캐시다 — 기기 재부팅 또는 앱 삭제 후 재설치.
4. Android 13 이상의 "테마 아이콘" 설정을 켜면 로고가 단색 테마 아이콘으로 바뀌지 않고 그대로 보인다(단색 레이어는 넣지 않았다 — D-041).

**출시 노트**
- 한국어: 농사다마 1.4.1 — 앱 아이콘을 농사다마 로고로 바꿨습니다.
- English: NongsaDaMa 1.4.1 — the app icon now shows the NongsaDaMa logo.

## 7. 검증 결과(2026-10-03, 오너 PC)
- 출시한 1.4 AAB를 풀어 아이콘 리소스 15개를 꺼내 봄: 전부 유효한 PNG, 템플릿 기본 그림. 적응형 아이콘 XML이 `@mipmap/ic_launcher_foreground`·`@color/ic_launcher_background`를 정상 참조.
- 새 아이콘 15개 생성 → 원·squircle·둥근 사각형 마스크 미리보기에서 퍼즐이 잘리지 않음.
- `android/gradlew :app:processReleaseResources`(aapt2 리소스 컴파일): 성공(exit 0), 링크 결과 `.ap_`에 새 아이콘 15개 포함
- `npm run typecheck` 0 · `node --test` 12건 · `npm run build` 성공 · `npx cap sync android` 플러그인 3개 · `git status --short`에 `.jks`·`.env*` 없음.
- 미실측: 실기기 설치 모습, Play 업로드.
- 아이콘 커밋: `4cad1a4` · 릴리스 커밋: `release: NongsaDaMa v1.4.1`, 태그 `v1.4.1`.
