import type { LifeInfoCategory } from '../../lib/categories'
import { cn } from './cn'
import hospital from '../../assets/glyphs/hospital.svg'
import market from '../../assets/glyphs/market.svg'
import government from '../../assets/glyphs/government.svg'
import transport from '../../assets/glyphs/transport.svg'
import support from '../../assets/glyphs/support.svg'
import other from '../../assets/glyphs/other.svg'

const GLYPH_SRC: Record<LifeInfoCategory, string> = {
  hospital,
  market,
  government,
  transport,
  support,
  other,
}

/**
 * 카테고리 그림 URL(지도 마커 HTML 등 <img>가 필요할 때). 모르는 값은 other.
 * 예: `<img src="${categoryGlyphSrc(item.category)}" alt="" width="24" height="24">`
 */
export function categoryGlyphSrc(category: string): string {
  return GLYPH_SRC[category as LifeInfoCategory] ?? GLYPH_SRC.other
}

export interface CategoryGlyphProps {
  /** LIFE_INFO_CATEGORIES 값 또는 'all'(전체). DB 문자열도 받는다 — 모르면 other */
  category: LifeInfoCategory | 'all' | (string & {})
  /** CSS px. 기본 24(목록 타일), 알약 20, 큰 타일 32 */
  size?: number
  className?: string
}

/** 카테고리 그림(장식, aria-hidden). 이름은 옆 글자로 읽힌다. 'all'은 로고 3색 2×2 네모(퍼즐 아님). */
export function CategoryGlyph({ category, size = 24, className }: CategoryGlyphProps) {
  if (category === 'all') {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 32 32"
        aria-hidden="true"
        focusable="false"
        className={cn('block shrink-0', className)}
      >
        <rect x="3.5" y="3.5" width="11.5" height="11.5" rx="3.5" className="fill-nong-500" />
        <rect x="17" y="3.5" width="11.5" height="11.5" rx="3.5" className="fill-da-500" />
        <rect x="3.5" y="17" width="11.5" height="11.5" rx="3.5" className="fill-ma-500" />
        <rect x="17" y="17" width="11.5" height="11.5" rx="3.5" className="fill-nong-200" />
      </svg>
    )
  }
  return (
    <img
      src={categoryGlyphSrc(category)}
      alt=""
      aria-hidden="true"
      width={size}
      height={size}
      draggable={false}
      className={cn('block shrink-0', className)}
      style={{ width: size, height: size }}
    />
  )
}
