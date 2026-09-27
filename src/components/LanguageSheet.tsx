import { useState } from 'react'
import { BottomSheet } from './ui/BottomSheet'
import { Check } from './ui/icons'
import { useCountries } from '../hooks/useCountries'
import { useTranslation } from '../i18n/useTranslation'
import { deviceLocale, getLocaleLabel, type Locale } from '../config/app'
import { pinnedLocalesForCountry, readStoredCountry } from '../lib/country'

/**
 * 언어 선택 창(PRD v1.4 §3.2 화면 2). /select 언어 줄과 헤더 언어 버튼이 같이 쓴다.
 * 위: 저장된 국적의 언어(기본 언어가 맨 앞) · 아래: 앱이 지원하는 전체 언어.
 * 언어는 자기 이름(endonym)으로 적는다 — 화면 언어를 못 읽어도 자기 언어를 찾게 한다.
 */
interface LanguageSheetProps {
  open: boolean
  onClose: () => void
  /** 고른 국적(ISO 2자). 주지 않으면 기기에 저장된 값을 읽는다. */
  countryCode?: string | null
  /** 사용자가 이 창에서 언어를 직접 골랐을 때(언어 전환 뒤) 불린다. */
  onPicked?: (code: Locale) => void
}

export function LanguageSheet({ open, onClose, countryCode, onPicked }: LanguageSheetProps) {
  const { t, locale, setLocale, supportedLocales } = useTranslation()
  const country = countryCode === undefined ? (open ? readStoredCountry() : null) : countryCode
  const { data: countries, isLoading, isError, refetch, isFetching } = useCountries({
    enabled: open && Boolean(country),
  })
  const recommended = deviceLocale(
    typeof navigator === 'undefined'
      ? []
      : navigator.languages?.length
        ? navigator.languages
        : [navigator.language],
  )
  // 창이 열린 채로 국적 언어가 도착해도 아래 "전체 언어" 줄이 밀리지 않게, 불러오는 동안 차지한
  // 높이(언어 3줄)를 이번에 열려 있는 동안은 그대로 둔다(렌더 중 상태 갱신 패턴).
  const [reserved, setReserved] = useState(false)
  if (open && isLoading && !reserved) setReserved(true)
  if (!open && reserved) setReserved(false)
  const countryRow = country ? (countries ?? []).find((row) => row.iso_code === country) : undefined
  const pinned = countryRow ? pinnedLocalesForCountry(countryRow, supportedLocales) : []

  const pick = (code: Locale) => {
    setLocale(code, true)
    onPicked?.(code)
    onClose()
  }

  const renderLocale = (code: Locale, keyPrefix: string, showRecommended: boolean) => {
    const active = locale === code
    return (
      <li key={`${keyPrefix}-${code}`}>
        <button
          type="button"
          aria-pressed={active}
          onClick={() => pick(code)}
          className={[
            'flex min-h-[44px] w-full items-center gap-2 rounded-md border px-4 py-2 text-left text-base',
            active
              ? 'border-green-700 bg-green-50 font-semibold text-green-800'
              : 'border-gray-300 bg-white text-gray-700 active:bg-gray-50',
          ].join(' ')}
        >
          <span lang={code} className="flex-1">
            {getLocaleLabel(code)}
          </span>
          {showRecommended && code === recommended ? (
            <span className="rounded-full bg-green-50 px-2 py-0.5 text-xs font-normal text-green-800">
              {t('select.recommended')}
            </span>
          ) : null}
          {active ? <Check aria-hidden size={20} strokeWidth={2.5} className="shrink-0 text-green-700" /> : null}
        </button>
      </li>
    )
  }

  const sectionLabel = 'mb-2 text-sm font-semibold text-gray-700'
  // 국적은 골랐는데 고정할 언어가 없으면(목록에 없는 국적 등) 구역을 통째로 숨긴다.
  // 받아 둔 목록이 있으면(pinned) 다시 읽기에 실패해도 목록을 먼저 보여 준다.
  const showPinnedSection = !country || pinned.length > 0 || isLoading || isError

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={t('select.language')}
      closeLabel={t('common.close')}
    >
      {showPinnedSection ? (
        <section className="mb-4">
          <h3 className={sectionLabel}>{t('select.languagePinned')}</h3>
          {!country ? (
            <p className="rounded-card bg-gray-50 px-4 py-3 text-sm text-gray-600">
              {t('select.languagePinHint')}
            </p>
          ) : pinned.length > 0 ? (
            <ul className={['flex flex-col gap-2', reserved ? 'min-h-[148px]' : ''].join(' ')}>
              {pinned.map((code) => renderLocale(code, 'pinned', false))}
            </ul>
          ) : isLoading ? (
            <p
              role="status"
              className="flex min-h-[148px] items-center justify-center rounded-card bg-gray-50 px-4 py-3 text-center text-sm text-gray-500"
            >
              {t('select.countryLoading')}
            </p>
          ) : isError ? (
            <div role="alert" className="rounded-card bg-red-50 px-4 py-3 text-sm text-red-700">
              <p className="mb-2">{t('select.countryError')}</p>
              <button
                type="button"
                onClick={() => void refetch()}
                disabled={isFetching}
                className="min-h-[44px] rounded-full border border-red-300 px-4 text-red-700 disabled:opacity-50"
              >
                {t('common.retry')}
              </button>
            </div>
          ) : null}
        </section>
      ) : null}

      <section>
        <h3 className={sectionLabel}>{t('select.languageAll')}</h3>
        <ul className="flex flex-col gap-2">
          {supportedLocales.map((code) => renderLocale(code, 'all', true))}
        </ul>
      </section>
    </BottomSheet>
  )
}
