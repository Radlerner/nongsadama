// 생활정보 카테고리(고정 도메인 값, PRD 8.1). 언어·국가 코드가 아니므로 코드에서 참조해도 된다.
// 그림은 components/ui/CategoryGlyph(디자인 v5 카테고리 그림)가 맡는다 — 이모지·색 틴트 표는 두지 않는다.
export const LIFE_INFO_CATEGORIES = [
  'hospital',
  'market',
  'government',
  'transport',
  'other',
  'support',
] as const

export type LifeInfoCategory = (typeof LIFE_INFO_CATEGORIES)[number]

/** 카테고리의 i18n 번역 키. 예: hospital -> 'lifeInfo.category.hospital' */
export function categoryLabelKey(category: string): string {
  return `lifeInfo.category.${category}`
}
