import { haversineKm } from './matching'
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

/** 이 거리(km)보다 멀면 "서비스 지역 밖"으로 안내한다. */
export const OUT_OF_AREA_KM = 30

/** 중심좌표가 있는 활성 읍·면 중 가장 가까운 곳과 거리를 구한다. */
export function nearestTown(
  regions: Region[],
  lat: number,
  lng: number,
): { region: Region; distanceKm: number } | null {
  let best: { region: Region; distanceKm: number } | null = null
  for (const r of regions) {
    if (r.level !== 'town' || r.centroid_lat == null || r.centroid_lng == null) continue
    const d = haversineKm(lat, lng, r.centroid_lat, r.centroid_lng)
    if (!best || d < best.distanceKm) best = { region: r, distanceKm: d }
  }
  return best
}
