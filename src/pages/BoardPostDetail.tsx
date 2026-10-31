import { useRef, useState, type RefObject } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from '../i18n/useTranslation'
import { useAuth } from '../context/AuthContext'
import {
  usePost,
  useDeletePost,
  useSimilarPosts,
  postCategoryLabelKey,
} from '../hooks/usePosts'
import { useRegions } from '../hooks/useRegions'
import { useBoardGate } from '../hooks/useBoardGate'
import { inScope } from '../lib/regionGate'
import { useSelectedRegion } from '../context/SelectedRegionContext'
import {
  useBlockedIds,
  useBlockUser,
  useUnblockUser,
  useReportPost,
} from '../hooks/useModeration'
import { regionLabel } from '../lib/regionName'
import { FROM_DETAIL_STATE } from '../components/layout/flash'
import {
  Avatar,
  BottomSheet,
  Button,
  EmptyState,
  ErrorState,
  Icon,
  LoadingState,
  SectionHeader,
  SkeletonBlock,
  SlowHint,
  buttonClasses,
  cn,
} from '../components/ui'
import {
  CategoryTag,
  ErrorLine,
  MetaLine,
  NoteBox,
  SourceLocaleChip,
  formatPostTime,
  useDistanceLabel,
  writeErrorKey,
} from '../components/board/PostParts'
import { PostGallery } from '../components/board/PostPhotos'

/** 신고·차단 줄의 조용한 글자 버튼(44px 높이, 회색 글자). */
const QUIET_ACTION =
  'inline-flex h-11 items-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 text-small font-bold text-ink-muted transition-colors hover:bg-surface active:bg-surface-2'

