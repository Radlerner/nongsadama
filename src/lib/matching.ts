import type { Tables } from '../types/database'

type Region = Tables<'regions'>
export type NeighborRow = Tables<'neighbor_profiles'>

/** 두 좌표 간 대원거리(km). 지역 중심좌표 간 근사 거리 계산용. */
export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const rad = (d: number) => (d * Math.PI) / 180
  const R = 6371
  const dLat = rad(lat2 - lat1)
  const dLng = rad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(a))
}

/** 읍·면 중심좌표 기준 근사 거리(km). 좌표가 없으면 null. */
export function regionDistanceKm(a: Region | undefined, b: Region | undefined): number | null {
  if (!a || !b) return null
  if (a.id === b.id) return 0
  if (
    a.centroid_lat == null || a.centroid_lng == null ||
    b.centroid_lat == null || b.centroid_lng == null
  ) {
    return null
  }
  return haversineKm(a.centroid_lat, a.centroid_lng, b.centroid_lat, b.centroid_lng)
}

/** 이 거리 이하인 다른 읍·면은 "인접"으로 본다(PRD v1.4 §2.1의 같은/인접 읍·면). */
export const ADJACENT_KM = 10

export interface ViewerProfile {
  preferred_locale: string
  crop_type: string | null
  country_code: string | null
  region_id: string | null
}

const norm = (s: string | null | undefined) => (s ?? '').trim().toLowerCase()

/**
 * 매칭 점수(PRD v1.4 §2.1): 같은 언어 +3, 같은 작목 +2, 같은/인접 읍·면 +2, 같은 국적 +1.
 * 값 비교만 하며 특정 언어·국가·작목을 하드코딩하지 않는다.
 */
export function matchScore(
  viewer: ViewerProfile,
  other: NeighborRow,
  regionsById: Map<string, Region>,
): number {
  let score = 0
  if (norm(viewer.preferred_locale) !== '' && norm(viewer.preferred_locale) === norm(other.preferred_locale)) {
    score += 3
  }
  if (norm(viewer.crop_type) !== '' && norm(viewer.crop_type) === norm(other.crop_type)) {
    score += 2
  }
  const vr = viewer.region_id ? regionsById.get(viewer.region_id) : undefined
  const or = other.region_id ? regionsById.get(other.region_id) : undefined
  const dist = regionDistanceKm(vr, or)
  if (dist !== null && dist <= ADJACENT_KM) score += 2
  if (norm(viewer.country_code) !== '' && norm(viewer.country_code) === norm(other.country_code)) {
    score += 1
  }
  return score
}
