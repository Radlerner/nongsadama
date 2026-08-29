import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getLocaleLabel } from '../config/app'
import { useTranslation } from '../i18n/useTranslation'
import { MapPin } from '../components/ui/icons'
import { useRegions, type Region } from '../hooks/useRegions'
import { useSelectedRegion } from '../context/SelectedRegionContext'
import { regionLabel } from '../lib/regionName'
import { getCurrentPosition, nearestTown, OUT_OF_AREA_KM } from '../lib/geo'

/**
 * 언어·지역 선택 화면(PRD 5 IA, 4.1 흐름).
 * 언어는 즉시 전환, 지역은 Supabase regions(활성)에서 시/읍·면을 불러와 선택한다.
 * 선택 지역은 컨텍스트+localStorage에 저장되어 이후 목록 화면이 소비한다.
 */
export function Select() {
  const { t, locale, setLocale, supportedLocales } = useTranslation()

  return (
    <div className="mx-auto flex min-h-screen max-w-screen-sm flex-col bg-brand-cream px-6 py-6 text-gray-900">
      <h1 className="text-xl font-extrabold tracking-tight text-green-700">{t('select.title')}</h1>

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
                      : 'border-gray-300 bg-white text-gray-700',
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
          className="flex min-h-[56px] items-center justify-center rounded-full bg-brand-greenDark px-6 py-3 text-base font-semibold text-white"
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
  const [locating, setLocating] = useState(false)
  const [geoNotice, setGeoNotice] = useState<string | null>(null)

  // 위치 동의 시 가까운 지역 추천(v1.3 §4.1). 좌표는 기기 내 계산만, 저장·전송 없음.
  const suggestNearest = async () => {
    setGeoNotice(null)
    setLocating(true)
    try {
      const pos = await getCurrentPosition()
      const near = nearestTown(regions ?? [], pos.lat, pos.lng)
      if (!near) {
        setGeoNotice('select.geoNoRegion')
        return
      }
      setRegionId(near.region.id)
      setGeoNotice(near.distanceKm > OUT_OF_AREA_KM ? 'map.outOfArea' : 'select.geoSet')
    } catch {
      setGeoNotice('map.geoError')
    } finally {
      setLocating(false)
    }
  }

  // P2-2: 로드된 활성 지역 목록에 없는 저장된 선택은 무효화한다(비활성/삭제된 지역의 stale id 정리).
  useEffect(() => {
    if (regions && regionId && !regions.some((r) => r.id === regionId)) {
      setRegionId(null)
    }
  }, [regions, regionId, setRegionId])

  if (isLoading) {
    return (
      <p className="rounded-card bg-white/70 px-4 py-6 text-center text-sm text-gray-500">
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
          className="min-h-[44px] rounded-full border border-red-300 px-4 text-red-700 disabled:opacity-50"
        >
          {t('common.retry')}
        </button>
      </div>
    )
  }

  const all = regions ?? []
  const cities = all.filter((r) => r.level === 'city')
  const towns = all.filter((r) => r.level === 'town')
  const cityIds = new Set(cities.map((c) => c.id))

  // 시별로 읍·면을 묶고, 부모 시가 없는(미분류) 읍·면은 별도 그룹으로 노출한다.
  // (P2-1: city가 없고 town만 있을 때 아무것도 안 그려지는 무음 공백 방지)
  const groups: { key: string; label: string; towns: Region[] }[] = cities.map((city) => ({
    key: city.id,
    label: regionLabel(city.id, city.names, locale),
    towns: towns.filter((tn) => tn.parent_id === city.id),
  }))
  const ungrouped = towns.filter((tn) => !tn.parent_id || !cityIds.has(tn.parent_id))
  if (ungrouped.length > 0) {
    groups.push({ key: '__ungrouped__', label: t('select.regionOther'), towns: ungrouped })
  }

  const totalTowns = groups.reduce((n, g) => n + g.towns.length, 0)
  if (totalTowns === 0) {
    return (
      <p className="rounded-card bg-white/70 px-4 py-6 text-center text-sm text-gray-500">
        {t('select.regionEmpty')}
      </p>
    )
  }

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
              : 'border-gray-300 bg-white text-gray-700',
          ].join(' ')}
        >
          {active ? <span aria-hidden className="mr-2">✓</span> : null}
          {regionLabel(town.id, town.names, locale)}
        </button>
      </li>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <button
        type="button"
        onClick={() => void suggestNearest()}
        disabled={locating}
        className="flex min-h-[56px] w-full items-center justify-center gap-2 rounded-full border-2 border-green-300 bg-green-50 text-base font-semibold text-green-800 disabled:opacity-60"
      >
        <MapPin aria-hidden size={20} strokeWidth={2.25} />
        {locating ? t('select.geoLocating') : t('select.geoButton')}
      </button>
      {geoNotice ? (
        <p className="rounded-full bg-gray-50 px-3 py-2 text-xs text-gray-700">{t(geoNotice)}</p>
      ) : null}
      {groups
        .filter((g) => g.towns.length > 0)
        .map((g) => (
          <div key={g.key}>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
              {g.label}
            </p>
            <ul className="flex flex-col gap-2">{g.towns.map(renderTown)}</ul>
          </div>
        ))}
    </div>
  )
}
