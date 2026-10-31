import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'
import type { User } from '@supabase/supabase-js'
import { useBlockedIds, useUnblockUser } from '../hooks/useModeration'
import { useAuth } from '../context/AuthContext'
import { useTranslation } from '../i18n/useTranslation'
import { useRegions } from '../hooks/useRegions'
import { useOwnProfile } from '../hooks/useOwnProfile'
import { getSupabaseClient } from '../lib/supabase'
import { deletionRequestEmail, deletionRequestMailto, getLocaleLabel } from '../config/app'
import { APP_VERSION } from '../config/version'
import { regionLabel } from '../lib/regionName'
import { toAsciiDigits } from '../lib/digits'
import { FROM_DETAIL_STATE } from '../components/layout/flash'
import {
  Avatar,
  BottomSheet,
  Button,
  EmptyState,
  ErrorState,
  Icon,
  LoadingState,
  Skeleton,
  SkeletonBlock,
  SlowHint,
  Spinner,
  TAP_GUARD_MS,
  cn,
  type IconName,
} from '../components/ui'

/*
 * 내 정보(디자인 v5). 정체성 색 없음: 글자는 잉크, 주 행동만 초록(nong-600).
 * 설정 줄(키트 4.7): 40px 회색 칸 아이콘 + 굵은 제목 + 한 줄 설명 + 꺾쇠. 구분선은 글자부터.
 * 배치(D-046): 첫 화면 = 프로필·설정·차단 목록·로그아웃. "계정 설정"(회원탈퇴)은 아래로 내려야 보이고,
 * 개인정보처리방침·버전 줄은 그 아래(페이지 진짜 끝)에 둔다.
 */

/** 줄 하나의 겉모양(링크·버튼·스위치가 같이 쓴다). ul이 -mx-5로 화면 끝까지 넓힌다. */
const ROW =
  'flex w-full min-h-16 items-center gap-3 px-5 text-left transition-colors active:bg-surface disabled:cursor-default disabled:active:bg-transparent'

function RowBody({
  icon,
  label,
  value,
  last = false,
  trailing,
}: {
  icon: IconName
  label: string
  value?: ReactNode
  last?: boolean
  /** 오른쪽 끝(기본: 꺾쇠) */
  trailing?: ReactNode
}) {
  return (
    <>
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-surface text-ink-body">
        <Icon name={icon} size={22} />
      </span>
      <span
        className={cn(
          'flex min-w-0 flex-1 items-center gap-2 self-stretch py-2.5',
          !last && 'border-b border-line',
        )}
      >
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="text-body font-bold text-ink">{label}</span>
          {value ? <span className="text-caption text-ink-muted">{value}</span> : null}
        </span>
        {trailing === undefined ? (
          <Icon name="chevron" size={20} className="shrink-0 text-ink-muted" />
        ) : (
          trailing
        )}
      </span>
    </>
  )
}

/** 켬/끔 모양(장식). 실제 스위치는 줄 전체 button[role=switch]. 켜지면 초록 + 체크(색만으로 구분하지 않게). */
function SwitchVisual({ checked }: { checked: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'relative inline-flex h-8 w-[52px] shrink-0 items-center rounded-full border transition-colors',
        checked ? 'border-nong-600 bg-nong-600' : 'border-line-input bg-surface-2',
      )}
    >
      <span
        className={cn(
          'absolute left-[3px] top-[3px] flex h-6 w-6 items-center justify-center rounded-full bg-white transition-transform',
          checked ? 'translate-x-5 text-nong-600' : 'border border-line-input',
        )}
      >
        {checked ? <Icon name="check-plain" size={14} strokeWidth={2.5} /> : null}
      </span>
    </span>
  )
}

/** 오류 한 줄(빨강 + 아이콘). */
function AlertLine({ id, className, children }: { id?: string; className?: string; children: ReactNode }) {
  return (
    <p id={id} role="alert" className={cn('flex items-start gap-1.5 text-small text-danger', className)}>
      <Icon name="alert" size={18} className="mt-px shrink-0" />
      <span className="min-w-0">{children}</span>
    </p>
  )
}

const isOffline = () => typeof navigator !== 'undefined' && !navigator.onLine

