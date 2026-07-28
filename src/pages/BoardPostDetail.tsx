import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from '../i18n/useTranslation'
import { useAuth } from '../context/AuthContext'
import { usePost, useDeletePost, postCategoryLabelKey } from '../hooks/usePosts'
import { useRegions } from '../hooks/useRegions'
import { regionLabel } from '../lib/regionName'

export function BoardPostDetail() {
  const { t, locale } = useTranslation()
  const { postId } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()
  const { data: post, isLoading, isError, refetch, isFetching } = usePost(postId)
  const { data: regions } = useRegions()
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
  const isOwn = user?.id === post.author_id
  const createdDate = post.created_at.slice(0, 10)

  return (
    <article className="flex flex-col gap-4">
      <header>
        <h1 className="text-lg font-bold text-gray-900">{post.title}</h1>
        <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-gray-500">
          <span>{t(postCategoryLabelKey(post.category))}</span>
          {region ? <span>{regionLabel(region.id, region.names, locale)}</span> : null}
          <span>
            {post.authorNickname ?? t('board.unknownAuthor')}
            {post.authorCountry ? ` · ${post.authorCountry}` : ''}
          </span>
          <span>{createdDate}</span>
        </p>
      </header>

      <p className="whitespace-pre-line text-sm text-gray-800">{post.body}</p>

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

      <Link to="/board" className="text-green-700 underline">
        {t('postDetail.back')}
      </Link>
    </article>
  )
}
