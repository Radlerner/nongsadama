import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { getLocaleLabel, type Locale } from '../config/app'
import { useTranslation } from '../i18n/useTranslation'
import { MapPin } from '../components/ui/icons'
import { PickerRow } from '../components/ui/BottomSheet'
import { CountrySheet } from '../components/CountrySheet'
import { LanguageSheet } from '../components/LanguageSheet'
import { useCountries, type Country } from '../hooks/useCountries'
import {
  clearStoredCountry,
  pickLocaleForCountry,
  readStoredCountry,
  writeStoredCountry,
} from '../lib/country'
import {
  useRegions,
  splitRegionGroups,
  provinceOf,
  type Region,
} from '../hooks/useRegions'
import { useRegionChoice, viewRegionId } from '../context/RegionChoiceContext'
import { regionChoiceStore } from '../lib/regionChoiceStore'
import { safeReturnTo } from '../lib/regionChoice'
import { regionLabel } from '../lib/regionName'
import { getCurrentPosition, nearestServiceRegion, OUT_OF_AREA_KM } from '../lib/geo'

/**
 * 언어·지역 선택 화면(PRD 5 IA, 4.1 흐름).
 * v1.4(PRD_v1.4 §3.2): 국적(선택)을 고르면 그 나라 기본 언어로 앱 언어를 맞춘다. 언어 9개 세로 목록은
 * 아래에서 올라오는 창으로 옮겨 지역 선택과 "계속"이 아래로 밀리지 않게 했다.
 * 지역은 Supabase regions(활성)에서 시/읍·면을 불러와 선택한다.
 * 선택 지역은 "지금 보는 지역"(직접 고름)으로 기기에 저장되어 이후 화면이 쓴다(v1.6 D-047).
 * 지역 없이 "계속"을 누르면 전국으로 넘어가지 않고 고르라고 알린다. 전국은 "지역 없이 전국 둘러보기"로만(D2).
 */
export function Select() {
  const { t, locale, setLocale, supportedLocales } = useTranslation()
  const location = useLocation()
  const navigate = useNavigate()
  const { view, pickAll } = useRegionChoice()
  const { data: regions, isError: regionsError } = useRegions()
  // 게시판·글쓰기·안내 상자에서 왔으면 그 화면으로 돌아간다(앱 안의 경로만)
  const navState = location.state as { returnTo?: unknown; returnState?: unknown } | null
  const returnTo = safeReturnTo(navState?.returnTo)
  const returnState = navState?.returnState
  const [needRegion, setNeedRegion] = useState(false)
  const regionHeadingRef = useRef<HTMLHeadingElement>(null)
  useEffect(() => {
    if (view.status === 'region') setNeedRegion(false)
  }, [view.status])
  const goNext = () => navigate(returnTo, { state: returnState })
  const onContinue = () => {
    // 지역 목록을 읽었는데 아무것도 고르지 않았으면 머문다. 목록을 못 읽었으면 아무것도 쓰지 않고 넘어간다.
    const listReady = !regionsError && regions !== undefined && regions.length > 0
    if (listReady && view.status === 'none') {
      setNeedRegion(true)
      regionHeadingRef.current?.scrollIntoView({ block: 'center' })
      regionHeadingRef.current?.focus()
      return
    }
    goNext()
  }
  const onBrowseAll = () => {
    pickAll()
    goNext()
  }
  const [countryCode, setCountryCode] = useState<string | null>(() => readStoredCountry())
  const [countryOpen, setCountryOpen] = useState(false)
  const [languageOpen, setLanguageOpen] = useState(false)
  // 국적 선택 직후에만 보이는 안내. 문구 대신 상태로 두고 렌더 때 번역한다(언어가 바뀌어도 문구가 따라온다).
  const [langNotice, setLangNotice] = useState<{ matched: boolean; locale: Locale } | null>(null)
  // 화면에 들어올 때 미리 읽는다(7건, 1시간 보관) — 느린 망에서도 국적 창을 열면 목록이 바로 보이게.
  const { data: countries } = useCountries()
  const country = countryCode ? (countries ?? []).find((row) => row.iso_code === countryCode) : undefined

  const chooseCountry = (next: Country) => {
    writeStoredCountry(next.iso_code)
    setCountryCode(next.iso_code)
    // explicit=false: 가입 때 프로필 언어가 국적 기본 언어를 따라갈 수 있게 "직접 고른 언어"로 표시하지 않는다.
    const picked = pickLocaleForCountry(next, supportedLocales)
    setLocale(picked.locale, false)
    setLangNotice(picked)
    setCountryOpen(false)
  }

  const skipCountry = () => {
    clearStoredCountry()
    setCountryCode(null)
    setLangNotice(null)
    setCountryOpen(false)
  }

  const noticeText = langNotice
    ? langNotice.matched
      ? t('select.nationalityLangSet').replace('{lang}', getLocaleLabel(langNotice.locale))
      : t('select.nationalityLangEnglish')
    : null

  return (
    <div className="mx-auto flex min-h-screen max-w-screen-sm flex-col bg-brand-cream px-6 py-6 text-gray-900">
      <h1 className="text-xl font-extrabold tracking-tight text-green-700">{t('select.title')}</h1>

      <section className="mt-6 flex flex-col gap-4">
        <div>
          <h2 id="select-nationality-label" className="mb-2 text-sm font-semibold text-gray-700">
            {t('select.nationality')}
          </h2>
          <PickerRow
            labelId="select-nationality-label"
            value={country ? country.name_ko : countryCode}
            secondary={country && country.name_native !== country.name_ko ? country.name_native : null}
            valueLang={country ? 'ko' : undefined}
            secondaryLang={country?.default_locale}
            placeholder={t('select.nationalityPlaceholder')}
            onClick={() => setCountryOpen(true)}
          />
        </div>
        <div>
          <h2 id="select-language-label" className="mb-2 text-sm font-semibold text-gray-700">
            {t('select.language')}
          </h2>
          <PickerRow
            labelId="select-language-label"
            value={getLocaleLabel(locale)}
            placeholder={t('select.language')}
            onClick={() => setLanguageOpen(true)}
          />
        </div>
        {noticeText ? (
          <p role="status" className="rounded-card bg-green-50 px-4 py-3 text-sm leading-relaxed text-green-800">
            {noticeText}
          </p>
        ) : null}
      </section>

      <CountrySheet
        open={countryOpen}
        onClose={() => setCountryOpen(false)}
        selected={countryCode}
        onSelect={chooseCountry}
        noneLabel={t('select.nationalityNone')}
        onNone={skipCountry}
      />
      <LanguageSheet
        open={languageOpen}
        onClose={() => setLanguageOpen(false)}
        countryCode={countryCode}
        onPicked={() => setLangNotice(null)}
      />

      <section className="mt-6">
        <h2 ref={regionHeadingRef} tabIndex={-1} className="mb-2 text-sm font-semibold text-gray-700 focus:outline-none">
          {t('select.region')}
        </h2>
        <RegionPicker />
      </section>

      <div className="mt-auto flex flex-col gap-3 pt-8">
        {/* 안내 자리는 처음부터 비워 두어 "계속"이 밀리지 않게 한다 */}
        <p role="alert" className="min-h-[1.25rem] text-center text-sm font-semibold text-red-700">
          {needRegion ? t('select.needRegion') : ''}
        </p>
        <button
          type="button"
          onClick={onContinue}
          className="flex min-h-[56px] items-center justify-center rounded-full bg-brand-greenDark px-6 py-3 text-base font-semibold text-white"
        >
          {t('select.continue')}
        </button>
        <button
          type="button"
          onClick={onBrowseAll}
          aria-pressed={view.status === 'all'}
          className="flex min-h-[44px] items-center justify-center rounded-full px-4 text-sm text-gray-700 underline"
        >
          {t('region.needed.all')}
        </button>
      </div>
    </div>
  )
}

