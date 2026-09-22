import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { useQueryClient } from '@tanstack/react-query'
import { getSupabaseClient, isSupabaseConfigured } from '../lib/supabase'
import { Capacitor } from '@capacitor/core'
import { App as CapacitorApp } from '@capacitor/app'
import { Browser } from '@capacitor/browser'
import { completeNativeOAuth, NATIVE_OAUTH_REDIRECT } from '../lib/nativeOAuth'
import type { OAuthProvider } from '../config/app'
import { useTranslation } from '../i18n/useTranslation'
import { useSelectedRegion } from '../context/SelectedRegionContext'

const PENDING_NICKNAME_KEY = 'nongsadama.pendingNickname'

interface SignUpArgs {
  email: string
  password: string
  nickname: string
}

interface AuthContextValue {
  session: Session | null
  user: User | null
  /** 초기 세션 복원이 끝나기 전 true (이때는 로그인 여부를 판단하지 말 것) */
  initializing: boolean
  signIn: (email: string, password: string) => Promise<{ error: string | null }>
  /** 가입. 이메일 확인이 켜져 있으면 needsEmailConfirm=true 로 반환된다. */
  signUp: (args: SignUpArgs) => Promise<{ error: string | null; needsEmailConfirm: boolean }>
  /**
   * 간편(소셜) 로그인 — Supabase OAuth 리다이렉트(PRD v1.6 후속, kakao-login 스킬).
   * 성공 시 카카오 등 제공자 페이지로 이동하므로 반환은 "시작 실패" 오류만 의미 있다.
   */
  signInWithOAuth: (provider: OAuthProvider) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
  oauthCallbackStatus: 'success' | 'error' | null
  clearOAuthCallbackStatus: () => void
  oauthCallbackError: boolean
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [initializing, setInitializing] = useState(true)
  const { locale, localeExplicit, localeSelection } = useTranslation()
  const [oauthCallbackStatus, setOAuthCallbackStatus] = useState<'success' | 'error' | null>(null)
  const [oauthCallbackError, setOAuthCallbackError] = useState(false)
  const clearOAuthCallbackStatus = useCallback(() => setOAuthCallbackStatus(null), [])
  const { regionId } = useSelectedRegion()
  const queryClient = useQueryClient()

  // onAuthStateChange 콜백에서 최신 언어·지역을 읽기 위한 ref (PRD 4.1: 선택값을 프로필에 저장)
  const localeRef = useRef(locale)
  localeRef.current = locale
  const localeExplicitRef = useRef(localeExplicit)
  localeExplicitRef.current = localeExplicit
  const regionRef = useRef(regionId)
  regionRef.current = regionId

  /**
   * 로그인된 사용자의 profiles 행이 없으면 만들어 준다.
   * - 이메일 확인이 꺼진 경우: 가입 직후 세션에서 즉시 생성됨
   * - 이메일 확인이 켜진 경우: 확인 후 첫 로그인 시 생성됨(가입 때 입력한 닉네임은
   *   localStorage 에 보관했다가 사용, 없으면 이메일 앞부분으로 대체)
   */
  const ensureProfile = useCallback(async (u: User) => {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', u.id)
      .maybeSingle()
    if (error || data) return
    const provider = u.app_metadata?.provider ?? 'email'
    // pending 닉네임은 이메일 가입 흐름 전용 — 소셜 첫 로그인에 쓰면 다른(이메일) 계정의
    // 닉네임을 오염시킨다(재검수 P1-1). 소셜에서는 읽지도, 소비하지도 않는다.
    const pending =
      provider === 'email' && typeof window !== 'undefined'
        ? window.localStorage.getItem(PENDING_NICKNAME_KEY)
        : null
    // 소셜(카카오 등) 로그인: 제공자 프로필 닉네임을 기본값으로 쓴다(kakao-login 스킬 §2.2).
    const meta = u.user_metadata as Record<string, unknown>
    const socialNickname =
      (typeof meta.name === 'string' && meta.name) ||
      (typeof meta.preferred_username === 'string' && meta.preferred_username) ||
      null
    const fallback =
      socialNickname ?? ((u.email ?? 'user').split('@')[0].slice(0, 40) || 'user')
    // 서로게이트 쌍(이모지 등) 안전 절단(재검수 P2-4)
    const nickname = Array.from(pending ?? fallback).slice(0, 40).join('') || 'user'
    const { error: insertError } = await supabase.from('profiles').insert({
      id: u.id,
      nickname,
      preferred_locale: localeRef.current,
      preferred_locale_explicit: localeExplicitRef.current,
      region_id: regionRef.current,
      auth_provider: provider,
    })
    if (!insertError || insertError.code === '23505') {
      // 23505(중복 키)는 동시 콜백 경합의 정상 결과 — 승자가 이미 생성함(재검수 P2-3).
      if (provider === 'email' && typeof window !== 'undefined') {
        window.localStorage.removeItem(PENDING_NICKNAME_KEY)
      }
      // 첫 로그인 시 useOwnProfile이 insert 이전의 null을 캐시할 수 있으므로 무효화한다.
      void queryClient.invalidateQueries({ queryKey: ['profiles', 'own'] })
    } else {
      // 진짜 실패(네트워크·RLS)는 삼키지 않고 최소한 기록한다(무언 실패 금지, P2-3).
      console.error('[nongsadama] profile create failed:', insertError.message)
    }
  }, [queryClient])

