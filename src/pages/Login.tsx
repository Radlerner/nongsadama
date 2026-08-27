import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useNavigate } from 'react-router-dom'
import { zodResolver } from '../lib/zodResolver'
import { z } from 'zod'
import { useAuth } from '../context/AuthContext'
import { useTranslation } from '../i18n/useTranslation'
import { oauthProviders, type OAuthProvider } from '../config/app'

// 제공자별 브랜드 버튼 스타일(디자인 가이드 준수 — 카카오: #FEE500 배경+검정 텍스트).
// 제공자 추가 시 여기와 i18n `auth.<provider>Start` 키만 더한다(kakao-login 스킬 §2.1).
const providerButtonClass: Record<OAuthProvider, string> = {
  kakao: 'bg-[#FEE500] text-[#191919]',
}
const providerIcon: Record<OAuthProvider, string> = {
  kakao: '💬',
}

// zod 메시지에는 번역 키를 담고, 렌더 시 t()로 변환한다(문자열 하드코딩 금지, PRD 6.1).
const schema = z.object({
  email: z.string().email('auth.error.emailInvalid'),
  password: z.string().min(6, 'auth.error.passwordMin'),
  nickname: z.string().max(40, 'auth.error.nicknameLong').optional(),
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

export function Login() {
  const { t } = useTranslation()
  const { signIn, signUp, signInWithOAuth } = useAuth()
  const navigate = useNavigate()
  const [mode, setMode] = useState<Mode>('signin')
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  // 간편로그인 우선 화면 — 이메일 폼은 접어 두되 삭제하지 않는다(기존 계정 회귀 방지).
  const [showEmail, setShowEmail] = useState(false)
  const [oauthError, setOauthError] = useState<string | null>(null)
  const [oauthPending, setOauthPending] = useState<OAuthProvider | null>(null)

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
    setOauthPending(provider)
    const { error } = await signInWithOAuth(provider)
    if (error) {
      // 시작 실패만 여기 도달(성공 시 제공자 페이지로 이동). 무언 실패 금지.
      setOauthError('auth.oauthError')
      setOauthPending(null)
    }
  }

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) })

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
        setSubmitError(errorKeyOf(error))
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
      setSubmitError(errorKeyOf(error))
      return
    }
    navigate('/home')
  })

  const inputClass =
    'w-full min-h-[44px] rounded-md border border-gray-300 px-3 py-2 text-base text-gray-900'

  return (
    <div className="mx-auto flex min-h-screen max-w-screen-sm flex-col bg-white px-6 py-6 text-gray-900">
      <h1 className="text-xl font-bold text-green-700">{t('app.name')}</h1>
      <p className="mt-1 text-sm text-gray-500">{t('landing.subtitle')}</p>

      {/* 간편로그인(Linktree식 세로 스택) — 이메일 폼은 아래 접힘(kakao-login 스킬 §2.1) */}
      <div className="mt-8 flex flex-col gap-3">
        {oauthProviders.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => void onOAuth(p)}
            disabled={oauthPending !== null}
            className={`flex min-h-[56px] items-center justify-center gap-2 rounded-md px-6 text-base font-semibold disabled:opacity-50 ${providerButtonClass[p]}`}
          >
            <span aria-hidden>{providerIcon[p]}</span>
            {oauthPending === p ? t('auth.loading') : t(`auth.${p}Start`)}
          </button>
        ))}
      </div>

      {oauthError ? (
        <p className="mt-3 rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{t(oauthError)}</p>
      ) : null}

      <button
        type="button"
        onClick={() => setShowEmail((v) => !v)}
        className="mt-6 min-h-[44px] text-sm text-gray-600 underline"
        aria-expanded={showEmail}
      >
        {t('auth.orEmail')}
      </button>

      {showEmail ? (
        <>
          <h2 className="mt-2 text-base font-bold text-gray-800">
            {mode === 'signin' ? t('auth.loginTitle') : t('auth.signupTitle')}
          </h2>

          <form onSubmit={(e) => void onSubmit(e)} className="mt-4 flex flex-col gap-4" noValidate>
        <label className="flex flex-col gap-1 text-sm font-semibold text-gray-700">
          {t('auth.email')}
          <input
            type="email"
            autoComplete="email"
            className={inputClass}
            {...register('email')}
          />
          {errors.email?.message ? (
            <span className="font-normal text-red-700">{t(errors.email.message)}</span>
          ) : null}
        </label>

        <label className="flex flex-col gap-1 text-sm font-semibold text-gray-700">
          {t('auth.password')}
          <input
            type="password"
            autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
            className={inputClass}
            {...register('password')}
          />
          {errors.password?.message ? (
            <span className="font-normal text-red-700">{t(errors.password.message)}</span>
          ) : null}
        </label>

        {mode === 'signup' ? (
          <label className="flex flex-col gap-1 text-sm font-semibold text-gray-700">
            {t('auth.nickname')}
            <input type="text" autoComplete="nickname" className={inputClass} {...register('nickname')} />
            {errors.nickname?.message ? (
              <span className="font-normal text-red-700">{t(errors.nickname.message)}</span>
            ) : null}
          </label>
        ) : null}

        {submitError ? (
          <p className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{t(submitError)}</p>
        ) : null}
        {notice ? (
          <p className="rounded-md bg-green-50 px-4 py-3 text-sm text-green-800">{t(notice)}</p>
        ) : null}

        <button
          type="submit"
          disabled={isSubmitting}
          className="min-h-[44px] rounded-md bg-green-700 px-6 py-3 text-base font-semibold text-white disabled:opacity-50"
        >
          {isSubmitting
            ? t('auth.loading')
            : mode === 'signin'
              ? t('auth.submitLogin')
              : t('auth.submitSignup')}
        </button>
      </form>

      <button
        type="button"
        onClick={() => {
          setMode(mode === 'signin' ? 'signup' : 'signin')
          setSubmitError(null)
          setNotice(null)
        }}
        className="mt-4 min-h-[44px] text-sm text-green-700 underline"
      >
        {mode === 'signin' ? t('auth.toSignup') : t('auth.toLogin')}
      </button>
        </>
      ) : null}

      <Link to="/home" className="mt-auto pt-6 text-sm text-gray-500 underline">
        {t('auth.backHome')}
      </Link>
    </div>
  )
}
