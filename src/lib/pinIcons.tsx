/**
 * 지도 핀용 정적 SVG 마크업(디자인 v1.6) — Leaflet divIcon·카카오 CustomOverlay는
 * HTML 문자열이 필요해 lucide 컴포넌트를 정적 렌더한다(입력이 우리 코드뿐이라 안전).
 */
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { CATEGORY_ICONS, MapPin } from '../components/ui/icons'
import { PersonStanding } from 'lucide-react'

export function categoryPinMarkup(category: string | null): string {
  const Icon = category ? (CATEGORY_ICONS[category] ?? MapPin) : MapPin
  return renderToStaticMarkup(
    createElement(Icon, { size: 20, strokeWidth: 2.25, color: '#15803d' }),
  )
}

/** 내 위치(사람) 핀 */
export function personPinMarkup(): string {
  return renderToStaticMarkup(
    createElement(PersonStanding, { size: 22, strokeWidth: 2.25, color: '#15803d' }),
  )
}
