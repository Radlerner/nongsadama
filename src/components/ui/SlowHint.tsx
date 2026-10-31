import { useTranslation } from '../../i18n/useTranslation'
import { cn } from './cn'
import { useOnline } from './hooks/useOnline'
import { useSlow } from './hooks/useSlow'

export interface SlowHintProps {
  /** 기다리는 중이면 true(예: mutation.isPending). 8초가 지나면 state.slow를 보여 준다 */
  busy: boolean
  /** 오프라인일 때 '느려요' 대신 보일 줄. 기본 state.waitingNetwork */
  offlineLabel?: string
  /** 보일 때의 여백 등(예: 'mt-2') */
  className?: string
}

/**
 * 바쁜 버튼 아래에 두는 느린 연결 안내: busy가 8초 넘게 이어지면 "인터넷이 느려요. 조금만 기다려 주세요.".
 * 바쁜 동안 오프라인이면 기다리지 않고 바로 연결 대기 줄("인터넷 연결을 기다리고 있어요…")을 보인다.
 * 안내가 읽히도록 상태 영역(role=status)은 늘 붙어 있고, 보일 것이 없으면 비어 있는 sr-only라 자리를 차지하지 않는다.
 */
export function SlowHint({ busy, offlineLabel, className }: SlowHintProps) {
  const { t } = useTranslation()
  const online = useOnline()
  const slow = useSlow(busy && online)
  const text = busy && !online ? (offlineLabel ?? t('state.waitingNetwork')) : slow ? t('state.slow') : null
  return (
    <p
      role="status"
      aria-live="polite"
      className={text ? cn('text-center text-small text-ink-muted', className) : 'sr-only'}
    >
      {text}
    </p>
  )
}
