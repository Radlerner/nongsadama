import { BottomSheet } from './ui/BottomSheet'
import { useCountries, type Country } from '../hooks/useCountries'
import { useTranslation } from '../i18n/useTranslation'

/**
 * 국적 선택 창(PRD v1.4 §3.2 화면 3). 목록은 DB(countries) 그대로 — 화면 코드에 국가 코드를 적지 않는다.
 * 국기는 쓰지 않는다(이미지 자산·이모지 금지). 선택 표시는 원형 라디오 모양(CSS).
 */
interface CountrySheetProps {
  open: boolean
  onClose: () => void
  /** 현재 고른 국적(ISO 2자). 없으면 null. */
  selected: string | null
  onSelect: (country: Country) => void
  /** 맨 아래 보조 줄(예: "고르지 않을래요", "국적 지우기"). */
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

  return (
    <BottomSheet open={open} onClose={onClose} title={t('select.nationalitySheetTitle')}>
      <p className="mb-3 text-sm leading-relaxed text-gray-600">{t('select.nationalitySheetHelp')}</p>

      {isLoading ? (
        <p role="status" className="rounded-card bg-gray-50 px-4 py-6 text-center text-sm text-gray-500">
          {t('select.countryLoading')}
        </p>
      ) : null}

      {isError ? (
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
        <ul className="flex flex-col gap-2">
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
                    <span className="block text-base font-semibold text-gray-900">{country.name_ko}</span>
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

      <div className="mt-3 flex flex-col gap-2">
        {otherLabel && onOther ? (
          <button
            type="button"
            onClick={onOther}
            className="min-h-[44px] w-full rounded-full border border-gray-300 px-4 py-2 text-base text-gray-700 active:bg-gray-50"
          >
            {otherLabel}
          </button>
        ) : null}
        <button
          type="button"
          onClick={onNone}
          className="min-h-[44px] w-full rounded-full border border-gray-300 px-4 py-2 text-base text-gray-700 active:bg-gray-50"
        >
          {noneLabel}
        </button>
      </div>
    </BottomSheet>
  )
}
