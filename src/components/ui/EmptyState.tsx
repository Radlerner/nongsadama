import { Link } from 'react-router-dom'
import { Button, buttonClasses } from './Button'
import { cn } from './cn'
import { Icon, type IconName } from './Icon'

export interface EmptyStateAction {
  label: string
  /** 링크로 갈 때 */
  to?: string
  /** 링크로 갈 때 넘길 라우터 state */
  state?: unknown
  /** 버튼으로 할 때 */
  onClick?: () => void
  icon?: IconName
  /** 이 접힘의 유일한 주 행동이면 true(초록 채움). 기본은 secondary */
  primary?: boolean
}

export interface EmptyStateProps {
  /** 상황에 맞는 선 아이콘(검색=search, 이웃=neighbors, 게시판=message …). 퍼즐 금지 */
  icon?: IconName
  /** 한 줄(예: "아직 글이 없어요") */
  title: string
  /** 선택: 다음에 할 일 한 줄 */
  body?: string
  /** 선택: 행동 하나 */
  action?: EmptyStateAction
  /** 테두리 카드(키트 4.16, 기본) */
  bordered?: boolean
  className?: string
}

/** 비어 있음: 56px 회색 원 안 선 아이콘 + 한 줄 + 행동 하나. */
export function EmptyState({ icon = 'message', title, body, action, bordered = true, className }: EmptyStateProps) {
  const variant = action?.primary ? 'primary' : 'secondary'
  return (
    <div className={cn('px-5 py-6 text-center', bordered && 'rounded-xl border border-line', className)}>
      <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-surface text-ink-muted">
        <Icon name={icon} size={26} />
      </span>
      <p className="mt-3 text-body font-bold text-ink">{title}</p>
      {body ? <p className="mt-0.5 text-small text-ink-muted">{body}</p> : null}
      {action ? (
        <div className="mt-4 flex justify-center">
          {action.to ? (
            <Link to={action.to} state={action.state} className={buttonClasses({ variant })}>
              {action.icon ? <Icon name={action.icon} size={20} strokeWidth={2} /> : null}
              {action.label}
            </Link>
          ) : (
            <Button variant={variant} icon={action.icon} onClick={action.onClick}>
              {action.label}
            </Button>
          )}
        </div>
      ) : null}
    </div>
  )
}
