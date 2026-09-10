import { haversineKm } from './matching'
import { regionConfig } from '../config/app'
import type { Tables } from '../types/database'

type Region = Tables<'regions'>

/**
 * 일회성 현재 위치 조회 (PRD v1.3 §4.1 "위치 동의 시 가까운 지역 추천").
 * 좌표는 기기 내 계산에만 쓰고 저장·전송하지 않는다(불변 원칙).
 */
export function getCurrentPosition(): Promise<{ lat: number; lng: number }> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      reject(new Error('geolocation-unavailable'))
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => reject(new Error(err.message)),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 },
    )
  })
}

/** 이 거리(km)보다 멀면 "서비스 지역 밖"으로 안내한다(설정값 regionConfig.outOfAreaKm). */
export const OUT_OF_AREA_KM: number = regionConfig.outOfAreaKm

/**
 * 사용자가 실제로 고를 수 있는 지역 단위(v1.1, D-033):
 * 읍·면(town) 전부 + 읍·면이 아직 없는 시·군(city). 읍·면이 있는 시·군은 읍·면으로 고른다.
 * 특정 시·군을 가정하지 않고 regions 데이터의 모양만 본다.
 */
export function selectableRegions(regions: Region[]): Region[] {
  const citiesWithTowns = new Set(
    regions.filter((r) => r.level === 'town' && r.parent_id).map((r) => r.parent_id as string),
  )
  return regions.filter(
    (r) => r.level === 'town' || (r.level === 'city' && !citiesWithTowns.has(r.id)),
  )
}

/** 중심좌표가 있는 선택 가능 지역 중 가장 가까운 곳과 거리를 구한다. */
export function nearestServiceRegion(
  regions: Region[],
  lat: number,
  lng: number,
): { region: Region; distanceKm: number } | null {
  let best: { region: Region; distanceKm: number } | null = null
  for (const r of selectableRegions(regions)) {
    if (r.centroid_lat == null || r.centroid_lng == null) continue
    const d = haversineKm(lat, lng, r.centroid_lat, r.centroid_lng)
    if (!best || d < best.distanceKm) best = { region: r, distanceKm: d }
  }
  return best
}
