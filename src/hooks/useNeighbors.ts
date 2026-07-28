import { useQuery } from '@tanstack/react-query'
import { getSupabaseClient } from '../lib/supabase'
import type { Tables } from '../types/database'

export type NeighborProfile = Tables<'neighbor_profiles'>

/**
 * 이웃 목록(neighbor_profiles 뷰). DB가 강제하는 조건:
 * - authenticated 전용(GRANT), 동의자 행만, 열람자 본인도 동의자일 때만(상호성).
 * 미동의/비로그인이면 0행 또는 권한 오류가 나므로 enabled로 호출 자체를 막는다.
 */
export function useNeighbors(enabled: boolean) {
  return useQuery({
    queryKey: ['neighbor_profiles'],
    queryFn: async (): Promise<NeighborProfile[]> => {
      const { data, error } = await getSupabaseClient().from('neighbor_profiles').select('*')
      if (error) throw new Error(error.message)
      return data ?? []
    },
    enabled,
  })
}
