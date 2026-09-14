import { useState } from 'react'
import { Link } from 'react-router-dom'
import { getLocaleLabel } from '../config/app'
import { useTranslation } from '../i18n/useTranslation'
import { MapPin } from '../components/ui/icons'
import {
  useRegions,
  splitRegionGroups,
  provinceOf,
  useStaleRegionCleanup,
  type Region,
} from '../hooks/useRegions'
import { useSelectedRegion } from '../context/SelectedRegionContext'
import { regionLabel } from '../lib/regionName'
import { getCurrentPosition, nearestServiceRegion, OUT_OF_AREA_KM } from '../lib/geo'

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
  // 안내는 키+데이터로 저장하고 렌더 시 번역한다 — 같은 화면에서 언어를 바꿔도 문구가 따라온다(재검수 P2).
  const [geoNotice, setGeoNotice] = useState<{ key: string; region?: Region; km?: number } | null>(
    null,
  )
  // P2-2: 로드된 활성 지역 목록에 없는 저장된 선택은 무효화한다(공용 훅, v1.1 D-033).
  useStaleRegionCleanup()
  // v1.2(D-035): 시/도 → 시·군·구 두 단계. 사용자가 고른 시/도가 없으면 현재 선택 지역의 시/도를 따른다.
  const [provinceChoice, setProvinceChoice] = useState<string | null>(null)
  const selectedRegion = (regions ?? []).find((r) => r.id === regionId)
  const provinces = (regions ?? []).filter((r) => r.level === 'province')
  const provinceId = provinceChoice ?? provinceOf(regions ?? [], selectedRegion)?.id ?? null

  // 위치 동의 시 가까운 지역 추천(v1.3 §4.1). 좌표는 기기 내 계산만, 저장·전송 없음.
  const suggestNearest = async () => {
    setGeoNotice(null)
    setLocating(true)
    try {
      const pos = await getCurrentPosition()
      const near = nearestServiceRegion(regions ?? [], pos.lat, pos.lng)
      if (!near) {
        setGeoNotice({ key: 'select.geoNoRegion' })
        return
      }
      if (near.distanceKm > OUT_OF_AREA_KM) {
        // v1.1(D-033): 서비스 지역 밖이면 자동 선택하지 않는다 — 먼 지역이 사용자의 지역으로
        // 굳어 게시판·프로필·글쓰기까지 그 지역이 되던 문제. 안내만 하고 선택은 사용자에게.
        setGeoNotice({ key: 'select.geoFar', region: near.region, km: near.distanceKm })
        return
      }
      setRegionId(near.region.id)
      setProvinceChoice(null) // 추천된 지역의 시/도를 따라가도록 수동 선택 해제
      setGeoNotice({ key: 'select.geoSet' })
    } catch {
      setGeoNotice({ key: 'map.geoError' })
    } finally {
      setLocating(false)
    }
  }
  const noticeText = geoNotice
    ? t(geoNotice.key)
        .replace(
          '{name}',
          geoNotice.region ? regionLabel(geoNotice.region.id, geoNotice.region.names, locale) : '',
        )
        .replace('{n}', geoNotice.km != null ? String(Math.max(1, Math.round(geoNotice.km))) : '')
    : null

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

  // v1.1(D-033): 시·군별 묶음 — 읍·면이 있는 시·군은 읍·면 버튼(파일럿 홍성 그대로),
  // 읍·면이 아직 없는 시·군은 시·군 자체를 고른다. 후자는 한 묶음(접힘)으로 모아 화면이
  // 시·군 수만큼 길어지지 않고 '계속' 버튼이 멀어지지 않게 한다. 부모 없는(미분류) 읍·면은 별도 그룹(P2-1).
  // 시/도 데이터가 있으면 고른 시/도의 시·군·구만(아직 안 골랐으면 비움), 없으면(구 데이터) 전체를 보여 준다.
  const { detailed, cityOnly } =
    provinces.length > 0 && !provinceId
      ? { detailed: [], cityOnly: [] }
      : splitRegionGroups(regions ?? [], provinces.length > 0 ? provinceId : undefined)
  const detailedGroups = detailed.map((g) => ({
    key: g.city?.id ?? '__ungrouped__',
    label: g.city ? regionLabel(g.city.id, g.city.names, locale) : t('select.regionOther'),
    members: g.members,
  }))
  // 시·군 묶음은 그 안의 지역이 선택돼 있거나 읍·면 그룹이 하나도 없을 때만 펼친 채로 시작한다.
  const cityOnlyOpen = cityOnly.some((r) => r.id === regionId) || detailedGroups.length === 0

  const total = detailedGroups.reduce((n, g) => n + g.members.length, 0) + cityOnly.length
  if ((regions ?? []).length === 0) {
    return (
      <p className="rounded-card bg-white/70 px-4 py-6 text-center text-sm text-gray-500">
        {t('select.regionEmpty')}
      </p>
    )
  }

  const provinceSelect =
    provinces.length > 0 ? (
      <label className="flex flex-col gap-1 text-sm font-semibold text-gray-700">
        {t('select.province')}
        <select
          value={provinceId ?? ''}
          onChange={(e) => setProvinceChoice(e.target.value || null)}
          className="min-h-[44px] rounded-md border border-gray-300 bg-white px-3 text-base font-normal text-gray-900"
        >
          <option value="">{t('select.provincePlaceholder')}</option>
          {provinces.map((p) => (
            <option key={p.id} value={p.id}>
              {regionLabel(p.id, p.names, locale)}
            </option>
          ))}
        </select>
      </label>
    ) : null

  const renderRegion = (region: Region) => {
    const active = regionId === region.id
    return (
      <li key={region.id}>
        <button
          type="button"
          onClick={() => setRegionId(region.id)}
          aria-pressed={active}
          className={[
            'flex min-h-[44px] w-full items-center rounded-md border px-4 text-left text-base',
            active
              ? 'border-green-700 bg-green-50 font-semibold text-green-700'
              : 'border-gray-300 bg-white text-gray-700',
          ].join(' ')}
        >
          {active ? <span aria-hidden className="mr-2">✓</span> : null}
          {regionLabel(region.id, region.names, locale)}
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
      {noticeText ? (
        <p className="rounded-full bg-gray-50 px-3 py-2 text-xs text-gray-700">{noticeText}</p>
      ) : null}
      {provinceSelect}
      {provinces.length > 0 && !provinceId ? (
        <p className="rounded-card bg-white/70 px-4 py-4 text-center text-sm text-gray-500">
          {t('select.pickProvinceFirst')}
        </p>
      ) : null}
      {provinceId && total === 0 ? (
        <p className="rounded-card bg-white/70 px-4 py-4 text-center text-sm text-gray-500">
          {t('select.regionEmpty')}
        </p>
      ) : null}
      {detailedGroups.map((g) => (
        <div key={g.key}>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
            {g.label}
          </p>
          <ul className="flex flex-col gap-2">{g.members.map(renderRegion)}</ul>
        </div>
      ))}
      {cityOnly.length > 0 ? (
        <details open={cityOnlyOpen}>
          <summary className="flex min-h-[44px] cursor-pointer list-none items-center gap-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
            <span aria-hidden>▸</span>
            {t('select.regionCities')} ({cityOnly.length})
          </summary>
          <ul className="mt-1 flex flex-col gap-2">{cityOnly.map(renderRegion)}</ul>
        </details>
      ) : null}
    </div>
  )
}
