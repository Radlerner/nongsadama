import { Capacitor } from '@capacitor/core'
import { useEffect, useId, useState, type ReactNode } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useNavigate } from 'react-router-dom'
import { zodResolver } from '../lib/zodResolver'
import { z } from 'zod'
import { useAuth } from '../context/AuthContext'
import { useTranslation } from '../i18n/useTranslation'
import { oauthProviders, type OAuthProvider } from '../config/app'
import { Button, buttonClasses, cn, Icon, SlowHint } from '../components/ui'
import { EntryHeader } from '../components/layout/EntryHeader'

// 제공자별 브랜드 버튼 스타일 — 팔레트 규칙의 허용 예외(제공자 디자인 가이드 우선).
// 카카오 로그인 디자인 가이드: 노란 컨테이너(kakao 토큰), 검정 심볼, 85% 검정 레이블(kakao-ink), 모서리 12px.
// 제공자 추가 시 여기와 i18n `auth.<provider>Start`·`auth.<provider>Pending` 키만 더한다(kakao-login 스킬 §2.1).
const providerButtonClass: Record<OAuthProvider, string> = {
  kakao: 'bg-kakao text-kakao-ink',
}

/** 카카오 심볼(말풍선, 검정). 가이드대로 레이블 왼쪽에 둔다. */
function KakaoSymbol() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
      className="block shrink-0 text-black"
    >
      <path
        fill="currentColor"
        d="M12 3C6.48 3 2 6.54 2 10.9c0 2.82 1.87 5.29 4.69 6.69l-.95 3.48c-.08.31.27.56.54.38l4.12-2.73c.53.06 1.06.09 1.6.09 5.52 0 10-3.54 10-7.91S17.52 3 12 3z"
      />
    </svg>
  )
}

const providerSymbol: Record<OAuthProvider, () => ReactNode> = {
  kakao: () => <KakaoSymbol />,
}

// zod 메시지에는 번역 키를 담고, 렌더 시 t()로 변환한다(문자열 하드코딩 금지, PRD 6.1).
const schema = z.object({
  email: z.string().email('auth.error.emailInvalid'),
  password: z.string().min(6, 'auth.error.passwordMin'),
  // 회원가입에서만 쓴다(D-046): 비밀번호를 두 번 넣어 오타로 못 들어오는 일을 막는다. 로그인에서는 칸이 없다.
  passwordConfirm: z.string().optional(),
  nickname: z.string().max(40, 'auth.error.nicknameLong').optional(),
})

// 회원가입 검사: 두 비밀번호가 같아야 한다. 규칙을 스키마에 두어, 첫 제출 뒤 칸을 고칠 때마다 안내가 맞게 바뀐다.
const signupSchema = schema.superRefine((v, ctx) => {
  if ((v.passwordConfirm ?? '') !== v.password) {
    ctx.addIssue({ code: 'custom', path: ['passwordConfirm'], message: 'auth.error.passwordMismatch' })
  }
})

type FormValues = z.infer<typeof schema>

type Mode = 'signin' | 'signup'

/** Supabase 오류 메시지를 번역 키로 매핑한다(알려진 사례만, 나머지는 일반 오류). */
function errorKeyOf(message: string): string {
  const m = message.toLowerCase()
  if (m.includes('invalid login credentials')) return 'auth.error.invalidCredentials'
  if (m.includes('already registered') || m.includes('already been registered'))
    return 'auth.error.emailTaken'
  if (m.includes('rate limit')) return 'auth.error.rateLimit'
  return 'auth.error.generic'
}

/** 보내기 실패 문구: 오프라인이면 연결 안내(common.offline), 아니면 원인별 문구. */
function submitErrorKey(message: string): string {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return 'common.offline'
  return errorKeyOf(message)
}

/** 입력칸(48px, 16px 글자 — iOS 확대 방지). 오류면 빨간 테두리. */
const FIELD =
  'block h-12 w-full rounded-lg border border-line-input bg-white px-4 text-body text-ink transition-colors focus:border-nong-600 aria-[invalid=true]:border-danger'

/** 칸 아래·폼 아래 오류 한 줄(빨간 글자 + 느낌표). */
function InlineError({ id, className, children }: { id?: string; className?: string; children: ReactNode }) {
  return (
    <p id={id} role="alert" className={cn('flex items-start gap-1.5 text-small text-danger', className)}>
      <Icon name="alert" size={18} className="mt-0.5 shrink-0" />
      <span>{children}</span>
    </p>
  )
}

