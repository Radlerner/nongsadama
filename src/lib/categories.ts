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

/**
 * 카테고리 식별 틴트(디자인 v1.5, DESIGN.md §2) — 아이콘 타일의 배경/글자색.
 * 색+그림 이중 부호화: 글을 못 읽어도 색과 아이콘으로 종류를 구분한다(다국적 직관성).
 */
export const LIFE_INFO_CATEGORY_TINTS: Record<string, { bg: string; text: string }> = {
  hospital: { bg: 'bg-rose-50', text: 'text-rose-700' },
  market: { bg: 'bg-amber-50', text: 'text-amber-700' },
  government: { bg: 'bg-sky-50', text: 'text-sky-700' },
  transport: { bg: 'bg-violet-50', text: 'text-violet-700' },
  support: { bg: 'bg-green-50', text: 'text-green-800' },
  other: { bg: 'bg-gray-100', text: 'text-gray-600' },
}

export type LifeInfoCategory = (typeof LIFE_INFO_CATEGORIES)[number]

/** 카테고리의 i18n 번역 키. 예: hospital -> 'lifeInfo.category.hospital' */
export function categoryLabelKey(category: string): string {
  return `lifeInfo.category.${category}`
}
