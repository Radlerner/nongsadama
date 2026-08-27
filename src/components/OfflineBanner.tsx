import { useEffect, useState } from 'react'
import { useTranslation } from '../i18n/useTranslation'

/** 오프라인 안내 배너(D-024) — 농촌 통신 환경 대응. 온라인 복귀 시 자동 소멸. */
export function OfflineBanner() {
  const { t } = useTranslation()
  const [offline, setOffline] = useState(
    typeof navigator !== 'undefined' ? !navigator.onLine : false,
  )

  useEffect(() => {
    const on = () => setOffline(false)
    const off = () => setOffline(true)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
    }
  }, [])

  if (!offline) return null
  return (
    <p role="status" className="bg-amber-100 px-4 py-2 text-center text-xs font-semibold text-amber-900">
      {t('common.offline')}
    </p>
  )
}
