import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Capacitor } from '@capacitor/core'
import { App as CapacitorApp } from '@capacitor/app'
import { useAuth } from './AuthContext'
import { useRegions } from '../hooks/useRegions'
import { useOwnProfile } from '../hooks/useOwnProfile'
import { regionChoiceStore } from '../lib/regionChoiceStore'
import {
  decideView,
  ownRegion as resolveOwnRegion,
  pendingWrite,
  saveOfferTarget,
  toOwnTarget,
  type OwnRegion,
  type ProfileRegionState,
  type RegionChoice,
  type ViewState,
} from '../lib/regionChoice'
import { regionStatus } from '../lib/regionScope'
import { getSupabaseClient, isSupabaseConfigured } from '../lib/supabase'
import { regionSyncConfig } from '../config/app'
import type { Tables } from '../types/database'

/**
 * 지금 보는 지역(view)·내 지역·"내 지역으로 저장" 제안을 한곳에서 정한다(v1.6, D-047).
 * 지도·생활정보·/farm·표시줄·게시판이 모두 이 값을 쓴다 — 화면마다 따로 판단하지 않는다.
 * 자식은 항상 그린다(공개 페이지 /privacy 등이 이 판단을 기다리지 않게).
 */

export type SavePhase = 'idle' | 'saving' | 'saved' | 'error'

interface RegionChoiceValue {
  view: ViewState
  record: RegionChoice
  own: OwnRegion
  /** 유효한 프로필 지역(내 지역). 없거나 아직 모르면 null */
  profileRegionId: string | null
  /** D1: 보는 지역이 내 지역과 다를 때 "내 지역으로" 대상 */
  toOwnRegionId: string | null
  /** 5초 기한이 지난 뒤 도착한 내 지역 — 자동 적용하지 않고 버튼만 켠다 */
  lateOwnRegionId: string | null
  /** "내 지역으로 저장" 제안 대상(D3·D5) */
  saveOffer: { regionId: string; previousRegionId: string | null } | null
  savePhase: SavePhase
  savedRegionId: string | null
  /** 직접 고름(지역 선택 화면·지도·표시줄) */
  pickRegion: (regionId: string) => void
  /** "지역 없이 전국 둘러보기"(D2) */
  pickAll: () => void
  /** "내 지역으로 보기" */
  showOwn: (regionId: string) => void
  saveOwn: () => Promise<void>
  dismissOffer: () => void
  retry: () => void
}

const RegionChoiceContext = createContext<RegionChoiceValue | null>(null)

function useOnline(): boolean {
  const subscribe = useCallback((cb: () => void) => {
    window.addEventListener('online', cb)
    window.addEventListener('offline', cb)
    return () => {
      window.removeEventListener('online', cb)
      window.removeEventListener('offline', cb)
    }
  }, [])
  return useSyncExternalStore(subscribe, () => navigator.onLine, () => true)
}

