import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useTranslation } from '../i18n/useTranslation'
import { useRegions, countyRegionIds } from '../hooks/useRegions'
import { useSelectedRegion } from '../context/SelectedRegionContext'
import { useLifeInfoList, type LifeInfo as LifeInfoRow } from '../hooks/useLifeInfo'
import { LIFE_INFO_CATEGORIES, categoryLabelKey } from '../lib/categories'
import { localizedContent } from '../lib/localizedContent'
import { regionLabel } from '../lib/regionName'
import { FreshnessBadge } from '../components/FreshnessBadge'
import { SafetyBanner } from '../components/SafetyBanner'
import { ShareButtons } from '../components/ShareButtons'
import { STALE_AFTER_MONTHS_SUPPORT } from '../lib/freshness'
import {
  CategoryGlyph,
  EmptyState,
  ErrorState,
  Icon,
  LoadingState,
  PillTabs,
  Skeleton,
  buttonClasses,
  cn,
} from '../components/ui'

const FILTERS = ['all', ...LIFE_INFO_CATEGORIES] as const

export function LifeInfo() {
  const { t, locale } = useTranslation()
  const {
    data: regions,
    isLoading: regionsLoading,
    isError: regionsError,
    refetch: refetchRegions,
    isFetching: regionsFetching,
    fetchStatus: regionsFetchStatus,
  } = useRegions()
  const { regionId } = useSelectedRegion()
  const scopeIds = countyRegionIds(regions ?? [], regionId)
  // 지역이 선택돼 있으면 regions 로드가 끝나 범위(scopeIds)가 확정된 뒤에만 조회한다.
  // (로딩 중 전체 범위로 선조회했다가 재조회하는 중복 요청·범위 오염 방지)
  const scopeReady = !regionId || regions !== undefined
  const { data: items, isLoading, isError, refetch, isFetching, fetchStatus } = useLifeInfoList(
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
  // 오프라인이면 첫 조회가 멈춘 채(paused) 기다린다: "정보 없음"이 아니라 "연결되면 불러와요"로 보여 준다
  const waitingNetwork =
    (fetchStatus === 'paused' && items === undefined) ||
    (Boolean(regionId) && regionsFetchStatus === 'paused' && regions === undefined)
  const loading = !showError && (regionsLoading || isLoading || !scopeReady || waitingNetwork)
  // 상담·도움 길(말하기 "힘들어요" 포함)에서는 안전 안내 바로 아래에 공식 도움 목록이 오도록 이웃 추천 칸을 숨긴다
  const helpPath = category === 'support' || fromTalk

  const options = FILTERS.map((c) => ({
    value: c as string,
    label: t(c === 'all' ? 'lifeInfo.category.all' : categoryLabelKey(c)),
    glyph: <CategoryGlyph category={c} size={20} />,
  }))

  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <h1 className="flex-1 text-title text-ink">{t('lifeInfo.title')}</h1>
        <Link to="/home" className={buttonClasses({ variant: 'secondary', size: 'sm', className: 'shrink-0' })}>
          <Icon name="map" size={18} />
          {t('lifeInfo.toMap')}
        </Link>
      </div>

      <PillTabs
        ariaLabel={t('map.filterLabel')}
        value={category}
        onChange={setCategory}
        options={options}
        className="mt-2"
      />

      {helpPath ? (
        <div className="mt-4">
          <SafetyBanner />
        </div>
      ) : null}

      {/* 공식 정보가 없는 지역에서도 갈 곳이 있게: 이웃이 쓴 우리 동네 추천(게시판, D-043).
          목록 위에 고정 — 목록이 늦게 와도 이 칸이 움직이지 않는다(v1.4 패턴). */}
      {helpPath ? null : (
        <Link
          to="/board?category=recommend"
          className="mt-4 flex min-h-16 items-center gap-3 rounded-xl border border-line bg-white px-4 py-3 text-ink no-underline hover:bg-surface active:bg-surface-2"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-surface text-da-600">
            <Icon name="pin" size={22} strokeWidth={2} />
          </span>
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="text-body font-bold text-ink">{t('lifeInfo.neighborTips')}</span>
            <span className="mt-0.5 text-small text-ink-muted">{t('lifeInfo.neighborTipsHint')}</span>
          </span>
          <Icon name="chevron" size={20} className="shrink-0 text-ink-muted" />
        </Link>
      )}

      <div className="mt-4">
        {loading ? (
          <LoadingState
            variant="inline"
            label={t('lifeInfo.loading')}
            offlineLabel={t('lifeInfo.waitingNetwork')}
          >
            <Skeleton variant="rows" lead="tile" count={5} className="mt-1" />
          </LoadingState>
        ) : showError ? (
          <ErrorState
            title={t('lifeInfo.error')}
            onRetry={retry}
            retrying={retrying}
            fallback={{ label: t('lifeInfo.toMap'), to: '/home' }}
          />
        ) : filtered.length === 0 ? (
          (items ?? []).length > 0 ? (
            <EmptyState
              icon="search"
              title={t('lifeInfo.emptyFiltered')}
              body={t('lifeInfo.emptyFilteredBody')}
              action={{ label: t('common.seeAll'), onClick: () => setCategory('all') }}
            />
          ) : (
            // v1.1(D-033): 등록 정보가 없는 지역은 오류가 아니라 빈 상태. 이웃 추천 칸이 위에 있으면 그 칸이 갈 곳이고,
            // 도움 길(칸을 숨김)에서는 게시판으로 가는 행동 하나를 단다.
            <EmptyState
              icon="search"
              title={t('lifeInfo.empty')}
              body={t('lifeInfo.emptyBody')}
              action={helpPath ? { label: t('lifeInfo.askBoard'), to: '/board', icon: 'message' } : undefined}
            />
          )
        ) : (
          <ul className="anim-fade">
            {filtered.map((item, i) => (
              <LifeInfoRowItem
                key={item.id}
                item={item}
                regionName={regionNameOf(item.region_id)}
                last={i === filtered.length - 1}
              />
            ))}
          </ul>
        )}
      </div>

      <ShareButtons className="mt-8 border-t border-line pt-6" />
    </section>
  )
}

