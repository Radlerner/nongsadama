import { useQuery } from '@tanstack/react-query'
import { getSupabaseClient } from '../lib/supabase'

/**
 * 작성자의 메신저 링크(PRD v1.6 §2). contact_links 뷰가 열람 자격을 강제한다:
 * 대상이 공개 동의 + 링크 보유 && 열람자도 동의자(상호성). 자격 없으면 0행 → null.
 * anon은 뷰 접근 자체가 거부되어 항상 null(권한 오류는 삼키고 null 반환).
 */
export function useContactLink(userId: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: ['contactLink', userId],
    queryFn: async (): Promise<string | null> => {
      const { data, error } = await getSupabaseClient()
        .from('contact_links')
        .select('messenger_link')
        .eq('id', userId as string)
        .maybeSingle()
      if (error) return null
      return data?.messenger_link ?? null
    },
    enabled: enabled && Boolean(userId),
  })
}