function RegionPicker() {
  const { t, locale } = useTranslation()
  const { data: regions, isLoading, isError, refetch, isFetching } = useRegions()
  const { view, pickRegion } = useRegionChoice()
  const regionId = viewRegionId(view)
  const [locating, setLocating] = useState(false)
  // 안내는 키+데이터로 저장하고 렌더 시 번역한다 — 같은 화면에서 언어를 바꿔도 문구가 따라온다(재검수 P2).
  const [geoNotice, setGeoNotice] = useState<{ key: string; region?: Region; km?: number } | null>(
    null,
  )
  const mountedRef = useRef(true)
  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])
  // v1.2(D-035): 시/도 → 시·군·구 두 단계. 사용자가 고른 시/도가 없으면 처음 정해진 보는 지역의 시/도를 따른다.
  // 처음 정해진 뒤에는 다시 계산하지 않는다 — 늦게 정해진 지역 때문에 목록이 통째로 바뀌어 손가락 아래가 바뀌지 않게(D-047).
  const [provinceChoice, setProvinceChoice] = useState<string | null>(null)
  const [initialProvince, setInitialProvince] = useState<string | null | undefined>(undefined)
  const provinces = (regions ?? []).filter((r) => r.level === 'province')
  useEffect(() => {
    if (initialProvince !== undefined || !regions || view.status === 'deciding') return
    const selected = regions.find((r) => r.id === regionId)
    setInitialProvince(provinceOf(regions, selected)?.id ?? null)
  }, [initialProvince, regions, view.status, regionId])
  const provinceId = provinceChoice ?? initialProvince ?? null

  const applyRegion = (region: Region) => {
    pickRegion(region.id)
    setProvinceChoice(provinceOf(regions ?? [], region)?.id ?? null)
  }

  // 위치 동의 시 가까운 지역 추천(v1.3 §4.1). 좌표는 기기 내 계산만, 저장·전송 없음.
  const suggestNearest = async () => {
    setGeoNotice(null)
    setLocating(true)
    // 위치를 받는 동안 사용자가 직접 고르거나 화면을 떠나면, 늦은 결과로 그 선택을 바꾸지 않는다(D-047)
    const startRev = regionChoiceStore.getChoiceRev()
    try {
      const pos = await getCurrentPosition()
      if (!mountedRef.current) return
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
      if (regionChoiceStore.getChoiceRev() !== startRev) {
        setGeoNotice({ key: 'select.geoSuggest', region: near.region, km: near.distanceKm })
        return
      }
      applyRegion(near.region)
      setGeoNotice({ key: 'select.geoSet' })
    } catch {
      if (mountedRef.current) setGeoNotice({ key: 'map.geoError' })
    } finally {
      if (mountedRef.current) setLocating(false)
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
          onClick={() => pickRegion(region.id)}
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
      {geoNotice?.key === 'select.geoSuggest' && geoNotice.region ? (
        <button
          type="button"
          onClick={() => {
            if (geoNotice.region) applyRegion(geoNotice.region)
            setGeoNotice({ key: 'select.geoSet' })
          }}
          className="min-h-[44px] rounded-full border border-green-700 bg-white px-4 text-sm font-semibold text-green-800"
        >
          {t('select.geoApply')}
        </button>
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