/** 키트 4.7: 40px 그림 타일 + 이름(16 굵게) + 메타(13) + 화살표. 구분선은 글자 쪽에서 시작한다. */
function LifeInfoRowItem({
  item,
  regionName,
  last,
}: {
  item: LifeInfoRow
  regionName: string
  last: boolean
}) {
  const { t, locale } = useTranslation()
  const { name } = localizedContent(item.localized_content, locale)
  return (
    <li>
      <Link
        to={`/life-info/${item.id}`}
        className="flex min-h-16 items-center gap-3 text-ink no-underline active:bg-surface"
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-surface">
          <CategoryGlyph category={item.category} size={24} />
        </span>
        <span
          className={cn(
            'flex min-w-0 flex-1 items-center gap-2 self-stretch border-b',
            last ? 'border-transparent' : 'border-line',
          )}
        >
          <span className="flex min-w-0 flex-1 flex-col py-2.5">
            <span className="text-body font-bold text-ink">{name || t('lifeInfo.untitled')}</span>
            <span className="flex flex-wrap items-center gap-x-1.5 text-caption text-ink-muted">
              <span>
                {t(categoryLabelKey(item.category))}
                {regionName ? ` · ${regionName}` : ''}
              </span>
              <span aria-hidden="true">·</span>
              <FreshnessBadge
                verifiedAt={item.verified_at}
                staleAfterMonths={item.category === 'support' ? STALE_AFTER_MONTHS_SUPPORT : undefined}
              />
            </span>
          </span>
          <Icon name="chevron" size={20} className="text-ink-muted" />
        </span>
      </Link>
    </li>
  )
}
