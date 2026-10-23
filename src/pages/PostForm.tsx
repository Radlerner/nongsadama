import { useEffect, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { z } from 'zod'
import { zodResolver } from '../lib/zodResolver'
import { useAuth } from '../context/AuthContext'
import { useTranslation } from '../i18n/useTranslation'
import { useSelectedRegion } from '../context/SelectedRegionContext'
import { useOwnProfile } from '../hooks/useOwnProfile'
import { useRegions } from '../hooks/useRegions'
import {
  POST_CATEGORIES,
  PostSaveError,
  postCategoryLabelKey,
  useCreatePost,
  usePost,
  useUpdatePost,
} from '../hooks/usePosts'
import { mobileNumbers } from '../lib/postCategories'
import {
  ImageError,
  MAX_POST_IMAGES,
  imageUrl,
  prepareImage,
  removePostImages,
  thumbPath,
  uploadPreparedImages,
  type PreparedImage,
} from '../lib/postImages'
import { regionLabel } from '../lib/regionName'
import { SafetyBanner } from '../components/SafetyBanner'
import { ImagePlus, X } from '../components/ui/icons'

const schema = z.object({
  category: z.string().min(1),
  title: z.string().min(1, 'postForm.error.titleRequired').max(200, 'postForm.error.titleLong'),
  body: z.string().min(1, 'postForm.error.bodyRequired').max(5000, 'postForm.error.bodyLong'),
})

type FormValues = z.infer<typeof schema>

/** 글에 붙일 사진 한 장: 이미 올라간 것(수정) 또는 이번에 고른 것(준비 중이면 prepared 없음). */
type Photo =
  | { kind: 'existing'; key: string; path: string }
  | { kind: 'new'; key: string; prepared?: PreparedImage; preview?: string }

let photoSeq = 0

/** 게시글 작성(/board/new)·수정(/board/:postId/edit) 공용 폼. 쓰기에만 로그인 요구(PRD 4.1). */
export function PostForm() {
  const { t, locale } = useTranslation()
  const { postId } = useParams()
  const isEdit = Boolean(postId)
  const { user, initializing } = useAuth()
  const { regionId } = useSelectedRegion()
  const { data: profile, isLoading: profileLoading } = useOwnProfile(user?.id)
  const { data: regions } = useRegions()
  const { data: existing, isLoading: postLoading } = usePost(isEdit ? postId : undefined)
  const createPost = useCreatePost()
  const updatePost = useUpdatePost()
  const navigate = useNavigate()
  const location = useLocation()
  const [submitError, setSubmitError] = useState<string | null>(null)

  // 🎤 라우터에서 넘어온 프리필(PRD v1.5 §3.1 ①④). 음성 텍스트는 본문 초안일 뿐이며
  // 게시 전 공개 경고 확인(§3.2-2)을 거쳐야 제출된다. boardSearch 는 게시판 거르기 값(돌아갈 주소).
  const talkState = (location.state ?? {}) as {
    prefill?: string
    category?: string
    fromTalk?: boolean
    boardSearch?: string
  }
  const fromTalk = Boolean(talkState.fromTalk)
  const boardHref = `/board${talkState.boardSearch?.startsWith('?') ? talkState.boardSearch : ''}`
  const [publicWarningOk, setPublicWarningOk] = useState(!fromTalk)
  // 우리 동네 추천(D-043): 휴대전화 번호가 보이면 체크해야 올라간다. 체크는 그때 보인 번호들에만 유효하다.
  const [approvedNumbers, setApprovedNumbers] = useState<string | null>(null)

  // 사진(D-044): 고를 때 바로 기기에서 줄여 둔다(위치 정보 제거). 준비 중인 칸도 같은 크기로 자리를 잡는다.
  const [photos, setPhotos] = useState<Photo[]>([])
  const [photoError, setPhotoError] = useState<string | null>(null)
  const photosInitFor = useRef<string | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  // 여러 장을 한꺼번에 고르면 한 장씩 차례로 준비한다(값싼 Android에서 큰 사진 여러 장을 동시에 풀면 앱이 꺼질 수 있다)
  const prepareQueue = useRef<Promise<void>>(Promise.resolve())
  // 준비가 늦게 끝났을 때 그 사진이 아직 목록에 있는지 보려고 최신 목록을 둔다
  const photosNow = useRef<Photo[]>([])
  photosNow.current = photos
  useEffect(() => {
    if (isEdit && existing && photosInitFor.current !== existing.id) {
      photosInitFor.current = existing.id
      setPhotos((existing.image_paths ?? []).map((path) => ({ kind: 'existing', key: path, path })))
    }
  }, [isEdit, existing])
  // 미리보기 주소는 화면을 떠날 때 돌려준다
  const previews = useRef(new Set<string>())
  useEffect(() => () => previews.current.forEach((u) => URL.revokeObjectURL(u)), [])

  const {
    register,
    handleSubmit,
    watch,
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
  const isRecommend = watch('category') === 'recommend'
  const numbersKey = isRecommend ? mobileNumbers(`${watch('title')}\n${watch('body')}`).join('|') : ''
  const mobileOk = numbersKey !== '' && approvedNumbers === numbersKey
  const processing = photos.some((p) => p.kind === 'new' && !p.prepared)

  if (initializing || (isEdit && postLoading) || (user && profileLoading)) {
    return (
      <p className="rounded-card bg-white/70 px-4 py-8 text-center text-sm text-gray-500">
        {t('board.loading')}
      </p>
    )
  }

  if (!user) {
    return (
      <section className="text-center">
        <p className="mb-4 rounded-card bg-white/70 px-4 py-8 text-sm text-gray-500">
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
        <p className="rounded-card bg-white/70 px-4 py-8 text-sm text-gray-500">
          {t('postForm.notEditable')}
        </p>
        <Link to={boardHref} className="mt-4 inline-block text-green-700 underline">
          {t('postDetail.back')}
        </Link>
      </div>
    )
  }

  // 게시 지역: 내 지역(프로필 지역 → 없으면 기기에서 고른 지역). 다른 지역 보기 제한(D-045)의 글 수가
  // 내 지역 글로 세지므로, 다른 지역을 보고 있어도 글은 내 지역 게시판에 올라간다.
  const postRegionId = profile?.region_id ?? regionId ?? null
  const postRegion = (regions ?? []).find((r) => r.id === (isEdit ? existing?.region_id : postRegionId))

  if (!isEdit && !postRegionId) {
    return (
      <section className="text-center">
        <p className="mb-4 rounded-card bg-white/70 px-4 py-8 text-sm text-gray-500">
          {t('postForm.regionRequired')}
        </p>
        <Link to="/select" className="text-green-700 underline">
          {t('postForm.selectRegion')}
        </Link>
      </section>
    )
  }

  const addPhotos = (files: FileList | null) => {
    setPhotoError(null)
    const picked = Array.from(files ?? [])
    const room = MAX_POST_IMAGES - photos.length
    if (picked.length > room) setPhotoError('postForm.photoTooMany')
    for (const file of picked.slice(0, Math.max(0, room))) {
      const key = `new-${++photoSeq}`
      setPhotos((list) => [...list, { kind: 'new', key }])
      prepareQueue.current = prepareQueue.current.then(() =>
        prepareImage(file)
          .then((prepared) => {
            const preview = URL.createObjectURL(prepared.thumb)
            previews.current.add(preview)
            setPhotos((list) => list.map((p) => (p.key === key ? { kind: 'new', key, prepared, preview } : p)))
          })
          .catch((error: unknown) => {
            // 그사이 뺀 사진이면 알리지 않는다
            if (photosNow.current.some((p) => p.key === key)) {
              const reason = error instanceof ImageError ? error.reason : 'failed'
              setPhotoError(reason === 'notImage' ? 'postForm.photoNotImage' : reason === 'unreadable' ? 'postForm.photoUnreadable' : 'postForm.photoFailed')
            }
            setPhotos((list) => list.filter((p) => p.key !== key))
          }),
      )
    }
  }
  const removePhoto = (key: string) => {
    setPhotoError(null)
    setPhotos((list) => list.filter((p) => p.key !== key))
  }

  const onSubmit = handleSubmit(async (values) => {
    setSubmitError(null)
    // H-3: 무언 비활성 대신, 누르면 이유를 말해 준다(저문해력 — 침묵 실패 금지)
    if (fromTalk && !publicWarningOk) {
      setSubmitError('postForm.warningRequired')
      return
    }
    const submittedNumbers = values.category === 'recommend' ? mobileNumbers(`${values.title}\n${values.body}`).join('|') : ''
    if (submittedNumbers && submittedNumbers !== approvedNumbers) {
      setSubmitError('postForm.mobileRequired')
      return
    }
    if (processing) {
      setSubmitError('postForm.photoProcessing')
      return
    }
    // 새 사진을 먼저 올리고, 글 저장이 실패하면 방금 올린 사진을 지운다
    let uploaded: string[] = []
    try {
      const fresh = photos.flatMap((p) => (p.kind === 'new' && p.prepared ? [p.prepared] : []))
      uploaded = fresh.length > 0 ? await uploadPreparedImages(user.id, fresh) : []
    } catch {
      setSubmitError('postForm.photoFailed')
      return
    }
    let next = 0
    const imagePaths = photos.map((p) => (p.kind === 'existing' ? p.path : uploaded[next++]))
    const photosChanged = JSON.stringify(imagePaths) !== JSON.stringify(existing?.image_paths ?? [])
    try {
      if (isEdit && existing) {
        await updatePost.mutateAsync({
          id: existing.id,
          category: values.category,
          title: values.title.trim(),
          body: values.body.trim(),
          ...(photosChanged ? { image_paths: imagePaths } : {}),
        })
        // 수정에서 뺀 사진 파일은 저장이 끝난 뒤 지운다
        void removePostImages((existing.image_paths ?? []).filter((p) => !imagePaths.includes(p)))
        navigate(`/board/${existing.id}`, { state: { boardSearch: talkState.boardSearch } })
      } else {
        const created = await createPost.mutateAsync({
          author_id: user.id,
          region_id: postRegionId as string,
          category: values.category,
          title: values.title.trim(),
          body: values.body.trim(),
          source_locale: locale, // 원문 언어 = 작성 시 UI 언어(PRD 6.2)
          image_paths: imagePaths,
        })
        navigate(`/board/${created.id}`, { state: { boardSearch: talkState.boardSearch } })
      }
    } catch (error) {
      // DB가 거절했을 때만 방금 올린 사진을 지운다. 응답만 못 받은 경우엔 글이 저장됐을 수 있어 남겨 둔다(남은 파일은 정기 정리).
      if (error instanceof PostSaveError && error.rejected) void removePostImages(uploaded)
      setSubmitError('postForm.error.saveFailed')
    }
  })

  // 번호 안내는 번호를 지웠거나 체크하면, 사진 준비 안내는 준비가 끝나면 사라진다
  const shownError =
    (submitError === 'postForm.mobileRequired' && (!numbersKey || mobileOk)) || (submitError === 'postForm.photoProcessing' && !processing)
      ? null
      : submitError

  const inputClass =
    'w-full min-h-[44px] rounded-md border border-gray-300 px-3 py-2 text-base text-gray-900'
  const knownCategory = (POST_CATEGORIES as readonly string[]).includes(existing?.category ?? '')

  return (
    <section>
      <h1 className="mb-1 text-xl font-extrabold tracking-tight">
        {isEdit ? t('postForm.editTitle') : t('postForm.newTitle')}
      </h1>
      <p className="mb-4 min-h-[20px] text-sm text-gray-600">
        {postRegion ? t('postForm.targetRegion').replace('{region}', regionLabel(postRegion.id, postRegion.names, locale)) : ''}
      </p>

      <form onSubmit={(e) => void onSubmit(e)} className="flex flex-col gap-4" noValidate>
        <label className="flex flex-col gap-1 text-sm font-semibold text-gray-700">
          {t('postForm.category')}
          <select className={inputClass} {...register('category')}>
            {/* 이 버전이 모르는 종류의 글을 고칠 때 칸이 비지 않게 그 값을 그대로 둔다 */}
            {isEdit && existing && !knownCategory ? (
              <option value={existing.category}>{t(postCategoryLabelKey(existing.category))}</option>
            ) : null}
            {POST_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {t(postCategoryLabelKey(c))}
              </option>
            ))}
          </select>
        </label>

        {isRecommend ? (
          <p className="rounded-md bg-green-50 px-4 py-3 text-sm text-green-900">
            {t('postForm.recommendGuide')}
          </p>
        ) : null}

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

        <div className="flex flex-col gap-2">
          <p className="text-sm font-semibold text-gray-700">
            {t('postForm.photos').replace('{max}', String(MAX_POST_IMAGES))}
          </p>
          <div className="flex flex-wrap gap-2">
            {photos.map((p, i) => {
              const src = p.kind === 'existing' ? imageUrl(thumbPath(p.path)) : p.preview
              return (
                <div key={p.key} className="relative h-24 w-24 overflow-hidden rounded-md bg-gray-100">
                  {src ? (
                    <img src={src} alt={t('postDetail.photo').replace('{n}', String(i + 1))} className="h-full w-full object-cover" />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center px-1 text-center text-[11px] text-gray-500">
                      {t('postForm.photoProcessing')}
                    </span>
                  )}
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => removePhoto(p.key)}
                    aria-label={`${t('postForm.removePhoto')} ${i + 1}`}
                    className="absolute right-0 top-0 flex h-11 w-11 items-start justify-end p-1"
                  >
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white">
                      <X aria-hidden size={14} strokeWidth={2.5} />
                    </span>
                  </button>
                </div>
              )
            })}
            {photos.length < MAX_POST_IMAGES ? (
              <button
                type="button"
                // 올리는 중에는 사진을 더하거나 빼지 못한다 — 뺀 사진이 그대로 올라가지 않게
                disabled={isSubmitting}
                onClick={() => fileInput.current?.click()}
                className="flex h-24 w-24 flex-col items-center justify-center gap-1 rounded-md border border-dashed border-gray-400 bg-white text-xs text-gray-600 disabled:opacity-50"
              >
                <ImagePlus aria-hidden size={22} strokeWidth={2} />
                {t('postForm.addPhoto')}
              </button>
            ) : null}
          </div>
          <input
            ref={fileInput}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => {
              addPhotos(e.target.files)
              e.target.value = '' // 같은 사진을 다시 고를 수 있게
            }}
          />
          <p className="text-xs text-gray-500">{t('postForm.photoHint')}</p>
          {photoError ? (
            <p className="text-sm text-red-700">{t(photoError).replace('{max}', String(MAX_POST_IMAGES))}</p>
          ) : null}
        </div>

        {fromTalk ? (
          <label className="flex items-start gap-3 rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <input
              type="checkbox"
              checked={publicWarningOk}
              onChange={(e) => setPublicWarningOk(e.target.checked)}
              className="mt-1 h-5 w-5 accent-amber-600"
            />
            {/* 추천 글에서는 가게 번호를 허용하므로 "개인 전화번호"만 막는 문구 */}
            <span>{t(isRecommend ? 'postForm.publicWarningRecommend' : 'postForm.publicWarning')}</span>
          </label>
        ) : null}

        {numbersKey ? (
          <label className="flex items-start gap-3 rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <input
              type="checkbox"
              checked={mobileOk}
              onChange={(e) => setApprovedNumbers(e.target.checked ? numbersKey : null)}
              className="mt-1 h-5 w-5 accent-amber-600"
            />
            <span>{t('postForm.mobileWarning')}</span>
          </label>
        ) : null}

        {shownError ? (
          <p className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{t(shownError).replace('{max}', String(MAX_POST_IMAGES))}</p>
        ) : null}

        <button
          type="submit"
          disabled={isSubmitting}
          className="min-h-[56px] rounded-full bg-brand-greenDark px-6 py-3 text-base font-semibold text-white disabled:opacity-50"
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
        to={isEdit && existing ? `/board/${existing.id}` : boardHref}
        state={isEdit ? { boardSearch: talkState.boardSearch } : undefined}
        className="mt-4 inline-block text-sm text-gray-500 underline"
      >
        {t('profileEdit.cancel')}
      </Link>
    </section>
  )
}