export function Profile() {
  const { t, locale } = useTranslation()
  const { user, initializing, signOut } = useAuth()
  const {
    data: profile,
    isPending: profilePending,
    isError: profileError,
    refetch: refetchProfile,
    isFetching: profileFetching,
  } = useOwnProfile(user?.id)
  const { data: regions } = useRegions()
  const queryClient = useQueryClient()
  const [signingOut, setSigningOut] = useState(false)
  // 이웃 공개 동의: 켤 때는 공개 범위 고지(profileEdit.matchingConsentDetail)를 시트로 먼저 보여 준다.
  const [consentSheetOpen, setConsentSheetOpen] = useState(false)

  // 다른 탭에서 아래로 내린 채 들어와도 맨 위에서 시작한다 — 계정 설정이 도착하자마자 보이지 않게(D-046)
  useLayoutEffect(() => {
    window.scrollTo(0, 0)
  }, [])

  const consent = useMutation({
    mutationFn: async (next: boolean) => {
      if (!user) throw new Error('not signed in')
      const { error } = await getSupabaseClient()
        .from('profiles')
        .update({ is_matching_visible: next })
        .eq('id', user.id)
      if (error) throw new Error(error.message)
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['profiles', 'own', user?.id] })
      void queryClient.invalidateQueries({ queryKey: ['neighbor_profiles'] })
    },
  })

  const onSignOut = () => {
    setSigningOut(true)
    void signOut().finally(() => setSigningOut(false))
  }

  const title = <h1 className="text-title text-ink">{t('profile.title')}</h1>

  if (initializing) {
    return (
      <section>
        {title}
        <LoadingState label={t('profile.loading')} offlineLabel={t('profile.waitingNetwork')} />
      </section>
    )
  }

  if (!user) {
    return (
      <section>
        {title}
        <EmptyState
          className="mt-4"
          icon="me"
          title={t('profile.empty')}
          action={{ label: t('profile.loginCta'), to: '/login', primary: true }}
        />
        {/* 로그인 전에도 개인정보처리방침·버전은 볼 수 있다 */}
        <PageEnd />
      </section>
    )
  }

  const region = profile?.region_id
    ? (regions ?? []).find((r) => r.id === profile.region_id)
    : undefined
  const optedIn = Boolean(profile?.is_matching_visible)
  const waitingProfile = profilePending && !profileError
  // 프로필을 아직 모르면(불러오는 중) '…', 못 불러왔거나 행이 없으면 '—' — 가짜 값을 그리지 않는다
  const unknownValue = waitingProfile ? '…' : '—'

  // 오프라인이라 못 바꿨으면 그 이유를 말한다
  const consentErrorText = consent.isError && isOffline() ? t('common.offline') : t('profile.consentSaveFailed')

  const onToggleConsent = () => {
    // 저장 중에는 무시한다 — 스위치는 disabled 대신 aria-disabled라 초점(키보드·TalkBack)이 그 자리에 남는다
    if (consent.isPending) return
    consent.reset()
    if (optedIn) {
      // 끄기는 바로(동의 철회는 쉬워야 한다)
      consent.mutate(false)
    } else {
      setConsentSheetOpen(true)
    }
  }

  return (
    <section>
      {/* 첫 화면에는 계정 삭제가 보이지 않게(오너 요청 2026-10-23, D-046): 위쪽 내용이 화면 한 장을 채우고,
          "계정 설정"은 아래로 내려야 나온다. 4rem ≈ 머리줄 + 본문 위 여백 */}
      <div className="min-h-[calc(100vh-4rem)]">
        {title}

        {/* 머리: 아바타 + 닉네임 + 이메일 */}
        {waitingProfile ? (
          <LoadingState
            variant="inline"
            label={t('profile.loading')}
            offlineLabel={t('profile.waitingNetwork')}
            className="mt-3"
          >
            <Skeleton variant="rows" lead="avatar" count={1} />
          </LoadingState>
        ) : profileError && !profile ? (
          <ErrorState
            className="mt-4"
            title={t('profile.loadError')}
            onRetry={() => void refetchProfile()}
            retrying={profileFetching}
            fallback={{ label: t('profile.goHome'), to: '/home' }}
          />
        ) : (
          <div className="mt-4 flex items-center gap-4">
            <Avatar name={profile?.nickname || user.email || '?'} seed={user.id} size={48} />
            <dl className="min-w-0 flex-1">
              <dt className="sr-only">{t('profile.nicknameLabel')}</dt>
              <dd className="truncate text-section text-ink">{profile?.nickname ?? '—'}</dd>
              <dt className="sr-only">{t('profile.emailLabel')}</dt>
              <dd className="truncate text-small text-ink-muted">{user.email ?? '—'}</dd>
            </dl>
          </div>
        )}

        {/* 내 프로필 설정 */}
        <ul className="-mx-5 mt-5">
          <li>
            <Link to="/profile/edit" state={FROM_DETAIL_STATE} className={ROW}>
              <RowBody icon="edit" label={t('profile.editCta')} />
            </Link>
          </li>
          <li>
            <Link to="/profile/edit" state={FROM_DETAIL_STATE} className={ROW}>
              <RowBody
                icon="globe"
                label={t('profile.localeLabel')}
                value={
                  profile ? (
                    <span lang={profile.preferred_locale}>{getLocaleLabel(profile.preferred_locale)}</span>
                  ) : (
                    unknownValue
                  )
                }
              />
            </Link>
          </li>
          <li>
            <Link to="/profile/edit" state={FROM_DETAIL_STATE} className={ROW}>
              <RowBody
                icon="pin"
                label={t('profile.regionLabel')}
                value={
                  region
                    ? regionLabel(region.id, region.names, locale)
                    : !profile
                      ? unknownValue
                      : profile.region_id
                        ? regions
                          ? '—'
                          : '…' // 지역 목록이 아직 안 왔다
                        : t('profileEdit.regionNone')
                }
              />
            </Link>
          </li>
          <li>
            <button
              type="button"
              role={profile ? 'switch' : undefined}
              aria-checked={profile ? optedIn : undefined}
              aria-busy={consent.isPending || undefined}
              aria-disabled={consent.isPending || undefined}
              disabled={!profile}
              onClick={onToggleConsent}
              className={cn(ROW, 'aria-disabled:cursor-default aria-disabled:active:bg-transparent')}
            >
              <RowBody
                icon="neighbors"
                label={t('profileEdit.matchingConsent')}
                last
                value={
                  consent.isPending && !consentSheetOpen ? (
                    <span className="flex items-center gap-1.5">
                      <Spinner />
                      {t('state.saving')}
                    </span>
                  ) : !profile ? (
                    unknownValue
                  ) : optedIn ? (
                    t('profile.consentOn')
                  ) : (
                    t('profile.consentOff')
                  )
                }
                trailing={
                  profile ? (
                    <SwitchVisual checked={optedIn} />
                  ) : (
                    // 켬/끔을 아직 모르면 손잡이 없는 중립 트랙(같은 크기) — 가짜 '꺼짐'을 그리지 않는다
                    <span
                      aria-hidden="true"
                      className="h-8 w-[52px] shrink-0 rounded-full border border-line-strong bg-surface-2"
                    />
                  )
                }
              />
            </button>
            <SlowHint busy={consent.isPending && !consentSheetOpen} className="px-5 pb-2 text-left" />
            {consent.isError && !consentSheetOpen ? (
              <AlertLine className="px-5 pb-2">{consentErrorText}</AlertLine>
            ) : null}
          </li>
        </ul>

        <BlockedUsers userId={user.id} />

        {/* 로그아웃은 첫 화면에 그대로(D-046) */}
        <ul className="-mx-5 mt-6 border-t border-line">
          <li>
            <button
              type="button"
              onClick={onSignOut}
              disabled={signingOut}
              aria-busy={signingOut || undefined}
              className={ROW}
            >
              <RowBody
                icon="logout"
                label={t('profile.logout')}
                last
                trailing={signingOut ? <Spinner /> : null}
              />
            </button>
            <SlowHint busy={signingOut} className="px-5 pb-2 text-left" />
          </li>
        </ul>
      </div>

      <section aria-labelledby="account-settings-title" className="-mx-5 mt-8 border-t border-line px-5 pt-6">
        <h2 id="account-settings-title" className="text-section text-ink">
          {t('profile.accountSettings')}
        </h2>
        <AccountDeletion user={user} />
      </section>

      <PageEnd />

      <BottomSheet
        open={consentSheetOpen}
        onClose={() => {
          if (!consent.isPending) setConsentSheetOpen(false)
        }}
        title={t('profileEdit.matchingConsent')}
        description={t('profileEdit.matchingConsentDetail')}
        initialFocus="panel"
      >
        <Button
          fullWidth
          icon="check-plain"
          loading={consent.isPending}
          loadingLabel={t('state.saving')}
          onClick={() => consent.mutate(true, { onSuccess: () => setConsentSheetOpen(false) })}
        >
          {t('profile.consentAgree')}
        </Button>
        <SlowHint busy={consent.isPending} className="mt-2" />
        {consent.isError ? <AlertLine className="mt-3">{consentErrorText}</AlertLine> : null}
        <Button
          fullWidth
          variant="tertiary"
          className="mt-2"
          disabled={consent.isPending}
          onClick={() => setConsentSheetOpen(false)}
        >
          {t('common.cancel')}
        </Button>
      </BottomSheet>
    </section>
  )
}

