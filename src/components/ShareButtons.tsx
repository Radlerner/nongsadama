import { useEffect } from 'react'
import { useTranslation } from '../i18n/useTranslation'
import { officialSiteUrl } from '../config/app'

// AddToAny SPA 연동: 스크립트는 1회만 주입하고, 이미 로드된 뒤 재마운트되면 재스캔(init).
// 제3자 스크립트(static.addtoany.com) — 개인정보 처리방침 고지 목록(§10-J) 대상.
declare global {
  interface Window {
    a2a?: { init: (type: string) => void }
  }
}

const A2A_SRC = 'https://static.addtoany.com/menu/page.js'

/** 공유 버튼(카카오톡·Threads·WhatsApp·Telegram·X). 공유 URL은 공식 주소로 고정. */
export function ShareButtons() {
  const { t } = useTranslation()

  useEffect(() => {
    if (document.querySelector(`script[src="${A2A_SRC}"]`)) {
      window.a2a?.init('page')
      return
    }
    const script = document.createElement('script')
    script.defer = true
    script.src = A2A_SRC
    document.head.appendChild(script)
  }, [])

  return (
    <div className="rounded-md border border-gray-200 px-4 py-3">
      <p className="mb-2 text-xs font-semibold text-gray-500">{t('share.title')}</p>
      <div
        className="a2a_kit a2a_kit_size_32 a2a_default_style"
        data-a2a-url={officialSiteUrl}
        data-a2a-title="농사다마 NongsaDama"
      >
        <a className="a2a_dd" href="https://www.addtoany.com/share" aria-label={t('share.more')} />
        <a className="a2a_button_whatsapp" />
        <a className="a2a_button_telegram" />
        <a className="a2a_button_threads" />
        <a className="a2a_button_x" />
      </div>
    </div>
  )
}