export function RegionChoiceProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const { user, authStatus, ensureOwnProfile } = useAuth()
  const record = useSyncExternalStore(regionChoiceStore.subscribe, regionChoiceStore.getSnapshot, regionChoiceStore.getSnapshot)
  const online = useOnline()
  const uid = user?.id ?? null
  const signedInUid = authStatus === 'signedIn' ? uid : null

  const regionsQuery = useRegions()
  const regions = regionsQuery.data
  const regionsFailed = regionsQuery.isError || (regions !== undefined && regions.length === 0)

  const profileQuery = useOwnProfile(signedInUid ?? undefined)
  const profile: ProfileRegionState = !signedInUid
    ? { state: 'pending' }
    : profileQuery.data !== undefined
      ? { state: 'success', exists: profileQuery.data !== null, regionId: profileQuery.data?.region_id ?? null }
      : profileQuery.isError
        ? { state: 'error' }
        : { state: 'pending' }

  // 판단 기한: 로그인 상태·계정이 바뀔 때마다 새로 잰다(같은 계정의 토큰 갱신·SIGNED_IN은 바꾸지 않음).
  // "다시 시도"는 nonce로 기한을 다시 건다.
  const [nonce, setNonce] = useState(0)
  const deadlineKey = `${authStatus}:${uid ?? '-'}#${nonce}`
  const [passedKey, setPassedKey] = useState<string | null>(null)
  useEffect(() => {
    const timer = window.setTimeout(() => setPassedKey(deadlineKey), regionSyncConfig.decisionMs)
    return () => window.clearTimeout(timer)
  }, [deadlineKey])
  // 자동 적용을 끄면(스위치) 기한이 이미 지난 것처럼 다룬다 — 자동으로 따르지 않고 "내 지역으로 보기" 버튼만 남는다
  const deadlinePassed = passedKey === deadlineKey || !regionSyncConfig.autoApply

  const input = {
    view: record.view,
    auth: authStatus,
    uid: signedInUid,
    regions,
    regionsFailed,
    profile,
    deadlinePassed,
    offline: !online,
  }
  const view = decideView(input)
  const write = pendingWrite(input)
  const writeKey = write ? JSON.stringify(write) : null

  // 자동 쓰기(귀속·프로필 따르기·묘비): 판단에 쓴 rev가 그대로일 때만 — 그사이 직접 고른 값은 덮지 않는다.
  // writeKey가 같은 쓰기를 대표하므로 write 객체 자체는 의존성에 넣지 않는다.
  useEffect(() => {
    if (!write) return
    regionChoiceStore.apply(write, record.rev)
  }, [writeKey, record.rev])

  const own = resolveOwnRegion({ auth: authStatus, profile, regions, view })
  const profileRegionId = own.state === 'ready' ? own.profileRegionId : null
  const toOwnRegionId = toOwnTarget(regions, view, profileRegionId)
  const lateOwnRegionId =
    view.status === 'none' && view.reason === 'timeout' && profile.state === 'success' && regionStatus(regions, profile.regionId) === 'valid'
      ? profile.regionId
      : null

  const dismissals = useSyncExternalStore(
    regionChoiceStore.subscribe,
    () => JSON.stringify(regionChoiceStore.getDismissals()),
    () => '[]',
  )
  // profile·view는 매 렌더 새 객체라 값 문자열로 묶는다
  const profileKey = JSON.stringify(profile)
  const viewKey = JSON.stringify(view)
  const saveOffer = useMemo(
    () => saveOfferTarget({ auth: authStatus, uid: signedInUid, profile: JSON.parse(profileKey), regions, view: JSON.parse(viewKey), dismissed: JSON.parse(dismissals) }),
    [authStatus, signedInUid, profileKey, regions, viewKey, dismissals],
  )
  const [save, setSave] = useState<{ phase: SavePhase; uid: string | null; regionId: string | null }>({ phase: 'idle', uid: null, regionId: null })
  const savePhase = save.uid === signedInUid ? save.phase : 'idle'
  const savedRegionId = save.uid === signedInUid ? save.regionId : null

  // 앱 복귀·화면이 다시 보일 때 오래된 프로필만 다시 받는다(다른 기기에서 지역을 바꿨을 수 있다)
  useEffect(() => {
    if (!signedInUid) return
    const refresh = () => {
      if (document.visibilityState === 'hidden') return
      void queryClient.refetchQueries({ queryKey: ['profiles', 'own', signedInUid], stale: true })
    }
    document.addEventListener('visibilitychange', refresh)
    let remove: (() => void) | undefined
    if (Capacitor.isNativePlatform()) {
      const handle = CapacitorApp.addListener('resume', refresh)
      remove = () => { void handle.then((h) => h.remove()).catch(() => undefined) }
    }
    return () => {
      document.removeEventListener('visibilitychange', refresh)
      remove?.()
    }
  }, [signedInUid, queryClient])

  // 다른 탭이 기록을 바꾸면 다시 읽는다(같은 탭 변경은 저장소가 바로 알린다)
  useEffect(() => {
    const onStorage = (e: StorageEvent) => regionChoiceStore.handleStorageEvent(e.key, e.newValue)
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const pickRegion = useCallback((regionId: string) => regionChoiceStore.pickUser(regionId, signedInUid), [signedInUid])
  const pickAll = useCallback(() => regionChoiceStore.pickAll(signedInUid), [signedInUid])
  const showOwn = useCallback((regionId: string) => {
    if (signedInUid) regionChoiceStore.followProfile(regionId, signedInUid)
  }, [signedInUid])

  const saveOwn = useCallback(async () => {
    if (!user || !signedInUid || !saveOffer || !isSupabaseConfigured) return
    if (save.phase === 'saving') return
    const target = saveOffer.regionId
    const previous = saveOffer.previousRegionId
    const forUid = signedInUid
    setSave({ phase: 'saving', uid: forUid, regionId: target })
    const supabase = getSupabaseClient()
    // 기존 행만 고친다(insert 금지 — 가입 처리와 겹치면 닉네임 등이 사라진다).
    // 프로필 지역이 아직 비어 있을(또는 무효 값 그대로일) 때만 쓴다: 다른 기기에서 그사이 저장했으면 덮지 않는다.
    const attempt = async () => {
      let q = supabase.from('profiles').update({ region_id: target }).eq('id', forUid)
      q = previous ? q.eq('region_id', previous) : q.is('region_id', null)
      return q.select('id, region_id')
    }
    try {
      let { data, error } = await attempt()
      if (!error && (data ?? []).length === 0) {
        const { data: row, error: rowError } = await supabase.from('profiles').select('id, region_id').eq('id', forUid).maybeSingle()
        if (rowError) error = rowError
        else if (!row) {
          // 행이 아직 없다(가입 직후) — 만들어지기를 한 번 기다리고 한 번만 다시 시도
          await ensureOwnProfile(user)
          ;({ data, error } = await attempt())
        } else if (row.region_id && row.region_id !== previous) {
          // 다른 곳에서 이미 내 지역을 정했다 — 제안을 거두고(D1 버튼이 이어받음) 새 값을 받는다
          await queryClient.invalidateQueries({ queryKey: ['profiles'] })
          setSave({ phase: 'idle', uid: forUid, regionId: null })
          return
        }
      }
      const saved = (data ?? [])[0] as Pick<Tables<'profiles'>, 'id' | 'region_id'> | undefined
      if (error || !saved || saved.region_id !== target) {
        setSave({ phase: 'error', uid: forUid, regionId: target })
        return
      }
      // 서버가 돌려준 값으로만 따른다. 그사이 다른 계정으로 바뀌었으면 아무것도 하지 않는다.
      queryClient.setQueryData<Tables<'profiles'> | null>(['profiles', 'own', forUid], (old) => (old ? { ...old, region_id: target } : old))
      regionChoiceStore.undismissOffer(forUid, target)
      const current = regionChoiceStore.getSnapshot().view
      if (current.kind === 'user' && current.regionId === target) regionChoiceStore.apply({ type: 'followProfile', regionId: target, uid: forUid }, regionChoiceStore.getSnapshot().rev)
      setSave({ phase: 'saved', uid: forUid, regionId: target })
      void queryClient.invalidateQueries({ queryKey: ['profiles'] })
      void queryClient.invalidateQueries({ queryKey: ['posts', 'ownRegionCount'] })
    } catch {
      setSave({ phase: 'error', uid: forUid, regionId: target })
    }
  }, [user, signedInUid, saveOffer, save.phase, ensureOwnProfile, queryClient])

  // "저장했어요"는 잠시 뒤 비운다
  useEffect(() => {
    if (save.phase !== 'saved') return
    const timer = window.setTimeout(() => setSave((s) => (s.phase === 'saved' ? { ...s, phase: 'idle' } : s)), 4000)
    return () => window.clearTimeout(timer)
  }, [save.phase])

  const dismissOffer = useCallback(() => {
    if (signedInUid && saveOffer) regionChoiceStore.dismissOffer(signedInUid, saveOffer.regionId)
    setSave({ phase: 'idle', uid: signedInUid, regionId: null })
  }, [signedInUid, saveOffer])

  const { isError: regionsError, refetch: refetchRegions } = regionsQuery
  const retry = useCallback(() => {
    if (regionsError) void refetchRegions()
    if (signedInUid) void queryClient.refetchQueries({ queryKey: ['profiles', 'own', signedInUid] })
    setNonce((n) => n + 1)
  }, [regionsError, refetchRegions, signedInUid, queryClient])

  const ownKey = JSON.stringify(own)
  const value = useMemo<RegionChoiceValue>(
    () => ({
      view: JSON.parse(viewKey) as ViewState,
      record,
      own: JSON.parse(ownKey) as OwnRegion,
      profileRegionId,
      toOwnRegionId,
      lateOwnRegionId,
      saveOffer,
      savePhase,
      savedRegionId,
      pickRegion,
      pickAll,
      showOwn,
      saveOwn,
      dismissOffer,
      retry,
    }),
    [viewKey, record, ownKey, profileRegionId, toOwnRegionId, lateOwnRegionId, saveOffer, savePhase, savedRegionId, pickRegion, pickAll, showOwn, saveOwn, dismissOffer, retry],
  )

  return <RegionChoiceContext.Provider value={value}>{children}</RegionChoiceContext.Provider>
}

export function useRegionChoice(): RegionChoiceValue {
  const ctx = useContext(RegionChoiceContext)
  if (!ctx) throw new Error('useRegionChoice must be used within a RegionChoiceProvider')
  return ctx
}

/** 지금 보는 지역의 id(지역을 보고 있을 때만). 'all'·'none'·판단 중이면 null. */
export function viewRegionId(view: ViewState): string | null {
  return view.status === 'region' ? view.regionId : null
}
