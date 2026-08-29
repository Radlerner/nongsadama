import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useTranslation } from '../i18n/useTranslation'
import { useRegions, countyRegionIds } from '../hooks/useRegions'
import { useSelectedRegion } from '../context/SelectedRegionContext'
import { useLifeInfoList, type LifeInfo as LifeInfoRow } from '../hooks/useLifeInfo'
import {
  LIFE_INFO_CATEGORIES,
  LIFE_INFO_CATEGORY_ICONS,
  categoryLabelKey,
} from '../lib/categories'
import { localizedContent } from '../lib/localizedContent'
import { regionLabel } from '../lib/regionName'
import { FreshnessBadge } from '../components/FreshnessBadge'
import { SafetyBanner } from '../components/SafetyBanner'
import { STALE_AFTER_MONTHS_SUPPORT } from '../lib/freshness'
import { CardLink } from '../components/ui/Card'
import { EmptyBox, ErrorBox, LoadingBox } from '../components/ui/StateBoxes'

const FILTERS = ['all', ...LIFE_INFO_CATEGORIES] as const

export function LifeInfo() {
  const { t, locale } = useTranslation()
  const {
    data: regions,
    isLoading: regionsLoading,
    isError: regionsError,
    refetch: refetchRegions,
    isFetching: regionsFetching,
  } = useRegions()
  const { regionId } = useSelectedRegion()
  const scopeIds = countyRegionIds(regions ?? [], regionId)
  // 지역이 선택돼 있으면 regions 로드가 끝나 범위(scopeIds)가 확정된 뒤에만 조회한다.
  // (로딩 중 전체 범위로 선조회했다가 재조회하는 중복 요청·범위 오염 방지)
  const scopeReady = !regionId || regions !== undefined
  const { data: items, isLoading, isError, refetch, isFetching } = useLifeInfoList(
    scopeIds,
    scopeReady,
  )
  // 라우터(🎤)에서 ?category=support / ?from=talk 로 진입할 수 있다(PRD v1.5 §3.1 ②③).
  const [searchParams] = useSearchParams()
  // §3.2-1: 라우터 경유(②) 진입 시엔 카테고리와 무관하게 도움 배너를 보인다(오분류 대비).
  const fromTalk = searchParams.get('from') === 'talk'
  const initialCategory = searchParams.get('category')
  const [category, setCategory] = useState<string>(
    initialCategory && (LIFE_INFO_CATEGORIES as readonly string[]).includes(initialCategory)
      ? initialCategory
      : 'all',
  )

  const regionNameOf = (id: string) => {
    const r = (regions ?? []).find((x) => x.id === id)
    return r ? regionLabel(r.id, r.names, locale) : ''
  }

  const filtered = (items ?? []).filter((i) => category === 'all' || i.category === category)
  // 지역 범위 계산에 regions가 필요한 경우 그 실패도 오류로 다룬다(조용한 전체 폴백 방지).
  const showError = (Boolean(regionId) && regionsError) || isError
  const retrying = regionsFetching || isFetching
  const retry = () => {
    if (regionsError) void refetchRegions()
    if (isError) void refetch()
  }
  const loading = !showError && (regionsLoading || isLoading || !scopeReady)

  return (
    <section>
      <h1 className="mb-4 text-xl font-extrabold tracking-tight">{t('lifeInfo.title')}</h1>

      <div className="mb-4 flex flex-wrap gap-2">
        {FILTERS.map((c) => {
          const active = category === c
          return (
            <button
              key={c}
              type="button"
              onClick={() => setCategory(c)}
              aria-pressed={active}
              className={[
                'inline-flex min-h-[44px] items-center rounded-full border px-4 text-sm',
                active
                  ? 'border-green-700 bg-brand-greenDark font-semibold text-white'
                  : 'border-gray-300 bg-white text-gray-700',
              ].join(' ')}
            >
              {c === 'all' ? t('lifeInfo.category.all') : (
                <>
                  <span aria-hidden className="mr-1">{LIFE_INFO_CATEGORY_ICONS[c] ?? ''}</span>
                  {t(categoryLabelKey(c))}
                </>
              )}
            </button>
          )
        })}
      </div>

      {category === 'support' || fromTalk ? (
        <div className="mb-4">
          <SafetyBanner />
        </div>
      ) : null}

      {loading ? (
        <LoadingBox text={t('lifeInfo.loading')} />
      ) : showError ? (
        <ErrorBox
          text={t('lifeInfo.error')}
          retryLabel={t('common.retry')}
          onRetry={retry}
          retrying={retrying}
        />
      ) : filtered.length === 0 ? (
        <EmptyBox text={(items ?? []).length > 0 ? t('lifeInfo.emptyFiltered') : t('lifeInfo.empty')} />
      ) : (
        <ul className="flex flex-col gap-2">
          {filtered.map((item) => (
            <LifeInfoCard
              key={item.id}
              item={item}
              regionName={regionNameOf(item.region_id)}
            />
          ))}
        </ul>
      )}
    </section>
  )
}

function LifeInfoCard({ item, regionName }: { item: LifeInfoRow; regionName: string }) {
  const { t, locale } = useTranslation()
  const { name } = localizedContent(item.localized_content, locale)
  return (
    <li>
      <CardLink to={`/life-info/${item.id}`} className="px-4 py-3">
        <p className="font-semibold text-gray-900">{name || t('lifeInfo.untitled')}</p>
        <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-gray-500">
          <span>
            {t(categoryLabelKey(item.category))}
            {regionName ? ` · ${regionName}` : ''}
          </span>
          <FreshnessBadge
            verifiedAt={item.verified_at}
            staleAfterMonths={item.category === 'support' ? STALE_AFTER_MONTHS_SUPPORT : undefined}
          />
        </p>
      </CardLink>
    </li>
  )
}
