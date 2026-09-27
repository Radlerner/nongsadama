import { useEffect, useId, useRef } from 'react'
import { BottomSheet } from './ui/BottomSheet'
import { useCountries, type Country } from '../hooks/useCountries'
import { useTranslation } from '../i18n/useTranslation'

/**
 * 국적 선택 창(PRD v1.4 §3.2 화면 3). 목록은 DB(countries) 그대로 — 화면 코드에 국가 코드를 적지 않는다.
 * 국기는 쓰지 않는다(이미지 자산·이모지 금지). 선택 표시는 원형 라디오 모양(CSS).
 * 보조 버튼(다른 나라·고르지 않기·닫기)은 창 바닥에 고정한다 — 느린 망에서 목록이 늦게 도착해도
 * 누르려던 버튼 자리에 나라 줄이 들어와 언어가 바뀌는 일이 없게 한다.
 */
interface CountrySheetProps {
  open: boolean
  onClose: () => void
  /** 현재 고른 국적(ISO 2자). 없으면 null. */
  selected: string | null
  onSelect: (country: Country) => void
  /** 창 바닥의 보조 버튼(예: "고르지 않을래요", "국적 지우기"). */
  noneLabel: string
  onNone: () => void
  /** 목록에 없는 나라를 위한 줄(프로필 수정 전용). 주지 않으면 그리지 않는다. */
  otherLabel?: string
  onOther?: () => void
}

export function CountrySheet({
  open,
  onClose,
  selected,
  onSelect,
  noneLabel,
  onNone,
  otherLabel,
  onOther,
}: CountrySheetProps) {
  const { t } = useTranslation()
  const { data: countries, isLoading, isError, refetch, isFetching } = useCountries({ enabled: open })
  const helpId = useId()
  const listRef = useRef<HTMLUListElement>(null)
  const footerRef = useRef<HTMLDivElement>(null)
  const hasList = Boolean(countries && countries.length > 0)

  // 창을 연 뒤에 목록이 도착했으면 초점이 바닥 버튼에 남아 있다 — 목록(고른 나라가 있으면 그 줄)으로 옮긴다.
  useEffect(() => {
    if (!open || !hasList) return
    if (!footerRef.current?.contains(document.activeElement)) return
    const list = listRef.current
    const target =
      list?.querySelector<HTMLElement>('button[aria-pressed="true"]') ??
      list?.querySelector<HTMLElement>('button')
    target?.focus()
  }, [open, hasList])

  const footerButton =
    'min-h-[44px] w-full rounded-full border border-gray-300 px-3 py-2 text-base text-gray-700 active:bg-gray-50'

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={t('select.nationalitySheetTitle')}
      descriptionId={helpId}
      footer={
        <div ref={footerRef} className="flex flex-col gap-2">
          {otherLabel && onOther ? (
            <button type="button" onClick={onOther} className={footerButton}>
              {otherLabel}
            </button>
          ) : null}
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={onNone} className={footerButton}>
              {noneLabel}
            </button>
            <button type="button" onClick={onClose} className={footerButton}>
              {t('common.close')}
            </button>
          </div>
        </div>
      }
    >
      <p id={helpId} className="mb-3 text-sm leading-relaxed text-gray-600">
        {t('select.nationalitySheetHelp')}
      </p>

      {isLoading ? (
        <p role="status" className="rounded-card bg-gray-50 px-4 py-6 text-center text-sm text-gray-500">
          {t('select.countryLoading')}
        </p>
      ) : null}

      {/* 받아 둔 목록이 있으면 다시 읽기에 실패해도 목록을 보여 준다 */}
      {isError && !countries ? (
        <div role="alert" className="rounded-card bg-red-50 px-4 py-6 text-center text-sm text-red-700">
          <p className="mb-3">{t('select.countryError')}</p>
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

      {countries && countries.length > 0 ? (
        <ul ref={listRef} className="flex flex-col gap-2">
          {countries.map((country) => {
            const active = selected === country.iso_code
            return (
              <li key={country.iso_code}>
                <button
                  type="button"
                  aria-pressed={active}
                  onClick={() => onSelect(country)}
                  className={[
                    'flex min-h-[56px] w-full items-center gap-3 rounded-md border px-4 py-2 text-left',
                    active ? 'border-green-700 bg-green-50' : 'border-gray-300 bg-white active:bg-gray-50',
                  ].join(' ')}
                >
                  <span
                    aria-hidden
                    className={[
                      'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2',
                      active ? 'border-green-700' : 'border-gray-300',
                    ].join(' ')}
                  >
                    {active ? <span className="h-2.5 w-2.5 rounded-full bg-brand-greenDark" /> : null}
                  </span>
                  <span className="flex-1">
                    <span lang="ko" className="block text-base font-semibold text-gray-900">
                      {country.name_ko}
                    </span>
                    {country.name_native !== country.name_ko ? (
                      <span lang={country.default_locale} className="block text-sm text-gray-600">
                        {country.name_native}
                      </span>
                    ) : null}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      ) : null}
    </BottomSheet>
  )
}
