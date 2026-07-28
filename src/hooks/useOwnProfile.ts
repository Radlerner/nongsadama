import { useQuery } from '@tanstack/react-query'
import { getSupabaseClient } from '../lib/supabase'
import type { Tables } from '../types/database'

export function useOwnProfile(userId: string | undefined) {
  return useQuery({
    queryKey: ['profiles', 'own', userId],
    queryFn: async (): Promise<Tables<'profiles'> | null> => {
      const { data, error } = await getSupabaseClient()
        .from('profiles')
        .select('*')
        .eq('id', userId as string)
        .maybeSingle()
      if (error) throw new Error(error.message)
      return data
    },
    enabled: Boolean(userId),
  })
}