export function BoardPostDetail() {
  const { t, locale } = useTranslation()
  const { postId } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()
  const { data: post, isPending, isError, refetch, isFetching } = usePost(postId)
  const { data: regions } = useRegions()
  const { regionId: viewerRegionId } = useSelectedRegion()
  const deletePost = useDeletePost()
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const { data: blockedIds } = useBlockedIds(user?.id)
  const unblock = useUnblockUser(user?.id)
  const distanceOf = useDistanceLabel()
  const titleRef = useRef<HTMLHeadingElement>(null)
  // 게시판에서 고른 거르기(?category= 등)를 지켜 돌아간다(목록 카드의 링크 state)
  const boardSearch = (useLocation().state as { boardSearch?: string } | null)?.boardSearch ?? ''
  const boardHref = `/board${boardSearch.startsWith('?') ? boardSearch : ''}`

  // isPending: 불러오는 중 + 오프라인으로 멈춘 경우(없는 글로 잘못 보이지 않게)
  if (isPending && !isError) {
    return (
      <LoadingState
        variant="inline"
        tone="da"
        label={t('board.loading')}
        offlineLabel={t('board.waitingNetwork')}
      >
        <PostDetailSkeleton />
      </LoadingState>
    )
  }

  // 받아 둔 글이 없을 때만 오류 화면 — 다시 받다가 실패해도 이미 보던 글은 그대로 둔다
  if (isError && post === undefined) {
    return (
      <ErrorState
        className="mt-2"
        title={t('board.error')}
        onRetry={() => void refetch()}
        retrying={isFetching}
        tone="da"
        fallback={{ label: t('postDetail.back'), to: boardHref }}
      />
    )
  }

  if (!post) {
    return (
      <EmptyState
        className="mt-2"
        icon="document"
        title={t('postDetail.empty')}
        body={t('post.notFoundBody')}
        action={{ label: t('postDetail.back'), to: boardHref }}
      />
    )
  }

  const region = (regions ?? []).find((r) => r.id === post.region_id)
  const viewerRegion = viewerRegionId
    ? (regions ?? []).find((r) => r.id === viewerRegionId)
    : undefined
  const distanceLabel = distanceOf(viewerRegion, region)
  const isOwn = user?.id === post.author_id
  const nickname = post.authorNickname ?? t('board.unknownAuthor')
  const photos = post.image_paths ?? []
  const regionName = region ? regionLabel(region.id, region.names, locale) : null

  // 차단한 작성자의 글: 본문 대신 안내(뒤로가기·직접 URL 접근 커버, 재검수 P1-1a)
  if (!isOwn && blockedIds?.has(post.author_id)) {
    return (
      <div className="mt-2 rounded-xl border border-line px-5 py-6 text-center">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-surface text-ink-muted">
          <Icon name="block" size={26} />
        </span>
        <p className="mt-3 text-body font-bold text-ink">{t('block.postHidden')}</p>
        <div className="mt-4 flex flex-col items-center gap-1">
          <Button
            variant="secondary"
            loading={unblock.isPending}
            loadingLabel={t('post.unblocking')}
            onClick={() => unblock.mutate(post.author_id)}
          >
            {t('block.unblock')}
          </Button>
          <SlowHint busy={unblock.isPending} />
          {unblock.isError ? <ErrorLine className="mt-1">{t(writeErrorKey('report.error'))}</ErrorLine> : null}
          <Link to={boardHref} className={buttonClasses({ variant: 'ghost', size: 'sm', tone: 'da' })}>
            {t('postDetail.back')}
          </Link>
        </div>
      </div>
    )
  }

  // 사진이 있으면 읍·면은 사진 위 알약에 있으니 메타 줄에서는 뺀다(PostDetail 아트보드)
  const meta = [
    photos.length > 0 ? null : regionName,
    distanceLabel,
    formatPostTime(post.created_at, locale, t),
  ].filter((part): part is string => Boolean(part))
  const closeDelete = () => {
    if (!deletePost.isPending) setConfirmingDelete(false)
  }

  return (
    <div className="anim-fade">
      <article>
        {/* 사진이 먼저: 헤더 바로 아래, 화면 폭 전체 */}
        {photos.length > 0 ? <PostGallery paths={photos} regionName={regionName} className="-mt-3 mb-5" /> : null}

        <div className="flex items-center gap-3">
          <Avatar name={nickname} seed={post.author_id} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-label text-ink">{nickname}</p>
            <p className="break-words text-caption text-ink-muted">
              <MetaLine parts={meta} timeIso={post.created_at} />
            </p>
          </div>
          <CategoryTag category={post.category} />
        </div>

        <h1
          ref={titleRef}
          tabIndex={-1}
          lang={post.source_locale}
          className="mt-4 break-words text-title text-ink outline-none"
        >
          {post.title}
        </h1>
        <p lang={post.source_locale} className="mt-2 whitespace-pre-line break-words text-body text-ink-body">
          {post.body}
        </p>

        {post.source_locale !== locale ? <SourceLocaleChip code={post.source_locale} className="mt-4" /> : null}

        {post.category === 'help' ? (
          /* v1.5 §5 데모 완료 조건: 만남 안전 문구 */
          <NoteBox icon="shield" className="mt-4">
            <p>{t('postDetail.helpSafety')}</p>
          </NoteBox>
        ) : null}

        {post.category === 'recommend' ? (
          /* 이용자가 쓴 추천은 농사다마가 확인한 생활정보와 다르다(D-043) */
          <NoteBox icon="info" className="mt-4">
            <p>{t('postDetail.recommendNote')}</p>
          </NoteBox>
        ) : null}

        {isOwn ? (
          <div className="mt-5 flex gap-2 border-t border-line pt-4">
            <Link
              to={`/board/${post.id}/edit`}
              // 저장하면 이 화면으로 뒤로 돌아온다(같은 글이 history에 두 번 쌓이지 않게) + 게시판 거르기 유지
              state={{ ...FROM_DETAIL_STATE, boardSearch }}
              className={buttonClasses({ variant: 'secondary', size: 'sm', className: 'flex-1' })}
            >
              <Icon name="edit" size={18} />
              {t('postDetail.edit')}
            </Link>
            <Button
              variant="danger"
              size="sm"
              icon="trash"
              className="flex-1"
              onClick={() => setConfirmingDelete(true)}
            >
              {t('postDetail.delete')}
            </Button>
          </div>
        ) : null}

        {/* in-app 신고·차단(Play UGC 정책, D-022) — 로그인 사용자, 타인 글에만 */}
        {user && !isOwn ? (
          <ModerationActions postId={post.id} authorId={post.author_id} boardHref={boardHref} titleRef={titleRef} />
        ) : null}
      </article>

      {deletePost.isError && !confirmingDelete ? (
        <ErrorLine className="mt-3">{t(writeErrorKey('post.deleteError'))}</ErrorLine>
      ) : null}

      <SimilarPosts postId={post.id} boardHref={boardHref} />

      <div className="mt-8 flex justify-center">
        <Link to={boardHref} className={buttonClasses({ variant: 'ghost', size: 'sm', tone: 'da' })}>
          {t('postDetail.back')}
        </Link>
      </div>

      <BottomSheet
        open={confirmingDelete}
        onClose={closeDelete}
        title={t('post.deleteTitle')}
        description={t('post.deleteBody')}
        initialFocus="panel"
        returnFocusRef={titleRef}
      >
        <Button
          fullWidth
          variant="danger"
          icon="trash"
          loading={deletePost.isPending}
          loadingLabel={t('state.deleting')}
          onClick={() =>
            deletePost.mutate(
              { id: post.id, imagePaths: photos },
              // 지운 글로 뒤로 돌아오지 않게 이 자리를 게시판으로 바꾼다 + "삭제했어요"
              { onSuccess: () => navigate(boardHref, { replace: true, state: { toast: 'state.deleted' } }) },
            )
          }
        >
          {t('postDetail.deleteConfirm')}
        </Button>
        <SlowHint busy={deletePost.isPending} className="mt-2" />
        {deletePost.isError ? <ErrorLine className="mt-2">{t(writeErrorKey('post.deleteError'))}</ErrorLine> : null}
        <Button
          fullWidth
          variant="tertiary"
          className="mt-2"
          disabled={deletePost.isPending}
          onClick={closeDelete}
        >
          {t('postDetail.deleteCancel')}
        </Button>
      </BottomSheet>
    </div>
  )
}

