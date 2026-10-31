import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { cn } from './cn'
import { Icon } from './Icon'

export interface ChoiceRowProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  /** 고른 줄이면 true — 2px nong-600 테두리 + 굵은 글자 + 초록 체크 원 */
  selected: boolean
  /** 줄 글자(한 줄 또는 두 줄). 다른 언어 이름이면 안쪽 요소에 lang= 을 준다 */
  children: ReactNode
  /** 체크 원 앞에 붙는 작은 표시(예: '기기 언어 추천' 알약) */
  trailing?: ReactNode
  /**
   * 읽어주기에 알릴 선택 상태 속성. pressed(기본) = aria-pressed 버튼(언어·국적 창, v1.4 그대로) ·
   * radio = role="radio" + aria-checked(부모가 role="radiogroup"과 화살표 키를 맡는다)
   */
  semantics?: 'pressed' | 'radio'
}

/**
 * 고르는 줄(키트 라디오 줄, 56px). 흰 바탕 + 12px 모서리. 안 고름 = 1px 선(line) + 빈 원(line-input, 3:1),
 * 고름 = 2px nong-600 테두리 + 700 + 흰 체크가 든 nong-600 원. 테두리가 2px가 되면 안쪽 여백을 1px 줄여 글자가 움직이지 않는다.
 * 긴 다국어는 줄을 바꿔 두 줄로 커진다(자르지 않는다).
 */
export const ChoiceRow = forwardRef<HTMLButtonElement, ChoiceRowProps>(function ChoiceRow(
  { selected, children, trailing, semantics = 'pressed', type = 'button', className, ...rest },
  ref,
) {
  const state = semantics === 'radio' ? { role: 'radio', 'aria-checked': selected } : { 'aria-pressed': selected }
  return (
    <button
      ref={ref}
      type={type}
      {...state}
      className={cn(
        'flex min-h-14 w-full items-center gap-3 rounded-xl bg-white py-2 text-left text-body text-ink transition-colors hover:bg-surface active:bg-surface-2',
        selected ? 'border-2 border-nong-600 px-[15px] font-bold' : 'border border-line px-4 font-normal',
        className,
      )}
      {...rest}
    >
      <span className="min-w-0 flex-1">{children}</span>
      {trailing}
      {selected ? (
        <span
          aria-hidden="true"
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-nong-600 text-white"
        >
          <Icon name="check-plain" size={16} strokeWidth={2.5} />
        </span>
      ) : (
        <span aria-hidden="true" className="h-6 w-6 shrink-0 rounded-full border-2 border-line-input" />
      )}
    </button>
  )
})
