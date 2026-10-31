import { cn } from './cn'
import { TONE_SOFT, toneFromSeed, type Tone } from './tone'

export interface AvatarProps {
  /** 닉네임(첫 글자를 보여 준다). 사진·얼굴은 쓰지 않는다 */
  name: string
  /** 정체성 색. 없으면 seed(또는 name)로 늘 같은 색을 고른다 */
  tone?: Tone
  seed?: string
  /** 기본 40px */
  size?: 32 | 40 | 48
  className?: string
}

const SIZE = {
  32: 'h-8 w-8 text-small',
  40: 'h-10 w-10 text-body',
  48: 'h-12 w-12 text-section',
} as const

/** 머리글자 아바타(키트 4.8): 100 바탕 + 600 글자, 800 굵기. 장식이라 aria-hidden — 이름은 옆 글자로 읽힌다. */
export function Avatar({ name, tone, seed, size = 40, className }: AvatarProps) {
  const initial = Array.from(name.trim())[0]?.toUpperCase() ?? '?'
  const resolved = tone ?? toneFromSeed(seed ?? name)
  return (
    <span
      aria-hidden="true"
      className={cn(
        'flex shrink-0 items-center justify-center rounded-full font-extrabold leading-none',
        SIZE[size],
        TONE_SOFT[resolved],
        className,
      )}
    >
      {initial}
    </span>
  )
}
