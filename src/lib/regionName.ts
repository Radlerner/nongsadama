import { appConfig, type Locale } from '../config/app'
import type { Json } from '../types/database'

/**
 * regions.names(locale를 키로 하는 이름 JSON)에서 현재 locale 이름을 고른다.
 * 없으면 기본 locale, 그다음 아무 문자열 값으로 폴백한다. (국가·언어 비종속: 특정 코드 분기 없음)
 */
export function regionName(names: Json, locale: Locale): string {
  if (names && typeof names === 'object' && !Array.isArray(names)) {
    const map = names as Record<string, Json | undefined>
    const preferred = map[locale]
    if (typeof preferred === 'string') return preferred
    const fallback = map[appConfig.defaultLocale]
    if (typeof fallback === 'string') return fallback
    for (const v of Object.values(map)) {
      if (typeof v === 'string') return v
    }
  }
  return ''
}
