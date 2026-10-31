import { useTranslation } from '../i18n/useTranslation'
import { Icon } from './ui/Icon'
import { useOnline } from './ui/hooks/useOnline'

/** 오프라인 안내 배너(D-024, 키트 4.17) — 농촌 통신 환경 대응. 온라인 복귀 시 자동 소멸. 헤더 안에 붙어 있다. */
export function OfflineBanner() {
  const { t } = useTranslation()
  const online = useOnline()

  if (online) return null
  return (
    <p
      role="status"
      className="flex min-h-[44px] items-center gap-2.5 bg-surface-2 px-5 py-2.5 text-small text-ink"
    >
      <Icon name="wifi-off" size={20} className="text-ink-body" />
      <span>{t('common.offline')}</span>
    </p>
  )
}
