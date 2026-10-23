import { useQuery } from '@tanstack/react-query'
import { getSupabaseClient } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useSelectedRegion } from '../context/SelectedRegionContext'
import { useOwnProfile } from './useOwnProfile'
import { useRegions, countyRegionIds } from './useRegions'
import { OTHER_REGION_UNLOCK_POSTS, isUnlocked } from '../lib/regionGate'

/**
 * 다른 지역 게시글 보기 제한(D-045)에 필요한 값: 내 지역, 그 시·군 범위, 내 지역에 쓴 공개 글 수.
 * 글 수는 ['posts', …] 아래에 두어 글을 쓰거나 지우면(usePosts의 무효화) 다시 센다.
 */
export function useBoardGate() {
  const { user, initializing } = useAuth()
  const { regionId: selectedRegionId } = useSelectedRegion()
  const { data: profile, isLoading: profileLoading } = useOwnProfile(user?.id)
  const { data: regions, isError: regionsError } = useRegions()
  // 프로필 지역이 지금 고를 수 없는 곳(비활성·없어진 지역)이면 기기에서 고른 지역을 내 지역으로 본다
  const profileRegionId = profile?.region_id && regions?.some((r) => r.id === profile.region_id) ? profile.region_id : null
  const ownRegionId = user ? (profileRegionId ?? selectedRegionId) : selectedRegionId
  const ownScope = regions ? countyRegionIds(regions, ownRegionId) : null
  const scopeKey = ownScope ? [...ownScope].sort() : null
  const count = useQuery({
    queryKey: ['posts', 'ownRegionCount', user?.id ?? null, scopeKey],
    queryFn: async (): Promise<number> => {
      const { count: n, error } = await getSupabaseClient()
        .from('posts')
        .select('id', { count: 'exact', head: true })
        .eq('author_id', user?.id as string)
        .eq('status', 'published')
        .in('region_id', scopeKey as string[])
      if (error) throw new Error(error.message)
      return n ?? 0
    },
    enabled: Boolean(user && scopeKey),
  })
  const ownPostCount = count.data
  return {
    loggedIn: Boolean(user),
    selectedRegionId,
    ownRegionId,
    ownScope,
    ownPostCount,
    need: OTHER_REGION_UNLOCK_POSTS,
    unlocked: isUnlocked(Boolean(user), ownPostCount),
    /** 로그인 확인·지역 목록·프로필을 아직 모름 — 이때는 어느 지역을 보여 줄지 정하지 않는다 */
    pending: initializing || (!regions && !regionsError) || (Boolean(user) && profileLoading),
    /** 글 수를 세는 중 */
    countPending: Boolean(user) && Boolean(scopeKey) && count.isLoading,
    /** 글 수를 못 셌다 — 잠긴 것으로 다루되 "0개"라고 말하지 않는다 */
    countFailed: count.isError,
  }
}
