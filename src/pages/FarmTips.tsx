import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useTranslation } from '../i18n/useTranslation'
import { useOwnProfile } from '../hooks/useOwnProfile'
import { useFarmTips } from '../hooks/useFarmTips'
import { localizedContent } from '../lib/localizedContent'
import { norm } from '../lib/matching'
import { Card, CardLink } from '../components/ui/Card'
import { EmptyBox } from '../components/ui/StateBoxes'
import { useRuralPrograms, useUserArea, useWeather } from '../hooks/useRegionalInfo'
import { MapPin, School, Sprout, Thermometer, WEATHER_ICONS } from '../components/ui/icons'

/**
 * 🌾 농사 도움(PRD v1.7 §1·§2, v1.2 D-036) — 비로그인 열람.
 * v1.2부터 본문은 API 실데이터(날씨·농촌지도사업)이고, 정적 상식 팁은 비공개 처리됐다.
 * 팁 목록은 실데이터(농사로 OpenAPI 연동 후)가 생길 때만 렌더되며, 그때 내 작목 팁이 맨 위(훅에서 정렬).
 */
/**
 * 위치 기반 정보 묶음: ☀️ 오늘 날씨 + 🏫 우리 지역 교육·사업(농진청 실데이터).
 * 기본은 선택 지역(읍·면 또는 시·군·구), "내 위치"로 전국 어디서든 자기 지역 정보(항목1).
 * 지역이 없으면 안내, 지역이 있는데 둘 다 없거나 실패하면 빈 상태(정적 폴백 없음, D-036).
 */
function RegionalInfo() {
  const { t } = useTranslation()
  const { area, useMyLocation, locating, geoError } = useUserArea()
  const { data: weather, isLoading: weatherLoading } = useWeather(area?.lat, area?.lon)
  const { data: programs, isLoading: programsLoading } = useRuralPrograms(
    area?.sido ?? null,
    area?.sigungu ?? null,
  )
  const [showAllPrograms, setShowAllPrograms] = useState(false)
  const hasPrograms = Boolean(programs && programs.items.length > 0)
  // v1.2(D-036): 정적 팁이 사라졌으므로 이 묶음이 화면의 본문이다. 지역이 없으면 안내, 있는데 둘 다 없으면 빈 상태.
  const showNoData = Boolean(area) && !weatherLoading && !programsLoading && !weather && !hasPrograms

  return (
    <div className="mb-4 flex flex-col gap-2">
      <button
        type="button"
        onClick={() => void useMyLocation()}
        disabled={locating}
        className="min-h-[44px] self-start rounded-full border border-green-300 bg-green-50 px-4 text-sm font-semibold text-green-800 disabled:opacity-50"
      >
        <MapPin aria-hidden size={18} strokeWidth={2.25} className="mr-1 inline align-[-3px]" />
        {locating ? t('select.geoLocating') : t('farm.useMyLocation')}
      </button>
      {geoError ? <p className="text-xs text-red-700">{t('map.geoError')}</p> : null}
      {/* 지오코더 실패로 시군을 못 얻으면 사업 카드가 사라지는 이유를 알려준다(재검수 P2-3) */}
      {area?.source === 'geo' && !area.sigungu && weather ? (
        <p className="text-xs text-gray-500">{t('farm.regionUnknown')}</p>
      ) : null}
      {!area ? <EmptyBox text={t('farm.pickRegionHint')} /> : null}
      {showNoData ? <EmptyBox text={t('farm.noRegionalData')} /> : null}

      {weather && area ? (
        <Card className="px-4 py-3">
          <p className="text-xs font-semibold text-gray-500">
            {t('farm.weatherTitle')}
            {area.sigungu ? ` · ${area.sigungu}` : weather.name ? ` · ${weather.name}` : ''}
          </p>
          <div className="mt-1 flex items-center gap-3">
            {(() => {
              const W = WEATHER_ICONS[weather.icon?.slice(0, 2) ?? ''] ?? Thermometer
              return <W aria-hidden size={44} strokeWidth={1.75} className="text-sky-600" />
            })()}
            <div>
              <p className="text-3xl font-extrabold tracking-tight text-gray-900">
                {weather.tempC != null ? `${weather.tempC}°` : '—'}
              </p>
              <p className="text-xs text-gray-500">
                {t('farm.weatherFeels')} {weather.feelsC != null ? `${weather.feelsC}°` : '—'} ·{' '}
                {t('farm.weatherHumidity')} {weather.humidity != null ? `${weather.humidity}%` : '—'}
              </p>
            </div>
          </div>
        </Card>
      ) : null}

      {hasPrograms && programs ? (
        <Card className="px-4 py-3">
          <p className="text-xs font-semibold text-gray-500">
            <School aria-hidden size={14} strokeWidth={2.25} className="mr-1 inline align-[-2px]" />
            {t('farm.programsTitle')}
            {area?.sigungu ? ` · ${area.sigungu}` : ''}
            <span className="ml-1 font-normal text-gray-400">
              ({programs.total}{t('farm.programsCount')})
            </span>
          </p>
          <ul className="mt-2 flex flex-col gap-1">
            {(showAllPrograms ? programs.items : programs.items.slice(0, 3)).map((p) => (
              <li key={p.id} className="text-sm text-gray-800">
                <span className="font-medium">{p.name.trim()}</span>
                <span className="ml-1 text-[11px] text-gray-400">{p.category}</span>
              </li>
            ))}
          </ul>
          {programs.items.length > 3 ? (
            <button
              type="button"
              onClick={() => setShowAllPrograms((v) => !v)}
              className="mt-2 min-h-[44px] text-xs font-semibold text-green-700 underline"
            >
              {showAllPrograms ? t('farm.programsLess') : t('farm.programsMore')}
            </button>
          ) : null}
          <p className="mt-1 text-[11px] text-gray-400">{t('farm.programsSource')}</p>
        </Card>
      ) : null}
    </div>
  )
}

