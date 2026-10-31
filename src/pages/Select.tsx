import { useId, useState, type KeyboardEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { getLocaleLabel, type Locale } from '../config/app'
import { useTranslation } from '../i18n/useTranslation'
import { CountrySheet } from '../components/CountrySheet'
import { LanguageSheet } from '../components/LanguageSheet'
import { EntryHeader } from '../components/layout/EntryHeader'
import {
  Button,
  buttonClasses,
  ChoiceRow,
  cn,
  EmptyState,
  ErrorState,
  Icon,
  LoadingState,
  PickerRow,
  SkeletonBlock,
  useSlow,
  type IconName,
} from '../components/ui'
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
  useStaleRegionCleanup,
  type Region,
} from '../hooks/useRegions'
import { useSelectedRegion } from '../context/SelectedRegionContext'
import { regionLabel } from '../lib/regionName'
import { getCurrentPosition, nearestServiceRegion, OUT_OF_AREA_KM } from '../lib/geo'

/**
 * 언어·지역 선택 화면(PRD 5 IA, 4.1 흐름).
 * v1.4(PRD_v1.4 §3.2): 국적(선택)을 고르면 그 나라 기본 언어로 앱 언어를 맞춘다. 언어 9개 세로 목록은
 * 아래에서 올라오는 창으로 옮겨 지역 선택과 "계속"이 아래로 밀리지 않게 했다.
 * 지역은 Supabase regions(활성)에서 시/읍·면을 불러와 선택한다.
 * 선택 지역은 컨텍스트+localStorage에 저장되어 이후 목록 화면이 소비한다.
 * 디자인 v5: 흰 바탕, 입력 줄(국적·언어 → 창), 56px 라디오 줄(선택 = 2px 초록 테두리 + 체크),
 * 화면 아래에 붙은 주 버튼 하나(계속).
 */
export function Select() {
  const { t, setLocale, locale, supportedLocales } = useTranslation()
  const navigate = useNavigate()
  const regionHeadingId = useId()
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
    <div className="mx-auto flex min-h-app max-w-screen-sm flex-col bg-white text-ink">
      {/* 언어는 이 화면의 '언어' 줄에서 고른다 — 머리줄의 언어 버튼은 두지 않는다 */}
      <EntryHeader
        language={false}
        onBack={() => (window.history.length > 1 ? navigate(-1) : navigate('/'))}
      />
      <main className="flex-1 px-5 pb-8 pt-3">
        <h1 className="text-title text-ink">{t('select.title')}</h1>
        <p className="mt-1 text-body text-ink-body">{t('select.lead')}</p>

        <section className="mt-6 flex flex-col gap-5">
          <div>
            <h2 id="select-nationality-label" className="mb-2 text-label text-ink">
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
            <h2 id="select-language-label" className="mb-2 text-label text-ink">
              {t('select.language')}
            </h2>
            <PickerRow
              labelId="select-language-label"
              value={getLocaleLabel(locale)}
              valueLang={locale}
              placeholder={t('select.language')}
              onClick={() => setLanguageOpen(true)}
            />
          </div>
        </section>
        {/* 국적에 맞춰 언어를 바꿨다는 안내: 상태 영역은 늘 붙어 있고 안의 글만 바뀐다 */}
        <div role="status" aria-live="polite">
          {noticeText ? (
            <p className="mt-3 flex items-start gap-2 rounded-xl bg-surface px-4 py-3 text-small text-ink-body">
              <Icon name="check" size={20} className="mt-px shrink-0 text-nong-600" />
              <span>{noticeText}</span>
            </p>
          ) : null}
        </div>

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

        <section className="mt-8" aria-labelledby={regionHeadingId}>
          <h2 id={regionHeadingId} className="text-section text-ink">
            {t('select.region')}
          </h2>
          <p className="mt-1 text-small text-ink-muted">{t('select.regionHint')}</p>
          <RegionPicker labelledBy={regionHeadingId} />
        </section>
      </main>

      {/* 주 버튼은 화면 아래에 붙어 있어 목록이 길어도 늘 보인다(흰 바탕 + 위 1px 선, 그림자 없음). */}
      <div className="sticky bottom-0 z-20 border-t border-line bg-white px-5 pb-[calc(12px+var(--safe-bottom))] pt-3">
        <Link to="/home" className={buttonClasses({ fullWidth: true })}>
          {t('select.continue')}
          <Icon name="chevron" size={20} strokeWidth={2} />
        </Link>
      </div>
    </div>
  )
}

/** 위치 찾기 결과 안내의 모양(아이콘·색). 키는 main 그대로. */
const GEO_NOTICE_LOOK: Record<string, { icon: IconName; className: string }> = {
  'select.geoSet': { icon: 'check', className: 'text-nong-600' },
  'select.geoFar': { icon: 'info', className: 'text-ink-muted' },
  'select.geoNoRegion': { icon: 'info', className: 'text-ink-muted' },
  'map.geoError': { icon: 'alert', className: 'text-danger' },
}

