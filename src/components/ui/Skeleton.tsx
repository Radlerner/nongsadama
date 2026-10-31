import { useTranslation } from '../../i18n/useTranslation'
import { cn } from './cn'

/*
 * 스켈레톤(키트 4.12). 회색 면 + 지나가는 밝은 띠(.skel, 움직임 줄이기면 멈춤).
 * 실제 내용과 같은 모양·자리를 잡아 화면이 튀지 않게 한다.
 */

/** 모양 하나. 크기·모서리는 className으로. 예: <SkeletonBlock className="h-4 w-1/2 rounded-full" /> */
export function SkeletonBlock({ className }: { className?: string }) {
  return <span aria-hidden="true" className={cn('skel block', className)} />
}

const LINE_WIDTHS = ['w-[90%]', 'w-[76%]', 'w-[62%]', 'w-[84%]', 'w-[48%]']

export type SkeletonVariant = 'lines' | 'rows' | 'post' | 'rail'

export interface SkeletonProps {
  /**
   * lines = 글줄(본문·상세)
   * rows  = 40px 타일/아바타 + 두 줄(목록 행, 64px)
   * post  = 게시글 카드(아바타 + 두 줄 + 4:3 사진 + 글줄)
   * rail  = 가로 카드 레일(156×196 사진 + 두 줄) — 부모가 가로 스크롤을 맡는다
   */
  variant?: SkeletonVariant
  /** 반복 개수(lines 기본 3, rows 3, post 1, rail 3) */
  count?: number
  /** rows의 앞 모양: tile(둥근 사각, 장소) | avatar(원, 사람) */
  lead?: 'tile' | 'avatar'
  /** 화면에 안 보이는 읽기용 문구. 기본 state.loading */
  label?: string
  className?: string
}

export function Skeleton({ variant = 'lines', count, lead = 'tile', label, className }: SkeletonProps) {
  const { t } = useTranslation()
  const n = count ?? (variant === 'post' ? 1 : 3)
  const items = Array.from({ length: n }, (_, i) => i)

  let body
  if (variant === 'lines') {
    body = (
      <div className="flex flex-col gap-3">
        {items.map((i) => (
          <SkeletonBlock key={i} className={cn('h-3.5 rounded-full', LINE_WIDTHS[i % LINE_WIDTHS.length])} />
        ))}
      </div>
    )
  } else if (variant === 'rows') {
    body = (
      <div className="flex flex-col">
        {items.map((i) => (
          <div key={i} className="flex h-16 items-center gap-3">
            <SkeletonBlock className={cn('h-10 w-10 shrink-0', lead === 'avatar' ? 'rounded-full' : 'rounded-xl')} />
            <span className="flex-1">
              <SkeletonBlock className={cn('h-3.5 rounded-full', i % 2 ? 'w-[48%]' : 'w-[62%]')} />
              <SkeletonBlock className={cn('mt-2 h-3 rounded-full', i % 2 ? 'w-[30%]' : 'w-[38%]')} />
            </span>
          </div>
        ))}
      </div>
    )
  } else if (variant === 'post') {
    body = (
      <div className="flex flex-col gap-8">
        {items.map((i) => (
          <div key={i}>
            <div className="flex items-center gap-3">
              <SkeletonBlock className="h-10 w-10 shrink-0 rounded-full" />
              <span className="flex-1">
                <SkeletonBlock className="h-3.5 w-[40%] rounded-full" />
                <SkeletonBlock className="mt-2 h-3 w-[64%] rounded-full" />
              </span>
            </div>
            <SkeletonBlock className="mt-3 aspect-[4/3] w-full rounded-xl" />
            <SkeletonBlock className="mt-4 h-4 w-[72%] rounded-full" />
            <SkeletonBlock className="mt-3 h-3.5 w-[94%] rounded-full" />
            <SkeletonBlock className="mt-2 h-3.5 w-[58%] rounded-full" />
          </div>
        ))}
      </div>
    )
  } else {
    body = (
      <div className="flex gap-3">
        {items.map((i) => (
          <div key={i} className="w-[156px] shrink-0">
            <SkeletonBlock className="h-[196px] w-[156px] rounded-xl" />
            <SkeletonBlock className="mt-3 h-3.5 w-[90%] rounded-full" />
            <SkeletonBlock className="mt-2 h-3 w-[55%] rounded-full" />
          </div>
        ))}
      </div>
    )
  }

  return (
    <div aria-busy="true" className={className}>
      <span className="sr-only">{label ?? t('state.loading')}</span>
      {body}
    </div>
  )
}
