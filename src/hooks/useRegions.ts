import { useQuery } from '@tanstack/react-query'
import { getSupabaseClient } from '../lib/supabase'
import { appConfig } from '../config/app'
import { regionName } from '../lib/regionName'
import type { Tables } from '../types/database'

export type Region = Tables<'regions'>

/** 지역 단계 순서(v1.2, D-035): 시·도(province) → 시·군·구(city) → 읍·면(town). */
const LEVEL_ORDER: Record<string, number> = { province: 0, city: 1, town: 2 }

async function fetchRegions(): Promise<Region[]> {
  // RLS(regions_select_active)가 활성 지역만 노출하지만, 의도를 명시해 is_active도 건다.
  const { data, error } = await getSupabaseClient()
    .from('regions')
    .select('*')
    .eq('is_active', true)
  if (error) throw new Error(error.message)
  // 결정적 정렬(v1.1 D-033·재검수): 시·도·시·군·구는 기본 언어 이름순, 읍·면은 등록(id)순 —
  // 시드가 읍 먼저·면 다음이라 v1.0의 화면 순서(홍성읍 맨 위)를 유지한다.
  const key = (r: Region) => regionName(r.names, appConfig.defaultLocale)
  return (data ?? []).sort((a, b) => {
    const la = LEVEL_ORDER[a.level] ?? 9
    const lb = LEVEL_ORDER[b.level] ?? 9
    if (la !== lb) return la - lb
    if (a.level === 'town') return a.id.localeCompare(b.id)
    return key(a).localeCompare(key(b), appConfig.defaultLocale)
  })
}

export function useRegions() {
  // 지역 목록은 정적 데이터(257행)라 화면 진입마다 재조회하지 않는다(재검수 P2 — 1시간 캐시).
  return useQuery({ queryKey: ['regions'], queryFn: fetchRegions, staleTime: 60 * 60_000 })
}

// 순수 범위 함수는 lib/regionScope.ts로 옮겼다(node:test에서 바로 쓰려고, v1.6). 기존 import 경로는 그대로 둔다.
export { countyRegionIds, countyOf, provinceOf } from '../lib/regionScope'

/**
 * 시·군·구별 선택 단위 묶음(v1.1, D-033). provinceId를 주면 그 시·도의 시·군·구만.
 * members = 그 시·군·구의 읍·면, 읍·면이 아직 없으면 시·군·구 자신 1개(시·군·구 단위로 고른다).
 * 부모가 없거나 비활성 시·군·구를 가리키는 읍·면은 city: null 그룹으로 모은다.
 */
export interface RegionGroup {
  city: Region | null
  members: Region[]
}

export function groupRegionsByCity(regions: Region[], provinceId?: string | null): RegionGroup[] {
  const cities = regions.filter(
    (r) => r.level === 'city' && (provinceId == null || r.parent_id === provinceId),
  )
  const towns = regions.filter((r) => r.level === 'town')
  const groups: RegionGroup[] = cities.map((city) => {
    const members = towns.filter((t) => t.parent_id === city.id)
    return { city, members: members.length > 0 ? members : [city] }
  })
  // 부모 없는(미분류) 읍·면은 전체 목록을 요청했을 때만 별도 그룹으로 붙인다.
  if (provinceId == null) {
    const allCityIds = new Set(regions.filter((r) => r.level === 'city').map((c) => c.id))
    const orphan = towns.filter((t) => !t.parent_id || !allCityIds.has(t.parent_id))
    if (orphan.length > 0) groups.push({ city: null, members: orphan })
  }
  return groups
}

/**
 * 화면 공용 분할(Select·ProfileEdit이 같은 순서를 쓴다, 재검수 P2):
 * detailed = 읍·면까지 준비된 시·군·구 그룹(+미분류 읍·면) — 먼저 보여 준다.
 * cityOnly = 읍·면이 없어 시·군·구 자체로 고르는 지역들 — 한 묶음으로 뒤에 둔다.
 */
export function splitRegionGroups(
  regions: Region[],
  provinceId?: string | null,
): {
  detailed: RegionGroup[]
  cityOnly: Region[]
} {
  const groups = groupRegionsByCity(regions, provinceId)
  const isDetailed = (g: RegionGroup) => g.city === null || g.members[0]?.level === 'town'
  return {
    detailed: groups.filter(isDetailed),
    cityOnly: groups.filter((g) => !isDetailed(g)).flatMap((g) => g.members),
  }
}

/**
 * 시·도별 선택 단위 목록(v1.2 — 프로필 편집 드롭다운). 각 시·도 아래에 시·군·구 순서대로,
 * 읍·면이 있는 시·군·구는 읍·면을(county와 함께), 없는 시·군·구는 자기 자신을 넣는다.
 * 시·도가 없는(구 데이터) 시·군·구는 province: null 그룹.
 */
export interface ProvinceGroup {
  province: Region | null
  members: { region: Region; county: Region | null }[]
}

export function groupSelectableByProvince(regions: Region[]): ProvinceGroup[] {
  const provinces = regions.filter((r) => r.level === 'province')
  const provinceIds = new Set(provinces.map((p) => p.id))
  const build = (provinceId: string | null): ProvinceGroup['members'] =>
    groupRegionsByCity(regions, provinceId ?? undefined)
      .filter((g) => g.city !== null && (provinceId !== null || !provinceIds.has(g.city.parent_id ?? '')))
      .flatMap((g) => g.members.map((m) => ({ region: m, county: m.level === 'town' ? g.city : null })))
  const groups: ProvinceGroup[] = provinces.map((p) => ({ province: p, members: build(p.id) }))
  const legacy = build(null)
  if (legacy.length > 0) groups.push({ province: null, members: legacy })
  return groups.filter((g) => g.members.length > 0)
}

// 저장된 지역이 활성 목록에 없을 때의 정리(v1.1 D-033의 useStaleRegionCleanup)는 v1.6(D-047)부터
// RegionChoiceProvider가 한다: 목록으로 무효가 확인되면 '없음'(묘비)으로 바꾸고, 목록을 못 읽었거나 0행이면
// 건드리지 않는다. 무효 지역이 '전체 범위' 조회가 되는 길은 lib/regionScope의 태그 범위로 막았다.
