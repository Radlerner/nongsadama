import { useState } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router-dom'
import { useTranslation } from '../i18n/useTranslation'
import { useAuth } from '../context/AuthContext'
import { useRegions, countyRegionIds, countyOf, provinceOf } from '../hooks/useRegions'
import { useBoardPosts, postCategoryLabelKey, type PostWithAuthor } from '../hooks/usePosts'
import { useBlockedIds } from '../hooks/useModeration'
import { useBoardGate } from '../hooks/useBoardGate'
import { BOARD_FILTERS, parseBoardCategory } from '../lib/postCategories'
import { boardView, inScope } from '../lib/regionGate'
import { imageUrl, thumbPath } from '../lib/postImages'
import { CardLink } from '../components/ui/Card'
import { Lock, MapPin } from '../components/ui/icons'
import { EmptyBox, ErrorBox, LoadingBox } from '../components/ui/StateBoxes'
import { regionLabel } from '../lib/regionName'
import { regionDistanceKm } from '../lib/matching'
import type { Tables } from '../types/database'

type Region = Tables<'regions'>

export function Board() {
  const { t, locale } = useTranslation()
  const { user } = useAuth()
  const {
    data: regions,
    isError: regionsError,
    refetch: refetchRegions,
    isFetching: regionsFetching,
  } = useRegions()
  const gate = useBoardGate()
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  const [panelOpen, setPanelOpen] = useState(false)
  // 이웃 목록에서 진입한 "이 작성자의 글만 보기" 모드(PRD v1.4 §2.1)
  const authorId = searchParams.get('author')
  // 글 종류 거르기(?category=, D-043). 생활정보 화면의 "이웃이 추천한 우리 동네"가 recommend 로 들어온다.
  const category = parseBoardCategory(searchParams.get('category'))
  const setParam = (key: string, value: string | null) => {
    const params = new URLSearchParams(searchParams)
    if (value) params.set(key, value)
    else params.delete(key)
    setSearchParams(params, { replace: true })
  }

  const regionsById = new Map((regions ?? []).map((r) => [r.id, r]))
  const nameOf = (id: string | null | undefined) => {
    const r = id ? regionsById.get(id) : undefined
    return r ? regionLabel(r.id, r.names, locale) : ''
  }
  // 목록은 시·군 전체(읍·면 포함)를 보여 주므로 지역 줄에는 시·군 이름을 쓴다
  const countyNameOf = (id: string | null | undefined) => {
    const c = countyOf(regions ?? [], id ? regionsById.get(id) : undefined)
    return c ? regionLabel(c.id, c.names, locale) : nameOf(id)
  }
  // 다른 지역 둘러보기(?region=, D-045) — 시·군·구·읍·면 id만 받는다
  const browseParam = searchParams.get('region')
  const browseRegion = browseParam ? regionsById.get(browseParam) : undefined
  const view = boardView({
    loggedIn: gate.loggedIn,
    unlocked: gate.unlocked,
    selectedRegionId: gate.selectedRegionId,
    ownRegionId: gate.ownRegionId,
    ownScope: gate.ownScope,
    browseRegionId: browseRegion && browseRegion.level !== 'province' ? browseRegion.id : null,
  })
  const viewScope = regions ? countyRegionIds(regions, view.regionId) : null
  // 이웃의 글 보기에서 아직 열리지 않은 사람에게 보일 범위(로그인: 내 지역, 로그인 전: 고른 지역)
  const allowedScope = gate.unlocked ? null : gate.ownScope
  // 글 수가 결과를 바꿀 때만(둘러보기·기기 지역이 내 지역 밖·이웃의 글 보기) 글 수를 기다린다
  const selectedOutside = gate.loggedIn && Boolean(gate.selectedRegionId) && Boolean(gate.ownScope) && !inScope(gate.ownScope, gate.selectedRegionId)
  const needCount = gate.loggedIn && (Boolean(browseParam) || selectedOutside || Boolean(authorId))
  const waitingScope = regions === undefined || gate.pending || (needCount && gate.countPending)
  const countText = gate.countFailed ? '–' : String(gate.ownPostCount ?? 0)
  const needsRegion = !waitingScope && !authorId && !viewScope

  const { data: rawPosts, isLoading, isError, refetch, isFetching } = useBoardPosts(
    authorId ? null : viewScope,
    !waitingScope && (Boolean(authorId) || Boolean(viewScope)),
    authorId,
  )
  // 차단한 사용자의 글 숨김(Play UGC 정책, D-022) — 차단 목록은 본인 것만 RLS로 조회됨
  const { data: blockedIds } = useBlockedIds(user?.id)
  const unblocked = blockedIds ? (rawPosts ?? []).filter((p) => !blockedIds.has(p.author_id)) : rawPosts
  const regionAllowed = authorId && !gate.unlocked
    ? (unblocked ?? []).filter((p) => inScope(allowedScope, p.region_id))
    : unblocked
  const hiddenOtherRegion = (unblocked ?? []).length - (regionAllowed ?? []).length
  const posts = category ? (regionAllowed ?? []).filter((p) => p.category === category) : regionAllowed

  // 거른 종류로 바로 쓰기(PostForm 이 location.state.category 를 첫 값으로 쓴다), 상세·글쓰기에서 돌아올 주소
  const boardSearch = location.search
  const writeLink = { to: user ? '/board/new' : '/login', state: user ? { category, boardSearch } : undefined }

  // 지역 목록은 이웃의 글 보기에서도 거르기에 필요하다 — 실패하면 어느 모드든 오류로 보인다(무한 로딩 방지)
  const showError = regionsError || isError
  const retrying = regionsFetching || isFetching
  const retry = () => {
    if (regionsError) void refetchRegions()
    if (isError) void refetch()
  }
  const loading = !showError && !needsRegion && (waitingScope || isLoading)
  // 내 지역 밖을 보고 있는가(둘러보기 ?region= 이든, 기기에서 고른 지역이 밖이든)
  const viewingOther = view.outside

  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <h1 className="text-xl font-extrabold tracking-tight">{t('board.title')}</h1>
        <Link
          to={writeLink.to}
          state={writeLink.state}
          className="inline-flex min-h-[44px] items-center rounded-full bg-brand-greenDark px-4 text-sm font-semibold text-white"
        >
          {t('board.write')}
        </Link>
      </div>

      {/* 지금 보는 지역 + 다른 지역 보기. 한 줄 높이를 고정해 지역·글 수가 늦게 와도 아래 버튼이 움직이지 않는다. */}
      {authorId ? null : (
        <div className="mb-3 flex min-h-[44px] items-center justify-between gap-2">
          <p className="min-w-0 flex-1 text-sm text-gray-700">
            {view.regionId && countyNameOf(view.regionId) ? t('board.viewing').replace('{region}', countyNameOf(view.regionId)) : ''}
          </p>
          {viewingOther ? (
            <button
              type="button"
              // 고른 지역이 밖이어도 돌아올 수 있게 내 지역을 직접 가리킨다(?region 을 지우기만 하면 고른 지역에 머문다)
              onClick={() => { setPanelOpen(false); setParam('region', gate.ownRegionId) }}
              className="inline-flex min-h-[44px] shrink-0 items-center rounded-full border border-gray-300 bg-white px-3 text-sm text-gray-700"
            >
              {t('board.backToOwn')}
            </button>
          ) : (
            <button
              type="button"
              aria-expanded={panelOpen}
              // 글 수를 세는 동안은 눌러도 열지 않는다 — 열린 칸의 내용이 손가락 아래서 바뀌지 않게
              disabled={gate.countPending}
              onClick={() => setPanelOpen((open) => !open)}
              className="inline-flex min-h-[44px] shrink-0 items-center rounded-full border border-gray-300 bg-white px-3 text-sm text-gray-700 disabled:opacity-60"
            >
              {/* 자물쇠 자리는 늘 잡아 두어 글 수가 와도 버튼 크기가 그대로다 */}
              <Lock aria-hidden size={14} strokeWidth={2.25} className={`mr-1 ${gate.unlocked ? 'invisible' : ''}`} />
              {t('board.otherRegions')}
            </button>
          )}
        </div>
      )}

      {panelOpen && !authorId && !viewingOther ? (
        gate.unlocked ? (
          <RegionBrowsePanel
            regions={regions ?? []}
            initialRegionId={view.regionId}
            onPick={(id) => { setPanelOpen(false); setParam('region', id) }}
          />
        ) : (
          <div className="mb-3 rounded-md bg-gray-50 px-4 py-3 text-sm text-gray-700">
            <p>
              {gate.loggedIn
                ? t('board.lockedBody').replace('{need}', String(gate.need)).replace('{count}', countText)
                : t('board.lockedLoggedOut').replace('{need}', String(gate.need))}
            </p>
            <Link
              to={writeLink.to}
              state={writeLink.state}
              className="mt-2 inline-flex min-h-[44px] items-center font-semibold text-green-800 underline"
            >
              {gate.loggedIn ? t('board.write') : t('profile.loginCta')}
            </Link>
          </div>
        )
      ) : null}

      {/* 종류 버튼은 데이터와 무관하게 고정 — 목록이 늦게 와도 누르는 자리가 움직이지 않는다(v1.4 패턴) */}
      <div role="group" aria-label={t('board.filterLabel')} className="mb-4 flex flex-wrap gap-2">
        {[null, ...BOARD_FILTERS].map((c) => {
          const active = category === c
          return (
            <button
              key={c ?? 'all'}
              type="button"
              onClick={() => setParam('category', c)}
              aria-pressed={active}
              className={[
                'inline-flex min-h-[44px] items-center rounded-full border px-4 text-sm',
                active
                  ? 'border-green-700 bg-brand-greenDark font-semibold text-white'
                  : 'border-gray-300 bg-white text-gray-700',
              ].join(' ')}
            >
              {c === 'recommend' ? (
                <MapPin aria-hidden size={16} strokeWidth={2.25} className="mr-1 inline align-[-3px]" />
              ) : null}
              {c ? t(postCategoryLabelKey(c)) : t('board.filterAll')}
            </button>
          )
        })}
      </div>

      {authorId ? (
        <p className="mb-3 flex items-center justify-between rounded-md bg-green-50 px-3 py-2 text-xs text-green-800">
          <span>
            {t('board.authorFilter')}
            {(unblocked ?? [])[0]?.authorNickname ? `: ${(unblocked ?? [])[0]?.authorNickname}` : ''}
          </span>
          <Link to="/board" className="min-h-[32px] font-semibold underline">
            {t('board.authorFilterClear')}
          </Link>
        </p>
      ) : null}

      {needsRegion ? (
        <div className="flex flex-col items-center gap-3">
          <EmptyBox text={t('postForm.regionRequired')} />
          <Link to="/select" className="inline-flex min-h-[44px] items-center text-green-700 underline">
            {t('postForm.selectRegion')}
          </Link>
        </div>
      ) : loading ? (
        <LoadingBox text={t('board.loading')} />
      ) : showError ? (
        <ErrorBox
          text={t('board.error')}
          retryLabel={t('common.retry')}
          onRetry={retry}
          retrying={retrying}
        />
      ) : (
        <>
          {/* 목록 자리 안에 둔다 — 위의 버튼들을 밀지 않게 */}
          {view.redirectedFrom && nameOf(view.redirectedFrom) ? (
            <div className="mb-3 rounded-md bg-amber-50 px-4 py-3 text-sm text-amber-900">
              <p>
                {t('board.lockedShowingOwn')
                  .replace('{region}', nameOf(view.redirectedFrom))
                  .replace('{own}', countyNameOf(gate.ownRegionId))
                  .replace('{need}', String(gate.need))
                  .replace('{count}', countText)}
              </p>
              {/* 이사했거나 내 지역이 틀렸으면 프로필에서 바꾼다(내 지역 = 프로필 지역) */}
              <Link to="/profile/edit" className="mt-1 inline-flex min-h-[44px] items-center font-semibold underline">
                {t('profile.editCta')}
              </Link>
            </div>
          ) : null}
          {authorId && hiddenOtherRegion > 0 ? (
            <p className="mb-3 rounded-md bg-gray-50 px-4 py-3 text-sm text-gray-700">
              {t('board.authorHidden').replace('{n}', String(hiddenOtherRegion)).replace('{need}', String(gate.need))}
            </p>
          ) : null}
          {(posts ?? []).length === 0 ? (
            authorId && hiddenOtherRegion > 0 ? null : category === 'recommend' && !authorId && !view.outside ? (
              <div className="flex flex-col items-center gap-3">
                <EmptyBox text={t('board.recommendEmpty')} />
                <Link
                  to={writeLink.to}
                  state={writeLink.state}
                  className="inline-flex min-h-[44px] items-center rounded-full border border-green-700 bg-white px-4 text-sm font-semibold text-green-800"
                >
                  {t('board.recommendWrite')}
                </Link>
              </div>
            ) : (
              <EmptyBox text={category ? t('board.emptyFiltered') : t('board.empty')} />
            )
          ) : (
            <ul className="flex flex-col gap-2">
              {(posts ?? []).map((post) => (
                <PostCard
                  key={post.id}
                  post={post}
                  regionsById={regionsById}
                  viewerRegionId={gate.selectedRegionId}
                  boardSearch={boardSearch}
                />
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  )
}

/** 다른 지역 고르기(열린 사람만) — 시·도 → 시·군·구. 기기에 저장된 내 지역은 바꾸지 않는다. */
function RegionBrowsePanel({
  regions,
  initialRegionId,
  onPick,
}: {
  regions: Region[]
  initialRegionId: string | null
  onPick: (regionId: string) => void
}) {
  const { t, locale } = useTranslation()
  const provinces = regions.filter((r) => r.level === 'province')
  const initialProvince = provinceOf(regions, regions.find((r) => r.id === initialRegionId))
  const [provinceId, setProvinceId] = useState(initialProvince?.id ?? provinces[0]?.id ?? '')
  const cities = regions.filter((r) => r.level === 'city' && r.parent_id === provinceId)
  const [cityId, setCityId] = useState('')
  const selectClass = 'w-full min-h-[44px] rounded-md border border-gray-300 bg-white px-3 py-2 text-base text-gray-900'
  return (
    <div className="mb-3 flex flex-col gap-2 rounded-md bg-gray-50 px-4 py-3">
      <label className="flex flex-col gap-1 text-sm font-semibold text-gray-700">
        {t('board.pickProvince')}
        <select
          className={selectClass}
          value={provinceId}
          onChange={(e) => { setProvinceId(e.target.value); setCityId('') }}
        >
          {provinces.map((p) => (
            <option key={p.id} value={p.id}>{regionLabel(p.id, p.names, locale)}</option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm font-semibold text-gray-700">
        {t('board.pickCity')}
        <select className={selectClass} value={cityId} onChange={(e) => setCityId(e.target.value)}>
          <option value="">{t('board.pickCity')}</option>
          {cities.map((c) => (
            <option key={c.id} value={c.id}>{regionLabel(c.id, c.names, locale)}</option>
          ))}
        </select>
      </label>
      <button
        type="button"
        disabled={!cityId}
        onClick={() => onPick(cityId)}
        className="min-h-[44px] rounded-full bg-brand-greenDark px-4 text-sm font-semibold text-white disabled:opacity-50"
      >
        {t('board.pickApply')}
      </button>
    </div>
  )
}

function PostCard({
  post,
  regionsById,
  viewerRegionId,
  boardSearch,
}: {
  post: PostWithAuthor
  regionsById: Map<string, Region>
  viewerRegionId: string | null
  boardSearch: string
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
  const photos = post.image_paths ?? []

  return (
    <li>
      <CardLink to={`/board/${post.id}`} state={{ boardSearch }} className="flex items-center gap-3 px-4 py-3">
        <div className="min-w-0 flex-1">
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
            {photos.length > 0 ? <span className="sr-only">{t('board.photoCount').replace('{n}', String(photos.length))}</span> : null}
          </p>
        </div>
        {/* 작은 그림(약 360px) — 크기를 고정해 그림이 늦게 와도 카드 높이가 바뀌지 않는다 */}
        {photos.length > 0 ? (
          <img
            src={imageUrl(thumbPath(photos[0]))}
            alt=""
            loading="lazy"
            decoding="async"
            className="h-16 w-16 shrink-0 rounded-md bg-gray-100 object-cover"
          />
        ) : null}
      </CardLink>
    </li>
  )
}
