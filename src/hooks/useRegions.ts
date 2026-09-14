import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getSupabaseClient } from '../lib/supabase'
import { appConfig } from '../config/app'
import { regionName } from '../lib/regionName'
import { useSelectedRegion } from '../context/SelectedRegionContext'
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

/**
 * 선택 지역이 속한 시/군 하위(시 + 그 읍·면) 지역 id 집합을 반환한다.
 * 미선택이거나 로드된 목록에 없으면 null(→ 소비 측은 전체 범위로 처리). 시·도는 선택 단위가 아니라 null.
 */
export function countyRegionIds(regions: Region[], selectedId: string | null): string[] | null {
  if (!selectedId) return null
  const selected = regions.find((r) => r.id === selectedId)
  if (!selected || selected.level === 'province') return null
  const countyId = selected.level === 'city' ? selected.id : selected.parent_id ?? selected.id
  const ids = regions.filter((r) => r.id === countyId || r.parent_id === countyId).map((r) => r.id)
  return ids.length > 0 ? ids : [countyId]
}

/** 지역이 속한 시·군·구 행(시·군·구면 자기 자신). 시·도·없음이면 null. */
export function countyOf(regions: Region[], region: Region | undefined | null): Region | null {
  if (!region) return null
  if (region.level === 'city') return region
  if (region.level === 'town') return regions.find((r) => r.id === region.parent_id) ?? null
  return null
}

/** 지역이 속한 시·도 행(v1.2). 시·도면 자기 자신, 시·군·구는 부모, 읍·면은 부모의 부모. 없으면 null. */
export function provinceOf(regions: Region[], region: Region | undefined | null): Region | null {
  if (!region) return null
  if (region.level === 'province') return region
  const county = countyOf(regions, region)
  if (!county?.parent_id) return null
  return regions.find((r) => r.id === county.parent_id && r.level === 'province') ?? null
}

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
