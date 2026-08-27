import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getSupabaseClient } from '../lib/supabase'

/**
 * 신고·차단(Play UGC 정책, D-022).
 * - 신고: 본인 명의 insert만 가능(RLS), 열람은 운영자(admin)만.
 * - 차단: 본인 것만 CRUD(RLS). 노출 필터링은 클라이언트에서 blockedIds로 적용.
 */

/** 내가 차단한 사용자 id 집합. 비로그인 시 빈 Set. */
export function useBlockedIds(userId: string | undefined) {
  return useQuery({
    queryKey: ['blocks', userId],
    queryFn: async (): Promise<Set<string>> => {
      const { data, error } = await getSupabaseClient()
        .from('blocks')
        .select('blocked_id')
      if (error) throw new Error(error.message)
      return new Set((data ?? []).map((r) => r.blocked_id))
    },
    enabled: Boolean(userId),
  })
}

export function useBlockUser(userId: string | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (blockedId: string) => {
      const { error } = await getSupabaseClient()
        .from('blocks')
        .insert({ blocker_id: userId as string, blocked_id: blockedId })
      // 23505(이미 차단)는 목적 달성 상태이므로 성공으로 취급
      if (error && error.code !== '23505') throw new Error(error.message)
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['blocks'] }),
  })
}

export function useUnblockUser(userId: string | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (blockedId: string) => {
      const { error } = await getSupabaseClient()
        .from('blocks')
        .delete()
        .eq('blocker_id', userId as string)
        .eq('blocked_id', blockedId)
      if (error) throw new Error(error.message)
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['blocks'] }),
  })
}

/** 게시글 신고. 같은 글 재신고(23505)는 "이미 접수됨"으로 구분해 알린다. */
export function useReportPost(userId: string | undefined) {
  return useMutation({
    mutationFn: async (input: { postId: string; reason: string }) => {
      const { error } = await getSupabaseClient().from('reports').insert({
        reporter_id: userId as string,
        post_id: input.postId,
        reason: input.reason,
      })
      if (error) {
        if (error.code === '23505') return { duplicated: true }
        throw new Error(error.message)
      }
      return { duplicated: false }
    },
  })
}
