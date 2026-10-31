import { cn } from './cn'
import type { Tone } from './tone'

const TRACK: Record<Tone | 'white', string> = {
  nong: 'border-line-strong border-t-nong-600',
  da: 'border-line-strong border-t-da-600',
  ma: 'border-line-strong border-t-ma-600',
  white: 'border-white/40 border-t-white',
}

export interface SpinnerProps {
  /** 기본 nong(초록). 녹색 버튼·사진 위에서는 white */
  tone?: Tone | 'white'
  /** 기본 20px(키트 .spin), lg = 24px */
  size?: 'md' | 'lg'
  className?: string
}

/** 링 스피너. 혼자 쓰지 말고 반드시 글자(무엇을 기다리는지)와 함께 둔다. */
export function Spinner({ tone = 'nong', size = 'md', className }: SpinnerProps) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'block shrink-0 animate-spin rounded-full border-2 [animation-duration:0.8s]',
        size === 'lg' ? 'h-6 w-6' : 'h-5 w-5',
        TRACK[tone],
        className,
      )}
    />
  )
}
