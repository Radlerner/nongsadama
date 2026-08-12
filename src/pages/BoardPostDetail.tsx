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
import { regionLabel } from '../lib/regionName'
import { regionDistanceKm } from '../lib/matching'
import { operatorEmail } from '../config/app'

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

  if (isLoading) {
    return (
      <p className="rounded-md bg-gray-50 px-4 py-8 text-center text-sm text-gray-500">
        {t('board.loading')}
      </p>
    )
  }

  if (isError) {
    return (
      <div className="rounded-md bg-red-50 px-4 py-8 text-center text-sm text-red-700">
        <p className="mb-3">{t('board.error')}</p>
        <button
          type="button"
          onClick={() => void refetch()}
          disabled={isFetching}
          className="min-h-[44px] rounded-md border border-red-300 px-4 text-red-700 disabled:opacity-50"
        >
          {t('common.retry')}
        </button>
      </div>
    )
  }

  if (!post) {
    return (
      <div className="text-center">
        <p className="rounded-md bg-gray-50 px-4 py-8 text-sm text-gray-500">
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

  return (
    <article className="flex flex-col gap-4">
      <header>
        <h1 className="text-lg font-bold text-gray-900">{post.title}</h1>
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
          {/* v1.5 §5 데모 완료 조건: 만남 안전 문구 + 신고 수단 */}
          <p>{t('postDetail.helpSafety')}</p>
          <a
            href={`mailto:${operatorEmail}?subject=${encodeURIComponent('[농사다마 신고] 게시글 ' + post.id)}`}
            className="mt-1 inline-block font-semibold underline"
          >
            {t('postDetail.report')}
          </a>
        </div>
      ) : null}

      {isOwn ? (
        <div className="flex gap-2">
          <Link
            to={`/board/${post.id}/edit`}
            className="inline-flex min-h-[44px] flex-1 items-center justify-center rounded-md border border-gray-300 text-sm font-semibold text-gray-700"
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
                className="min-h-[44px] flex-1 rounded-md bg-red-600 text-sm font-semibold text-white disabled:opacity-50"
              >
                {t('postDetail.deleteConfirm')}
              </button>
              <button
                type="button"
                onClick={() => setConfirmingDelete(false)}
                className="min-h-[44px] flex-1 rounded-md border border-gray-300 text-sm text-gray-700"
              >
                {t('postDetail.deleteCancel')}
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmingDelete(true)}
              className="min-h-[44px] flex-1 rounded-md border border-red-300 text-sm font-semibold text-red-700"
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

/** 비슷한 글(PRD v1.6 §1). 결과 없으면(데이터 5건 미만 포함) 섹션 자체를 숨긴다. */
function SimilarPosts({ postId }: { postId: string }) {
  const { t } = useTranslation()
  const { data } = useSimilarPosts(postId)
  if (!data || data.length === 0) return null
  return (
    <section className="rounded-md border border-gray-200 px-4 py-3">
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
