/**
 * 아이콘 타일(디자인 v1.5, DESIGN.md §4) — 맨몸 이모지 대신 틴트 배경의 라운드 사각 안에.
 * airbnb의 일러스트 글리프처럼 "만들어진 아이콘"으로 읽히게 하는 최소 장치.
 */
interface IconTileProps {
  emoji: string
  /** tailwind 배경 틴트 클래스(예: 'bg-rose-50'). 기본은 연초록. */
  tint?: string
  size?: 'md' | 'lg'
}

export function IconTile({ emoji, tint = 'bg-green-50', size = 'md' }: IconTileProps) {
  const box = size === 'lg' ? 'h-12 w-12 text-2xl' : 'h-10 w-10 text-xl'
  return (
    <span
      aria-hidden
      className={`flex ${box} shrink-0 items-center justify-center rounded-2xl ${tint}`}
    >
      {emoji}
    </span>
  )
}