  useEffect(() => {
    // 환경변수 누락 빌드에서도 인증이 필요 없는 공개 페이지(/privacy·/delete-account·/child-safety)는
    // ErrorBoundary로 떨어지지 않고 렌더돼야 한다(재검수 D-032). 데이터 화면은 호출 시점에 실패한다.
    if (!isSupabaseConfigured) {
      console.error('[nongsadama] Supabase 환경변수 없음 — 인증 초기화 생략(공개 페이지만 동작)')
      setInitializing(false)
      return
    }
    const supabase = getSupabaseClient()
    let cancelled = false

    void supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return
      setSession(data.session)
      setInitializing(false)
      if (data.session?.user) void ensureProfile(data.session.user)
    })

    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next)
      if (next?.user) setTimeout(() => { if (!cancelled) void ensureProfile(next.user) }, 0)
    })

    return () => {
      cancelled = true
      sub.subscription.unsubscribe()
    }
  }, [ensureProfile])

  const processedLocaleSelection = useRef(localeSelection)
  useEffect(() => {
    if (processedLocaleSelection.current === localeSelection) return
    if (!session?.user) return
    processedLocaleSelection.current = localeSelection
    const userId = session.user.id
    void getSupabaseClient().from('profiles')
      .update({ preferred_locale: locale, preferred_locale_explicit: true })
      .eq('id', userId)
      .then(({ error }) => {
        if (error) console.error('[nongsadama] preferred locale update failed')
        else void queryClient.invalidateQueries({ queryKey: ['profiles', 'own', userId] })
      })
  }, [localeSelection, locale, session?.user.id, queryClient])

  useEffect(() => {
    if (!Capacitor.isNativePlatform() || !isSupabaseConfigured) return
    let cancelled = false
    const handleUrl = async (url: string) => {
      if (cancelled) return
      try {
        if (await completeNativeOAuth(url)) {
          await Browser.close().catch(() => undefined)
          if (!cancelled) {
            setOAuthCallbackError(false)
            setOAuthCallbackStatus('success')
          }
        }
      } catch {
        await Browser.close().catch(() => undefined)
        if (!cancelled) {
          setOAuthCallbackError(true)
          setOAuthCallbackStatus('error')
        }
      }
    }
    const listener = CapacitorApp.addListener('appUrlOpen', ({ url }) => { void handleUrl(url) })
    void listener.then(async () => {
      if (cancelled) return
      const launch = await CapacitorApp.getLaunchUrl()
      if (launch?.url) await handleUrl(launch.url)
    }).catch(() => {
      if (!cancelled) setOAuthCallbackError(true)
    })
    return () => {
      cancelled = true
      void listener.then((handle) => handle.remove()).catch(() => undefined)
    }
  }, [])

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await getSupabaseClient().auth.signInWithPassword({ email, password })
    return { error: error ? error.message : null }
  }, [])

  const signUp = useCallback(async ({ email, password, nickname }: SignUpArgs) => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(PENDING_NICKNAME_KEY, nickname)
    }
    const { data, error } = await getSupabaseClient().auth.signUp({ email, password })
    if (error) {
      // 가입 실패 시 pending 닉네임을 남기지 않는다(같은 브라우저의 다른 계정 오염 방지, P2-1).
      if (typeof window !== 'undefined') window.localStorage.removeItem(PENDING_NICKNAME_KEY)
      return { error: error.message, needsEmailConfirm: false }
    }
    // 세션이 없으면 이메일 확인이 켜진 프로젝트 → 확인 후 첫 로그인 때 ensureProfile이 처리
    return { error: null, needsEmailConfirm: !data.session }
  }, [])

  const signInWithOAuth = useCallback(async (provider: OAuthProvider) => {
    setOAuthCallbackError(false)
    try {
      const native = Capacitor.isNativePlatform()
      const { data, error } = await getSupabaseClient().auth.signInWithOAuth({
        provider,
        options: native
          ? { redirectTo: NATIVE_OAUTH_REDIRECT, skipBrowserRedirect: true }
          : { redirectTo: `${window.location.origin}${import.meta.env.BASE_URL}` },
      })
      if (error) return { error: error.message }
      if (native) {
        if (!data.url) return { error: 'oauth-start-failed' }
        await Browser.open({ url: data.url })
      }
      return { error: null }
    } catch {
      return { error: 'oauth-start-failed' }
    }
  }, [])

  const signOut = useCallback(async () => {
    await getSupabaseClient().auth.signOut()
    // 공용 단말 방어: 이전 사용자 데이터가 gcTime 동안 메모리에 남지 않게 비운다(재검수 P2-5).
    queryClient.clear()
  }, [queryClient])

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      initializing,
      signIn,
      signUp,
      signInWithOAuth,
      signOut,
      oauthCallbackStatus,
      clearOAuthCallbackStatus,
      oauthCallbackError,
    }),
    [session, initializing, signIn, signUp, signInWithOAuth, signOut, oauthCallbackStatus, clearOAuthCallbackStatus, oauthCallbackError],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider')
  return ctx
}