/** 페이지의 진짜 끝(계정 설정 아래) — 개인정보처리방침 + 버전 줄이 첫 화면의 끝처럼 보이지 않게(D-046) */
function PageEnd() {
  const { t } = useTranslation()
  return (
    <>
      <ul className="-mx-5 mt-8 border-t border-line">
        <li>
          <Link to="/privacy" className={ROW}>
            <RowBody icon="shield" label={t('common.privacy')} last />
          </Link>
        </li>
      </ul>
      {/* v1.1: 테스터 문의·버그 리포트용 버전 표기(단일 기준 src/config/version.ts) */}
      <p className="mt-2 text-caption text-ink-muted">
        {t('app.name')} v{APP_VERSION}
      </p>
    </>
  )
}

type DeleteStep = 'idle' | 'verify' | 'confirm'

/** 영구 삭제 확정 버튼은 나타난 뒤 1초 동안 눌리지 않는다(보이는 대로 흐리게) — 느린 비밀번호 확인 뒤 연타가 닿지 않게 */
const CONFIRM_GUARD_MS = 1000

/** 실수로 지우지 않게 따라 쓰는 숫자 4개(1000~9999). 언어와 상관없이 읽을 수 있다. */
function newDeleteCode(): string {
  return String(1000 + (crypto.getRandomValues(new Uint32Array(1))[0] % 9000))
}

