import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { getLocaleLabel } from '../../config/app'
import { useTranslation } from '../../i18n/useTranslation'
import { LanguageSheet } from '../LanguageSheet'
import { Icon } from '../ui/Icon'

/**
 * 헤더 언어 버튼(v1.4 §3.2 동작 + v5 모양): 44px 지구본 + 현재 언어를 자기 이름으로 보여 주고, 누르면 공용 언어 창을 연다.
 * 고르면 즉시 전환되고, 로그인 상태면 AuthContext 가 기존대로 프로필에 반영한다(1.3 동작, 변경 없음).
 */
export function LanguageSwitcher() {
  const { locale, t } = useTranslation()
  const [open, setOpen] = useState(false)
  const current = getLocaleLabel(locale)
  // 헤더는 화면이 바뀌어도 남아 있다 — 창이 열린 채로 화면이 바뀌면(기기 뒤로 가기 등) 창을 닫는다.
  const { pathname } = useLocation()
  useEffect(() => setOpen(false), [pathname])

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-label={`${t('language.label')}: ${current}`}
        className="flex h-11 min-w-11 shrink-0 items-center gap-1.5 rounded-lg px-2.5 text-label text-ink transition-colors hover:bg-surface active:bg-surface-2"
      >
        <Icon name="globe" size={18} />
        <span lang={locale} className="max-w-[7.5rem] truncate">
          {current}
        </span>
      </button>
      <LanguageSheet open={open} onClose={() => setOpen(false)} />
    </>
  )
}
