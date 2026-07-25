// 앱 전역 설정.
//
// 국가·언어 비종속 원칙(PRD 0·6장):
// - 아래 supportedLocales / defaultLocale 은 "설정 데이터"이며 비즈니스 로직 분기가 아니다.
// - 특정 코드('vi', 'ko' 등)로 로직을 분기하지 않는다. 언어 추가는 이 배열과
//   src/i18n/dictionaries 에 사전 파일을 더하는 것만으로 가능해야 한다(DB 변경 불필요).
// - 파일럿 지역/검증 언어(PRD 14장)가 확정되면 이 값만 교체한다.

export type Locale = string

export interface AppConfig {
  /** 화면에 노출할 지원 언어 목록(ISO 639 언어 코드). */
  supportedLocales: Locale[]
  /** 사용자가 언어를 아직 고르지 않았을 때 사용할 기본 언어. */
  defaultLocale: Locale
}

export const appConfig: AppConfig = {
  supportedLocales: ['ko', 'en'],
  defaultLocale: 'ko',
}
