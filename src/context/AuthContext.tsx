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
import { isAuthRetryableFetchError, type Session, type User } from '@supabase/supabase-js'
import { useQueryClient, type QueryClient } from '@tanstack/react-query'
import { getSupabaseClient, isSupabaseConfigured } from '../lib/supabase'
import { Capacitor } from '@capacitor/core'
import { App as CapacitorApp } from '@capacitor/app'
import { Browser } from '@capacitor/browser'
import { completeNativeOAuth, NATIVE_OAUTH_REDIRECT } from '../lib/nativeOAuth'
import { readStoredCountry } from '../lib/country'
import type { OAuthProvider } from '../config/app'
import { useTranslation } from '../i18n/useTranslation'
import { regionChoiceStore } from '../lib/regionChoiceStore'
import type { AuthStatus } from '../lib/regionChoice'

const PENDING_NICKNAME_KEY = 'nongsadama.pendingNickname'

/** 로그아웃 정리: 프로필에서 온 보는 지역만 지우고(직접 고른 둘러보기 설정은 유지), 지역 목록 캐시는 남긴다. */
function clearAfterSignOut(queryClient: QueryClient) {
  regionChoiceStore.clearProfileView()
  // 공용 단말 방어: 이전 사용자 데이터가 gcTime 동안 메모리에 남지 않게 비운다(재검수 P2-5).
  // 지역 목록(공개·정적)은 다시 받지 않도록 남긴다 — 비우면 그동안 보는 지역을 판단할 수 없다.
  const regions = queryClient.getQueryData(['regions'])
  queryClient.clear()
  if (regions) queryClient.setQueryData(['regions'], regions)
}

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
  /**
   * 지역 판단용 로그인 상태(v1.6 D-047). 'unknown' = 복원 중이거나, 토큰 갱신이 네트워크 오류로 끝나
   * 로그아웃인지 알 수 없음 — 이때 기기 기록은 읽기만 한다.
   */
  authStatus: AuthStatus
  /** 내 profiles 행이 있게 한다(없으면 만든다). 같은 계정은 한 번만 실행하고 결과를 나눠 쓴다. */
  ensureOwnProfile: (u: User) => Promise<void>
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
  const [authStatus, setAuthStatus] = useState<AuthStatus>('unknown')
  const queryClient = useQueryClient()

  // onAuthStateChange 콜백에서 최신 언어를 읽기 위한 ref (PRD 4.1: 선택값을 프로필에 저장)
  const localeRef = useRef(locale)
  localeRef.current = locale
  const localeExplicitRef = useRef(localeExplicit)
  localeExplicitRef.current = localeExplicit
  // 계정별 1회: 같은 계정의 SIGNED_IN은 탭 복귀·다른 탭·비밀번호 재확인마다 다시 온다(D-047)
  const ensuredRef = useRef(new Map<string, Promise<void>>())

  /**
   * 로그인된 사용자의 profiles 행이 없으면 만들어 준다.
   * - 이메일 확인이 꺼진 경우: 가입 직후 세션에서 즉시 생성됨
   * - 이메일 확인이 켜진 경우: 확인 후 첫 로그인 시 생성됨(가입 때 입력한 닉네임은
   *   localStorage 에 보관했다가 사용, 없으면 이메일 앞부분으로 대체)
   * - 지역은 넣지 않는다(v1.6 D-047, B안): 둘러보던 지역을 프로필에 자동 저장하지 않고,
   *   로그인 뒤 "내 지역으로 저장"을 제안한다. 이메일·카카오 모두 같다.
   */
  const createProfileIfMissing = useCallback(async (u: User) => {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', u.id)
      .maybeSingle()
    if (error) {
      // 조회 실패는 다음 인증 이벤트나 저장 제안의 재시도에서 다시 확인한다(무언 실패 금지)
      console.error('[nongsadama] profile check failed:', error.message)
      throw new Error(error.message)
    }
    if (data) return
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
      region_id: null,
      country_code: readStoredCountry(),
      auth_provider: provider,
    })
    if (!insertError || insertError.code === '23505') {
      // 23505(중복 키)는 동시 콜백 경합의 정상 결과 — 승자가 이미 생성함(재검수 P2-3).
      if (provider === 'email' && typeof window !== 'undefined') {
        window.localStorage.removeItem(PENDING_NICKNAME_KEY)
      }
      // 첫 로그인 시 프로필 조회가 insert 이전의 null을 캐시할 수 있으므로 ['profiles'] 전체를 무효화한다.
      void queryClient.invalidateQueries({ queryKey: ['profiles'] })
    } else {
      // 진짜 실패(네트워크·RLS)는 삼키지 않고 최소한 기록한다(무언 실패 금지, P2-3).
      console.error('[nongsadama] profile create failed:', insertError.message)
      throw new Error(insertError.message)
    }
  }, [queryClient])

  const ensureOwnProfile = useCallback((u: User): Promise<void> => {
    const running = ensuredRef.current.get(u.id)
    if (running) return running
    const task = createProfileIfMissing(u).catch((err: unknown) => {
      // 실패한 계정은 다시 시도할 수 있게 비운다
      ensuredRef.current.delete(u.id)
      throw err
    })
    ensuredRef.current.set(u.id, task)
    return task
  }, [createProfileIfMissing])
  const ensureProfile = useCallback((u: User) => {
    ensureOwnProfile(u).catch(() => undefined)
  }, [ensureOwnProfile])

  useEffect(() => {
    // 환경변수 누락 빌드에서도 인증이 필요 없는 공개 페이지(/privacy·/delete-account·/child-safety)는
    // ErrorBoundary로 떨어지지 않고 렌더돼야 한다(재검수 D-032). 데이터 화면은 호출 시점에 실패한다.
    if (!isSupabaseConfigured) {
      console.error('[nongsadama] Supabase 환경변수 없음 — 인증 초기화 생략(공개 페이지만 동작)')
      setInitializing(false)
      setAuthStatus('signedOut')
      return
    }
    const supabase = getSupabaseClient()
    let cancelled = false

    void supabase.auth.getSession().then(({ data, error }) => {
      if (cancelled) return
      setSession(data.session)
      setInitializing(false)
      // 만료된 토큰을 네트워크 오류로 못 갱신했으면 세션이 비어 와도 로그아웃이 아니다(D-047)
      setAuthStatus(data.session ? 'signedIn' : error && isAuthRetryableFetchError(error) ? 'unknown' : 'signedOut')
      if (data.session?.user) ensureProfile(data.session.user)
    })

    const { data: sub } = supabase.auth.onAuthStateChange((event, next) => {
      setSession(next)
      if (event === 'SIGNED_OUT') {
        // 모든 탭에 온다(다른 탭의 로그아웃·토큰 거부 포함) — 명시적 signOut을 거치지 않아도 같은 정리를 한다
        setAuthStatus('signedOut')
        ensuredRef.current.clear()
        regionChoiceStore.clearProfileView()
        queryClient.removeQueries({ queryKey: ['profiles'] })
      } else if (next?.user) {
        // INITIAL_SESSION(null)은 오류 때도 오므로 상태 판단에 쓰지 않는다
        setAuthStatus('signedIn')
      }
      if (next?.user) setTimeout(() => { if (!cancelled) ensureProfile(next.user) }, 0)
    })

    return () => {
      cancelled = true
      sub.subscription.unsubscribe()
    }
  }, [ensureProfile, queryClient])

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
    try {
      await getSupabaseClient().auth.signOut()
    } finally {
      // auth-js는 서버 호출이 실패해도 로컬 세션을 지운다 — 정리는 어떤 경우에도 한다(D-047)
      ensuredRef.current.clear()
      clearAfterSignOut(queryClient)
    }
  }, [queryClient])

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      initializing,
      authStatus,
      ensureOwnProfile,
      signIn,
      signUp,
      signInWithOAuth,
      signOut,
      oauthCallbackStatus,
      clearOAuthCallbackStatus,
      oauthCallbackError,
    }),
    [session, initializing, authStatus, ensureOwnProfile, signIn, signUp, signInWithOAuth, signOut, oauthCallbackStatus, clearOAuthCallbackStatus, oauthCallbackError],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider')
  return ctx
}
