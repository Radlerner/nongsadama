import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useTranslation } from '../i18n/useTranslation'
import { useOwnProfile } from '../hooks/useOwnProfile'
import { useFarmTips } from '../hooks/useFarmTips'
import { localizedContent } from '../lib/localizedContent'
import { norm } from '../lib/matching'
import { Card, CardLink } from '../components/ui/Card'
import { EmptyBox, ErrorBox, LoadingBox } from '../components/ui/StateBoxes'
import { useRuralPrograms, useUserArea, useWeather } from '../hooks/useRegionalInfo'

/**
 * 🌾 농사 도움 목록(PRD v1.7 §1·§2) — 비로그인 열람.
 * 로그인+작목 설정 시 내 작목 팁이 맨 위(훅에서 정렬).
 */
/**
 * 위치 기반 정보 묶음: ☀️ 오늘 날씨 + 🏫 우리 지역 교육·사업(농진청 실데이터).
 * 기본은 선택 지역(파일럿), "내 위치"로 전국 어디서든 자기 지역 정보(항목1).
 * 데이터 없음/실패 시 각 카드 숨김(부가 정보 — 핵심 흐름 비차단).
 */
function RegionalInfo() {
  const { t } = useTranslation()
  const { area, useMyLocation, locating, geoError } = useUserArea()
  const { data: weather } = useWeather(area?.lat, area?.lon)
  const { data: programs } = useRuralPrograms(area?.sido ?? null, area?.sigungu ?? null)
  const [showAllPrograms, setShowAllPrograms] = useState(false)

  return (
    <div className="mb-4 flex flex-col gap-2">
      <button
        type="button"
        onClick={() => void useMyLocation()}
        disabled={locating}
        className="min-h-[44px] self-start rounded-full border border-green-300 bg-green-50 px-4 text-sm font-semibold text-green-800 disabled:opacity-50"
      >
        📍 {locating ? t('select.geoLocating') : t('farm.useMyLocation')}
      </button>
      {geoError ? <p className="text-xs text-red-700">{t('map.geoError')}</p> : null}
      {/* 지오코더 실패로 시군을 못 얻으면 사업 카드가 사라지는 이유를 알려준다(재검수 P2-3) */}
      {area?.source === 'geo' && !area.sigungu ? (
        <p className="text-xs text-gray-500">{t('farm.regionUnknown')}</p>
      ) : null}

      {weather && area ? (
        <Card className="px-4 py-3">
          <p className="text-xs font-semibold text-gray-500">
            ☀️ {t('farm.weatherTitle')}
            {area.sigungu ? ` · ${area.sigungu}` : weather.name ? ` · ${weather.name}` : ''}
          </p>
          <p className="mt-1 text-2xl font-bold text-gray-900">
            {weather.tempC != null ? `${weather.tempC}°C` : '—'}
            <span className="ml-2 text-sm font-normal text-gray-600">
              {weather.desc ?? ''}
            </span>
          </p>
          <p className="mt-0.5 text-xs text-gray-500">
            {t('farm.weatherFeels')} {weather.feelsC != null ? `${weather.feelsC}°C` : '—'} ·{' '}
            {t('farm.weatherHumidity')} {weather.humidity != null ? `${weather.humidity}%` : '—'}
          </p>
        </Card>
      ) : null}

      {programs && programs.items.length > 0 ? (
        <Card className="px-4 py-3">
          <p className="text-xs font-semibold text-gray-500">
            🏫 {t('farm.programsTitle')}
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
  const { data: tips, isLoading, isError, refetch, isFetching } = useFarmTips(myCrop)

  return (
    <section>
      <h1 className="mb-1 text-lg font-bold">🌾 {t('farm.title')}</h1>
      <p className="mb-4 text-xs text-gray-500">{t('farm.subtitle')}</p>

      {/* 위치 기반 실시간 정보(PRD v1.7 항목1·2·3) — 비로그인, 전국 대응 */}
      <RegionalInfo />


      {isLoading ? (
        <LoadingBox text={t('farm.loading')} />
      ) : isError ? (
        <ErrorBox
          text={t('farm.error')}
          retryLabel={t('common.retry')}
          onRetry={() => void refetch()}
          retrying={isFetching}
        />
      ) : (tips ?? []).length === 0 ? (
        <EmptyBox text={t('farm.empty')} />
      ) : (
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
      )}
    </section>
  )
}
