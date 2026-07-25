import { useQuery } from '@tanstack/react-query'
import { getSupabaseClient } from '../lib/supabase'
import type { Tables } from '../types/database'

export type Region = Tables<'regions'>

async function fetchRegions(): Promise<Region[]> {
  // RLS(regions_select_active)가 활성 지역만 노출하지만, 의도를 명시해 is_active도 건다.
  const { data, error } = await getSupabaseClient()
    .from('regions')
    .select('*')
    .eq('is_active', true)
  if (error) throw new Error(error.message)
  return data ?? []
}

export function useRegions() {
  return useQuery({ queryKey: ['regions'], queryFn: fetchRegions })
}
