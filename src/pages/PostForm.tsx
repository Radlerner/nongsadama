import { useEffect, useId, useRef, useState } from 'react'
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
import { BOARD_FILTERS, mobileNumbers } from '../lib/postCategories'
import {
  ImageError,
  MAX_POST_IMAGES,
  imageSize,
  imageUrl,
  prepareImage,
  removePostImages,
  thumbPath,
  uploadPreparedImages,
  type PreparedImage,
} from '../lib/postImages'
import { regionLabel } from '../lib/regionName'
import { SafetyBanner } from '../components/SafetyBanner'
import { cameFromDetail, flashToast } from '../components/layout/flash'
import {
  Button,
  EmptyState,
  ErrorState,
  Icon,
  LoadingState,
  SlowHint,
  Spinner,
  buttonClasses,
  cn,
} from '../components/ui'
import { ErrorLine, NoteBox } from '../components/board/PostParts'
import { PhotoSlot } from '../components/board/PostPhotos'

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

/** 이번에 고른 사진의 올리기 상태(게시할 때 한 장씩 올린다) */
type UploadStatus = 'uploading' | 'done' | 'failed'

let photoSeq = 0

/** 입력칸(키트): 48px 이상, 흰 바탕 + 입력칸 선(line-input, 3:1), 초점은 초록 테두리, 오류는 빨간 선. */
const FIELD =
  'block w-full rounded-lg border border-line-input bg-white px-4 text-body text-ink transition-colors placeholder:text-ink-muted focus:border-nong-600 aria-[invalid=true]:border-danger'