function RegionPicker({ labelledBy }: { labelledBy: string }) {
  const { t, locale } = useTranslation()
  const { data: regions, isPending, isError, refetch, isFetching } = useRegions()
  const { regionId, setRegionId } = useSelectedRegion()
  const [locating, setLocating] = useState(false)
  // 8초 넘게 위치를 못 받으면 느린 안내 + 기다리지 않는 길. 위치는 인터넷 없이도 받을 수 있어 '연결 대기'로 바꾸지 않는다.
  const locatingSlow = useSlow(locating)
  // 안내는 키+데이터로 저장하고 렌더 시 번역한다 — 같은 화면에서 언어를 바꿔도 문구가 따라온다(재검수 P2).
  const [geoNotice, setGeoNotice] = useState<{ key: string; region?: Region; km?: number } | null>(
    null,
  )
  // P2-2: 로드된 활성 지역 목록에 없는 저장된 선택은 무효화한다(공용 훅, v1.1 D-033).
  useStaleRegionCleanup()
  // v1.2(D-035): 시/도 → 시·군·구 두 단계. 사용자가 고른 시/도가 없으면 현재 선택 지역의 시/도를 따른다.
  const [provinceChoice, setProvinceChoice] = useState<string | null>(null)
  // 시·군 묶음(접힘)을 사람이 직접 열고 닫았으면 그 값을 따른다. 시/도가 바뀌면 다시 기본값으로.
  const [cityOnlyToggle, setCityOnlyToggle] = useState<{ province: string | null; open: boolean } | null>(null)
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

  // 처음 불러오기(오프라인이라 요청이 멈춘 경우 포함 — '지역이 없어요'로 오해하지 않게 연결 대기 줄을 보인다)
  if (isPending) {
    return (
      <LoadingState
        variant="inline"
        label={t('select.regionLoading')}
        offlineLabel={t('select.regionOffline')}
        className="mt-3"
      >
        <div className="mt-2 flex flex-col gap-2">
          <SkeletonBlock className="h-12 w-full rounded-xl" />
          <SkeletonBlock className="mt-3 h-12 w-full rounded-lg" />
          <SkeletonBlock className="mt-3 h-4 w-24 rounded-full" />
          {[0, 1, 2].map((i) => (
            <SkeletonBlock key={i} className="h-14 w-full rounded-xl" />
          ))}
        </div>
      </LoadingState>
    )
  }

  if (isError) {
    return (
      <ErrorState
        className="mt-3"
        title={t('select.regionError')}
        onRetry={() => void refetch()}
        retrying={isFetching}
        fallback={{ label: t('select.skipRegion'), to: '/home' }}
      />
    )
  }

  if ((regions ?? []).length === 0) {
    return (
      <EmptyState
        className="mt-3"
        icon="pin"
        title={t('select.regionEmpty')}
        action={{ label: t('select.skipRegion'), to: '/home', icon: 'home' }}
      />
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
  const cityOnlyDefaultOpen = cityOnly.some((r) => r.id === regionId) || detailedGroups.length === 0
  const cityOnlyOpen =
    cityOnlyToggle && cityOnlyToggle.province === provinceId ? cityOnlyToggle.open : cityOnlyDefaultOpen

  const total = detailedGroups.reduce((n, g) => n + g.members.length, 0) + cityOnly.length

  // 라디오 묶음 하나(role=radiogroup): Tab으로 들어오면 고른 줄(없으면 보이는 첫 줄), ↑↓←→ / Home / End로 옮기며 고른다.
  const visible = [...detailedGroups.flatMap((g) => g.members), ...(cityOnlyOpen ? cityOnly : [])]
  const tabStop = visible.some((r) => r.id === regionId) ? regionId : (visible[0]?.id ?? null)

  const onRadioKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    const step: Record<string, number> = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }
    if (!(e.key in step) && e.key !== 'Home' && e.key !== 'End') return
    const group = e.currentTarget.closest('[role="radiogroup"]')
    // 접힌 묶음(<details> 닫힘) 안의 줄은 건너뛴다(보이는 줄만)
    const radios = Array.from(group?.querySelectorAll<HTMLButtonElement>('[role="radio"]') ?? []).filter(
      (el) => !el.closest('details:not([open])') && el.getClientRects().length > 0,
    )
    if (radios.length === 0) return
    e.preventDefault()
    const at = radios.indexOf(e.currentTarget)
    const n = radios.length
    const next =
      e.key === 'Home' ? 0 : e.key === 'End' ? n - 1 : (((at < 0 ? 0 : at) + step[e.key]) % n + n) % n
    const target = radios[next]
    target.focus()
    if (target.dataset.value) setRegionId(target.dataset.value)
  }

  const renderRegion = (region: Region) => (
    <li key={region.id}>
      <ChoiceRow
        semantics="radio"
        selected={regionId === region.id}
        data-value={region.id}
        tabIndex={region.id === tabStop ? 0 : -1}
        onClick={() => setRegionId(region.id)}
        onKeyDown={onRadioKeyDown}
      >
        {regionLabel(region.id, region.names, locale)}
      </ChoiceRow>
    </li>
  )

  const look = geoNotice ? (GEO_NOTICE_LOOK[geoNotice.key] ?? GEO_NOTICE_LOOK['select.geoNoRegion']) : null

  return (
    <div className="mt-3 flex flex-col gap-5">
      <div>
        <Button
          variant="secondary"
          fullWidth
          wrap
          icon="pin"
          onClick={() => void suggestNearest()}
          loading={locating}
          loadingLabel={t('select.geoLocating')}
        >
          {t('select.geoButton')}
        </Button>
        {/* 기다림은 상태를 보여 준다: 8초가 지나면 느린 안내 + 기다리지 않는 길. 평소에는 위치를 어디에도 보내지 않는다는 한 줄 */}
        <p role="status" aria-live="polite" className="mt-2 text-small text-ink-muted">
          {locating && locatingSlow ? `${t('state.slow')} ${t('select.geoWayOut')}` : t('select.geoPrivacy')}
        </p>
        {/* 찾기 결과: 상태 영역은 늘 붙어 있고 안의 글만 바뀐다(처음부터 채워진 채 붙은 영역은 화면 읽기가 자주 건너뜀) */}
        <div role="status" aria-live="polite">
          {noticeText && look ? (
            <p className="mt-2 flex items-start gap-2 rounded-xl bg-surface px-4 py-3 text-small text-ink-body">
              <Icon name={look.icon} size={20} className={cn('mt-px shrink-0', look.className)} />
              <span>{noticeText}</span>
            </p>
          ) : null}
        </div>
      </div>

      {provinces.length > 0 ? (
        <label className="flex flex-col gap-2">
          <span className="text-label text-ink">{t('select.province')}</span>
          <span className="relative block">
            <select
              value={provinceId ?? ''}
              onChange={(e) => {
                setProvinceChoice(e.target.value || null)
                setCityOnlyToggle(null)
              }}
              className="h-12 w-full appearance-none rounded-lg border border-line-input bg-white pl-4 pr-11 text-body text-ink transition-colors hover:bg-surface focus:border-nong-600"
            >
              <option value="">{t('select.provincePlaceholder')}</option>
              {provinces.map((p) => (
                <option key={p.id} value={p.id}>
                  {regionLabel(p.id, p.names, locale)}
                </option>
              ))}
            </select>
            <Icon
              name="chevron-down"
              size={20}
              className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-ink-muted"
            />
          </span>
        </label>
      ) : null}

      {provinces.length > 0 && !provinceId ? (
        <p className="flex items-start gap-2 rounded-xl border border-line px-4 py-3 text-small text-ink-body">
          <Icon name="info" size={20} className="mt-px shrink-0 text-ink-muted" />
          <span>{t('select.pickProvinceFirst')}</span>
        </p>
      ) : null}
      {provinceId && total === 0 ? (
        <EmptyState icon="pin" title={t('select.regionEmpty')} />
      ) : null}

      {total > 0 ? (
        <div role="radiogroup" aria-labelledby={labelledBy} className="flex flex-col gap-5">
          {detailedGroups.map((g) => (
            <div key={g.key} role="group" aria-labelledby={`${labelledBy}-${g.key}`}>
              <p id={`${labelledBy}-${g.key}`} className="mb-2 text-small font-bold text-ink-muted">
                {g.label}
              </p>
              <ul className="flex flex-col gap-2">{g.members.map(renderRegion)}</ul>
            </div>
          ))}
          {cityOnly.length > 0 ? (
            <details
              open={cityOnlyOpen}
              onToggle={(e) => {
                const open = e.currentTarget.open
                if (open !== cityOnlyOpen) setCityOnlyToggle({ province: provinceId, open })
              }}
              className="group"
            >
              <summary className="flex min-h-12 cursor-pointer list-none items-center gap-2 rounded-xl border border-line px-4 py-2 text-label text-ink transition-colors hover:bg-surface active:bg-surface-2 [&::-webkit-details-marker]:hidden">
                <span className="min-w-0 flex-1">
                  {t('select.regionCities')} ({cityOnly.length})
                </span>
                <Icon
                  name="chevron-down"
                  size={20}
                  className="shrink-0 text-ink-muted transition-transform group-open:rotate-180"
                />
              </summary>
              <ul className="mt-2 flex flex-col gap-2">{cityOnly.map(renderRegion)}</ul>
            </details>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
