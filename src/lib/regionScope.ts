import type { Tables } from '../types/database'

/**
 * 지역 범위 계산(순수 함수, v1.6 D-047). React·환경변수를 쓰지 않아 node:test에서 바로 불러 쓴다.
 * 예전에는 hooks/useRegions.ts 안에 있었다 — 그 파일은 같은 이름으로 다시 내보낸다.
 */
export type Region = Tables<'regions'>

/**
 * 선택 지역이 속한 시/군 하위(시 + 그 읍·면) 지역 id 집합을 반환한다.
 * 미선택이거나 로드된 목록에 없으면 null. 시·도는 선택 단위가 아니라 null.
 * null을 "전국"으로 쓰지 말 것 — 생활정보 조회는 lifeInfoScope의 태그 값만 받는다.
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

export type RegionStatus = 'valid' | 'invalid' | 'unknown'

/**
 * 저장된 지역 id가 지금 고를 수 있는 곳인가.
 * - unknown: 목록을 아직 못 읽었거나 실패했거나 0행 — "무효"의 증거가 아니므로 아무것도 지우지 않는다.
 * - valid: 활성 목록에 있는 시·군·구 또는 읍·면
 * - invalid: 목록은 있는데 없거나(비활성·삭제·다른 환경), 시·도
 */
export function regionStatus(regions: Region[] | undefined, id: string | null | undefined): RegionStatus {
  if (!regions || regions.length === 0) return 'unknown'
  if (!id) return 'invalid'
  const row = regions.find((r) => r.id === id)
  return row && (row.level === 'city' || row.level === 'town') ? 'valid' : 'invalid'
}

/** 두 지역이 같은 시·군·구에 속하는가(표시줄의 "내 지역" 비교 — 목록이 시·군 단위라서). */
export function sameCounty(regions: Region[], a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false
  if (a === b) return true
  const ca = countyOf(regions, regions.find((r) => r.id === a))
  const cb = countyOf(regions, regions.find((r) => r.id === b))
  return Boolean(ca && cb && ca.id === cb.id)
}

/** 생활정보 조회 범위. null·빈 배열이 "전국"이 되는 길을 없애려고 태그를 붙인다(D2). */
export type LifeInfoScope = { kind: 'county'; ids: string[] } | { kind: 'all' }

/** 보는 지역 → 조회 범위. 시·군 범위를 못 구하면 null(조회하지 않음). 'all'은 명시적 전국 보기에서만. */
export function lifeInfoScope(regions: Region[] | undefined, view: { status: string; regionId?: string | null }): LifeInfoScope | null {
  if (view.status === 'all') return { kind: 'all' }
  if (view.status !== 'region' || !regions) return null
  const ids = countyRegionIds(regions, view.regionId ?? null)
  return ids && ids.length > 0 ? { kind: 'county', ids } : null
}

/** 캐시 키용 안정 표현. */
export function lifeInfoScopeKey(scope: LifeInfoScope | null): string | null {
  if (!scope) return null
  return scope.kind === 'all' ? 'all' : `county:${[...scope.ids].sort().join(',')}`
}
