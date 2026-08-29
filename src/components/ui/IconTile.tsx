import type { LucideIcon } from 'lucide-react'

/**
 * 아이콘 타일(디자인 v1.6, DESIGN.md §4) — 틴트 배경 라운드 사각 + 라인 아이콘.
 * 색(틴트)+그림(아이콘) 이중 부호화로 글 없이 종류를 구분한다.
 */
interface IconTileProps {
  icon: LucideIcon
  /** tailwind 틴트: 배경(예: 'bg-rose-50')과 아이콘 색(예: 'text-rose-700') */
  tint?: string
  iconClass?: string
  size?: 'md' | 'lg'
}

export function IconTile({
  icon: Icon,
  tint = 'bg-green-50',
  iconClass = 'text-green-800',
  size = 'md',
}: IconTileProps) {
  const box = size === 'lg' ? 'h-12 w-12' : 'h-10 w-10'
  const glyph = size === 'lg' ? 24 : 20
  return (
    <span
      aria-hidden
      className={`flex ${box} shrink-0 items-center justify-center rounded-2xl ${tint}`}
    >
      <Icon size={glyph} strokeWidth={2} className={iconClass} />
    </span>
  )
}
