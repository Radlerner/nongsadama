import { useQuery } from '@tanstack/react-query'
import { getSupabaseClient } from '../lib/supabase'
import type { Tables } from '../types/database'

export type LifeInfo = Tables<'life_info'>

async function fetchLifeInfoList(regionIds: string[] | null): Promise<LifeInfo[]> {
  // RLS(life_info_select_published_or_admin)가 공개분만 노출하지만 의도를 명시한다.
  let query = getSupabaseClient().from('life_info').select('*').eq('is_published', true)
  if (regionIds && regionIds.length > 0) {
    query = query.in('region_id', regionIds)
  }
  const { data, error } = await query
  if (error) throw new Error(error.message)
  return data ?? []
}

/** regionIds가 null이면 공개 생활정보 전체, 아니면 해당 지역 집합으로 범위를 좁힌다. */
export function useLifeInfoList(regionIds: string[] | null) {
  return useQuery({
    queryKey: ['life_info', 'list', regionIds ? [...regionIds].sort() : null],
    queryFn: () => fetchLifeInfoList(regionIds),
  })
}

async function fetchLifeInfoItem(id: string): Promise<LifeInfo | null> {
  const { data, error } = await getSupabaseClient()
    .from('life_info')
    .select('*')
    .eq('id', id)
    .eq('is_published', true)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data
}

export function useLifeInfoItem(id: string | undefined) {
  return useQuery({
    queryKey: ['life_info', 'item', id],
    queryFn: () => fetchLifeInfoItem(id as string),
    enabled: Boolean(id),
  })
}
