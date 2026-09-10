import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getSupabaseClient } from '../lib/supabase'
import { appConfig } from '../config/app'
import { regionName } from '../lib/regionName'
import { useSelectedRegion } from '../context/SelectedRegionContext'
import type { Tables } from '../types/database'

export type Region = Tables<'regions'>

async function fetchRegions(): Promise<Region[]> {
  // RLS(regions_select_active)가 활성 지역만 노출하지만, 의도를 명시해 is_active도 건다.
  const { data, error } = await getSupabaseClient()
    .from('regions')
    .select('*')
    .eq('is_active', true)
  if (error) throw new Error(error.message)
  // 다지역(v1.1, D-033)에서 그룹·드롭다운·지도 폴백 순서가 실행마다 달라지지 않도록 결정적 정렬:
  // 시·군은 기본 언어 이름순, 읍·면은 등록 순(id 순 — 시드는 읍 먼저, 그다음 면)을 보존해
  // v1.0에서 홍성읍이 맨 위였던 화면 순서를 유지한다(재검수 P2).
  const key = (r: Region) => regionName(r.names, appConfig.defaultLocale)
  return (data ?? []).sort((a, b) => {
    if (a.level !== b.level) return a.level === 'city' ? -1 : 1
    if (a.level === 'city') return key(a).localeCompare(key(b), appConfig.defaultLocale)
    return a.id.localeCompare(b.id)
  })
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

/** 지역이 속한 시·군 행(시·군이면 자기 자신). 없으면 null. */
export function countyOf(regions: Region[], region: Region | undefined | null): Region | null {
  if (!region) return null
  if (region.level === 'city') return region
  return regions.find((r) => r.id === region.parent_id) ?? null
}

/**
 * 시·군별 선택 단위 묶음(v1.1, D-033).
 * members = 그 시·군의 읍·면, 읍·면이 아직 없으면 시·군 자신 1개(시·군 단위로 고른다).
 * 부모가 없거나 비활성 시·군을 가리키는 읍·면은 city: null 그룹으로 모은다.
 */
export interface RegionGroup {
  city: Region | null
  members: Region[]
}

export function groupRegionsByCity(regions: Region[]): RegionGroup[] {
  const cities = regions.filter((r) => r.level === 'city')
  const towns = regions.filter((r) => r.level === 'town')
  const cityIds = new Set(cities.map((c) => c.id))
  const groups: RegionGroup[] = cities.map((city) => {
    const members = towns.filter((t) => t.parent_id === city.id)
    return { city, members: members.length > 0 ? members : [city] }
  })
  const orphan = towns.filter((t) => !t.parent_id || !cityIds.has(t.parent_id))
  if (orphan.length > 0) groups.push({ city: null, members: orphan })
  return groups
}

/**
 * 화면 공용 분할(Select·ProfileEdit이 같은 순서를 쓴다, 재검수 P2):
 * detailed = 읍·면까지 준비된 시·군 그룹(+미분류 읍·면) — 먼저 보여 준다.
 * cityOnly = 읍·면이 없어 시·군 자체로 고르는 지역들 — 한 묶음으로 뒤에 둔다.
 */
export function splitRegionGroups(regions: Region[]): {
  detailed: RegionGroup[]
  cityOnly: Region[]
} {
  const groups = groupRegionsByCity(regions)
  const isDetailed = (g: RegionGroup) => g.city === null || g.members[0]?.level === 'town'
  return {
    detailed: groups.filter(isDetailed),
    cityOnly: groups.filter((g) => !isDetailed(g)).flatMap((g) => g.members),
  }
}

/**
 * 저장된 regionId가 활성 목록에 없으면(비활성·삭제·다른 환경의 id) null로 정리한다.
 * 앱 셸(AppLayout)에서 호출해, 오래된 id가 조용히 '전체 범위'로 바뀌는 일을 막는다(v1.1, D-033).
 * 목록이 0행이면(일시적 정책 오류 등) '이 id가 무효'라는 증거가 아니므로 건드리지 않는다(재검수 P2).
 */
export function useStaleRegionCleanup(): void {
  const { data: regions } = useRegions()
  const { regionId, setRegionId } = useSelectedRegion()
  useEffect(() => {
    if (regions && regions.length > 0 && regionId && !regions.some((r) => r.id === regionId)) {
      setRegionId(null)
    }
  }, [regions, regionId, setRegionId])
}
