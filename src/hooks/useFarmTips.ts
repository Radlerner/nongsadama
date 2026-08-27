import { useQuery } from '@tanstack/react-query'
import { getSupabaseClient } from '../lib/supabase'
import { norm } from '../lib/matching'
import type { Tables } from '../types/database'

export type FarmTip = Tables<'farm_tips'>

/**
 * 🌾 농사 도움(PRD v1.7 §1). 비로그인 열람(RLS: is_published 공개 읽기).
 * 정렬은 클라이언트에서: 내 작목 팁 → 공통(crop null) → 기타, 각 그룹 내 최신순.
 */
export function useFarmTips(myCrop: string | null) {
  return useQuery({
    queryKey: ['farmTips', 'list'],
    queryFn: async (): Promise<FarmTip[]> => {
      const { data, error } = await getSupabaseClient()
        .from('farm_tips')
        .select('*')
        .order('created_at', { ascending: false })
      if (error) throw new Error(error.message)
      return data ?? []
    },
    select: (tips) => {
      // 매칭 표준 norm(trim+lowercase, matching.ts)과 동일 규칙(재검수 P2-3)
      const rank = (t: FarmTip) =>
        myCrop && norm(t.crop_type) === norm(myCrop) && norm(myCrop) !== ''
          ? 0
          : t.crop_type === null
            ? 1
            : 2
      return [...tips].sort((a, b) => rank(a) - rank(b))
    },
  })
}

export function useFarmTip(id: string | undefined) {
  return useQuery({
    queryKey: ['farmTips', 'item', id],
    queryFn: async (): Promise<FarmTip | null> => {
      const { data, error } = await getSupabaseClient()
        .from('farm_tips')
        .select('*')
        .eq('id', id as string)
        .maybeSingle()
      if (error) throw new Error(error.message)
      return data
    },
    enabled: Boolean(id),
  })
}
