import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from '../../i18n/useTranslation'
import { buttonClasses } from './Button'
import { cn } from './cn'
import { useOnline } from './hooks/useOnline'
import { useSlow, SLOW_AFTER_MS } from './hooks/useSlow'
import { Spinner } from './Spinner'
import type { Tone } from './tone'

export interface LoadingStateProps {
  /** 무엇을 기다리는지(예: t('board.loading')). 기본 state.loading "불러오는 중…" */
  label?: string
  /** 8초가 지나면 덧붙는 안내. 기본 state.slow */
  slowLabel?: string
  /**
   * 오프라인일 때 '느려요' 대신 바로 보이는 줄. 기본 state.waitingNetwork "인터넷 연결을 기다리고 있어요…".
   * 화면별 문구가 있으면 넘긴다(예: 게시판의 '인터넷이 연결되면 글을 불러와요'). label은 바꾸지 않는다.
   */
  offlineLabel?: string
  slowAfterMs?: number
  /** 스피너·링크 색(영역 정체성). 기본 nong */
  tone?: Tone
  /** page = 화면 가운데 큰 대기(기본) · inline = 56px 한 줄(목록 더 불러오기, 키트 4.13) */
  variant?: 'page' | 'inline'
  /** 기다리지 않고 갈 수 있는 길(예: 지도 대신 목록). 링크 하나 */
  fallback?: { label: string; to: string }
  /** 스피너 아래에 붙일 스켈레톤 등 */
  children?: ReactNode
  className?: string
}

/**
 * 모든 기다림은 상태를 보여 준다: 스피너 + 글자, 8초 뒤 느린 연결 안내, 오프라인이면 그 대신 연결을 기다린다는 줄.
 * role=status. children(스켈레톤 등)은 aria-hidden으로 감싸 상태를 한 번만 읽는다.
 * fallback 링크는 짧은 글자여도 44×44 이상.
 */
export function LoadingState({
  label,
  slowLabel,
  offlineLabel,
  slowAfterMs = SLOW_AFTER_MS,
  tone = 'nong',
  variant = 'page',
  fallback,
  children,
  className,
}: LoadingStateProps) {
  const { t } = useTranslation()
  // 오프라인이면 '느려요'가 아니라 연결을 기다리는 것이다. 다시 연결되면 그때부터 8초를 센다.
  const online = useOnline()
  const slow = useSlow(online, slowAfterMs)
  const hint = !online ? (offlineLabel ?? t('state.waitingNetwork')) : slow ? (slowLabel ?? t('state.slow')) : null
  return (
    <div className={className}>
      <div
        role="status"
        aria-live="polite"
        className={cn('flex flex-col items-center text-center', variant === 'page' ? 'gap-2 py-10' : 'gap-1 py-2')}
      >
        <div className="flex min-h-[40px] items-center justify-center gap-2.5 text-label text-ink-body">
          <Spinner tone={tone} />
          <span>{label ?? t('state.loading')}</span>
        </div>
        {hint ? <p className="max-w-xs text-small text-ink-muted">{hint}</p> : null}
        {fallback ? (
          <Link
            to={fallback.to}
            className={buttonClasses({ variant: 'ghost', size: 'sm', tone, className: 'min-w-11' })}
          >
            {fallback.label}
          </Link>
        ) : null}
      </div>
      {/* 상태 줄이 이미 읽혔으니 아래 스켈레톤의 sr-only '불러오는 중'은 다시 읽지 않는다 */}
      {children ? <div aria-hidden="true">{children}</div> : null}
    </div>
  )
}