/** 신고 사유 값 집합(신고 데이터로 저장 — 특정 언어 하드코딩이 아닌 코드값). */
const REPORT_REASONS = ['spam', 'abuse', 'scam', 'other'] as const

/**
 * in-app 신고·차단(Play UGC 정책, D-022).
 * 신고: 사유 4택(시트) → reports insert(중복은 "이미 접수됨"). 차단: 확인(시트) 후 blocks insert → 게시판으로.
 * 보내는 중에는 시트를 닫지 않는다(바탕·Esc·취소 모두).
 */
function ModerationActions({
  postId,
  authorId,
  boardHref,
  titleRef,
}: {
  postId: string
  authorId: string
  boardHref: string
  titleRef: RefObject<HTMLHeadingElement>
}) {
  const { t } = useTranslation()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [reporting, setReporting] = useState(false)
  const [reported, setReported] = useState<null | 'ok' | 'dup'>(null)
  const [pendingReason, setPendingReason] = useState<string | null>(null)
  const [confirmingBlock, setConfirmingBlock] = useState(false)
  const report = useReportPost(user?.id)
  const block = useBlockUser(user?.id)
  const { data: blockedIds } = useBlockedIds(user?.id)
  const alreadyBlocked = blockedIds?.has(authorId) ?? false
  // 신고를 마치면 신고 버튼이 이 안내 줄로 바뀐다: 시트를 닫으면 초점이 여기로 온다
  const reportedRef = useRef<HTMLParagraphElement>(null)
  const closeReport = () => {
    if (!report.isPending) setReporting(false)
  }
  const closeBlock = () => {
    if (!block.isPending) setConfirmingBlock(false)
  }
  const reportedText = reported === 'dup' ? t('report.duplicated') : t('report.done')

  return (
    <div className="mt-5 flex flex-wrap items-center justify-between gap-x-2 border-y border-line py-1">
      {reported ? (
        <p
          ref={reportedRef}
          tabIndex={-1}
          className="flex min-h-11 items-center gap-1.5 text-small text-ink-body outline-none"
        >
          <Icon name="check" size={18} className="shrink-0 text-ink-muted" />
          {reportedText}
        </p>
      ) : (
        <button type="button" onClick={() => setReporting(true)} className={cn(QUIET_ACTION, '-ml-2.5')}>
          <Icon name="flag" size={18} />
          {t('postDetail.report')}
        </button>
      )}

      {/* 차단 — 신고 상태와 무관하게 항상 표시(신고 후에도 차단 가능) */}
      {alreadyBlocked ? (
        <span className="flex min-h-11 items-center text-small text-ink-muted">{t('block.already')}</span>
      ) : (
        <button type="button" onClick={() => setConfirmingBlock(true)} className={cn(QUIET_ACTION, '-mr-2.5')}>
          <Icon name="block" size={18} />
          {t('block.action')}
        </button>
      )}

      <BottomSheet
        open={reporting}
        onClose={closeReport}
        returnFocusRef={reported ? reportedRef : titleRef}
        initialFocus="panel"
        title={reported ? t('post.reported') : t('report.pickReason')}
        description={reported ? reportedText : t('report.sheetBody')}
      >
        {/* 접수 결과를 화면 읽기 프로그램에 알린다(시트 설명이 바뀌는 것만으로는 읽히지 않는다) */}
        <p role="status" className="sr-only">
          {reported ? reportedText : ''}
        </p>
        {reported ? (
          <Button fullWidth variant="tertiary" autoFocus onClick={() => setReporting(false)}>
            {t('common.close')}
          </Button>
        ) : (
          <>
            <div className="flex flex-col gap-2">
              {REPORT_REASONS.map((r) => (
                <Button
                  key={r}
                  fullWidth
                  variant="secondary"
                  disabled={report.isPending && pendingReason !== r}
                  loading={report.isPending && pendingReason === r}
                  loadingLabel={t('state.sending')}
                  onClick={() => {
                    setPendingReason(r)
                    report.mutate(
                      { postId, reason: r },
                      { onSuccess: (res) => setReported(res.duplicated ? 'dup' : 'ok') },
                    )
                  }}
                >
                  {t(`report.reason.${r}`)}
                </Button>
              ))}
            </div>
            <SlowHint busy={report.isPending} className="mt-3" />
            {report.isError ? <ErrorLine className="mt-3">{t(writeErrorKey('report.error'))}</ErrorLine> : null}
            <Button
              fullWidth
              variant="tertiary"
              className="mt-3"
              disabled={report.isPending}
              onClick={closeReport}
            >
              {t('postDetail.deleteCancel')}
            </Button>
          </>
        )}
      </BottomSheet>

      <BottomSheet
        open={confirmingBlock}
        onClose={closeBlock}
        title={t('block.action')}
        description={t('post.blockBody')}
        initialFocus="panel"
        returnFocusRef={titleRef}
      >
        <Button
          fullWidth
          variant="danger"
          icon="block"
          loading={block.isPending}
          loadingLabel={t('post.blocking')}
          onClick={() =>
            block.mutate(authorId, {
              // 차단한 사람의 글로 뒤로 돌아오지 않게 이 자리를 게시판으로 바꾼다 + "차단했어요"
              onSuccess: () => navigate(boardHref, { replace: true, state: { toast: 'state.blocked' } }),
            })
          }
        >
          {t('block.confirm')}
        </Button>
        <SlowHint busy={block.isPending} className="mt-2" />
        {block.isError ? <ErrorLine className="mt-2">{t(writeErrorKey('report.error'))}</ErrorLine> : null}
        <Button
          fullWidth
          variant="tertiary"
          className="mt-2"
          disabled={block.isPending}
          onClick={closeBlock}
        >
          {t('postDetail.deleteCancel')}
        </Button>
      </BottomSheet>
    </div>
  )
}

