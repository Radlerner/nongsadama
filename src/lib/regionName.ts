import { appConfig, type Locale } from '../config/app'
import type { Json } from '../types/database'

/**
 * regions.names(locale를 키로 하는 이름 JSON)에서 현재 locale 이름을 고른다.
 * 없으면 기본 locale, 그다음 아무 문자열 값으로 폴백한다. (국가·언어 비종속: 특정 코드 분기 없음)
 * 유효한 이름이 하나도 없으면 빈 문자열을 반환한다. 화면 표기용 대체 라벨은 regionLabel 사용.
 */
export function regionName(names: Json, locale: Locale): string {
  if (names && typeof names === 'object' && !Array.isArray(names)) {
    const map = names as Record<string, Json | undefined>
    const preferred = map[locale]
    if (typeof preferred === 'string' && preferred.trim() !== '') return preferred
    const fallback = map[appConfig.defaultLocale]
    if (typeof fallback === 'string' && fallback.trim() !== '') return fallback
    for (const v of Object.values(map)) {
      if (typeof v === 'string' && v.trim() !== '') return v
    }
  }
  return ''
}

/**
 * 화면 표기용 지역 라벨. 이름이 비어 있으면(데이터 품질 문제) id 앞부분으로 최소 표기해
 * 빈 라벨 버튼(접근성 이름 부재)을 방지한다.
 */
export function regionLabel(id: string, names: Json, locale: Locale): string {
  const name = regionName(names, locale)
  if (name !== '') return name
  return `#${id.slice(0, 8)}`
}