/**
 * 입력 칸(48px, 8px 모서리, 16px 글자 — iOS 확대 방지). 오류면 빨간 테두리.
 * 초점이 옮겨 갈 때 머리줄·아래 탭 줄에 가리지 않는 것은 index.css의 html scroll-padding이 맡는다.
 */
function fieldClass(invalid: boolean) {
  return cn(
    'h-12 w-full rounded-lg border bg-white px-3.5 text-body text-ink placeholder:text-ink-muted',
    invalid ? 'border-danger' : 'border-line-input',
  )
}

/**
 * 계정 삭제(Google Play 요건, D-021 → D-046): 회원탈퇴(글자만) → 계정 삭제 → 본인 확인 → 영구 삭제 확정 → Edge Function(본인만) → 로그아웃.
 * 처음에는 칸 없이 회색 "회원탈퇴" 글자 줄만 보이고, 누르면 그때 경고와 계정 삭제 버튼이 나온다(오너 요청 — 눈에 바로 띄지 않게).
 * 본인 확인: 이메일 가입자는 비밀번호를 다시 넣어 로그인으로 확인하고(모르면 이메일 요청 링크), 카카오 가입자는 화면의 숫자 4개를 따라 쓴다.
 * 두 번 누름 사고 방지: 새로 나타난 버튼은 TAP_GUARD_MS 동안 무시, 영구 삭제 확정은 오른쪽 칸(확인이 있던 왼쪽에는 취소)에 1초 흐리게.
 * 모양(v5): 칸은 흰 바탕 + 1px 선, 위험은 빨간 글자·아이콘으로만(빨간 바탕 없음). 기다림은 버튼 안 스피너 + 글자 + 느린 연결 안내.
 */
