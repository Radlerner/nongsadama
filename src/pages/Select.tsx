import { Link } from 'react-router-dom'
import { getLocaleLabel } from '../config/app'
import { useTranslation } from '../i18n/useTranslation'
import { useRegions, type Region } from '../hooks/useRegions'
import { useSelectedRegion } from '../context/SelectedRegionContext'
import { regionName } from '../lib/regionName'

/**
 * 언어·지역 선택 화면(PRD 5 IA, 4.1 흐름).
 * 언어는 즉시 전환, 지역은 Supabase regions(활성)에서 시/읍·면을 불러와 선택한다.
 * 선택 지역은 컨텍스트+localStorage에 저장되어 이후 목록 화면이 소비한다.
 */
export function Select() {
  const { t, locale, setLocale, supportedLocales } = useTranslation()

  return (
    <div className="mx-auto flex min-h-screen max-w-screen-sm flex-col bg-white px-6 py-6 text-gray-900">
      <h1 className="text-xl font-bold text-green-700">{t('select.title')}</h1>

      <section className="mt-6">
        <h2 className="mb-2 text-sm font-semibold text-gray-700">{t('select.language')}</h2>
        <ul className="flex flex-col gap-2">
          {supportedLocales.map((code) => {
            const active = locale === code
            return (
              <li key={code}>
                <button
                  type="button"
                  onClick={() => setLocale(code)}
                  aria-pressed={active}
                  className={[
                    'flex min-h-[44px] w-full items-center rounded-md border px-4 text-left text-base',
                    active
                      ? 'border-green-700 bg-green-50 font-semibold text-green-700'
                      : 'border-gray-300 text-gray-700',
                  ].join(' ')}
                >
                  {getLocaleLabel(code)}
                </button>
              </li>
            )
          })}
        </ul>
      </section>

      <section className="mt-6">
        <h2 className="mb-2 text-sm font-semibold text-gray-700">{t('select.region')}</h2>
        <RegionPicker />
      </section>

      <div className="mt-auto pt-8">
        <Link
          to="/home"
          className="flex min-h-[44px] items-center justify-center rounded-md bg-green-700 px-6 py-3 text-base font-semibold text-white"
        >
          {t('select.continue')}
        </Link>
      </div>
    </div>
  )
}

function RegionPicker() {
  const { t, locale } = useTranslation()
  const { data: regions, isLoading, isError, refetch, isFetching } = useRegions()
  const { regionId, setRegionId } = useSelectedRegion()

  if (isLoading) {
    return (
      <p className="rounded-md bg-gray-50 px-4 py-6 text-center text-sm text-gray-500">
        {t('select.regionLoading')}
      </p>
    )
  }

  if (isError) {
    return (
      <div className="rounded-md bg-red-50 px-4 py-6 text-center text-sm text-red-700">
        <p className="mb-3">{t('select.regionError')}</p>
        <button
          type="button"
          onClick={() => void refetch()}
          disabled={isFetching}
          className="min-h-[44px] rounded-md border border-red-300 px-4 text-red-700 disabled:opacity-50"
        >
          {t('common.retry')}
        </button>
      </div>
    )
  }

  const cities = (regions ?? []).filter((r) => r.level === 'city')
  const towns = (regions ?? []).filter((r) => r.level === 'town')

  if (cities.length === 0 && towns.length === 0) {
    return (
      <p className="rounded-md bg-gray-50 px-4 py-6 text-center text-sm text-gray-500">
        {t('select.regionEmpty')}
      </p>
    )
  }

  const townsOf = (cityId: string) => towns.filter((r) => r.parent_id === cityId)

  const renderTown = (town: Region) => {
    const active = regionId === town.id
    return (
      <li key={town.id}>
        <button
          type="button"
          onClick={() => setRegionId(town.id)}
          aria-pressed={active}
          className={[
            'flex min-h-[44px] w-full items-center rounded-md border px-4 text-left text-base',
            active
              ? 'border-green-700 bg-green-50 font-semibold text-green-700'
              : 'border-gray-300 text-gray-700',
          ].join(' ')}
        >
          {regionName(town.names, locale)}
        </button>
      </li>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {cities.map((city) => (
        <div key={city.id}>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
            {regionName(city.names, locale)}
          </p>
          <ul className="flex flex-col gap-2">{townsOf(city.id).map(renderTown)}</ul>
        </div>
      ))}
    </div>
  )
}
