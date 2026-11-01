import { useQuery } from '@tanstack/react-query'
import { getSupabaseClient } from '../lib/supabase'
import { regionSyncConfig } from '../config/app'
import { lifeInfoScopeKey, type LifeInfoScope } from '../lib/regionScope'
import type { Tables } from '../types/database'

export type LifeInfo = Tables<'life_info'>

export interface LifeInfoList {
  rows: LifeInfo[]
  /** 상한을 넘어 일부만 받았다 — 화면에 "일부만 보여요"를 띄운다(조용히 잘리지 않게) */
  truncated: boolean
}

async function fetchLifeInfoList(scope: LifeInfoScope): Promise<LifeInfoList> {
  // RLS(life_info_select_published_or_admin)가 공개분만 노출하지만 의도를 명시한다.
  // 순서: Postgres는 ORDER BY 없이는 순서를 보장하지 않으므로 안정 정렬을 명시한다.
  const limit = scope.kind === 'all' ? regionSyncConfig.lifeInfoAllLimit : regionSyncConfig.lifeInfoCountyLimit
  let query = getSupabaseClient()
    .from('life_info')
    .select('*')
    .eq('is_published', true)
    .order('category')
    .order('id')
  // 시·군 범위는 반드시 거른다 — 범위 없는 조회는 명시적 전국 보기('all')에서만(v1.6 D-047, D2)
  if (scope.kind === 'county') query = query.in('region_id', scope.ids)
  const { data, error } = await query.limit(limit + 1)
  if (error) throw new Error(error.message)
  const rows = data ?? []
  return { rows: rows.slice(0, limit), truncated: rows.length > limit }
}

/**
 * 생활정보 목록. scope가 null이면 조회하지 않는다(보는 지역을 정하는 중이거나 없음).
 * 지도·목록이 같은 범위면 같은 캐시 키를 쓴다.
 */
export function useLifeInfoList(scope: LifeInfoScope | null) {
  return useQuery({
    queryKey: ['life_info', 'list', lifeInfoScopeKey(scope)],
    queryFn: () => fetchLifeInfoList(scope as LifeInfoScope),
    enabled: scope !== null,
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
