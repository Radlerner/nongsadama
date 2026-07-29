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
import { getSupabaseClient } from '../lib/supabase'
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
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [initializing, setInitializing] = useState(true)
  const { locale } = useTranslation()
  const { regionId } = useSelectedRegion()
  const queryClient = useQueryClient()

  // onAuthStateChange 콜백에서 최신 언어·지역을 읽기 위한 ref (PRD 4.1: 선택값을 프로필에 저장)
  const localeRef = useRef(locale)
  localeRef.current = locale
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
    const pending =
      typeof window !== 'undefined' ? window.localStorage.getItem(PENDING_NICKNAME_KEY) : null
    const fallback = (u.email ?? 'user').split('@')[0].slice(0, 40) || 'user'
    const { error: insertError } = await supabase.from('profiles').insert({
      id: u.id,
      nickname: (pending ?? fallback).slice(0, 40),
      preferred_locale: localeRef.current,
      region_id: regionRef.current,
      auth_provider: 'email',
    })
    if (!insertError) {
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem(PENDING_NICKNAME_KEY)
      }
      // 첫 로그인 시 useOwnProfile이 insert 이전의 null을 캐시할 수 있으므로 무효화한다.
      void queryClient.invalidateQueries({ queryKey: ['profiles', 'own'] })
    }
  }, [queryClient])

  useEffect(() => {
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
      if (next?.user) void ensureProfile(next.user)
    })

    return () => {
      cancelled = true
      sub.subscription.unsubscribe()
    }
  }, [ensureProfile])

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

  const signOut = useCallback(async () => {
    await getSupabaseClient().auth.signOut()
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({ session, user: session?.user ?? null, initializing, signIn, signUp, signOut }),
    [session, initializing, signIn, signUp, signOut],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider')
  return ctx
}
