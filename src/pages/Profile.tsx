import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
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
import { TAP_GUARD_MS } from '../components/ui/BottomSheet'
import { ChevronRight } from '../components/ui/icons'

export function Profile() {
  const { t, locale } = useTranslation()
  const { user, initializing, signOut } = useAuth()
  const { data: profile, isLoading } = useOwnProfile(user?.id)
  const { data: regions } = useRegions()
  // 다른 탭에서 아래로 내린 채 들어와도 맨 위에서 시작한다 — 계정 설정이 도착하자마자 보이지 않게(D-046)
  useLayoutEffect(() => {
    window.scrollTo(0, 0)
  }, [])

  if (initializing) {
    return (
      <p className="rounded-card bg-white/70 px-4 py-8 text-center text-sm text-gray-500">
        {t('profile.loading')}
      </p>
    )
  }

  if (!user) {
    return (
      <section>
        <h1 className="mb-4 text-xl font-extrabold tracking-tight">{t('profile.title')}</h1>
        <p className="mb-4 rounded-card bg-white/70 px-4 py-8 text-center text-sm text-gray-500">
          {t('profile.empty')}
        </p>
        <Link
          to="/login"
          className="flex min-h-[44px] items-center justify-center rounded-full bg-brand-greenDark px-6 py-3 text-base font-semibold text-white"
        >
          {t('profile.loginCta')}
        </Link>
      </section>
    )
  }

  const region = profile?.region_id
    ? (regions ?? []).find((r) => r.id === profile.region_id)
    : undefined

  return (
    <section>
      {/* 첫 화면에는 계정 삭제가 보이지 않게(오너 요청 2026-10-23, D-046): 위쪽 내용이 화면 한 장을 채우고,
          "계정 설정"은 아래로 내려야 나온다. 4rem ≈ 머리줄(약 60px) + 본문 위 여백 */}
      <div className="min-h-[calc(100vh-4rem)]">
        <h1 className="mb-4 text-xl font-extrabold tracking-tight">{t('profile.title')}</h1>

        {isLoading ? (
          <p className="rounded-card bg-white/70 px-4 py-8 text-center text-sm text-gray-500">
            {t('profile.loading')}
          </p>
        ) : (
          <dl className="flex flex-col gap-3 rounded-card border border-gray-100 bg-white shadow-card px-4 py-4 text-sm">
            <div>
              <dt className="text-xs text-gray-500">{t('profile.nicknameLabel')}</dt>
              <dd className="font-semibold text-gray-900">{profile?.nickname ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-xs text-gray-500">{t('profile.emailLabel')}</dt>
              <dd className="text-gray-900">{user.email ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-xs text-gray-500">{t('profile.localeLabel')}</dt>
              <dd className="text-gray-900">
                {profile ? getLocaleLabel(profile.preferred_locale) : '—'}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-gray-500">{t('profile.regionLabel')}</dt>
              <dd className="text-gray-900">
                {region ? regionLabel(region.id, region.names, locale) : '—'}
              </dd>
            </div>
          </dl>
        )}

        <Link
          to="/profile/edit"
          className="mt-4 flex min-h-[44px] items-center justify-center rounded-full bg-brand-greenDark px-6 py-3 text-base font-semibold text-white"
        >
          {t('profile.editCta')}
        </Link>

        <button
          type="button"
          onClick={() => void signOut()}
          className="mt-3 min-h-[44px] w-full rounded-full border border-gray-300 px-6 py-3 text-base text-gray-700"
        >
          {t('profile.logout')}
        </button>

        <BlockedUsers userId={user.id} />
      </div>

      <section aria-labelledby="account-settings-title" className="mt-8 border-t border-black/10 pt-6">
        <h2 id="account-settings-title" className="text-sm font-bold text-gray-700">
          {t('profile.accountSettings')}
        </h2>
        <AccountDeletion user={user} />
      </section>

      {/* 페이지의 진짜 끝(계정 설정 아래) — 버전 줄이 첫 화면의 끝처럼 보이지 않게 */}
      <Link to="/privacy" className="mt-6 inline-block min-h-[44px] text-xs text-gray-500 underline">
        {t('common.privacy')}
      </Link>
      {/* v1.1: 테스터 문의·버그 리포트용 버전 표기(단일 기준 src/config/version.ts) */}
      <p className="mt-2 text-[11px] text-gray-400">
        {t('app.name')} v{APP_VERSION}
      </p>
    </section>
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
 * 계정 삭제(Google Play 요건, D-021 → D-046): 회원탈퇴(글자만) → 계정 삭제 → 본인 확인 → 영구 삭제 확정 → Edge Function(본인만) → 로그아웃.
 * 처음에는 빨간 칸 없이 "회원탈퇴" 글자만 보이고, 누르면 그때 경고와 계정 삭제 버튼이 나온다(오너 요청 — 눈에 바로 띄지 않게).
 * 본인 확인: 이메일 가입자는 비밀번호를 다시 넣어 로그인으로 확인하고(모르면 이메일 요청 링크), 카카오 가입자는 화면의 숫자 4개를 따라 쓴다.
 * 두 번 누름 사고 방지: 새로 나타난 버튼은 TAP_GUARD_MS 동안 무시, 영구 삭제 확정은 오른쪽 칸(확인이 있던 왼쪽에는 취소)에 1초 흐리게.
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
  const [deleteError, setDeleteError] = useState(false)
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

  // 펼치거나 단계가 바뀌면 칸이 아래 탭 줄에 가리지 않게 화면 안으로(즉시 — 부드러운 이동 중 손가락 아래로 오지 않게)
  useEffect(() => {
    if (open) panelRef.current?.scrollIntoView({ block: 'nearest' })
  }, [open, step])
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
    setDeleteError(false)
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
    setDeleteError(false)
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
    setDeleteError(false)
    const { data, error } = await getSupabaseClient().functions.invoke('delete-account')
    if (error || !data?.ok) {
      // 서버에서는 지웠는데 응답만 못 받았을 수 있다 — 계정이 이미 없으면 지워진 것으로 끝낸다
      const { error: meError } = await getSupabaseClient().auth.getUser()
      if (meError && [401, 403, 404].includes(meError.status ?? 0)) {
        await finish()
        return
      }
      setDeleteError(true)
      setDeleting(false)
      return
    }
    await finish()
  }

  const inputClass = 'w-full min-h-[44px] rounded-md border border-gray-300 px-3 py-2 text-base text-gray-900'
  const mailLink = (
    <a className="inline-flex min-h-[44px] items-center font-semibold underline" href={deletionRequestMailto}>
      {deletionRequestEmail}
    </a>
  )
  return (
    <div className="mt-2">
      {/* 평범한 글자 줄 — 빨간 칸·버튼 모양 없이 */}
      <button
        type="button"
        onClick={toggle}
        disabled={checking || deleting}
        aria-expanded={open}
        aria-controls="account-withdraw-panel"
        className="flex min-h-[44px] w-full items-center justify-between text-left text-sm text-gray-600"
      >
        {t('profile.withdraw')}
        <ChevronRight aria-hidden size={16} strokeWidth={2} className={open ? 'rotate-90' : ''} />
      </button>
      {open ? (
        <div
          id="account-withdraw-panel"
          ref={panelRef}
          className="mt-2 scroll-mb-[calc(5rem+env(safe-area-inset-bottom))] rounded-md border border-red-200 px-4 py-3"
        >
          <p className="text-xs text-gray-600">{t('profile.deleteAccountWarn')}</p>
          {step === 'idle' ? (
            <button
              type="button"
              onClick={start}
              className="mt-2 min-h-[44px] w-full rounded-full border border-red-300 text-sm font-semibold text-red-700"
            >
              {t('profile.deleteAccount')}
            </button>
          ) : step === 'verify' ? (
            <form
              className="mt-3 flex flex-col gap-2"
              noValidate
              onSubmit={(e) => {
                e.preventDefault()
                void verify()
              }}
            >
              {usesPassword ? (
                <>
                  <label className="flex flex-col gap-1 text-sm text-gray-700">
                    {t('profile.deleteVerifyPassword')}
                    <input
                      ref={inputRef}
                      type="password"
                      autoComplete="current-password"
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      aria-invalid={verifyError ? true : undefined}
                      aria-describedby={verifyError ? 'delete-verify-error' : undefined}
                      className={inputClass}
                    />
                  </label>
                  {/* 늘 보이는 한 줄(나타났다 사라지며 버튼을 밀지 않게): 비밀번호를 모르면 이메일로 */}
                  <p className="text-xs text-gray-600">
                    {t('profile.deleteVerifyNoPassword')} {mailLink}
                  </p>
                </>
              ) : (
                <label className="flex flex-col gap-1 text-sm text-gray-700">
                  {t('profile.deleteVerifyCode')}
                  <span aria-hidden className="text-2xl font-extrabold tracking-[0.3em] text-gray-900">
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
                    className={inputClass}
                  />
                </label>
              )}
              {verifyError ? (
                <p id="delete-verify-error" role="alert" className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">
                  {t(verifyError)}
                </p>
              ) : null}
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={checking}
                  className="min-h-[44px] flex-1 rounded-full border border-red-300 text-sm font-semibold text-red-700 disabled:opacity-50"
                >
                  {checking ? t('auth.loading') : t('profile.deleteVerifyNext')}
                </button>
                <button
                  type="button"
                  disabled={checking}
                  onClick={cancel}
                  className="min-h-[44px] flex-1 rounded-full border border-gray-300 text-sm text-gray-700 disabled:opacity-50"
                >
                  {t('postDetail.deleteCancel')}
                </button>
              </div>
            </form>
          ) : (
            <div className="mt-3 flex flex-col gap-2">
              <p ref={stepTitleRef} tabIndex={-1} role="status" className="text-sm text-red-800 outline-none">
                {t('profile.deleteVerified')}
              </p>
              {/* 취소를 왼쪽(확인이 있던 자리)에, 영구 삭제 확정은 오른쪽 — 남은 연타는 취소에 닿는다 */}
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={deleting}
                  onClick={cancel}
                  className="min-h-[44px] flex-1 rounded-full border border-gray-300 text-sm text-gray-700 disabled:opacity-50"
                >
                  {t('postDetail.deleteCancel')}
                </button>
                <button
                  type="button"
                  disabled={deleting || !armed}
                  onClick={() => void onDelete()}
                  className="min-h-[44px] flex-1 rounded-full bg-red-600 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {deleting ? t('auth.loading') : t('profile.deleteAccountConfirm')}
                </button>
              </div>
            </div>
          )}
          {deleteError ? (
            <p role="alert" className="mt-2 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">
              {t('profile.deleteAccountError')}{' '}
              {/* 삭제 요청 공식 창구는 설정값 하나로 통일(D-032) — 사전 문자열에 주소를 박지 않는다 */}
              {mailLink}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

/** 차단 관리(D-022): 차단한 사용자 목록 + 해제. 목록이 비면 섹션 숨김. */
function BlockedUsers({ userId }: { userId: string }) {
  const { t } = useTranslation()
  const { data: blockedIds } = useBlockedIds(userId)
  const unblock = useUnblockUser(userId)
  const ids = [...(blockedIds ?? [])]
  const { data: names } = useQuery({
    queryKey: ['blocks', 'names', ids.sort().join(',')],
    queryFn: async (): Promise<Map<string, string>> => {
      const { data } = await getSupabaseClient()
        .from('public_profiles')
        .select('id,nickname')
        .in('id', ids)
      return new Map((data ?? []).map((r) => [r.id as string, r.nickname ?? '']))
    },
    enabled: ids.length > 0,
  })
  if (ids.length === 0) return null
  return (
    <div className="mt-6 rounded-card border border-gray-100 bg-white shadow-card px-4 py-3">
      <p className="text-xs font-semibold text-gray-500">{t('block.listTitle')}</p>
      <ul className="mt-2 flex flex-col gap-1">
        {ids.map((id) => (
          <li key={id} className="flex items-center justify-between text-sm">
            <span>{names?.get(id) || t('board.unknownAuthor')}</span>
            <button
              type="button"
              disabled={unblock.isPending}
              onClick={() => unblock.mutate(id)}
              className="min-h-[44px] px-2 text-xs text-green-700 underline disabled:opacity-50"
            >
              {t('block.unblock')}
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
