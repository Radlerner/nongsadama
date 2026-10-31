import { useState } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router-dom'
import { useTranslation } from '../i18n/useTranslation'
import { useAuth } from '../context/AuthContext'
import { useRegions, countyRegionIds, countyOf, provinceOf } from '../hooks/useRegions'
import { useBoardPosts, postCategoryLabelKey, type PostWithAuthor } from '../hooks/usePosts'
import { useBlockedIds } from '../hooks/useModeration'
import { useBoardGate } from '../hooks/useBoardGate'
import { BOARD_FILTERS, parseBoardCategory, type PostCategory } from '../lib/postCategories'
import { boardView, inScope } from '../lib/regionGate'
import { regionLabel } from '../lib/regionName'
import {
  Avatar,
  Button,
  EmptyState,
  ErrorState,
  Icon,
  LoadingState,
  PillTabs,
  SkeletonBlock,
  buttonClasses,
  cn,
} from '../components/ui'
import {
  CategoryTag,
  MetaLine,
  NoteBox,
  SourceLocaleChip,
  formatPostTime,
  useDistanceLabel,
} from '../components/board/PostParts'
import { PostCardPhotos } from '../components/board/PostPhotos'
import type { Tables } from '../types/database'

type Region = Tables<'regions'>

/** 입력칸(키트): 48px, 흰 바탕 + 3:1 선, 초점은 초록 테두리 */
const SELECT_FIELD =
  'block h-12 w-full rounded-lg border border-line-input bg-white px-4 text-body text-ink transition-colors focus:border-nong-600'

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

  const {
    data: rawPosts,
    isLoading,
    isError,
    refetch,
    isFetching,
    fetchStatus,
  } = useBoardPosts(
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

  // 지역 목록은 이웃의 글 보기에서도 거르기에 필요하다 — 실패하면 어느 모드든 오류로 보인다(무한 로딩 방지).
  // 이미 받아 둔 글이 있으면 화면을 비우지 않는다: 목록은 그대로 두고 위에 작은 다시 시도 줄만 보인다.
  const showError = (regionsError && regions === undefined) || (isError && rawPosts === undefined)
  const staleError = !showError && isError && rawPosts !== undefined
  const retrying = regionsFetching || isFetching
  const retry = () => {
    if (regionsError) void refetchRegions()
    if (isError) void refetch()
  }
  // 오프라인이면 쿼리가 멈춘 채(paused) 기다린다: "글 없음"이 아니라 연결을 기다린다고 보여 준다
  const waitingNetwork = fetchStatus === 'paused' && rawPosts === undefined
  const loading = !showError && !needsRegion && (waitingScope || isLoading || waitingNetwork)
  // 내 지역 밖을 보고 있는가(둘러보기 ?region= 이든, 기기에서 고른 지역이 밖이든)
  const viewingOther = view.outside

  const ready = !loading && !showError && !needsRegion
  const shown = posts ?? []
  const recommendEmpty = category === 'recommend' && !authorId && !view.outside
  const authorHiddenOnly = Boolean(authorId) && hiddenOtherRegion > 0
  // 가운데 빈 칸의 행동이 이 접힘의 주 버튼이면 위쪽 글쓰기는 선 버튼으로 둔다(채운 버튼은 하나)
  const emptyHasPrimary =
    needsRegion || (ready && shown.length === 0 && !authorId && (recommendEmpty || (regionAllowed ?? []).length === 0))
  const viewingName = view.regionId ? countyNameOf(view.regionId) : ''
  const [viewingBefore, viewingAfter = ''] = t('board.viewing').split('{region}')
  const authorNickname = (unblocked ?? [])[0]?.authorNickname

  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <h1 className="flex-1 text-title text-ink">{t('board.title')}</h1>
        <Link
          to={writeLink.to}
          state={writeLink.state}
          className={buttonClasses({
            variant: emptyHasPrimary ? 'secondary' : 'primary',
            className: 'shrink-0 pl-3.5 pr-4',
          })}
        >
          <Icon name="edit" size={20} strokeWidth={2} />
          {t('board.write')}
        </Link>
      </div>

      {/* 지금 보는 지역 + 다른 지역 보기. 줄 높이를 고정해 지역·글 수가 늦게 와도 아래 알약이 움직이지 않는다. */}
      {authorId ? null : (
        <div className="mt-1 flex min-h-11 items-center justify-between gap-2">
          {/* 지역 이름과 "글 22개"는 쪼개지 않는다. 구분점은 앞 조각 끝에 붙여 줄 첫머리에 '·'가 오지 않게(MetaLine과 같게) */}
          <p className="min-w-0 flex-1 break-words text-caption text-ink-muted">
            {viewingName ? (
              <>
                {viewingBefore}
                <b className="whitespace-nowrap font-bold text-ink">{viewingName}</b>
                {viewingAfter}
                {ready ? (
                  <>
                    {' · '}
                    <span className="whitespace-nowrap">{t('board.count').replace('{n}', String(shown.length))}</span>
                  </>
                ) : null}
              </>
            ) : null}
          </p>
          {viewingOther ? (
            <Button
              variant="ghost"
              tone="da"
              size="sm"
              icon="pin"
              className="-mr-3 shrink-0"
              // 고른 지역이 밖이어도 돌아올 수 있게 내 지역을 직접 가리킨다(?region 을 지우기만 하면 고른 지역에 머문다)
              onClick={() => {
                setPanelOpen(false)
                setParam('region', gate.ownRegionId)
              }}
            >
              {t('board.backToOwn')}
            </Button>
          ) : (
            <button
              type="button"
              aria-expanded={panelOpen}
              aria-controls="board-region-panel"
              // 글 수를 세는 동안은 눌러도 열지 않는다 — 열린 칸의 내용이 손가락 아래서 바뀌지 않게
              disabled={gate.countPending}
              onClick={() => setPanelOpen((open) => !open)}
              className={buttonClasses({
                variant: 'ghost',
                tone: 'da',
                size: 'sm',
                disabled: gate.countPending,
                className: cn('-mr-3 shrink-0', panelOpen && 'bg-surface'),
              })}
            >
              {/* 자물쇠 자리는 늘 잡아 두어 글 수가 와도 버튼 크기가 그대로다 */}
              <Icon name="lock" size={18} className={cn(gate.unlocked && 'invisible')} />
              {t('board.otherRegions')}
            </button>
          )}
        </div>
      )}

      {panelOpen && !authorId && !viewingOther ? (
        <div id="board-region-panel" className="mt-2">
          {gate.unlocked ? (
            <RegionBrowsePanel
              regions={regions ?? []}
              initialRegionId={view.regionId}
              onPick={(id) => {
                setPanelOpen(false)
                setParam('region', id)
              }}
            />
          ) : (
            <NoteBox icon="lock">
              <p>
                {gate.loggedIn
                  ? t('board.lockedBody').replace('{need}', String(gate.need)).replace('{count}', countText)
                  : t('board.lockedLoggedOut').replace('{need}', String(gate.need))}
              </p>
              <Link
                to={writeLink.to}
                state={writeLink.state}
                className={buttonClasses({ variant: 'ghost', size: 'sm', tone: 'da', className: '-ml-3 mt-1' })}
              >
                {gate.loggedIn ? t('board.write') : t('profile.loginCta')}
              </Link>
            </NoteBox>
          )}
        </div>
      ) : null}

      {authorId ? (
        <div className="mt-3 flex min-h-12 items-center gap-2 rounded-xl border border-da-200 bg-da-50 py-1 pl-4 pr-1">
          <Icon name="me" size={20} className="shrink-0 text-da-600" />
          <p className="min-w-0 flex-1 text-small text-ink">
            {t('board.authorFilter')}
            {authorNickname ? (
              <>
                {': '}
                <b className="font-bold">{authorNickname}</b>
              </>
            ) : null}
          </p>
          <Link to="/board" className={buttonClasses({ variant: 'ghost', size: 'sm', tone: 'da', className: 'shrink-0' })}>
            {t('board.authorFilterClear')}
          </Link>
        </div>
      ) : null}

      {/* 종류 알약은 데이터와 무관하게 고정 — 목록이 늦게 와도 누르는 자리가 움직이지 않는다(v1.4 패턴) */}
      <div className="mt-2">
        <PillTabs<PostCategory | 'all'>
          ariaLabel={t('board.filterLabel')}
          value={category ?? 'all'}
          onChange={(v) => setParam('category', v === 'all' ? null : v)}
          options={[
            { value: 'all', label: t('board.filterAll') },
            ...BOARD_FILTERS.map((c) => ({
              value: c,
              label: t(postCategoryLabelKey(c)),
              glyph: c === 'recommend' ? <Icon name="pin" size={18} /> : undefined,
            })),
          ]}
        />
      </div>

      <div className="mt-2">
        {needsRegion ? (
          <EmptyState
            className="mt-2"
            icon="pin"
            title={t('postForm.regionRequired')}
            action={{ label: t('postForm.selectRegion'), to: '/select', icon: 'pin', primary: true }}
          />
        ) : loading ? (
          <LoadingState
            variant="inline"
            tone="da"
            label={t('board.loading')}
            offlineLabel={t('board.waitingNetwork')}
          >
            <PostListSkeleton />
          </LoadingState>
        ) : showError ? (
          <ErrorState
            className="mt-2"
            title={t('board.error')}
            onRetry={retry}
            retrying={retrying}
            tone="da"
            fallback={{ label: t('notFound.back'), to: '/home' }}
          />
        ) : (
          <>
            {staleError ? (
              // 받아 둔 글은 그대로 보여 주고, 새로 못 받았다는 것만 알린다
              <div className="mb-2 flex min-h-12 items-center gap-2 rounded-xl border border-line py-1 pl-4 pr-1">
                <Icon name="alert" size={20} className="shrink-0 text-danger" />
                <p role="alert" className="min-w-0 flex-1 text-small text-ink-body">
                  {t('board.error')}
                </p>
                <Button
                  variant="ghost"
                  size="sm"
                  tone="da"
                  icon="refresh"
                  className="shrink-0"
                  loading={retrying}
                  loadingLabel={t('state.retrying')}
                  onClick={retry}
                >
                  {t('common.retry')}
                </Button>
              </div>
            ) : null}
            {/* 목록 자리 안에 둔다 — 위의 버튼들을 밀지 않게 */}
            {view.redirectedFrom && nameOf(view.redirectedFrom) ? (
              <NoteBox icon="lock" className="mb-3">
                <p>
                  {t('board.lockedShowingOwn')
                    .replace('{region}', nameOf(view.redirectedFrom))
                    .replace('{own}', countyNameOf(gate.ownRegionId))
                    .replace('{need}', String(gate.need))
                    .replace('{count}', countText)}
                </p>
                {/* 이사했거나 내 지역이 틀렸으면 프로필에서 바꾼다(내 지역 = 프로필 지역) */}
                <Link
                  to="/profile/edit"
                  className={buttonClasses({ variant: 'ghost', size: 'sm', tone: 'da', className: '-ml-3 mt-1' })}
                >
                  {t('profile.editCta')}
                </Link>
              </NoteBox>
            ) : null}
            {authorHiddenOnly ? (
              <NoteBox icon="lock" className="mb-3">
                <p>{t('board.authorHidden').replace('{n}', String(hiddenOtherRegion)).replace('{need}', String(gate.need))}</p>
              </NoteBox>
            ) : null}
            {shown.length === 0 ? (
              authorHiddenOnly && (regionAllowed ?? []).length === 0 ? null : category && (regionAllowed ?? []).length > 0 ? (
                // 이 종류만 비었다: 이웃 글 보기(?author)는 유지한 채 '전체'로 돌아간다.
                // 우리 동네 추천은 첫 추천 글 쓰기로 이끈다(D-043).
                recommendEmpty ? (
                  <RecommendEmpty writeLink={writeLink} />
                ) : (
                  <EmptyState
                    className="mt-2"
                    icon="message"
                    title={t('board.emptyFiltered')}
                    action={{
                      label: authorId ? t('board.filterAll') : t('board.authorFilterClear'),
                      onClick: () => setParam('category', null),
                    }}
                  />
                )
              ) : authorId ? (
                <EmptyState
                  className="mt-2"
                  icon="message"
                  title={t('board.emptyAuthor')}
                  action={{ label: t('board.authorFilterClear'), to: '/board' }}
                />
              ) : recommendEmpty ? (
                <RecommendEmpty writeLink={writeLink} />
              ) : (
                <EmptyState
                  className="mt-2"
                  icon="message"
                  title={category ? t('board.emptyFiltered') : t('board.empty')}
                  action={{ label: t('board.write'), to: writeLink.to, state: writeLink.state, icon: 'edit', primary: true }}
                />
              )
            ) : (
              <ul className="anim-fade">
                {shown.map((post, i) => (
                  <PostCard
                    key={post.id}
                    post={post}
                    first={i === 0}
                    regionsById={regionsById}
                    viewerRegionId={gate.selectedRegionId}
                    boardSearch={boardSearch}
                  />
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </section>
  )
}

/** 우리 동네 추천이 아직 없을 때(D-043): 한 줄 + 첫 추천 글 쓰기(이 접힘의 주 버튼). 글쓰기는 종류를 이어받는다. */
function RecommendEmpty({ writeLink }: { writeLink: { to: string; state?: unknown } }) {
  const { t } = useTranslation()
  return (
    <div className="mt-2 rounded-xl border border-line px-5 py-6 text-center">
      <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-surface text-ink-muted">
        <Icon name="pin" size={26} />
      </span>
      <p className="mt-3 text-body font-bold text-ink">{t('board.recommendEmpty')}</p>
      <div className="mt-4 flex justify-center">
        <Link to={writeLink.to} state={writeLink.state} className={buttonClasses({ variant: 'primary' })}>
          <Icon name="edit" size={20} strokeWidth={2} />
          {t('board.recommendWrite')}
        </Link>
      </div>
    </div>
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
  return (
    <div className="flex flex-col gap-4 rounded-xl border border-line p-4">
      <label className="flex flex-col gap-2">
        <span className="text-label text-ink">{t('board.pickProvince')}</span>
        <select
          className={SELECT_FIELD}
          value={provinceId}
          onChange={(e) => {
            setProvinceId(e.target.value)
            setCityId('')
          }}
        >
          {provinces.map((p) => (
            <option key={p.id} value={p.id}>
              {regionLabel(p.id, p.names, locale)}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-2">
        <span className="text-label text-ink">{t('board.pickCity')}</span>
        <select className={SELECT_FIELD} value={cityId} onChange={(e) => setCityId(e.target.value)}>
          <option value="">{t('board.pickCity')}</option>
          {cities.map((c) => (
            <option key={c.id} value={c.id}>
              {regionLabel(c.id, c.names, locale)}
            </option>
          ))}
        </select>
      </label>
      {/* 위쪽 글쓰기가 이 접힘의 주 버튼이라 선 버튼으로 둔다 */}
      <Button variant="secondary" fullWidth disabled={!cityId} onClick={() => onPick(cityId)}>
        {t('board.pickApply')}
      </Button>
    </div>
  )
}

function PostCard({
  post,
  first,
  regionsById,
  viewerRegionId,
  boardSearch,
}: {
  post: PostWithAuthor
  first: boolean
  regionsById: Map<string, Region>
  viewerRegionId: string | null
  boardSearch: string
}) {
  const { t, locale } = useTranslation()
  const distanceOf = useDistanceLabel()
  const region = regionsById.get(post.region_id)
  const viewerRegion = viewerRegionId ? regionsById.get(viewerRegionId) : undefined
  const distanceLabel = distanceOf(viewerRegion, region)
  const nickname = post.authorNickname ?? t('board.unknownAuthor')
  const photos = post.image_paths ?? []
  const meta = [
    region ? regionLabel(region.id, region.names, locale) : null,
    distanceLabel,
    formatPostTime(post.created_at, locale, t),
  ].filter((part): part is string => Boolean(part))

  return (
    <li className={cn(!first && 'border-t border-line')}>
      <Link
        to={`/board/${post.id}`}
        state={{ boardSearch }}
        className={cn('-mx-5 block px-5 pb-5 transition-colors active:bg-surface', first ? 'pt-3' : 'pt-5')}
      >
        <span className="flex items-center gap-3">
          <Avatar name={nickname} seed={post.author_id} />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-label text-ink">{nickname}</span>
            <span className="block break-words text-caption text-ink-muted">
              <MetaLine parts={meta} timeIso={post.created_at} />
            </span>
          </span>
          <CategoryTag category={post.category} />
        </span>
        {/* 사진이 먼저(사진 카드). 자리 크기를 미리 정해 그림이 늦게 와도 카드 높이가 바뀌지 않는다 */}
        <PostCardPhotos paths={photos} className="mt-3" />
        <span lang={post.source_locale} className="mt-3 block break-words text-section font-bold text-ink">
          {post.title}
        </span>
        <span aria-hidden="true" lang={post.source_locale} className="mt-1 line-clamp-2 break-words text-body text-ink-body">
          {post.body}
        </span>
        {photos.length > 0 ? <span className="sr-only">{t('board.photoCount').replace('{n}', String(photos.length))}</span> : null}
        {post.source_locale !== locale ? <SourceLocaleChip code={post.source_locale} className="mt-3" /> : null}
      </Link>
    </li>
  )
}

/** 글 목록 자리 잡기(사진 카드 하나 + 글 카드 하나: 아바타 + 두 줄 + 사진 + 제목 + 본문 두 줄). */
function PostListSkeleton() {
  return (
    <div aria-hidden="true">
      {[true, false].map((withPhoto, i) => (
        <div key={i} className={cn(i === 0 ? 'pb-5 pt-3' : 'border-t border-line py-5')}>
          <div className="flex items-center gap-3">
            <SkeletonBlock className="h-10 w-10 shrink-0 rounded-full" />
            <span className="flex-1">
              <SkeletonBlock className="h-3.5 w-[34%] rounded-full" />
              <SkeletonBlock className="mt-2 h-3 w-[56%] rounded-full" />
            </span>
          </div>
          {withPhoto ? <SkeletonBlock className="mt-3 aspect-[16/10] w-full rounded-xl" /> : null}
          <SkeletonBlock className={cn('mt-4 h-[18px] rounded-full', withPhoto ? 'w-[72%]' : 'w-[64%]')} />
          <SkeletonBlock className="mt-3 h-3.5 w-[94%] rounded-full" />
          <SkeletonBlock className={cn('mt-2.5 h-3.5 rounded-full', withPhoto ? 'w-[58%]' : 'w-[46%]')} />
        </div>
      ))}
    </div>
  )
}
