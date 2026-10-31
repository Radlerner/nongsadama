import type { IconName } from '../ui/Icon'

/**
 * OpenWeather 아이콘 코드(예: '10d')의 앞 두 자리 → 그림 이름(docs/DESIGN_TOKENS.md 날씨 표).
 * 모르는 코드는 온도계. 날씨 그림은 정보라 정체성 색 없이 본문 색(ink-body)으로 그린다.
 */
const WEATHER_ICON: Record<string, IconName> = {
  '01': 'sun',
  '02': 'cloud-sun',
  '03': 'cloud',
  '04': 'cloudy',
  '09': 'cloud-rain',
  '10': 'cloud-sun-rain',
  '11': 'cloud-lightning',
  '13': 'snowflake',
  '50': 'cloud-fog',
}

export function weatherIconName(code: string | null | undefined): IconName {
  return WEATHER_ICON[code?.slice(0, 2) ?? ''] ?? 'thermometer'
}

/** 온도 표기(받은 값 그대로, 없으면 —). 홈 한눈 보기와 농사 도움 카드가 같은 숫자를 보인다. */
export function formatTemp(value: number | null | undefined): string {
  return value != null ? `${value}°` : '—'
}
