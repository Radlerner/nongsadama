import { useState } from 'react'
import { BottomSheet } from './ui/BottomSheet'
import { Button } from './ui/Button'
import { ChoiceRow } from './ui/ChoiceRow'
import { Icon } from './ui/Icon'
import { LoadingState } from './ui/LoadingState'
import { useCountries } from '../hooks/useCountries'
import { useTranslation } from '../i18n/useTranslation'
import { deviceLocale, getLocaleLabel, type Locale } from '../config/app'
import { pinnedLocalesForCountry, readStoredCountry } from '../lib/country'

/**
 * 언어 선택 창(PRD v1.4 §3.2 화면 2). /select 언어 줄과 헤더 언어 버튼이 같이 쓴다.
 * 위: 저장된 국적의 언어(기본 언어가 맨 앞) · 아래: 앱이 지원하는 전체 언어.
 * 언어는 자기 이름(endonym, lang=)으로 적는다 — 화면 언어를 못 읽어도 자기 언어를 찾게 한다.
 * 모양(v5): 56px 고르는 줄(ChoiceRow) — 고른 언어 = 2px nong-600 테두리 + 체크 원.
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
  // 창이 열린 채로 국적 언어가 도착하거나 읽기에 실패해도 아래 "전체 언어" 줄이 밀리지 않게, 목록 없이
  // 열렸으면 이번에 열려 있는 동안은 "내 국적 언어" 자리(언어 3줄 높이)를 그대로 둔다(렌더 중 상태 갱신 패턴).
  const [reserved, setReserved] = useState(false)
  if (open && country && !countries && !reserved) setReserved(true)
  if (!open && reserved) setReserved(false)
  const countryRow = country ? (countries ?? []).find((row) => row.iso_code === country) : undefined
  const pinned = countryRow ? pinnedLocalesForCountry(countryRow, supportedLocales) : []

  const pick = (code: Locale) => {
    setLocale(code, true)
    onPicked?.(code)
    onClose()
  }

  const renderLocale = (code: Locale, keyPrefix: string, showRecommended: boolean) => (
    <li key={`${keyPrefix}-${code}`}>
      <ChoiceRow selected={locale === code} onClick={() => pick(code)}>
        <span lang={code} className="block">
          {getLocaleLabel(code)}
        </span>
        {showRecommended && code === recommended ? (
          <span className="block text-caption font-normal text-ink-muted">{t('select.recommended')}</span>
        ) : null}
      </ChoiceRow>
    </li>
  )

  const sectionLabel = 'mb-2 text-small font-bold text-ink-muted'
  // 국적은 골랐는데 고정할 언어가 없으면(목록에 없는 국적 등) 구역을 통째로 숨긴다.
  // 받아 둔 목록이 있으면(pinned) 다시 읽기에 실패해도 목록을 먼저 보여 준다.
  const showPinnedSection = !country || pinned.length > 0 || isLoading || isError || reserved

  return (
    <BottomSheet open={open} onClose={onClose} title={t('select.language')} closeLabel={t('common.close')}>
      {showPinnedSection ? (
        <section className="mb-5">
          <h3 className={sectionLabel}>{t('select.languagePinned')}</h3>
          {!country ? (
            <p className="rounded-xl bg-surface px-4 py-3 text-small text-ink-body">{t('select.languagePinHint')}</p>
          ) : (
            // 언어 3줄(56px × 3 + 사이 8px × 2) 높이를 잡아 둔다
            <div className={reserved ? 'flex min-h-[184px] flex-col' : undefined}>
              {pinned.length > 0 ? (
                <ul className="flex flex-col gap-2">{pinned.map((code) => renderLocale(code, 'pinned', false))}</ul>
              ) : isLoading ? (
                <div className="flex flex-1 items-center justify-center rounded-xl bg-surface px-4">
                  <LoadingState variant="inline" label={t('select.countryLoading')} />
                </div>
              ) : isError ? (
                <div
                  aria-live="polite"
                  className="flex flex-1 flex-col items-center justify-center gap-3 rounded-xl border border-line px-4 py-4 text-center"
                >
                  <p role="alert" className="flex items-start gap-1.5 text-small text-ink">
                    <Icon name="alert" size={20} className="shrink-0 text-danger" />
                    <span>{t('select.countryError')}</span>
                  </p>
                  <Button
                    variant="secondary"
                    size="sm"
                    icon="refresh"
                    loading={isFetching}
                    loadingLabel={t('state.retrying')}
                    onClick={() => void refetch()}
                  >
                    {t('common.retry')}
                  </Button>
                </div>
              ) : null}
            </div>
          )}
        </section>
      ) : null}

      <section>
        <h3 className={sectionLabel}>{t('select.languageAll')}</h3>
        <ul className="flex flex-col gap-2">{supportedLocales.map((code) => renderLocale(code, 'all', true))}</ul>
      </section>
    </BottomSheet>
  )
}