function AccountDeletion({ user }: { user: User }) {
  const { t } = useTranslation()
  const { signIn, signOut } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState<DeleteStep>('idle')
  const [code, setCode] = useState('')
  const [input, setInput] = useState('')
  const [verifyError, setVerifyError] = useState<string | null>(null)
  const [checking, setChecking] = useState(false)
  const [deleting, setDeleting] = useState(false)
  /** 삭제 실패 문구 키: 'profile.deleteAccountError'(+ 이메일) 또는 오프라인이면 'common.offline' */
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [armed, setArmed] = useState(false)
  const lastChange = useRef(0) // 펼침·취소·단계가 바뀐 시각(두 번 누름 무시용)
  const panelRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const stepTitleRef = useRef<HTMLParagraphElement>(null)
  const providers = (user.app_metadata?.providers as string[] | undefined) ?? [user.app_metadata?.provider as string]
  const usesPassword = Boolean(user.email) && providers.includes('email')
  const tooSoon = () => Date.now() - lastChange.current < TAP_GUARD_MS
  const mark = () => {
    lastChange.current = Date.now()
  }

  // 펼치거나 단계가 바뀌거나 오류 줄이 생기면 칸이 아래 탭 줄·말하기 버튼에 가리지 않게 화면 안으로
  // (즉시 — 부드러운 이동 중 손가락 아래로 오지 않게)
  useEffect(() => {
    if (open) panelRef.current?.scrollIntoView({ block: 'nearest' })
  }, [open, step, verifyError, deleteError])
  // 본인 확인 단계는 입력 칸으로, 확정 단계는 안내 문장으로 초점을 옮긴다(화면 읽기 사용자가 바뀐 내용을 듣게)
  useEffect(() => {
    if (step === 'verify') inputRef.current?.focus()
    if (step === 'confirm') stepTitleRef.current?.focus()
  }, [step])
  // 확정 버튼은 나타난 뒤 1초 지나야 눌린다
  useEffect(() => {
    if (step !== 'confirm') {
      setArmed(false)
      return
    }
    const timer = window.setTimeout(() => setArmed(true), CONFIRM_GUARD_MS)
    return () => window.clearTimeout(timer)
  }, [step])

  const reset = () => {
    setStep('idle')
    setInput('')
    setVerifyError(null)
    setDeleteError(null)
  }
  const toggle = () => {
    if (tooSoon()) return // 두 번 눌러 펼쳤다 바로 접히지 않게
    mark()
    if (open) reset()
    setOpen(!open)
  }
  const start = () => {
    if (tooSoon()) return
    mark()
    setStep('verify')
    setCode(newDeleteCode())
    setInput('')
    setVerifyError(null)
    setDeleteError(null)
  }
  const cancel = () => {
    mark() // 취소를 두 번 눌러 계정 삭제가 다시 눌리지 않게
    reset()
  }
  const verify = async () => {
    setVerifyError(null)
    if (usesPassword) {
      if (!input) {
        setVerifyError('profile.deleteVerifyWrongPassword')
        return
      }
      setChecking(true)
      const { error } = await signIn(user.email as string, input)
      setChecking(false)
      if (error) {
        const m = error.toLowerCase()
        setVerifyError(
          m.includes('rate limit')
            ? 'auth.error.rateLimit'
            : m.includes('invalid login')
              ? 'profile.deleteVerifyWrongPassword'
              : isOffline()
                ? 'common.offline'
                : 'auth.error.generic',
        )
        return
      }
    } else if (toAsciiDigits(input) !== code) {
      setVerifyError('profile.deleteVerifyWrongCode')
      return
    }
    setInput('')
    mark()
    setStep('confirm')
  }
  const finish = async () => {
    await signOut()
    navigate('/', { replace: true })
  }
  const onDelete = async () => {
    if (!armed || tooSoon()) return
    setDeleting(true)
    setDeleteError(null)
    const { data, error } = await getSupabaseClient().functions.invoke('delete-account')
    if (error || !data?.ok) {
      // 서버에서는 지웠는데 응답만 못 받았을 수 있다 — 계정이 이미 없으면 지워진 것으로 끝낸다
      const { error: meError } = await getSupabaseClient().auth.getUser()
      if (meError && [401, 403, 404].includes(meError.status ?? 0)) {
        await finish()
        return
      }
      setDeleteError(isOffline() ? 'common.offline' : 'profile.deleteAccountError')
      setDeleting(false)
      return
    }
    await finish()
  }

  const mailLink = (
    <a
      className="inline-flex min-h-11 items-center break-all font-bold text-nong-600 underline underline-offset-2"
      href={deletionRequestMailto}
    >
      {deletionRequestEmail}
    </a>
  )
  return (
    <div className="mt-1">
      {/* 평범한 회색 글자 줄 — 빨간 칸·버튼 모양 없이(D-046). 펼친 칸은 화면 끝까지(반쪽 버튼 두 개가 한 줄에 들어가게) */}
      <div className="-mx-5">
        <button
          type="button"
          onClick={toggle}
          disabled={checking || deleting}
          aria-expanded={open}
          aria-controls="account-withdraw-panel"
          className="flex min-h-14 w-full items-center gap-3 px-5 text-left text-body text-ink-muted transition-colors active:bg-surface disabled:active:bg-transparent"
        >
          <span className="min-w-0 flex-1">{t('profile.withdraw')}</span>
          <Icon
            name="chevron"
            size={20}
            className={cn('shrink-0 transition-transform', open && 'rotate-90')}
          />
        </button>
        {open ? (
          <div
            id="account-withdraw-panel"
            ref={panelRef}
            className="border-t border-line px-5 pb-2 pt-4"
          >
            <p className="flex items-start gap-2 text-small text-ink-body">
              <Icon name="alert" size={18} className="mt-0.5 shrink-0 text-danger" />
              <span className="min-w-0">{t('profile.deleteAccountWarn')}</span>
            </p>
            {step === 'idle' ? (
              <Button fullWidth variant="danger" icon="trash" className="mt-4" onClick={start}>
                {t('profile.deleteAccount')}
              </Button>
            ) : step === 'verify' ? (
              <form
                className="mt-4"
                noValidate
                onSubmit={(e) => {
                  e.preventDefault()
                  void verify()
                }}
              >
                {usesPassword ? (
                  <>
                    <label className="block">
                      <span className="mb-2 block text-small text-ink">{t('profile.deleteVerifyPassword')}</span>
                      <input
                        ref={inputRef}
                        type="password"
                        autoComplete="current-password"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        aria-invalid={verifyError ? true : undefined}
                        aria-describedby={verifyError ? 'delete-verify-error' : undefined}
                        className={fieldClass(Boolean(verifyError))}
                      />
                    </label>
                    {/* 늘 보이는 한 줄(나타났다 사라지며 버튼을 밀지 않게): 비밀번호를 모르면 이메일로 */}
                    <p className="mt-2 text-small text-ink-muted">
                      {t('profile.deleteVerifyNoPassword')} {mailLink}
                    </p>
                  </>
                ) : (
                  <label className="block">
                    <span className="block text-small text-ink">{t('profile.deleteVerifyCode')}</span>
                    <span aria-hidden className="mt-2 block text-hero tracking-[0.3em] text-ink">
                      {code}
                    </span>
                    <span id="delete-code-digits" className="sr-only">
                      {code.split('').join(' ')}
                    </span>
                    <input
                      ref={inputRef}
                      type="text"
                      inputMode="numeric"
                      autoComplete="off"
                      maxLength={8}
                      aria-label={t('profile.deleteVerifyCodeLabel')}
                      aria-describedby={verifyError ? 'delete-code-digits delete-verify-error' : 'delete-code-digits'}
                      aria-invalid={verifyError ? true : undefined}
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      className={cn(fieldClass(Boolean(verifyError)), 'mt-2')}
                    />
                  </label>
                )}
                {verifyError ? (
                  <AlertLine id="delete-verify-error" className="mt-2">
                    {t(verifyError)}
                  </AlertLine>
                ) : null}
                <div className="mt-4 flex gap-2">
                  <Button
                    type="submit"
                    variant="danger"
                    wrap
                    className="min-w-0 flex-1"
                    loading={checking}
                    loadingLabel={t('profile.deleteVerifyChecking')}
                  >
                    {t('profile.deleteVerifyNext')}
                  </Button>
                  <Button variant="secondary" wrap className="min-w-0 flex-1" disabled={checking} onClick={cancel}>
                    {t('postDetail.deleteCancel')}
                  </Button>
                </div>
                <SlowHint busy={checking} className="mt-2" />
              </form>
            ) : (
              <div className="mt-4">
                <p ref={stepTitleRef} tabIndex={-1} role="status" className="text-body font-bold text-ink outline-none">
                  {t('profile.deleteVerified')}
                </p>
                {/* 취소를 왼쪽(확인이 있던 자리)에, 영구 삭제 확정은 오른쪽 — 남은 연타는 취소에 닿는다 */}
                <div className="mt-4 flex gap-2">
                  <Button variant="secondary" wrap className="min-w-0 flex-1" disabled={deleting} onClick={cancel}>
                    {t('postDetail.deleteCancel')}
                  </Button>
                  <Button
                    variant="danger"
                    icon="trash"
                    wrap
                    className="min-w-0 flex-1"
                    disabled={!armed && !deleting}
                    loading={deleting}
                    loadingLabel={t('state.deleting')}
                    onClick={() => void onDelete()}
                  >
                    {t('profile.deleteAccountConfirm')}
                  </Button>
                </div>
                <SlowHint busy={deleting} className="mt-2" />
              </div>
            )}
            {deleteError ? (
              <AlertLine className="mt-3">
                {t(deleteError)}
                {deleteError === 'profile.deleteAccountError' ? (
                  <>
                    {' '}
                    {/* 삭제 요청 공식 창구는 설정값 하나로 통일(D-032) — 사전 문자열에 주소를 박지 않는다 */}
                    {mailLink}
                  </>
                ) : null}
              </AlertLine>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  )
}

/** 차단 관리(D-022): 차단한 사용자 목록 + 해제. 목록이 비면 섹션 숨김. */
function BlockedUsers({ userId }: { userId: string }) {
  const { t } = useTranslation()
  const { data: blockedIds } = useBlockedIds(userId)
  const unblock = useUnblockUser(userId)
  const ids = [...(blockedIds ?? [])].sort()
  const {
    data: names,
    isPending: namesPending,
    isPlaceholderData: namesPlaceholder,
  } = useQuery({
    queryKey: ['blocks', 'names', ids.join(',')],
    queryFn: async (): Promise<Map<string, string>> => {
      // public_profiles는 id·nickname만(국적 등 다른 열 없음)
      const { data } = await getSupabaseClient()
        .from('public_profiles')
        .select('id,nickname')
        .in('id', ids)
      return new Map((data ?? []).map((r) => [r.id as string, r.nickname ?? '']))
    },
    enabled: ids.length > 0,
    // 하나를 풀어도 남은 줄이 다시 빈 자리로 깜빡이지 않게 직전 이름을 잠시 둔다
    placeholderData: keepPreviousData,
  })
  if (ids.length === 0) return null
  // 직전 이름표를 잠시 쓰는 중이면 거기 없는 새 줄만 기다린다
  const rowPending = (id: string) => namesPending || (namesPlaceholder && !names?.has(id))
  return (
    <section aria-labelledby="blocked-title" className="mt-8">
      <h2 id="blocked-title" className="text-section text-ink">
        {t('block.listTitle')}
      </h2>
      <ul className="mt-1">
        {ids.map((id, i) => {
          // 이름을 받기 전에는 '알 수 없음' 대신 자리만 보여 준다
          const pending = rowPending(id)
          const name = names?.get(id) || t('board.unknownAuthor')
          return (
            <li key={id} className="flex min-h-16 items-center gap-3">
              {pending ? (
                <SkeletonBlock className="h-10 w-10 shrink-0 rounded-full" />
              ) : (
                <Avatar name={name} seed={id} />
              )}
              <span
                className={cn(
                  'flex min-w-0 flex-1 items-center gap-3 self-stretch py-2.5',
                  i < ids.length - 1 && 'border-b border-line',
                )}
              >
                {pending ? (
                  <span className="min-w-0 flex-1" aria-busy="true" aria-label={t('state.loading')}>
                    <SkeletonBlock className="h-4 w-24 rounded-full" />
                  </span>
                ) : (
                  <span className="min-w-0 flex-1 truncate text-body font-bold text-ink">{name}</span>
                )}
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={unblock.isPending && unblock.variables !== id}
                  loading={unblock.isPending && unblock.variables === id}
                  onClick={() => {
                    unblock.reset()
                    unblock.mutate(id)
                  }}
                >
                  {t('block.unblock')}
                </Button>
              </span>
            </li>
          )
        })}
      </ul>
      {/* 이름을 기다리는 동안에도(해제 버튼은 id만 있으면 된다) 느림·연결 대기 줄을 보여 준다 */}
      <SlowHint busy={ids.some(rowPending) || unblock.isPending} className="mt-2" />
      {unblock.isError ? (
        <AlertLine className="mt-2">{isOffline() ? t('common.offline') : t('profile.consentSaveFailed')}</AlertLine>
      ) : null}
    </section>
  )
}
