import { appConfig, type Locale } from '../config/app'
import type { Json } from '../types/database'

export interface LocalizedText {
  name: string
  description: string
}

function asObject(v: Json | undefined): Record<string, Json | undefined> | null {
  return v && typeof v === 'object' && !Array.isArray(v)
    ? (v as Record<string, Json | undefined>)
    : null
}

/**
 * life_info.localized_content(locale를 키로 {name, description}를 담는 JSON)에서
 * 현재 locale 항목을 고른다. 없으면 기본 locale, 그다음 name이 있는 첫 항목으로 폴백한다.
 * (국가·언어 비종속: 특정 코드 분기 없음)
 */
export function localizedContent(content: Json, locale: Locale): LocalizedText {
  const map = asObject(content)
  let entry: Record<string, Json | undefined> | null = null
  if (map) {
    // 우선순위(현재 locale → 기본 locale → 나머지) 순으로 훑되, 각 단계에서
    // name이 비어있지 않은 항목만 채택한다(부분 입력된 항목이 정상 폴백을 가리지 않도록).
    const ordered = [map[locale], map[appConfig.defaultLocale], ...Object.values(map)]
      .map(asObject)
      .filter((e): e is Record<string, Json | undefined> => e !== null)
    entry =
      ordered.find((e) => typeof e.name === 'string' && e.name.trim() !== '') ??
      ordered[0] ??
      null
  }
  const name = entry && typeof entry.name === 'string' ? entry.name : ''
  const description = entry && typeof entry.description === 'string' ? entry.description : ''
  return { name, description }
}
