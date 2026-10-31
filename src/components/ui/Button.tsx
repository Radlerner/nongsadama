import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { cn } from './cn'
import { Icon, type IconName } from './Icon'
import { Spinner } from './Spinner'
import type { Tone } from './tone'

/*
 * 버튼(키트 4.1). 컨텍스트 훅을 쓰지 않는다 — ErrorBoundary(Provider 밖)에서도 쓸 수 있어야 한다.
 * 한 화면(접힘 한 번)에 채운 primary는 하나만.
 */

export type ButtonVariant = 'primary' | 'secondary' | 'tertiary' | 'ghost' | 'danger'
/** md = 48px(기본, 주 버튼) · sm = 44px(작은 버튼, 최소 터치 크기) */
export type ButtonSize = 'md' | 'sm'

export interface ButtonStyleOptions {
  variant?: ButtonVariant
  size?: ButtonSize
  fullWidth?: boolean
  /** ghost 버튼 글자색(영역 정체성). 기본 nong. 'ink'는 중립 */
  tone?: Tone | 'ink'
  /** 회색 비활성 모양(로딩 중에는 주지 말 것 — 로딩은 원래 색 유지) */
  disabled?: boolean
  /**
   * 긴 번역이 줄을 바꿔도 되는 버튼(좁은 2칸 배치 등): 높이를 고정하지 않고 최소 높이(48/44)만 지킨다.
   * 기본 false = 한 줄(whitespace-nowrap) 고정 높이.
   */
  wrap?: boolean
  className?: string
}

const BASE = 'inline-flex select-none items-center justify-center gap-2 text-label no-underline transition-colors'

const SIZE: Record<ButtonSize, string> = {
  md: 'h-12 rounded-xl',
  sm: 'h-11 rounded-lg',
}

/** wrap: 최소 높이만 지키고 줄바꿈을 허용 */
const SIZE_WRAP: Record<ButtonSize, string> = {
  md: 'min-h-12 rounded-xl py-2.5',
  sm: 'min-h-11 rounded-lg py-2',
}

function paddingClasses(variant: ButtonVariant, size: ButtonSize): string {
  if (variant === 'ghost') return 'px-3'
  return size === 'md' ? 'px-5' : 'px-3.5'
}

const GHOST_TONE: Record<Tone | 'ink', string> = {
  nong: 'text-nong-600 active:text-nong-700',
  da: 'text-da-600 active:text-da-700',
  ma: 'text-ma-600 active:text-ma-700',
  ink: 'text-ink',
}

function variantClasses(variant: ButtonVariant, tone: Tone | 'ink'): string {
  switch (variant) {
    case 'primary':
      return 'bg-nong-600 text-white hover:bg-nong-700 active:bg-nong-700'
    case 'secondary':
      return 'border border-line-strong bg-white text-ink hover:bg-surface active:bg-surface-2'
    case 'tertiary':
      return 'bg-surface text-ink hover:bg-surface-2 active:bg-surface-2'
    case 'ghost':
      return cn('bg-transparent hover:bg-surface', GHOST_TONE[tone])
    case 'danger':
      return 'border border-line-strong bg-white text-danger hover:bg-surface active:bg-surface-2'
  }
}

function disabledClasses(variant: ButtonVariant): string {
  return variant === 'ghost'
    ? 'cursor-default bg-transparent text-ink-disabled hover:bg-transparent'
    : 'cursor-default border-transparent bg-surface-2 text-ink-disabled hover:bg-surface-2'
}

/** <Link>·<a>를 버튼처럼 보이게 할 때 쓴다. 예: <Link className={buttonClasses({ fullWidth: true })}> */
export function buttonClasses({
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  tone = 'nong',
  disabled = false,
  wrap = false,
  className,
}: ButtonStyleOptions = {}): string {
  return cn(
    BASE,
    wrap ? cn(SIZE_WRAP[size], 'whitespace-normal text-center') : cn(SIZE[size], 'whitespace-nowrap'),
    paddingClasses(variant, size),
    disabled ? disabledClasses(variant) : variantClasses(variant, tone),
    fullWidth && 'w-full',
    className,
  )
}

export interface ButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className'>,
    Omit<ButtonStyleOptions, 'disabled'> {
  /** 진행 중: 크기 유지 + 스피너 + loadingLabel(예: t('state.posting')). 자동으로 disabled + aria-busy */
  loading?: boolean
  loadingLabel?: ReactNode
  /** 앞에 붙는 선 아이콘 */
  icon?: IconName
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'primary',
    size = 'md',
    fullWidth = false,
    tone = 'nong',
    wrap = false,
    loading = false,
    loadingLabel,
    icon,
    disabled,
    type = 'button',
    className,
    children,
    ...rest
  },
  ref,
) {
  const isDisabled = Boolean(disabled) || loading
  const iconSize = size === 'sm' ? 18 : 20
  return (
    <button
      ref={ref}
      type={type}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      className={buttonClasses({
        variant,
        size,
        fullWidth,
        tone,
        wrap,
        // 로딩 중에는 원래 색을 유지(키트 btn-loading), 그냥 비활성은 회색(btn-disabled)
        disabled: Boolean(disabled) && !loading,
        className: cn(loading && 'cursor-default', className),
      })}
      {...rest}
    >
      {loading ? (
        <>
          <Spinner tone={variant === 'primary' ? 'white' : 'nong'} />
          {loadingLabel ?? children}
        </>
      ) : (
        <>
          {icon ? <Icon name={icon} size={iconSize} strokeWidth={2} /> : null}
          {children}
        </>
      )}
    </button>
  )
})

export interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  icon: IconName
  /** 필수: 화면에 글자가 없으므로 읽어 줄 이름 */
  label: string
  iconSize?: number
  filled?: boolean
}

/** 44×44 아이콘 버튼(닫기·더보기 등). 색은 className의 text-*로. 기본 text-ink */
export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { icon, label, iconSize = 22, filled, type = 'button', className, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      className={cn(
        'inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg transition-colors hover:bg-surface active:bg-surface-2 disabled:cursor-default disabled:text-ink-disabled',
        // 글자색을 넘기면 그것만 쓴다(같은 속성 클래스 두 개는 순서가 보장되지 않음)
        className?.includes('text-') ? undefined : 'text-ink',
        className,
      )}
      {...rest}
    >
      <Icon name={icon} size={iconSize} filled={filled} />
    </button>
  )
})
