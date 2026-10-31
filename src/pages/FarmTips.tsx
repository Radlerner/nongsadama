import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useSelectedRegion } from '../context/SelectedRegionContext'
import { useTranslation } from '../i18n/useTranslation'
import { useOwnProfile } from '../hooks/useOwnProfile'
import { useFarmTips } from '../hooks/useFarmTips'
import { useRegions, countyOf } from '../hooks/useRegions'
import { useRuralPrograms, useUserArea, useWeather } from '../hooks/useRegionalInfo'
import { localizedContent } from '../lib/localizedContent'
import { regionLabel } from '../lib/regionName'
import { norm } from '../lib/matching'
import { formatTemp, weatherIconName } from '../components/farm/weather'
import {
  Button,
  EmptyState,
  ErrorState,
  Icon,
  LoadingState,
  SectionHeader,
  Skeleton,
  SkeletonBlock,
  buttonClasses,
  cn,
  useOnline,
  useSlow,
} from '../components/ui'

/** 카드 껍데기(키트: 흰 바탕 + 1px 선 + 12px 모서리, 그림자 없음) + 제목 줄. */
function InfoCard({ id, icon, title, aside, children }: {
  id: string
  icon: 'thermometer' | 'school'
  title: string
  aside?: string
  children: ReactNode
}) {
  return (
    <section aria-labelledby={id} className="rounded-xl border border-line bg-white px-4 py-3.5">
      {/* 아이콘은 첫 줄에 붙이고, 긴 번역은 글자 쪽에서만 줄을 바꾼다(아이콘만 따로 남지 않게) */}
      <h2 id={id} className="flex items-start gap-2 text-label text-ink">
        <Icon name={icon} size={20} strokeWidth={2} className="shrink-0 text-ink-body" />
        <span className="min-w-0">
          {title}
          {aside ? <span className="ml-1.5 font-normal text-ink-muted">{aside}</span> : null}
        </span>
      </h2>
      {children}
    </section>
  )
}

/** 카드 속 실패 한 줄 + 다시 시도(키트 4.15를 카드 안 크기로). */
function CardError({ title, onRetry, retrying }: { title: string; onRetry: () => void; retrying: boolean }) {
  const { t } = useTranslation()
  const online = useOnline()
  return (
    <div aria-live="polite" className="mt-2">
      <div role="alert" className="flex items-start gap-2">
        <Icon name="alert" size={20} className="mt-px text-danger" />
        <p className="min-w-0 flex-1">
          <span className="block text-body font-bold text-ink">{title}</span>
          <span className="block text-small text-ink-muted">{online ? t('state.errorBody') : t('common.offline')}</span>
        </p>
      </div>
      <Button
        variant="secondary"
        size="sm"
        icon="refresh"
        className="mt-3"
        onClick={onRetry}
        loading={retrying}
        loadingLabel={t('state.retrying')}
      >
        {t('common.retry')}
      </Button>
    </div>
  )
}

/** 첫 조회 중(오프라인이면 멈춤 = 'paused')인가. enabled=false(idle)는 기다림이 아니다. */
function firstLoad(q: { data: unknown; isError: boolean; fetchStatus: string }): boolean {
  return q.data === undefined && !q.isError && q.fetchStatus !== 'idle'
}

/**
 * 위치 기반 정보 묶음: 오늘 날씨 + 우리 지역 교육·사업(농진청 실데이터, PRD v1.7 항목1·2·3).
 * 기본은 선택 지역(읍·면 또는 시·군·구), "내 위치 정보 보기"로 전국 어디서든 자기 지역 정보(항목1, 좌표는 0.1°로만 전송·저장 없음).
 * 지역이 없으면 안내, 지역이 있는데 둘 다 없으면 빈 상태(정적 폴백 없음, D-036). 각 카드는 제 기다림·실패를 보인다(디자인 v5).
 */
