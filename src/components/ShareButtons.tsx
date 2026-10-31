import { useEffect } from 'react'
import { useTranslation } from '../i18n/useTranslation'
import { officialSiteUrl } from '../config/app'
import { buttonClasses } from './ui/Button'
import { Icon } from './ui/Icon'
import { cn } from './ui/cn'

// AddToAny SPA 연동: 스크립트는 1회만 주입하고, 이미 로드된 뒤 재마운트되면 재스캔(init).
// 제3자 스크립트(static.addtoany.com) — 개인정보 처리방침 고지 목록(§10-J) 대상.
declare global {
  interface Window {
    a2a?: { init: (type: string) => void }
  }
}

const A2A_SRC = 'https://static.addtoany.com/menu/page.js'
const SHARE_TITLE = '농사다마 NongsaDaMa'

// 서비스 이름은 고유명사라 번역하지 않는다. 링크 안에 글자가 있으면 AddToAny는 제 색 아이콘 대신 그 내용을 쓴다
// (디자인 v5: 로고 3색 밖의 색 면 금지). href는 스크립트가 늦거나 막혀도 동작하는 AddToAny 공유 주소다.
const SERVICES = [
  { cls: 'a2a_button_whatsapp', code: 'whatsapp', name: 'WhatsApp' },
  { cls: 'a2a_button_telegram', code: 'telegram', name: 'Telegram' },
  { cls: 'a2a_button_threads', code: 'threads', name: 'Threads' },
  { cls: 'a2a_button_x', code: 'x', name: 'X' },
] as const

function fallbackHref(code: string): string {
  return `https://www.addtoany.com/add_to/${code}?linkurl=${encodeURIComponent(officialSiteUrl)}&linkname=${encodeURIComponent(SHARE_TITLE)}`
}

/** 공유 버튼(WhatsApp·Telegram·Threads·X + 더 많은 공유 방법). 공유 URL은 공식 주소로 고정. */
export function ShareButtons({ className }: { className?: string }) {
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

  const btn = buttonClasses({ variant: 'tertiary', size: 'sm', className: 'min-w-11' })

  return (
    <section className={className}>
      <p className="flex items-center gap-2 text-label text-ink">
        <Icon name="share" size={20} className="text-nong-600" />
        {t('share.title')}
      </p>
      <div
        className="a2a_kit mt-3 flex flex-wrap gap-2"
        data-a2a-url={officialSiteUrl}
        data-a2a-title={SHARE_TITLE}
      >
        {SERVICES.map((s) => (
          <a key={s.code} className={cn(s.cls, btn)} href={fallbackHref(s.code)} target="_blank" rel="noopener noreferrer">
            {s.name}
          </a>
        ))}
        <a
          className={cn('a2a_dd', btn)}
          href="https://www.addtoany.com/share"
          target="_blank"
          rel="noopener noreferrer"
        >
          <Icon name="more" size={18} strokeWidth={2} />
          {t('share.more')}
        </a>
      </div>
    </section>
  )
}