export function FarmTips() {
  const { t, locale } = useTranslation()
  const { user } = useAuth()
  const { data: profile } = useOwnProfile(user?.id)
  const myCrop = profile?.crop_type ?? null
  // v1.2(D-036): 정적 상식 팁은 비공개 처리됐다. 실데이터(농사로 API 연동 후)가 생길 때만 목록을 그린다 —
  // 항상 비어 있을 목록에 로딩·오류·빈 상태 박스를 따로 두지 않는다(본문은 위 RegionalInfo).
  const { data: tips } = useFarmTips(myCrop)

  return (
    <section>
      <h1 className="mb-1 flex items-center gap-2 text-xl font-extrabold tracking-tight">
        <Sprout aria-hidden size={22} strokeWidth={2.25} className="text-green-800" />
        {t('farm.title')}
      </h1>
      <p className="mb-4 text-xs text-gray-500">{t('farm.subtitle')}</p>

      {/* 위치 기반 실시간 정보(PRD v1.7 항목1·2·3) — 비로그인, 전국 대응 */}
      <RegionalInfo />


      {(tips ?? []).length > 0 ? (
        <ul className="flex flex-col gap-2">
          {(tips ?? []).map((tip) => {
            const c = localizedContent(tip.localized_content, locale)
            const isMine = Boolean(
              myCrop && norm(tip.crop_type) === norm(myCrop) && norm(myCrop) !== '',
            )
            return (
              <li key={tip.id}>
                <CardLink to={`/farm/${tip.id}`} className="px-4 py-3">
                  <p className="flex items-center gap-2 font-semibold text-gray-900">
                    <span className="flex-1">{c.name}</span>
                    {isMine ? (
                      <span className="rounded-full bg-brand-greenDark px-2 py-0.5 text-[11px] font-semibold text-white">
                        {t('farm.myCrop')}
                      </span>
                    ) : tip.crop_type ? (
                      <span className="rounded-full bg-green-50 px-2 py-0.5 text-[11px] font-medium text-green-800">
                        {tip.crop_type}
                      </span>
                    ) : null}
                  </p>
                  <p className="mt-1 line-clamp-2 text-xs text-gray-500">{c.description}</p>
                </CardLink>
              </li>
            )
          })}
        </ul>
      ) : null}
    </section>
  )
}