function RegionalInfo() {
  const { t, locale } = useTranslation()
  const { regionId } = useSelectedRegion()
  const { data: regions, isError: regionsError, refetch: refetchRegions, isFetching: regionsFetching } = useRegions()
  const { area, useMyLocation, locating, geoError } = useUserArea()
  const weatherQ = useWeather(area?.lat, area?.lon)
  const programsQ = useRuralPrograms(area?.sido ?? null, area?.sigungu ?? null)
  const [showAllPrograms, setShowAllPrograms] = useState(false)
  const locateSlow = useSlow(locating)

  const weather = weatherQ.data
  const programs = programsQ.data
  const weatherLoading = firstLoad(weatherQ)
  const programsLoading = firstLoad(programsQ)
  const weatherFailed = weatherQ.isError && weather === undefined
  const programsFailed = programsQ.isError && programs === undefined
  const hasPrograms = Boolean(programs && programs.items.length > 0)
  // v1.2(D-036): 정적 팁이 사라졌으므로 이 묶음이 화면의 본문이다. 지역이 없으면 안내, 있는데 둘 다 없으면 빈 상태.
  const showNoData =
    Boolean(area) &&
    !weatherLoading &&
    !programsLoading &&
    !weatherFailed &&
    !programsFailed &&
    !weather &&
    !hasPrograms

  // 어느 지역 기준인지: 선택 지역 이름(표시 언어) 또는 '내 위치'(+ 지오코더가 찾은 시·군)
  const selected = regionId ? regions?.find((r) => r.id === regionId) : undefined
  const county = regions ? countyOf(regions, selected) : null
  const areaLabel = !area
    ? ''
    : area.source === 'geo'
      ? `${t('map.locate')}${area.sigungu ? ` · ${area.sigungu}` : weather?.name ? ` · ${weather.name}` : ''}`
      : selected
        ? regionLabel(selected.id, selected.names, locale)
        : ''
  const programsArea =
    area?.source === 'geo' ? area.sigungu ?? '' : county ? regionLabel(county.id, county.names, locale) : ''
  // 지역은 골랐는데 지역 목록이 아직 없거나 실패: '지역을 골라 주세요'로 오표시하지 않는다
  const regionsPending = Boolean(regionId) && regions === undefined && !area

  return (
    <div className="mt-4 flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        {areaLabel ? (
          <p className="flex min-w-0 items-center gap-1.5 text-small font-bold text-ink">
            <Icon name="pin" size={18} strokeWidth={2} className="shrink-0 text-nong-600" />
            <span className="min-w-0 truncate">{areaLabel}</span>
          </p>
        ) : (
          <span aria-hidden="true" />
        )}
        <Button
          variant="secondary"
          size="sm"
          icon="navigate"
          wrap
          onClick={() => void useMyLocation()}
          loading={locating}
          loadingLabel={t('map.locating')}
        >
          {t('farm.useMyLocation')}
        </Button>
      </div>

      {locating && locateSlow ? (
        <p role="status" className="text-small text-ink-muted">
          {t('map.locateSlow')}{' '}
          <Link to="/select" className="font-bold text-nong-600 underline underline-offset-2">
            {t('map.chooseRegionManually')}
          </Link>
        </p>
      ) : null}

      {geoError ? (
        <div role="alert" className="flex items-start gap-2 rounded-xl border border-line px-4 py-3">
          <Icon name="alert" size={20} className="mt-px text-danger" />
          <div className="min-w-0 flex-1">
            <p className="text-body font-bold text-ink">{t('map.geoErrorTitle')}</p>
            <p className="text-small text-ink-muted">{t('map.geoError')}</p>
            <Link to="/select" className={buttonClasses({ variant: 'ghost', size: 'sm', className: '-ml-3 mt-1' })}>
              <Icon name="pin" size={18} />
              {t('map.chooseRegionManually')}
            </Link>
          </div>
        </div>
      ) : null}

      {/* 지오코더 실패로 시군을 못 얻으면 사업 카드가 사라지는 이유를 알려준다(재검수 P2-3) */}
      {area?.source === 'geo' && !area.sigungu && weather ? (
        <p className="flex items-start gap-1.5 text-small text-ink-muted">
          <Icon name="info" size={18} className="mt-px shrink-0" />
          {t('farm.regionUnknown')}
        </p>
      ) : null}

      {regionsPending ? (
        regionsError ? (
          <ErrorState
            title={t('farm.noRegionalData')}
            onRetry={() => void refetchRegions()}
            retrying={regionsFetching}
          />
        ) : (
          <LoadingState variant="inline" label={t('farm.weatherLoading')}>
            <SkeletonBlock className="mt-2 h-28 w-full rounded-xl" />
          </LoadingState>
        )
      ) : !area ? (
        <EmptyState
          icon="pin"
          title={t('farm.pickRegionTitle')}
          body={t('farm.pickRegionHint')}
          action={{ label: t('map.chooseRegion'), to: '/select', icon: 'pin', primary: true }}
        />
      ) : null}

      {showNoData ? (
        <EmptyState
          icon="info"
          title={t('farm.noRegionalData')}
          action={{ label: t('map.changeRegion'), to: '/select', icon: 'pin' }}
        />
      ) : null}

      {area && (weatherLoading || weatherFailed || weather) ? (
        <InfoCard id="farm-weather" icon="thermometer" title={t('farm.weatherTitle')}>
          {weatherLoading ? (
            <LoadingState variant="inline" label={t('farm.weatherLoading')} className="mt-1">
              <div className="flex items-center gap-3 pt-1">
                <SkeletonBlock className="h-11 w-11 rounded-full" />
                <span className="flex-1">
                  <SkeletonBlock className="h-6 w-20 rounded-full" />
                  <SkeletonBlock className="mt-2 h-3 w-40 rounded-full" />
                </span>
              </div>
            </LoadingState>
          ) : weatherFailed ? (
            <CardError
              title={t('farm.weatherError')}
              onRetry={() => void weatherQ.refetch()}
              retrying={weatherQ.isFetching}
            />
          ) : weather ? (
            <div className="mt-2 flex items-center gap-3">
              <Icon name={weatherIconName(weather.icon)} size={44} strokeWidth={1.75} className="text-ink-body" />
              <div className="min-w-0">
                <p className="text-hero text-ink">{formatTemp(weather.tempC)}</p>
                <p className="text-small text-ink-muted">
                  {t('farm.weatherFeels')} {formatTemp(weather.feelsC)} · {t('farm.weatherHumidity')}{' '}
                  {weather.humidity != null ? `${weather.humidity}%` : '—'}
                </p>
              </div>
            </div>
          ) : null}
        </InfoCard>
      ) : null}

      {area && (programsLoading || programsFailed || hasPrograms) ? (
        <InfoCard
          id="farm-programs"
          icon="school"
          title={`${t('farm.programsTitle')}${programsArea ? ` · ${programsArea}` : ''}`}
          aside={hasPrograms && programs ? `(${programs.total}${t('farm.programsCount')})` : undefined}
        >
          {programsLoading ? (
            <LoadingState variant="inline" label={t('farm.programsLoading')} className="mt-1">
              <Skeleton variant="lines" count={3} className="mt-2" />
            </LoadingState>
          ) : programsFailed ? (
            <CardError
              title={t('farm.programsError')}
              onRetry={() => void programsQ.refetch()}
              retrying={programsQ.isFetching}
            />
          ) : programs ? (
            <>
              <ul id="farm-programs-list" className="mt-1">
                {(showAllPrograms ? programs.items : programs.items.slice(0, 3)).map((p) => (
                  <li key={p.id} className="border-b border-line py-2.5 last:border-b-0">
                    <p className="text-body text-ink">{p.name.trim()}</p>
                    {p.category ? <p className="text-caption text-ink-muted">{p.category}</p> : null}
                  </li>
                ))}
              </ul>
              {programs.items.length > 3 ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className="-ml-3"
                  aria-expanded={showAllPrograms}
                  aria-controls="farm-programs-list"
                  onClick={() => setShowAllPrograms((v) => !v)}
                >
                  <Icon name={showAllPrograms ? 'collapse' : 'chevron-down'} size={18} strokeWidth={2} />
                  {showAllPrograms ? t('farm.programsLess') : t('farm.programsMore')}
                </Button>
              ) : null}
              <p className="mt-1 text-caption text-ink-muted">{t('farm.programsSource')}</p>
            </>
          ) : null}
        </InfoCard>
      ) : null}
    </div>
  )
}

