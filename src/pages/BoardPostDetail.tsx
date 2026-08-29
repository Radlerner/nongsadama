import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from '../i18n/useTranslation'
import { useAuth } from '../context/AuthContext'
import {
  usePost,
  useDeletePost,
  useSimilarPosts,
  postCategoryLabelKey,
} from '../hooks/usePosts'
import { useRegions } from '../hooks/useRegions'
import { useSelectedRegion } from '../context/SelectedRegionContext'
import {
  useBlockedIds,
  useBlockUser,
  useUnblockUser,
  useReportPost,
} from '../hooks/useModeration'
import { regionLabel } from '../lib/regionName'
import { regionDistanceKm } from '../lib/matching'

export function BoardPostDetail() {
  const { t, locale } = useTranslation()
  const { postId } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()
  const { data: post, isLoading, isError, refetch, isFetching } = usePost(postId)
  const { data: regions } = useRegions()
  const { regionId: viewerRegionId } = useSelectedRegion()
  const deletePost = useDeletePost()
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const { data: blockedIds } = useBlockedIds(user?.id)
  const unblock = useUnblockUser(user?.id)

  if (isLoading) {
    return (
      <p className="rounded-card bg-white/70 px-4 py-8 text-center text-sm text-gray-500">
        {t('board.loading')}
      </p>
    )
  }

  if (isError) {
    return (
      <div className="rounded-card bg-red-50 px-4 py-8 text-center text-sm text-red-700">
        <p className="mb-3">{t('board.error')}</p>
        <button
          type="button"
          onClick={() => void refetch()}
          disabled={isFetching}
          className="min-h-[44px] rounded-full border border-red-300 px-4 text-red-700 disabled:opacity-50"
        >
          {t('common.retry')}
        </button>
      </div>
    )
  }

  if (!post) {
    return (
      <div className="text-center">
        <p className="rounded-card bg-white/70 px-4 py-8 text-sm text-gray-500">
          {t('postDetail.empty')}
        </p>
        <Link to="/board" className="mt-4 inline-block text-green-700 underline">
          {t('postDetail.back')}
        </Link>
      </div>
    )
  }

  const region = (regions ?? []).find((r) => r.id === post.region_id)
  const viewerRegion = viewerRegionId
    ? (regions ?? []).find((r) => r.id === viewerRegionId)
    : undefined
  const dist = regionDistanceKm(viewerRegion, region)
  const distanceLabel =
    dist === null
      ? null
      : dist === 0
        ? t('neighbors.sameTown')
        : t('neighbors.aboutKm').replace('{n}', String(Math.max(1, Math.round(dist))))
  const isOwn = user?.id === post.author_id
  const createdDate = post.created_at.slice(0, 10)

  // 차단한 작성자의 글: 본문 대신 안내(뒤로가기·직접 URL 접근 커버, 재검수 P1-1a)
  if (!isOwn && blockedIds?.has(post.author_id)) {
    return (
      <div className="text-center">
        <p className="rounded-card bg-white/70 px-4 py-8 text-sm text-gray-500">
          {t('block.postHidden')}
        </p>
        <button
          type="button"
          disabled={unblock.isPending}
          onClick={() => unblock.mutate(post.author_id)}
          className="mt-3 min-h-[44px] text-sm text-green-700 underline disabled:opacity-50"
        >
          {t('block.unblock')}
        </button>
        <br />
        <Link to="/board" className="mt-2 inline-block text-sm text-gray-500 underline">
          {t('postDetail.back')}
        </Link>
      </div>
    )
  }

  return (
    <article className="flex flex-col gap-4">
      <header>
        <h1 className="text-xl font-extrabold tracking-tight text-gray-900">{post.title}</h1>
        <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-gray-500">
          <span>{t(postCategoryLabelKey(post.category))}</span>
          {region ? <span>{regionLabel(region.id, region.names, locale)}</span> : null}
          {distanceLabel ? <span className="text-green-700">{distanceLabel}</span> : null}
          <span>
            {post.authorNickname ?? t('board.unknownAuthor')}
            {post.authorCountry ? ` · ${post.authorCountry}` : ''}
          </span>
          <span>{createdDate}</span>
        </p>
      </header>

      <p className="whitespace-pre-line text-sm text-gray-800">{post.body}</p>

      {post.category === 'help' ? (
        <div className="rounded-md bg-amber-50 px-4 py-3 text-xs text-amber-900">
          {/* v1.5 §5 데모 완료 조건: 만남 안전 문구 */}
          <p>{t('postDetail.helpSafety')}</p>
        </div>
      ) : null}

      {/* in-app 신고·차단(Play UGC 정책, D-022) — 로그인 사용자, 타인 글에만 */}
      {user && !isOwn ? <ModerationActions postId={post.id} authorId={post.author_id} /> : null}

      {isOwn ? (
        <div className="flex gap-2">
          <Link
            to={`/board/${post.id}/edit`}
            className="inline-flex min-h-[44px] flex-1 items-center justify-center rounded-full border border-gray-300 text-sm font-semibold text-gray-700"
          >
            {t('postDetail.edit')}
          </Link>
          {confirmingDelete ? (
            <>
              <button
                type="button"
                disabled={deletePost.isPending}
                onClick={() =>
                  deletePost.mutate(post.id, { onSuccess: () => navigate('/board') })
                }
                className="min-h-[44px] flex-1 rounded-full bg-red-600 text-sm font-semibold text-white disabled:opacity-50"
              >
                {t('postDetail.deleteConfirm')}
              </button>
              <button
                type="button"
                onClick={() => setConfirmingDelete(false)}
                className="min-h-[44px] flex-1 rounded-full border border-gray-300 text-sm text-gray-700"
              >
                {t('postDetail.deleteCancel')}
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmingDelete(true)}
              className="min-h-[44px] flex-1 rounded-full border border-red-300 text-sm font-semibold text-red-700"
            >
              {t('postDetail.delete')}
            </button>
          )}
        </div>
      ) : null}

      {deletePost.isError ? (
        <p className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{t('board.error')}</p>
      ) : null}

      <SimilarPosts postId={post.id} />

      <Link to="/board" className="text-green-700 underline">
        {t('postDetail.back')}
      </Link>
    </article>
  )
}

