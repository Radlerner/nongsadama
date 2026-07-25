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

/**
 * 선택 지역이 속한 시/군 하위(시 + 그 읍·면) 지역 id 집합을 반환한다.
 * 미선택이거나 로드된 목록에 없으면 null(→ 소비 측은 전체 범위로 처리).
 */
export function countyRegionIds(regions: Region[], selectedId: string | null): string[] | null {
  if (!selectedId) return null
  const selected = regions.find((r) => r.id === selectedId)
  if (!selected) return null
  const countyId = selected.level === 'city' ? selected.id : selected.parent_id ?? selected.id
  const ids = regions.filter((r) => r.id === countyId || r.parent_id === countyId).map((r) => r.id)
  return ids.length > 0 ? ids : [countyId]
}
