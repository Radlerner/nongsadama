import { useEffect, useRef, type KeyboardEvent, type ReactNode } from 'react'
import { cn } from './cn'
import { TONE_BORDER, type Tone } from './tone'

export interface PillOption<V extends string = string> {
  value: V
  label: string
  /** 앞 그림(예: <CategoryGlyph category="hospital" size={20} />) */
  glyph?: ReactNode
}

export interface PillTabsProps<V extends string = string> {
  options: ReadonlyArray<PillOption<V>>
  value: V
  onChange: (value: V) => void
  /** 그룹 이름(읽기용, 필수). 예: "카테고리" 번역 문구 */
  ariaLabel: string
  /**
   * soft = 키트 4.3(선택: surface-2 바탕 + 굵게, 기본)
   * outline = 홈 카테고리 칩(흰 바탕 + 선, 선택: tone 600 두 줄 테두리)
   */
  variant?: 'soft' | 'outline'
  /** outline 선택 테두리 색(영역 정체성). 기본 nong */
  tone?: Tone
  /**
   * true(기본) = main의 px-5를 넘어 화면 끝까지 스크롤(-mx-5 px-4).
   * 패딩 없는 곳(/home)에서는 false로 두고 부모가 여백을 준다.
   */
  bleed?: boolean
  className?: string
}

/**
 * 알약 필터(키트 4.3). radiogroup: Tab으로 들어와 ←/→로 고른다.
 * 보이는 알약은 36px, 누르는 영역은 44px. 고른 알약은 처음 그릴 때와 바뀔 때 가로로만 스크롤해 보이게 한다.
 * 초점 고리는 보이는 36px 알약에 그린다(44px 줄에 꼭 맞아 위아래가 잘리지 않는다).
 */
export function PillTabs<V extends string = string>({
  options,
  value,
  onChange,
  ariaLabel,
  variant = 'soft',
  tone = 'nong',
  bleed = true,
  className,
}: PillTabsProps<V>) {
  const refs = useRef<Array<HTMLButtonElement | null>>([])
  const rowRef = useRef<HTMLDivElement>(null)
  const firstRun = useRef(true)
  const selectedIndex = Math.max(
    0,
    options.findIndex((o) => o.value === value),
  )

  // 고른 알약이 줄 밖에 있으면 가로로만 스크롤(scrollIntoView는 페이지까지 세로로 움직일 수 있어 쓰지 않는다).
  useEffect(() => {
    const first = firstRun.current
    firstRun.current = false
    const row = rowRef.current
    const el = refs.current[selectedIndex]
    if (!row || !el) return
    const reduce =
      typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const behavior: ScrollBehavior = first || reduce ? 'auto' : 'smooth'
    const r = row.getBoundingClientRect()
    const b = el.getBoundingClientRect()
    const pad = 16
    const dx = b.left < r.left ? b.left - r.left - pad : b.right > r.right ? b.right - r.right + pad : 0
    if (dx) row.scrollBy({ left: dx, behavior })
  }, [selectedIndex])

  const move = (to: number) => {
    const n = options.length
    if (n === 0) return
    const i = (to + n) % n
    onChange(options[i].value)
    refs.current[i]?.focus()
  }

  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault()
      move(i + 1)
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault()
      move(i - 1)
    } else if (e.key === 'Home') {
      e.preventDefault()
      move(0)
    } else if (e.key === 'End') {
      e.preventDefault()
      move(options.length - 1)
    }
  }

  return (
    <div
      ref={rowRef}
      role="radiogroup"
      aria-label={ariaLabel}
      className={cn('scrollbar-none flex gap-1 overflow-x-auto', bleed && '-mx-5 px-4', className)}
    >
      {options.map((o, i) => {
        const on = o.value === value
        const pill =
          variant === 'soft'
            ? cn(
                'h-9 rounded-full border border-transparent',
                on ? 'bg-surface-2 font-bold text-ink' : 'font-normal text-ink-muted group-hover:text-ink',
              )
            : cn(
                'h-9 rounded-full bg-white text-ink',
                on ? cn('border-2 font-bold', TONE_BORDER[tone]) : 'border border-line-strong font-normal',
              )
        // outline 선택 시 테두리가 2px이 되므로 안쪽 여백을 1px 줄여 글자가 움직이지 않게 한다
        const pad =
          variant === 'outline' && on
            ? o.glyph
              ? 'pl-[7px] pr-[11px]'
              : 'px-[15px]'
            : o.glyph
              ? 'pl-2 pr-3'
              : 'px-4'
        return (
          <button
            key={o.value}
            ref={(el) => {
              refs.current[i] = el
            }}
            type="button"
            role="radio"
            aria-checked={on}
            tabIndex={i === selectedIndex ? 0 : -1}
            onClick={() => onChange(o.value)}
            onKeyDown={(e) => onKeyDown(e, i)}
            className="group flex h-11 shrink-0 items-center rounded-full focus-visible:!outline-none"
          >
            <span
              className={cn(
                'flex items-center gap-1.5 whitespace-nowrap text-label transition-colors',
                'group-focus-visible:outline group-focus-visible:outline-2 group-focus-visible:outline-offset-2 group-focus-visible:outline-nong-600',
                pill,
                pad,
              )}
            >
              {o.glyph}
              {o.label}
            </span>
          </button>
        )
      })}
    </div>
  )
}
