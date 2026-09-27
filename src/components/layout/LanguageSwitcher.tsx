import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { getLocaleLabel } from '../../config/app'
import { useTranslation } from '../../i18n/useTranslation'
import { LanguageSheet } from '../LanguageSheet'

/**
 * 헤더 언어 버튼(PRD v1.4 §3.2): 현재 언어를 자기 이름으로 보여 주고, 누르면 공용 언어 창을 연다.
 * 기기마다 모양이 다른 기본 <select> 를 대체한다. 고르면 즉시 전환되고, 로그인 상태면 AuthContext 가
 * 기존대로 프로필에 반영한다(1.3 동작, 변경 없음).
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
        className="flex min-h-[44px] items-center rounded-full border border-gray-300 bg-white px-4 text-sm text-gray-700 active:bg-gray-50"
      >
        <span lang={locale}>{current}</span>
      </button>
      <LanguageSheet open={open} onClose={() => setOpen(false)} />
    </>
  )
}