/**
 * 비슷한 글(PRD v1.6 §1, v1.2 D-034). 서버 RPC가 관련성 게이트(의미+어휘)를 통과한 글만 돌려주며,
 * 후보가 없으면 억지로 채우지 않고 "아직 비슷한 글이 없어요"를 보여 준다(무관한 글 노출 금지).
 * 차단한 작성자의 글은 추천에서 제외한다(재검수 P1-1b). 로딩·오류 중에는 섹션을 숨긴다(부가 기능).
 */
function SimilarPosts({ postId, boardHref }: { postId: string; boardHref: string }) {
  const { t, locale } = useTranslation()
  const { user } = useAuth()
  const { data: raw, isLoading, isError } = useSimilarPosts(postId)
  const { data: blockedIds } = useBlockedIds(user?.id)
  const { data: regions } = useRegions()
  // 다른 지역 글은 아직 열리지 않은 사람에게 보이지 않는다(D-045) — 목록과 같은 규칙
  const gate = useBoardGate()
  const data = (raw ?? [])
    .filter((s) => !blockedIds?.has(s.author_id))
    .filter((s) => gate.unlocked || inScope(gate.ownScope, s.region_id))
  // 지역·글 수를 아직 모르면 "비슷한 글이 없어요"라고 잘못 말하지 않게 섹션을 숨긴다
  const gateUnknown = gate.pending || gate.countPending || (!gate.unlocked && !gate.ownScope)
  if (isLoading || isError || gateUnknown || raw === undefined) return null
  return (
    <section className="mt-8" aria-labelledby="similar-posts-title">
      <SectionHeader
        id="similar-posts-title"
        title={t('postDetail.similar')}
        seeAll={data.length > 0 ? { to: boardHref } : undefined}
        tone="da"
      />
      {data.length === 0 ? (
        <p className="text-small text-ink-muted">{t('postDetail.similarEmpty')}</p>
      ) : (
        <ul>
          {data.map((s, i) => {
            const region = (regions ?? []).find((r) => r.id === s.region_id)
            const meta = [
              region ? regionLabel(region.id, region.names, locale) : null,
              formatPostTime(s.created_at, locale, t),
            ]
              .filter(Boolean)
              .join(' · ')
            return (
              <li key={s.id} className={i > 0 ? 'border-t border-line' : undefined}>
                <Link
                  to={`/board/${s.id}`}
                  className="-mx-5 flex min-h-16 items-center gap-3 px-5 py-3 transition-colors active:bg-surface"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-caption text-ink-muted">
                      <b className="font-bold text-ink-body">{t(postCategoryLabelKey(s.category))}</b>
                      {meta ? ` · ${meta}` : ''}
                    </span>
                    <span className="mt-0.5 line-clamp-2 break-words text-body font-bold text-ink">{s.title}</span>
                  </span>
                  <Icon name="chevron" size={20} className="shrink-0 text-ink-muted" />
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

/** 글 상세 자리 잡기: 사진 자리 + 작성자 줄 + 제목 + 본문 줄. */
function PostDetailSkeleton() {
  return (
    <div aria-hidden="true" className="pt-3">
      <div className="flex items-center gap-3">
        <SkeletonBlock className="h-10 w-10 shrink-0 rounded-full" />
        <span className="flex-1">
          <SkeletonBlock className="h-3.5 w-[34%] rounded-full" />
          <SkeletonBlock className="mt-2 h-3 w-[52%] rounded-full" />
        </span>
      </div>
      <SkeletonBlock className="mt-6 h-[22px] w-[78%] rounded-full" />
      <div className="mt-5 flex flex-col gap-3">
        <SkeletonBlock className="h-3.5 w-[94%] rounded-full" />
        <SkeletonBlock className="h-3.5 w-[88%] rounded-full" />
        <SkeletonBlock className="h-3.5 w-[62%] rounded-full" />
      </div>
    </div>
  )
}
