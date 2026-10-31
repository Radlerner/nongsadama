import { cn } from './cn'
import type { Tone } from './tone'

/** 경로 → 영역 정체성. /home·/life-info·/farm = 농사, /board = 다, /neighbors = 마, 그 외(/talk, /profile …) = 없음 */
export function toneForPath(pathname: string): Tone | null {
  const p = pathname.replace(/\/+$/, '') || '/'
  const under = (base: string) => p === base || p.startsWith(base + '/')
  if (under('/home') || under('/life-info') || under('/farm')) return 'nong'
  if (under('/board')) return 'da'
  if (under('/neighbors')) return 'ma'
  return null
}

/**
 * 인디케이터 바(키트 2c): 헤더 바로 아래, 그 자체가 구분선(따로 hairline 없음).
 * 2:1:1 = 농사 : 다 : 마. 현재 영역은 4px 500색, 나머지는 2px 200색.
 */
export function IndicatorBar({ active }: { active: Tone | null }) {
  const seg = (tone: Tone, on: string, off: string, grow: string) => (
    <span className={cn(grow, active === tone ? cn('h-1 rounded-sm', on) : cn('h-0.5 rounded-[1px]', off))} />
  )
  return (
    <div aria-hidden="true" className="flex h-1 items-end gap-[3px] bg-white px-4">
      {seg('nong', 'bg-nong-500', 'bg-nong-200', 'flex-[2]')}
      {seg('da', 'bg-da-500', 'bg-da-200', 'flex-1')}
      {seg('ma', 'bg-ma-500', 'bg-ma-200', 'flex-1')}
    </div>
  )
}