/** 게시글 작성(/board/new)·수정(/board/:postId/edit) 공용 폼. 쓰기에만 로그인 요구(PRD 4.1). */
export function PostForm() {
  const { t, locale } = useTranslation()
  const { postId } = useParams()
  const isEdit = Boolean(postId)
  const { user, initializing } = useAuth()
  const { regionId } = useSelectedRegion()
  const { data: profile, isLoading: profileLoading } = useOwnProfile(user?.id)
  const { data: regions } = useRegions()
  const {
    data: existing,
    isPending: postPending,
    isError: postError,
    refetch: refetchPost,
    isFetching: postFetching,
  } = usePost(isEdit ? postId : undefined)
  const createPost = useCreatePost()
  const updatePost = useUpdatePost()
  const navigate = useNavigate()
  const location = useLocation()
  const [submitError, setSubmitError] = useState<string | null>(null)
  const ids = useId()
  const titleErrorId = `${ids}-title-error`
  const bodyErrorId = `${ids}-body-error`
  const bodyHintId = `${ids}-body-hint`
  const photoHeadingId = `${ids}-photos`
  const photoHintId = `${ids}-photo-hint`

  // 말하기(/talk)에서 라우터로 넘어온 프리필(PRD v1.5 §3.1 ①④). 음성 텍스트는 본문 초안일 뿐이며
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
  // 준비·올리기가 늦게 끝났을 때 그 사진이 아직 목록에 있는지 보려고 최신 목록을 둔다
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

  // 올리기(게시할 때 한 장씩, 같은 lib/postImages 함수): 한 장이 실패해도 이미 올라간 사진은 다시 올리지 않는다
  // (시골 통신비). 실패한 칸은 "다시 올리기"로 그 사진만 다시 보낸다.
  const [uploads, setUploads] = useState<Record<string, UploadStatus>>({})
  const [phase, setPhase] = useState<'idle' | 'uploading' | 'saving'>('idle')
  const submitBlock = useRef<HTMLDivElement>(null)
  const hasFresh = photos.some((p) => p.kind === 'new')
  useEffect(() => {
    // 올리기 카드가 바쁜 게시 버튼 위에 끼어들면 버튼·SlowHint를 아래 탭·말하기 원 위로 올린다
    if (phase === 'uploading' && hasFresh) submitBlock.current?.scrollIntoView({ block: 'nearest' })
  }, [phase, hasFresh])
  const uploadedPaths = useRef(new Map<string, string>()) // 사진 key → 올린 경로
  const inflight = useRef(new Map<string, Promise<string>>())
  // 올렸지만 아직 어느 글에도 붙지 않은 파일: 글을 저장하지 않고 화면을 떠나면 지운다(주소만 알면 열리는 공개 버킷)
  const unsaved = useRef(new Set<string>())
  // 게시·저장 중에 떠나도 그 일은 끝까지 간다(main과 같다): 끝난 뒤 글에 붙지 않은 파일만 지운다.
  // 떠난 뒤 끝난 '다시 올리기'도 여기서 지운다.
  const submitRun = useRef<Promise<unknown>>(Promise.resolve())
  useEffect(
    () => () => {
      void Promise.allSettled([submitRun.current, ...inflight.current.values()]).then(() => {
        const paths = [...unsaved.current]
        unsaved.current.clear()
        void removePostImages(paths)
      })
    },
    [],
  )

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
  const uploadingNow = photos.some((p) => uploads[p.key] === 'uploading')
  const anyFailed = photos.some((p) => uploads[p.key] === 'failed')
  // 올리는 중에는 사진을 더하거나 빼지 못한다 — 뺀 사진이 그대로 올라가지 않게
  const busy = isSubmitting || uploadingNow

  const heading = (
    <h1 className="text-title text-ink">{isEdit ? t('postForm.editTitle') : t('postForm.newTitle')}</h1>
  )

  // 수정: 글을 받기 전(오프라인으로 멈춘 경우 포함)에는 "수정할 수 없음"으로 판단하지 않는다
  if (initializing || (isEdit && postPending && !postError) || (user && profileLoading)) {
    return (
      <section>
        {heading}
        <LoadingState
          tone="da"
          label={isEdit ? t('board.loading') : t('state.loading')}
          offlineLabel={isEdit ? t('board.waitingNetwork') : undefined}
          className="mt-2"
        />
      </section>
    )
  }

  if (!user) {
    return (
      <section>
        {heading}
        <EmptyState
          className="mt-4"
          icon="lock"
          title={t('postForm.loginRequired')}
          action={{ label: t('profile.loginCta'), to: '/login', primary: true }}
        />
      </section>
    )
  }

  if (isEdit && postError && existing === undefined) {
    return (
      <section>
        {heading}
        <ErrorState
          className="mt-4"
          title={t('board.error')}
          onRetry={() => void refetchPost()}
          retrying={postFetching}
          tone="da"
          fallback={{ label: t('postDetail.back'), to: boardHref }}
        />
      </section>
    )
  }

  if (isEdit && (!existing || existing.author_id !== user.id)) {
    return (
      <section>
        {heading}
        <EmptyState
          className="mt-4"
          icon="lock"
          title={t('postForm.notEditable')}
          action={{ label: t('postDetail.back'), to: boardHref }}
        />
      </section>
    )
  }

  // 게시 지역: 내 지역(프로필 지역 → 없으면 기기에서 고른 지역). 다른 지역 보기 제한(D-045)의 글 수가
  // 내 지역 글로 세지므로, 다른 지역을 보고 있어도 글은 내 지역 게시판에 올라간다.
  const postRegionId = profile?.region_id ?? regionId ?? null
  const postRegion = (regions ?? []).find((r) => r.id === (isEdit ? existing?.region_id : postRegionId))

  if (!isEdit && !postRegionId) {
    return (
      <section>
        {heading}
        <EmptyState
          className="mt-4"
          icon="pin"
          title={t('postForm.regionRequired')}
          action={{ label: t('postForm.selectRegion'), to: '/select', icon: 'pin', primary: true }}
        />
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

  /** 이번에 올린(글에는 아직 안 붙은) 사진 기록을 지운다. 다음 게시 때 새로 올린다. */
  const forgetUploads = (keys: string[]) => {
    for (const key of keys) {
      const path = uploadedPaths.current.get(key)
      if (path) unsaved.current.delete(path)
      uploadedPaths.current.delete(key)
    }
    setUploads((s) => Object.fromEntries(Object.entries(s).filter(([k]) => !keys.includes(k))))
  }

  const removePhoto = (key: string) => {
    if (busy) return
    setPhotoError(null)
    // 이미 올렸지만 글에 붙지 않은 사진이면 파일도 지운다
    const path = uploadedPaths.current.get(key)
    if (path) void removePostImages([path])
    forgetUploads([key])
    setPhotos((list) => list.filter((p) => p.key !== key))
  }

  /** 사진 한 장 올리기(같은 사진을 두 번 보내지 않는다). 성공하면 경로. */
  const uploadOne = (key: string, prepared: PreparedImage): Promise<string> => {
    const have = uploadedPaths.current.get(key)
    if (have) return Promise.resolve(have)
    const running = inflight.current.get(key)
    if (running) return running
    setUploads((s) => ({ ...s, [key]: 'uploading' }))
    const job = uploadPreparedImages(user.id, [prepared])
      .then(([path]) => {
        uploadedPaths.current.set(key, path)
        unsaved.current.add(path)
        setUploads((s) => ({ ...s, [key]: 'done' }))
        return path
      })
      .catch((error: unknown) => {
        setUploads((s) => ({ ...s, [key]: 'failed' }))
        throw error
      })
      .finally(() => inflight.current.delete(key))
    inflight.current.set(key, job)
    return job
  }

  const retryPhoto = (key: string) => {
    const photo = photos.find((p) => p.key === key)
    if (photo?.kind !== 'new' || !photo.prepared || busy) return
    // 실패는 칸이 다시 보여 준다. 다시 올리기가 되면 오프라인·사진 실패 안내를 지운다
    void uploadOne(key, photo.prepared)
      .then(() => setSubmitError((e) => (e === 'common.offline' || e === 'postForm.photoFailed' ? null : e)))
      .catch(() => undefined)
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
    // 새 사진을 먼저 한 장씩 올리고, 글 저장이 거절되면 방금 올린 사진을 지운다
    const fresh = photos.flatMap((p) => (p.kind === 'new' && p.prepared ? [{ key: p.key, prepared: p.prepared }] : []))
    setPhase('uploading')
    try {
      for (const p of fresh) await uploadOne(p.key, p.prepared)
    } catch {
      setPhase('idle')
      setSubmitError(navigator.onLine ? 'postForm.photoFailed' : 'common.offline')
      return
    }
    const imagePaths = photos.map((p) => (p.kind === 'existing' ? p.path : (uploadedPaths.current.get(p.key) as string)))
    const freshKeys = fresh.map((p) => p.key)
    const freshPaths = freshKeys.map((k) => uploadedPaths.current.get(k) as string)
    const photosChanged = JSON.stringify(imagePaths) !== JSON.stringify(existing?.image_paths ?? [])
    setPhase('saving')
    try {
      if (isEdit && existing) {
        await updatePost.mutateAsync({
          id: existing.id,
          category: values.category,
          title: values.title.trim(),
          body: values.body.trim(),
          ...(photosChanged ? { image_paths: imagePaths } : {}),
        })
        for (const path of freshPaths) unsaved.current.delete(path)
        // 수정에서 뺀 사진 파일은 저장이 끝난 뒤 지운다
        void removePostImages((existing.image_paths ?? []).filter((p) => !imagePaths.includes(p)))
        // 글 상세에서 왔으면 그 화면으로 돌아간다(같은 글이 history에 두 번 쌓이지 않게).
        // 아니면 replace: 뒤로 가기가 다 쓴 폼으로 돌아오지 않게. 도착한 글에서 "저장했어요" 알림(AppLayout)
        if (cameFromDetail(location.state)) {
          flashToast('state.saved')
          navigate(-1)
        } else {
          navigate(`/board/${existing.id}`, {
            replace: true,
            state: { toast: 'state.saved', boardSearch: talkState.boardSearch },
          })
        }
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
        for (const path of freshPaths) unsaved.current.delete(path)
        // replace: 뒤로 가기가 다 쓴 폼으로 돌아오지 않게. 도착한 글에서 "글을 올렸어요"
        navigate(`/board/${created.id}`, {
          replace: true,
          state: { toast: 'state.posted', boardSearch: talkState.boardSearch },
        })
      }
    } catch (error) {
      setPhase('idle')
      if (error instanceof PostSaveError && error.rejected) {
        // DB가 거절했다: 방금 올린 사진을 지운다
        void removePostImages(freshPaths)
      } else {
        // 응답만 못 받았다: 글이 저장됐을 수 있어 파일을 남긴다(떠날 때도 지우지 않는다 — 남은 파일은 정기 정리).
        // 다시 게시하면 새로 올린다(두 글이 같은 파일을 나눠 쓰지 않게).
        for (const path of freshPaths) unsaved.current.delete(path)
      }
      forgetUploads(freshKeys)
      setSubmitError(navigator.onLine ? 'postForm.error.saveFailed' : 'common.offline')
    }
  })

  // 번호 안내는 번호를 지웠거나 체크하면, 사진 준비 안내는 준비가 끝나면, 사진 실패 안내는 실패한 칸이 없어지면 사라진다
  const shownError =
    (submitError === 'postForm.mobileRequired' && (!numbersKey || mobileOk)) ||
    (submitError === 'postForm.photoProcessing' && !processing) ||
    (submitError === 'postForm.photoFailed' && !anyFailed)
      ? null
      : submitError

  const knownCategory = (POST_CATEGORIES as readonly string[]).includes(existing?.category ?? '')
  // 고르는 순서는 게시판 알약과 같게(우리 동네 추천이 먼저). 이 버전이 모르는 종류의 글을 고칠 때는 그 값을 그대로 둔다
  const categoryOptions: string[] = [
    ...(isEdit && existing && !knownCategory ? [existing.category] : []),
    ...BOARD_FILTERS,
  ]

  // 올리기 진행(키트 4.18): 올릴 새 사진의 크기(바이트)로 센다 — 한 장이 다 올라갈 때마다 늘어난다
  const freshPhotos = photos.flatMap((p) => (p.kind === 'new' && p.prepared ? [{ ...p, prepared: p.prepared }] : []))
  const totalBytes = freshPhotos.reduce((n, p) => n + p.prepared.full.size + p.prepared.thumb.size, 0)
  const doneFresh = freshPhotos.filter((p) => uploads[p.key] === 'done')
  const doneBytes = doneFresh.reduce((n, p) => n + p.prepared.full.size + p.prepared.thumb.size, 0)
  const pct = totalBytes > 0 ? Math.round((doneBytes / totalBytes) * 100) : 0
  const showUpload = phase === 'uploading' && freshPhotos.length > 0
  const uploadingPhoto = freshPhotos.find((p) => uploads[p.key] === 'uploading')

  const regionText = postRegion ? regionLabel(postRegion.id, postRegion.names, locale) : ''
  const [regionBefore, regionAfter = ''] = t('postForm.targetRegion').split('{region}')
  const backFromDetail = cameFromDetail(location.state)

  return (
    <section>
      {heading}

      <form
        onSubmit={(e) => {
          submitRun.current = onSubmit(e)
        }}
        className="mt-5 flex flex-col gap-6"
        noValidate
      >
        <fieldset className="min-w-0">
          <legend className="text-label text-ink">{t('postForm.category')}</legend>
          <div className="mt-1 flex flex-wrap gap-x-1">
            {categoryOptions.map((c) => (
              <label key={c} className="flex h-11 shrink-0 cursor-pointer items-center">
                <input type="radio" value={c} className="peer sr-only" {...register('category')} />
                <span
                  className={cn(
                    'flex h-9 items-center gap-1.5 whitespace-nowrap rounded-full px-4 text-label font-normal text-ink-muted transition-colors',
                    'peer-checked:bg-surface-2 peer-checked:font-bold peer-checked:text-ink',
                    'peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-nong-600',
                    c === 'recommend' && 'pl-3',
                  )}
                >
                  {c === 'recommend' ? <Icon name="pin" size={18} /> : null}
                  {t(postCategoryLabelKey(c))}
                </span>
              </label>
            ))}
          </div>
          {isRecommend ? (
            <NoteBox icon="info" className="mt-3">
              <p>{t('postForm.recommendGuide')}</p>
            </NoteBox>
          ) : null}
        </fieldset>

        {/* 사진이 먼저(PostForm 아트보드) */}
        <section aria-labelledby={photoHeadingId}>
          <div className="flex items-center justify-between gap-3">
            <h2 id={photoHeadingId} className="text-label text-ink">
              {t('postForm.photos').replace('{max}', String(MAX_POST_IMAGES))}
            </h2>
            <span aria-hidden="true" className="shrink-0 text-caption text-ink-muted">
              {photos.length} / {MAX_POST_IMAGES}
            </span>
          </div>
          <Button
            variant="secondary"
            fullWidth
            icon="photo-add"
            className="mt-2"
            disabled={busy || photos.length >= MAX_POST_IMAGES}
            aria-describedby={photoHintId}
            onClick={() => fileInput.current?.click()}
          >
            {t('postForm.addPhoto')}
          </Button>
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
          {photos.length > 0 ? (
            <ul className="mt-3 grid grid-cols-3 gap-2.5">
              {photos.map((p, i) => (
                <PhotoTile
                  key={p.key}
                  photo={p}
                  index={i}
                  status={uploads[p.key]}
                  busy={busy}
                  onRemove={() => removePhoto(p.key)}
                  onRetry={() => retryPhoto(p.key)}
                />
              ))}
            </ul>
          ) : null}
          {processing ? (
            <p role="status" className="mt-3 flex items-center gap-2 text-small text-ink-body">
              <Spinner tone="da" />
              {t('postForm.photoProcessing')}
            </p>
          ) : null}
          <div id={photoHintId} className="mt-3 flex flex-col gap-1.5">
            <p className="flex items-start gap-2 text-small text-ink-body">
              <Icon name="shield" size={18} className="mt-0.5 shrink-0 text-nong-600" />
              <span>{t('postForm.photoHint')}</span>
            </p>
            <p className="flex items-start gap-2 text-small text-ink-body">
              <Icon name="alert" size={18} className="mt-0.5 shrink-0 text-ink-body" />
              <span>{t('postForm.photoSafety')}</span>
            </p>
          </div>
          {photoError ? (
            <ErrorLine className="mt-2">{t(photoError).replace('{max}', String(MAX_POST_IMAGES))}</ErrorLine>
          ) : null}
        </section>

        <div>
          <label className="flex flex-col gap-2">
            <span className="text-label text-ink">{t('postForm.titleField')}</span>
            <input
              type="text"
              placeholder={t('post.form.titlePlaceholder')}
              aria-invalid={errors.title ? true : undefined}
              aria-describedby={errors.title ? titleErrorId : undefined}
              className={cn(FIELD, 'h-12')}
              {...register('title')}
            />
          </label>
          {errors.title?.message ? (
            <ErrorLine id={titleErrorId} className="mt-2">
              {t(errors.title.message)}
            </ErrorLine>
          ) : null}
        </div>

        <div>
          <div className="-mb-1.5 -mt-3 flex min-h-11 items-center justify-between gap-3">
            {/* 칸 이름도 누르면 입력칸으로 간다 — 누르는 자리 44px */}
            <label htmlFor={`${ids}-body`} className="inline-flex min-h-11 min-w-11 items-center text-label text-ink">
              {t('postForm.bodyField')}
            </label>
            {fromTalk ? (
              <span className="inline-flex min-h-8 shrink-0 items-center gap-1 rounded-full bg-nong-50 px-3 text-caption font-bold text-nong-600">
                <Icon name="mic" size={16} />
                {t('post.form.talkDraft')}
              </span>
            ) : null}
          </div>
          <textarea
            id={`${ids}-body`}
            rows={8}
            placeholder={t('post.form.bodyPlaceholder')}
            aria-invalid={errors.body ? true : undefined}
            aria-describedby={
              [errors.body ? bodyErrorId : null, fromTalk ? bodyHintId : null].filter(Boolean).join(' ') || undefined
            }
            className={cn(FIELD, 'mt-2 min-h-[12rem] resize-y py-3')}
            {...register('body')}
          />
          {errors.body?.message ? (
            <ErrorLine id={bodyErrorId} className="mt-2">
              {t(errors.body.message)}
            </ErrorLine>
          ) : null}
          {fromTalk ? (
            <p id={bodyHintId} className="mt-2 text-caption text-ink-muted">
              {t('post.form.talkHint')}
            </p>
          ) : null}
        </div>

        {/* 어디에 올라가는지(수정은 원래 글의 지역) */}
        {regionText ? (
          <p className="flex min-h-12 items-center gap-2 rounded-xl border border-line px-4 py-2 text-small text-ink-body">
            <Icon name="pin" size={20} className="shrink-0 text-ink-muted" />
            <span>
              {regionBefore}
              <b className="font-bold text-ink">{regionText}</b>
              {regionAfter}
            </span>
          </p>
        ) : null}

        {fromTalk ? (
          <label className="flex min-h-12 cursor-pointer items-start gap-3 rounded-xl border border-line bg-surface px-4 py-3.5">
            <input
              type="checkbox"
              checked={publicWarningOk}
              onChange={(e) => setPublicWarningOk(e.target.checked)}
              className="mt-0.5 h-6 w-6 shrink-0 accent-nong-600"
            />
            {/* 추천 글에서는 가게 번호를 허용하므로 "개인 전화번호"만 막는 문구 */}
            <span className="text-small text-ink">
              {t(isRecommend ? 'postForm.publicWarningRecommend' : 'postForm.publicWarning')}
            </span>
          </label>
        ) : null}

        {numbersKey ? (
          <label className="flex min-h-12 cursor-pointer items-start gap-3 rounded-xl border border-line bg-surface px-4 py-3.5">
            <input
              type="checkbox"
              checked={mobileOk}
              onChange={(e) => setApprovedNumbers(e.target.checked ? numbersKey : null)}
              className="mt-0.5 h-6 w-6 shrink-0 accent-nong-600"
            />
            <span className="text-small text-ink">{t('postForm.mobileWarning')}</span>
          </label>
        ) : null}

        <div ref={submitBlock} className="flex flex-col gap-2">
          {showUpload ? (
            <div role="status" className="flex items-center gap-3 rounded-xl border border-line py-3 pl-3 pr-4">
              <span className="skel relative h-12 w-12 shrink-0 overflow-hidden rounded-lg">
                {(uploadingPhoto ?? freshPhotos[freshPhotos.length - 1])?.preview ? (
                  <img
                    src={(uploadingPhoto ?? freshPhotos[freshPhotos.length - 1]).preview}
                    alt=""
                    className="absolute inset-0 h-full w-full object-cover"
                  />
                ) : null}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex justify-between gap-2 text-label text-ink">
                  <span>{t('state.uploading')}</span>
                  <span className="text-nong-600">{pct}%</span>
                </span>
                <span aria-hidden="true" className="mt-2 block h-1 overflow-hidden rounded-full bg-surface-2">
                  <span
                    className="block h-full rounded-full bg-nong-600 transition-[width] duration-500"
                    style={{ width: `${pct}%` }}
                  />
                </span>
                <span className="mt-1.5 block text-caption text-ink-muted">
                  {t('postForm.uploadedOf')
                    .replace('{total}', String(freshPhotos.length))
                    .replace('{n}', String(doneFresh.length))}
                </span>
              </span>
            </div>
          ) : null}
          {shownError ? (
            <ErrorLine className="mb-1">{t(shownError).replace('{max}', String(MAX_POST_IMAGES))}</ErrorLine>
          ) : null}
          <Button
            type="submit"
            fullWidth
            icon={isEdit ? 'check-plain' : 'arrow-up'}
            loading={isSubmitting}
            loadingLabel={
              phase === 'uploading' && freshPhotos.length > 0
                ? `${t('state.uploading')} ${pct}%`
                : isEdit
                  ? t('state.saving')
                  : t('state.posting')
            }
          >
            {isEdit ? t('profileEdit.save') : t('postForm.submit')}
          </Button>
          <SlowHint busy={isSubmitting} />
          {backFromDetail ? (
            <Button variant="secondary" fullWidth disabled={isSubmitting} onClick={() => navigate(-1)}>
              {t('profileEdit.cancel')}
            </Button>
          ) : (
            <Link
              to={isEdit && existing ? `/board/${existing.id}` : boardHref}
              state={isEdit ? { boardSearch: talkState.boardSearch } : undefined}
              className={buttonClasses({ variant: 'secondary', fullWidth: true })}
            >
              {t('profileEdit.cancel')}
            </Link>
          )}
        </div>
      </form>

      {fromTalk ? (
        <div className="mt-8">
          <SafetyBanner />
        </div>
      ) : null}
    </section>
  )
}

/** 고른 사진 한 칸(세 칸 줄의 정사각): 준비 중 · 올리는 중 · 올림 · 실패(다시 올리기) + 빼기 버튼. */
function PhotoTile({
  photo,
  index,
  status,
  busy,
  onRemove,
  onRetry,
}: {
  photo: Photo
  index: number
  status: UploadStatus | undefined
  busy: boolean
  onRemove: () => void
  onRetry: () => void
}) {
  const { t } = useTranslation()
  const removeRef = useRef<HTMLButtonElement>(null)
  const label = t('postDetail.photo').replace('{n}', String(index + 1))
  const src = photo.kind === 'existing' ? imageUrl(thumbPath(photo.path)) : photo.preview
  const preparing = photo.kind === 'new' && !photo.prepared
  return (
    <li className="relative aspect-square">
      {src ? (
        <PhotoSlot
          src={src}
          alt={label}
          size={photo.kind === 'existing' ? imageSize(photo.path) : null}
          className="h-full w-full rounded-xl"
        >
          {index === 0 && status !== 'failed' ? (
            <span
              className="absolute bottom-1.5 left-1.5 flex h-[22px] items-center whitespace-nowrap rounded-full px-[7px] text-caption font-bold glass"
            >
              {t('postForm.coverPhoto')}
            </span>
          ) : null}
          {status === 'uploading' ? (
            <span className="absolute inset-0 flex items-center justify-center bg-ink/50">
              <Spinner tone="white" />
              <span className="sr-only">{`${label}: ${t('state.uploading')}`}</span>
            </span>
          ) : null}
          {status === 'done' ? (
            <span className="absolute bottom-1.5 right-1.5 flex h-6 w-6 items-center justify-center rounded-full glass">
              <Icon name="check-plain" size={14} strokeWidth={2.75} />
            </span>
          ) : null}
        </PhotoSlot>
      ) : (
        <span className="skel flex h-full w-full items-center justify-center rounded-xl">
          {preparing ? <Spinner tone="da" /> : null}
          <span className="sr-only">{`${label}: ${t('postForm.photoProcessing')}`}</span>
        </span>
      )}
      {status === 'failed' ? (
        <button
          type="button"
          onClick={() => {
            onRetry()
            // 이 버튼이 사라져도 초점을 잃지 않게 같은 칸의 빼기 버튼으로 옮긴다
            removeRef.current?.focus()
          }}
          aria-label={`${t('postForm.photoRetry')}: ${label}`}
          className="absolute inset-0 flex flex-col items-center justify-center gap-0.5 rounded-xl bg-ink/[0.62] px-1 text-center text-caption font-bold text-white"
        >
          <Icon name="refresh" size={22} strokeWidth={2} />
          {t('postForm.photoRetry')}
        </button>
      ) : null}
      <button
        ref={removeRef}
        type="button"
        // disabled 대신 aria-disabled: 올리는 중에도 초점이 남는다
        aria-disabled={busy || undefined}
        onClick={() => {
          if (!busy) onRemove()
        }}
        aria-label={`${t('postForm.removePhoto')} ${index + 1}`}
        className="absolute -right-2.5 -top-2.5 z-10 flex h-11 w-11 items-center justify-center"
      >
        <span
          className={cn(
            'glass flex h-6 w-6 items-center justify-center rounded-full border-[1.5px] border-white transition-opacity',
            busy && 'opacity-40',
          )}
        >
          <Icon name="x" size={14} strokeWidth={2.75} />
        </span>
      </button>
    </li>
  )
}
