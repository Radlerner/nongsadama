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
  // 임시 기본값. 대상 사용자(한국어 미숙 외국인 근로자)를 고려하면 최종값이 아니며,
  // 파일럿 검증 언어(PRD 14장 미확정) 확정 시 교체한다. 사용자가 선택 화면에서
  // 언어를 고르면 이 값 대신 선택값이 사용된다. (docs/DECISIONS.md 참고)
  defaultLocale: 'ko',
}

// 각 언어를 그 언어 자체 이름(endonym)으로 표시하기 위한 라벨.
// UI 언어와 무관하게 고정 표기하여, 읽지 못하는 UI 언어와 상관없이 자신의 언어를 찾게 한다.
// 언어 추가 시 여기에도 라벨을 더한다(없으면 코드를 그대로 노출).
export const localeLabels: Record<Locale, string> = {
  ko: '한국어',
  en: 'English',
}

export function getLocaleLabel(code: Locale): string {
  return localeLabels[code] ?? code.toUpperCase()
}
