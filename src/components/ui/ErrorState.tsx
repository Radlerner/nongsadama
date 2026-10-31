import { Link } from 'react-router-dom'
import { useTranslation } from '../../i18n/useTranslation'
import { Button, buttonClasses } from './Button'
import { cn } from './cn'
import { Icon } from './Icon'
import { useOnline } from './hooks/useOnline'
import type { Tone } from './tone'

export interface ErrorStateProps {
  /** 기본 state.errorTitle "불러오지 못했어요" */
  title?: string
  /** 한 줄 설명. 기본: 오프라인이면 common.offline, 아니면 state.errorBody */
  body?: string
  /** 다시 시도(예: () => void query.refetch()) */
  onRetry?: () => void
  /** 다시 시도 중이면 true(예: query.isFetching) — 버튼이 스피너 + "다시 불러오는 중…" */
  retrying?: boolean
  /** 다시 시도 버튼 글자. 기본 common.retry */
  retryLabel?: string
  /** 다른 길(예: 홈으로 가는 링크 { label, to: '/home' }) */
  fallback?: { label: string; to: string }
  /** fallback 링크 색(영역 정체성). 기본 nong */
  tone?: Tone
  /** 테두리 카드(키트 4.15, 기본) · false면 테두리 없이 */
  bordered?: boolean
  className?: string
}

/**
 * 오류: 무엇이 안 됐는지 + 한 줄 + 다시 시도 + 다른 길.
 * 제목·설명은 role=alert(바로 읽힘). 바깥 aria-live=polite는 다시 시도 버튼의 '다시 불러오는 중…'을 읽어 준다.
 */
export function ErrorState({
  title,
  body,
  onRetry,
  retrying = false,
  retryLabel,
  fallback,
  tone = 'nong',
  bordered = true,
  className,
}: ErrorStateProps) {
  const { t } = useTranslation()
  const online = useOnline()
  return (
    <div
      aria-live="polite"
      className={cn('px-5 py-6 text-center', bordered && 'rounded-xl border border-line', className)}
    >
      <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-surface text-danger">
        <Icon name="alert" size={26} />
      </span>
      {/* 로딩을 대신해 이미 채워진 채로 나타나도 읽히도록 제목·설명은 alert. 버튼은 밖에 둔다. */}
      <div role="alert">
        <p className="mt-3 text-body font-bold text-ink">{title ?? t('state.errorTitle')}</p>
        <p className="mt-0.5 text-small text-ink-muted">
          {body ?? (online ? t('state.errorBody') : t('common.offline'))}
        </p>
      </div>
      {onRetry || fallback ? (
        <div className="mt-4 flex flex-col items-center gap-1">
          {onRetry ? (
            <Button
              variant="secondary"
              icon="refresh"
              onClick={onRetry}
              loading={retrying}
              loadingLabel={t('state.retrying')}
            >
              {retryLabel ?? t('common.retry')}
            </Button>
          ) : null}
          {fallback ? (
            <Link
              to={fallback.to}
              className={buttonClasses({ variant: 'ghost', size: 'sm', tone, className: 'min-w-11' })}
            >
              {fallback.label}
            </Link>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
