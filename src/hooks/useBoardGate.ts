import { useQuery } from '@tanstack/react-query'
import { getSupabaseClient } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useRegionChoice, viewRegionId } from '../context/RegionChoiceContext'
import { useRegions, countyRegionIds } from './useRegions'
import { OTHER_REGION_UNLOCK_POSTS, isUnlocked } from '../lib/regionGate'

/**
 * 다른 지역 게시글 보기 제한(D-045)에 필요한 값: 내 지역, 그 시·군 범위, 내 지역에 쓴 공개 글 수.
 * 글 수는 ['posts', …] 아래에 두어 글을 쓰거나 지우면(usePosts의 무효화) 다시 센다.
 * v1.6(D-047): 내 지역 = 유효한 프로필 지역 → 없으면 지금 보는(직접 고른) 지역. 비활성 프로필 지역은 쓰지 않는다.
 * 프로필을 못 불러왔으면 기기 지역으로 넘어가지 않고 오류로 다룬다(ownFailed).
 */
export function useBoardGate() {
  const { user, initializing } = useAuth()
  const { view, own, profileRegionId } = useRegionChoice()
  const { data: regions, isError: regionsError } = useRegions()
  const selectedRegionId = viewRegionId(view)
  const ownRegionId = own.state === 'ready' ? own.regionId : null
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
    /** 지금 보는 지역(직접 고른 지역 또는 따라가는 프로필 지역). 전국·없음이면 null */
    selectedRegionId,
    ownRegionId,
    ownScope,
    /** 거리 표시 기준(D4): 유효한 프로필 지역만 */
    profileRegionId,
    ownPostCount,
    need: OTHER_REGION_UNLOCK_POSTS,
    unlocked: isUnlocked(Boolean(user), ownPostCount),
    /** 로그인 확인·지역 목록·보는 지역·내 지역을 아직 모름 — 이때는 어느 지역을 보여 줄지 정하지 않는다 */
    pending:
      initializing ||
      (!regions && !regionsError) ||
      view.status === 'deciding' ||
      own.state === 'pending',
    /** 내 프로필을 못 불러왔다 — 기기 지역으로 대신하지 않는다 */
    ownFailed: own.state === 'error',
    /** 글 수를 세는 중 */
    countPending: Boolean(user) && Boolean(scopeKey) && count.isLoading,
    /** 글 수를 못 셌다 — 잠긴 것으로 다루되 "0개"라고 말하지 않는다 */
    countFailed: count.isError,
  }
}