/** 라벨 + 입력칸(라벨이 칸을 감싸 라벨을 눌러도 칸으로 간다) + 칸 아래 오류(aria-describedby로 묶는다). */
function Field({
  label,
  error,
  children,
}: {
  label: string
  error?: string
  children: (props: { 'aria-invalid'?: true; 'aria-describedby'?: string }) => ReactNode
}) {
  const errorId = `${useId()}-error` // 칸 아래 오류 줄의 id
  return (
    <div>
      <label className="flex flex-col gap-2">
        <span className="text-label text-ink">{label}</span>
        {children({
          'aria-invalid': error ? true : undefined,
          'aria-describedby': error ? errorId : undefined,
        })}
      </label>
      {error ? (
        <InlineError id={errorId} className="mt-2">
          {error}
        </InlineError>
      ) : null}
    </div>
  )
}

export function Login() {
  const { t } = useTranslation()
  const { signIn, signUp, signInWithOAuth, oauthCallbackError } = useAuth()
  const navigate = useNavigate()
  const [mode, setMode] = useState<Mode>('signin')
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  // 간편로그인 우선 화면 — 이메일 폼은 접어 두되 삭제하지 않는다(기존 계정 회귀 방지).
  const [showEmail, setShowEmail] = useState(false)
  const [oauthError, setOauthError] = useState<string | null>(null)
  const [oauthPending, setOauthPending] = useState<OAuthProvider | null>(null)
  const emailFormId = useId()

  // 카카오 페이지로 떠났다가 뒤로가기로 bfcache 복원되면 oauthPending이 남아
  // 버튼이 무기한 잠긴다(재검수 P2-1) — pageshow(persisted)에서 리셋.
  useEffect(() => {
    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted) setOauthPending(null)
    }
    window.addEventListener('pageshow', onPageShow)
    return () => window.removeEventListener('pageshow', onPageShow)
  }, [])

  const onOAuth = async (provider: OAuthProvider) => {
    setOauthError(null)
    // 오프라인이면 카카오 페이지로 떠나지 않는다(브라우저 오류 화면에 갇히지 않게) — 바로 연결 안내를 보인다.
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      setOauthError('common.offline')
      return
    }
    setOauthPending(provider)
    const { error } = await signInWithOAuth(provider)
    if (error) {
      // 시작 실패만 여기 도달(성공 시 제공자 페이지로 이동). 무언 실패 금지.
      setOauthError('auth.oauthError')
      setOauthPending(null)
    } else if (Capacitor.isNativePlatform()) {
      // 앱(Capacitor): 카카오는 바깥 브라우저에서 열리고 이 화면은 그대로 남는다 — 버튼을 다시 풀어 둔다.
      setOauthPending(null)
    }
  }

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(mode === 'signup' ? signupSchema : schema) })

  const onSubmit = handleSubmit(async (values) => {
    setSubmitError(null)
    setNotice(null)
    if (mode === 'signup') {
      const nickname = (values.nickname ?? '').trim()
      if (nickname.length === 0) {
        setSubmitError('auth.error.nicknameRequired')
        return
      }
      const { error, needsEmailConfirm } = await signUp({
        email: values.email,
        password: values.password,
        nickname,
      })
      if (error) {
        setSubmitError(submitErrorKey(error))
        return
      }
      if (needsEmailConfirm) {
        setNotice('auth.needsEmailConfirm')
        return
      }
      navigate('/home')
      return
    }
    const { error } = await signIn(values.email, values.password)
    if (error) {
      setSubmitError(submitErrorKey(error))
      return
    }
    navigate('/home')
  })

  const fieldError = (message?: string) => (message ? t(message) : undefined)
  const shownOauthError = oauthError ?? (oauthCallbackError ? 'auth.oauthError' : null)

  return (
    <div className="mx-auto flex min-h-app max-w-screen-sm flex-col bg-white text-ink">
      <EntryHeader onBack={() => (window.history.length > 1 ? navigate(-1) : navigate('/home'))} />
      <main className="flex flex-1 flex-col px-5 pb-[calc(16px+var(--safe-bottom))] pt-3">
        <h1 className="text-title text-ink">{t('auth.pageTitle')}</h1>
        <p className="mt-1 text-body text-ink-body">{t('auth.pageLead')}</p>

        {/* 간편로그인(Linktree식 세로 스택) — 이메일 폼은 아래 접힘(kakao-login 스킬 §2.1) */}
        <div className="mt-8 flex flex-col gap-3">
          {oauthProviders.map((p) => {
            const pending = oauthPending === p
            return (
              <button
                key={p}
                type="button"
                onClick={() => void onOAuth(p)}
                disabled={oauthPending !== null}
                aria-busy={pending || undefined}
                className={cn(
                  'flex min-h-12 w-full items-center justify-center gap-2 rounded-xl px-5 py-2 text-label disabled:cursor-default',
                  providerButtonClass[p],
                  oauthPending !== null && !pending && 'opacity-60',
                )}
              >
                {pending ? (
                  <span
                    aria-hidden="true"
                    className="block h-5 w-5 shrink-0 animate-spin rounded-full border-2 border-black/20 border-t-black/85 [animation-duration:0.8s]"
                  />
                ) : (
                  providerSymbol[p]()
                )}
                {pending ? t(`auth.${p}Pending`) : t(`auth.${p}Start`)}
              </button>
            )
          })}
        </div>
        {/* 카카오로 넘어가는 기다림이 8초를 넘으면 느린 연결 안내(오프라인이면 연결 대기) */}
        <SlowHint busy={oauthPending !== null} className="mt-2" />
        {shownOauthError ? <InlineError className="mt-3">{t(shownOauthError)}</InlineError> : null}

        <div aria-hidden="true" className="mt-6 flex items-center gap-3 text-caption text-ink-muted">
          <span className="h-px flex-1 bg-line" />
          {t('auth.or')}
          <span className="h-px flex-1 bg-line" />
        </div>

        <Button
          variant="secondary"
          fullWidth
          wrap
          className="mt-6"
          onClick={() => setShowEmail((v) => !v)}
          aria-expanded={showEmail}
          aria-controls={emailFormId}
        >
          {t('auth.orEmail')}
          <Icon
            name="chevron-down"
            size={20}
            strokeWidth={2}
            className={cn('shrink-0 transition-transform', showEmail && 'rotate-180')}
          />
        </Button>

        {showEmail ? (
          <section id={emailFormId} className="mt-8" aria-labelledby={`${emailFormId}-title`}>
            <h2 id={`${emailFormId}-title`} className="text-section text-ink">
              {mode === 'signin' ? t('auth.loginTitle') : t('auth.signupTitle')}
            </h2>

            <form onSubmit={(e) => void onSubmit(e)} className="mt-4 flex flex-col gap-5" noValidate>
              <Field label={t('auth.email')} error={fieldError(errors.email?.message)}>
                {(a11y) => (
                  <input
                    {...a11y}
                    type="email"
                    autoComplete="email"
                    inputMode="email"
                    className={FIELD}
                    {...register('email')}
                  />
                )}
              </Field>

              <Field label={t('auth.password')} error={fieldError(errors.password?.message)}>
                {(a11y) => (
                  <input
                    {...a11y}
                    type="password"
                    autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                    className={FIELD}
                    {...register('password')}
                  />
                )}
              </Field>

              {mode === 'signup' ? (
                <Field label={t('auth.passwordConfirm')} error={fieldError(errors.passwordConfirm?.message)}>
                  {(a11y) => (
                    <input
                      {...a11y}
                      type="password"
                      autoComplete="new-password"
                      className={FIELD}
                      {...register('passwordConfirm')}
                    />
                  )}
                </Field>
              ) : null}

              {mode === 'signup' ? (
                <Field label={t('auth.nickname')} error={fieldError(errors.nickname?.message)}>
                  {(a11y) => (
                    <input
                      {...a11y}
                      type="text"
                      autoComplete="nickname"
                      className={FIELD}
                      {...register('nickname')}
                    />
                  )}
                </Field>
              ) : null}

              {submitError ? <InlineError>{t(submitError)}</InlineError> : null}
              <div role="status" aria-live="polite" className={notice ? undefined : 'sr-only'}>
                {notice ? (
                  <p className="flex items-start gap-2 rounded-xl border border-line px-4 py-3 text-small text-ink-body">
                    <Icon name="mail" size={20} className="mt-px shrink-0 text-nong-600" />
                    <span>{t(notice)}</span>
                  </p>
                ) : null}
              </div>

              <div>
                <Button
                  type="submit"
                  fullWidth
                  loading={isSubmitting}
                  loadingLabel={mode === 'signin' ? t('auth.signingIn') : t('auth.signingUp')}
                >
                  {mode === 'signin' ? t('auth.submitLogin') : t('auth.submitSignup')}
                </Button>
                {/* 로그인·가입 응답이 8초를 넘으면 느린 연결 안내 */}
                <SlowHint busy={isSubmitting} className="mt-2" />
              </div>
            </form>

            <Button
              variant="ghost"
              fullWidth
              wrap
              className="mt-2"
              onClick={() => {
                setMode(mode === 'signin' ? 'signup' : 'signin')
                setSubmitError(null)
                setNotice(null)
              }}
            >
              {mode === 'signin' ? t('auth.toSignup') : t('auth.toLogin')}
            </Button>
          </section>
        ) : null}

        <div className="mt-auto flex justify-center pt-8">
          <Link to="/home" className={buttonClasses({ variant: 'ghost', size: 'sm', tone: 'ink' })}>
            <Icon name="home" size={18} strokeWidth={2} />
            {t('auth.backHome')}
          </Link>
        </div>
      </main>
    </div>
  )
}
