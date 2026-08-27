import { Link, useSearchParams } from 'react-router-dom'
import { useTranslation } from '../i18n/useTranslation'
import { useAuth } from '../context/AuthContext'
import { useRegions, countyRegionIds } from '../hooks/useRegions'
import { useSelectedRegion } from '../context/SelectedRegionContext'
import { useBoardPosts, postCategoryLabelKey, type PostWithAuthor } from '../hooks/usePosts'
import { useBlockedIds } from '../hooks/useModeration'
import { regionLabel } from '../lib/regionName'
import { regionDistanceKm } from '../lib/matching'
import type { Tables } from '../types/database'

type Region = Tables<'regions'>

export function Board() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const {
    data: regions,
    isLoading: regionsLoading,
    isError: regionsError,
    refetch: refetchRegions,
    isFetching: regionsFetching,
  } = useRegions()
  const { regionId } = useSelectedRegion()
  const [searchParams] = useSearchParams()
  // 이웃 목록에서 진입한 "이 작성자의 글만 보기" 모드(PRD v1.4 §2.1)
  const authorId = searchParams.get('author')
  const scopeIds = countyRegionIds(regions ?? [], regionId)
  const scopeReady = Boolean(authorId) || !regionId || regions !== undefined
  const { data: rawPosts, isLoading, isError, refetch, isFetching } = useBoardPosts(
    scopeIds,
    scopeReady,
    authorId,
  )
  // 차단한 사용자의 글 숨김(Play UGC 정책, D-022) — 차단 목록은 본인 것만 RLS로 조회됨
  const { data: blockedIds } = useBlockedIds(user?.id)
  const posts = blockedIds
    ? (rawPosts ?? []).filter((p) => !blockedIds.has(p.author_id))
    : rawPosts

  const regionsById = new Map((regions ?? []).map((r) => [r.id, r]))
  const showError = (Boolean(regionId) && regionsError) || isError
  const retrying = regionsFetching || isFetching
  const retry = () => {
    if (regionsError) void refetchRegions()
    if (isError) void refetch()
  }
  const loading = !showError && (regionsLoading || isLoading || !scopeReady)

  return (
    <section>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-lg font-bold">{t('board.title')}</h1>
        <Link
          to={user ? '/board/new' : '/login'}
          className="inline-flex min-h-[44px] items-center rounded-md bg-green-700 px-4 text-sm font-semibold text-white"
        >
          {t('board.write')}
        </Link>
      </div>

      {authorId ? (
        <p className="mb-3 flex items-center justify-between rounded-md bg-green-50 px-3 py-2 text-xs text-green-800">
          <span>
            {t('board.authorFilter')}
            {(posts ?? [])[0]?.authorNickname ? `: ${(posts ?? [])[0]?.authorNickname}` : ''}
          </span>
          <Link to="/board" className="min-h-[32px] font-semibold underline">
            {t('board.authorFilterClear')}
          </Link>
        </p>
      ) : null}

      {loading ? (
        <p className="rounded-md bg-gray-50 px-4 py-8 text-center text-sm text-gray-500">
          {t('board.loading')}
        </p>
      ) : showError ? (
        <div className="rounded-md bg-red-50 px-4 py-8 text-center text-sm text-red-700">
          <p className="mb-3">{t('board.error')}</p>
          <button
            type="button"
            onClick={retry}
            disabled={retrying}
            className="min-h-[44px] rounded-md border border-red-300 px-4 text-red-700 disabled:opacity-50"
          >
            {t('common.retry')}
          </button>
        </div>
      ) : (posts ?? []).length === 0 ? (
        <p className="rounded-md bg-gray-50 px-4 py-8 text-center text-sm text-gray-500">
          {t('board.empty')}
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {(posts ?? []).map((post) => (
            <PostCard
              key={post.id}
              post={post}
              regionsById={regionsById}
              viewerRegionId={regionId}
            />
          ))}
        </ul>
      )}
    </section>
  )
}

function PostCard({
  post,
  regionsById,
  viewerRegionId,
}: {
  post: PostWithAuthor
  regionsById: Map<string, Region>
  viewerRegionId: string | null
}) {
  const { t, locale } = useTranslation()
  const region = regionsById.get(post.region_id)
  const viewerRegion = viewerRegionId ? regionsById.get(viewerRegionId) : undefined
  const dist = regionDistanceKm(viewerRegion, region)
  const distanceLabel =
    dist === null
      ? null
      : dist === 0
        ? t('neighbors.sameTown')
        : t('neighbors.aboutKm').replace('{n}', String(Math.max(1, Math.round(dist))))

  return (
    <li>
      <Link
        to={`/board/${post.id}`}
        className="block rounded-card border border-gray-100 bg-white shadow-card px-4 py-3 active:bg-gray-50"
      >
        <p className="font-semibold text-gray-900">{post.title}</p>
        <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-gray-500">
          <span>{t(postCategoryLabelKey(post.category))}</span>
          {region ? <span>{regionLabel(region.id, region.names, locale)}</span> : null}
          {distanceLabel ? <span className="text-green-700">{distanceLabel}</span> : null}
          <span>
            {post.authorNickname ?? t('board.unknownAuthor')}
            {post.authorCountry ? ` · ${post.authorCountry}` : ''}
          </span>
          {post.source_locale !== locale ? (
            <span className="rounded bg-gray-100 px-1 text-[10px] font-semibold uppercase text-gray-500">
              {post.source_locale}
            </span>
          ) : null}
        </p>
      </Link>
    </li>
  )
}