/**
 * 🌾 농사 도움(PRD v1.7 §1·§2, v1.2 D-036) — 비로그인 열람.
 * v1.2부터 본문은 API 실데이터(날씨·농촌지도사업)이고, 정적 상식 팁은 비공개 처리됐다.
 * 팁 목록은 실데이터(농사로 OpenAPI 연동 후)가 생길 때만 렌더되며, 그때 내 작목 팁이 맨 위(훅에서 정렬).
 * 항상 비어 있을 목록에 로딩·오류·빈 상태 칸을 따로 두지 않는다(기다림·실패는 위 날씨·사업 카드가 보인다).
 */
export function FarmTips() {
  const { t, locale } = useTranslation()
  const { user } = useAuth()
  const { data: profile } = useOwnProfile(user?.id)
  const myCrop = profile?.crop_type ?? null
  const { data: tips } = useFarmTips(myCrop)

  return (
    <section>
      <h1 className="text-title text-ink">{t('farm.title')}</h1>
      <p className="mt-0.5 text-small text-ink-muted">{t('farm.subtitle')}</p>

      <RegionalInfo />

      {(tips ?? []).length > 0 ? (
        <div className="mt-8">
          <SectionHeader title={t('farm.tipsTitle')} />
          <ul>
            {(tips ?? []).map((tip, i, all) => {
              const c = localizedContent(tip.localized_content, locale)
              const isMine = Boolean(myCrop && norm(tip.crop_type) === norm(myCrop) && norm(myCrop) !== '')
              const last = i === all.length - 1
              return (
                <li key={tip.id}>
                  <Link
                    to={`/farm/${tip.id}`}
                    className="flex min-h-16 items-center gap-3 text-ink no-underline active:bg-surface"
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-surface text-nong-600">
                      <Icon name="sprout" size={22} strokeWidth={2} />
                    </span>
                    <span
                      className={cn(
                        'flex min-w-0 flex-1 items-center gap-2 self-stretch border-b',
                        last ? 'border-transparent' : 'border-line',
                      )}
                    >
                      <span className="flex min-w-0 flex-1 flex-col py-2.5">
                        <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                          <span className="min-w-0 text-body font-bold text-ink">{c.name}</span>
                          {isMine ? (
                            <span className="rounded-full bg-nong-50 px-2 text-caption font-bold leading-6 text-nong-700">
                              {t('farm.myCrop')}
                            </span>
                          ) : tip.crop_type ? (
                            <span className="rounded-full bg-surface px-2 text-caption leading-6 text-ink-body">
                              {tip.crop_type}
                            </span>
                          ) : null}
                        </span>
                        {c.description ? (
                          <span className="line-clamp-2 text-small text-ink-muted">{c.description}</span>
                        ) : null}
                      </span>
                      <Icon name="chevron" size={20} className="shrink-0 text-ink-muted" />
                    </span>
                  </Link>
                </li>
              )
            })}
          </ul>
        </div>
      ) : null}
    </section>
  )
}