/** 신고 사유 값 집합(신고 데이터로 저장 — 특정 언어 하드코딩이 아닌 코드값). */
const REPORT_REASONS = ['spam', 'abuse', 'scam', 'other'] as const

/**
 * in-app 신고·차단(Play UGC 정책, D-022).
 * 신고: 사유 4택 → reports insert(중복은 "이미 접수됨"). 차단: 확인 후 blocks insert → 게시판으로.
 */
function ModerationActions({ postId, authorId }: { postId: string; authorId: string }) {
  const { t } = useTranslation()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [reporting, setReporting] = useState(false)
  const [reported, setReported] = useState<null | 'ok' | 'dup'>(null)
  const [confirmingBlock, setConfirmingBlock] = useState(false)
  const report = useReportPost(user?.id)
  const block = useBlockUser(user?.id)
  const { data: blockedIds } = useBlockedIds(user?.id)
  const alreadyBlocked = blockedIds?.has(authorId) ?? false

  return (
    <div className="flex flex-col gap-2 rounded-card border border-gray-100 bg-white shadow-card px-4 py-3 text-xs">
      {reported ? (
        <p className="text-green-800">
          {reported === 'dup' ? t('report.duplicated') : t('report.done')}
        </p>
      ) : reporting ? (
        <div>
          <p className="mb-2 font-semibold text-gray-700">{t('report.pickReason')}</p>
          <div className="flex flex-wrap gap-2">
            {REPORT_REASONS.map((r) => (
              <button
                key={r}
                type="button"
                disabled={report.isPending}
                onClick={() =>
                  report.mutate(
                    { postId, reason: r },
                    { onSuccess: (res) => setReported(res.duplicated ? 'dup' : 'ok') },
                  )
                }
                className="min-h-[44px] rounded-md border border-gray-300 px-3 text-gray-700 disabled:opacity-50"
              >
                {t(`report.reason.${r}`)}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setReporting(false)}
              className="min-h-[44px] px-3 text-gray-500 underline"
            >
              {t('postDetail.deleteCancel')}
            </button>
          </div>
          {report.isError ? <p className="mt-2 text-red-700">{t('report.error')}</p> : null}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setReporting(true)}
          className="min-h-[44px] self-start font-semibold text-gray-600 underline"
        >
          🚩 {t('postDetail.report')}
        </button>
      )}

      {/* 차단 영역 — 신고 상태와 무관하게 항상 표시(신고 후에도 차단 가능) */}
      <div className="flex flex-wrap items-center gap-3">
        {alreadyBlocked ? (
          <span className="text-gray-400">{t('block.already')}</span>
        ) : confirmingBlock ? (
          <>
            <button
              type="button"
              disabled={block.isPending}
              onClick={() => block.mutate(authorId, { onSuccess: () => navigate('/board') })}
              className="min-h-[44px] rounded-full bg-red-600 px-3 font-semibold text-white disabled:opacity-50"
            >
              {t('block.confirm')}
            </button>
            <button
              type="button"
              onClick={() => setConfirmingBlock(false)}
              className="min-h-[44px] px-2 text-gray-500 underline"
            >
              {t('postDetail.deleteCancel')}
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmingBlock(true)}
            className="min-h-[44px] font-semibold text-red-600 underline"
          >
            🚫 {t('block.action')}
          </button>
        )}
        {block.isError ? <p className="text-red-700">{t('report.error')}</p> : null}
      </div>
    </div>
  )
}

/**
 * 비슷한 글(PRD v1.6 §1). 결과 없으면(데이터 5건 미만 포함) 섹션 자체를 숨긴다.
 * 차단한 작성자의 글은 추천에서 제외한다(재검수 P1-1b).
 */
function SimilarPosts({ postId }: { postId: string }) {
  const { t } = useTranslation()
  const { user } = useAuth()
  const { data: raw } = useSimilarPosts(postId)
  const { data: blockedIds } = useBlockedIds(user?.id)
  const data = (raw ?? []).filter((s) => !blockedIds?.has(s.author_id))
  if (data.length === 0) return null
  return (
    <section className="rounded-card border border-gray-100 bg-white shadow-card px-4 py-3">
      <p className="mb-2 text-xs font-semibold text-gray-500">{t('postDetail.similar')}</p>
      <ul className="flex flex-col gap-1">
        {data.map((s) => (
          <li key={s.id}>
            <Link to={`/board/${s.id}`} className="block min-h-[44px] py-2 text-sm text-gray-800 active:bg-gray-50">
              <span aria-hidden className="mr-1">💬</span>
              {s.title}
              <span className="ml-2 text-[11px] text-gray-400">{t(postCategoryLabelKey(s.category))}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
