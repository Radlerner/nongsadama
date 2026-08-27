import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { z } from 'zod'
import { zodResolver } from '../lib/zodResolver'
import { useAuth } from '../context/AuthContext'
import { useTranslation } from '../i18n/useTranslation'
import { useSelectedRegion } from '../context/SelectedRegionContext'
import { useOwnProfile } from '../hooks/useOwnProfile'
import {
  POST_CATEGORIES,
  postCategoryLabelKey,
  useCreatePost,
  usePost,
  useUpdatePost,
} from '../hooks/usePosts'
import { SafetyBanner } from '../components/SafetyBanner'

const schema = z.object({
  category: z.string().min(1),
  title: z.string().min(1, 'postForm.error.titleRequired').max(200, 'postForm.error.titleLong'),
  body: z.string().min(1, 'postForm.error.bodyRequired').max(5000, 'postForm.error.bodyLong'),
})

type FormValues = z.infer<typeof schema>

/** 게시글 작성(/board/new)·수정(/board/:postId/edit) 공용 폼. 쓰기에만 로그인 요구(PRD 4.1). */
export function PostForm() {
  const { t, locale } = useTranslation()
  const { postId } = useParams()
  const isEdit = Boolean(postId)
  const { user, initializing } = useAuth()
  const { regionId } = useSelectedRegion()
  const { data: profile } = useOwnProfile(user?.id)
  const { data: existing, isLoading: postLoading } = usePost(isEdit ? postId : undefined)
  const createPost = useCreatePost()
  const updatePost = useUpdatePost()
  const navigate = useNavigate()
  const location = useLocation()
  const [submitError, setSubmitError] = useState<string | null>(null)

  // 🎤 라우터에서 넘어온 프리필(PRD v1.5 §3.1 ①④). 음성 텍스트는 본문 초안일 뿐이며
  // 게시 전 공개 경고 확인(§3.2-2)을 거쳐야 제출된다.
  const talkState = (location.state ?? {}) as {
    prefill?: string
    category?: string
    fromTalk?: boolean
  }
  const fromTalk = Boolean(talkState.fromTalk)
  const [publicWarningOk, setPublicWarningOk] = useState(!fromTalk)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    values:
      isEdit && existing
        ? { category: existing.category, title: existing.title, body: existing.body }
        : undefined,
    defaultValues: {
      category:
        talkState.category && (POST_CATEGORIES as readonly string[]).includes(talkState.category)
          ? talkState.category
          : POST_CATEGORIES[0],
      title: '',
      body: talkState.prefill ?? '',
    },
  })

  if (initializing || (isEdit && postLoading)) {
    return (
      <p className="rounded-md bg-gray-50 px-4 py-8 text-center text-sm text-gray-500">
        {t('board.loading')}
      </p>
    )
  }

  if (!user) {
    return (
      <section className="text-center">
        <p className="mb-4 rounded-md bg-gray-50 px-4 py-8 text-sm text-gray-500">
          {t('postForm.loginRequired')}
        </p>
        <Link to="/login" className="text-green-700 underline">
          {t('profile.loginCta')}
        </Link>
      </section>
    )
  }

  if (isEdit && (!existing || existing.author_id !== user.id)) {
    return (
      <div className="text-center">
        <p className="rounded-md bg-gray-50 px-4 py-8 text-sm text-gray-500">
          {t('postForm.notEditable')}
        </p>
        <Link to="/board" className="mt-4 inline-block text-green-700 underline">
          {t('postDetail.back')}
        </Link>
      </div>
    )
  }

  // 게시 지역: 현재 선택 지역 → 없으면 프로필 지역(PRD 4.2 지역 피드 기준)
  const postRegionId = regionId ?? profile?.region_id ?? null

  if (!isEdit && !postRegionId) {
    return (
      <section className="text-center">
        <p className="mb-4 rounded-md bg-gray-50 px-4 py-8 text-sm text-gray-500">
          {t('postForm.regionRequired')}
        </p>
        <Link to="/select" className="text-green-700 underline">
          {t('postForm.selectRegion')}
        </Link>
      </section>
    )
  }

  const onSubmit = handleSubmit(async (values) => {
    setSubmitError(null)
    // H-3: 무언 비활성 대신, 누르면 이유를 말해 준다(저문해력 — 침묵 실패 금지)
    if (fromTalk && !publicWarningOk) {
      setSubmitError('postForm.warningRequired')
      return
    }
    try {
      if (isEdit && existing) {
        await updatePost.mutateAsync({
          id: existing.id,
          category: values.category,
          title: values.title.trim(),
          body: values.body.trim(),
        })
        navigate(`/board/${existing.id}`)
      } else {
        const created = await createPost.mutateAsync({
          author_id: user.id,
          region_id: postRegionId as string,
          category: values.category,
          title: values.title.trim(),
          body: values.body.trim(),
          source_locale: locale, // 원문 언어 = 작성 시 UI 언어(PRD 6.2)
        })
        navigate(`/board/${created.id}`)
      }
    } catch {
      setSubmitError('postForm.error.saveFailed')
    }
  })

  const inputClass =
    'w-full min-h-[44px] rounded-md border border-gray-300 px-3 py-2 text-base text-gray-900'

  return (
    <section>
      <h1 className="mb-4 text-lg font-bold">
        {isEdit ? t('postForm.editTitle') : t('postForm.newTitle')}
      </h1>

      <form onSubmit={(e) => void onSubmit(e)} className="flex flex-col gap-4" noValidate>
        <label className="flex flex-col gap-1 text-sm font-semibold text-gray-700">
          {t('postForm.category')}
          <select className={inputClass} {...register('category')}>
            {POST_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {t(postCategoryLabelKey(c))}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm font-semibold text-gray-700">
          {t('postForm.titleField')}
          <input type="text" className={inputClass} {...register('title')} />
          {errors.title?.message ? (
            <span className="font-normal text-red-700">{t(errors.title.message)}</span>
          ) : null}
        </label>

        <label className="flex flex-col gap-1 text-sm font-semibold text-gray-700">
          {t('postForm.bodyField')}
          <textarea rows={8} className={`${inputClass} resize-y`} {...register('body')} />
          {errors.body?.message ? (
            <span className="font-normal text-red-700">{t(errors.body.message)}</span>
          ) : null}
        </label>

        {fromTalk ? (
          <label className="flex items-start gap-3 rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <input
              type="checkbox"
              checked={publicWarningOk}
              onChange={(e) => setPublicWarningOk(e.target.checked)}
              className="mt-1 h-5 w-5 accent-amber-600"
            />
            <span>{t('postForm.publicWarning')}</span>
          </label>
        ) : null}

        {submitError ? (
          <p className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{t(submitError)}</p>
        ) : null}

        <button
          type="submit"
          disabled={isSubmitting}
          className="min-h-[56px] rounded-md bg-brand-greenDark px-6 py-3 text-base font-semibold text-white disabled:opacity-50"
        >
          {isSubmitting ? t('auth.loading') : t('postForm.submit')}
        </button>
      </form>

      {fromTalk ? (
        <div className="mt-4">
          <SafetyBanner />
        </div>
      ) : null}

      <Link
        to={isEdit && existing ? `/board/${existing.id}` : '/board'}
        className="mt-4 inline-block text-sm text-gray-500 underline"
      >
        {t('profileEdit.cancel')}
      </Link>
    </section>
  )
}
