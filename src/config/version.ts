/**
 * 웹앱 버전 — 사용자 노출·문서·릴리스 관리의 단일 기준(릴리스 PRD docs/prd/PRD_v<버전>.md와 1:1).
 *
 * 릴리스 절차(docs/releases/RELEASE_v<버전>.md — 현재 RELEASE_v1.3.md):
 * 1. 여기 APP_VERSION 을 올린다(예: '1.3').
 * 2. android/app/build.gradle 의 versionName 을 같은 값으로, versionCode 를 +1 한다
 *    (Google Play는 versionCode 가 이전보다 커야만 업로드를 받는다).
 * 3. package.json "version" 을 semver 로 맞춘다(예: 1.3.0) — package-lock.json 은 `npm install --package-lock-only` 로 맞춘다.
 * 4. docs/changelog/CHANGELOG.md 에 항목을 추가하고 git tag v<버전> 을 만든다.
 */
export const APP_VERSION = '1.3'

/** Android versionCode 와 동일하게 유지한다(문서·화면 표기용 — 빌드에는 쓰이지 않음). */
export const APP_VERSION_CODE = 4
