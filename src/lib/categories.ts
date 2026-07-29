// 생활정보 카테고리(고정 도메인 값, PRD 8.1). 언어·국가 코드가 아니므로 코드에서 참조해도 된다.
export const LIFE_INFO_CATEGORIES = [
  'hospital',
  'market',
  'government',
  'transport',
  'other',
  'support',
] as const

/** 카테고리 아이콘(직관 우선 — 색·텍스트와 병행 표기, PRD v1.5 §1). */
export const LIFE_INFO_CATEGORY_ICONS: Record<string, string> = {
  hospital: '🏥',
  market: '🛒',
  government: '🏛️',
  transport: '🚌',
  other: 'ℹ️',
  support: '🆘',
}

export type LifeInfoCategory = (typeof LIFE_INFO_CATEGORIES)[number]

/** 카테고리의 i18n 번역 키. 예: hospital -> 'lifeInfo.category.hospital' */
export function categoryLabelKey(category: string): string {
  return `lifeInfo.category.${category}`
}
