import { useCallback, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getCurrentPosition } from '../lib/geo'
import { coordToRegion } from '../lib/kakaoMap'
import { useRegions } from './useRegions'
import { useSelectedRegion } from '../context/SelectedRegionContext'

const FUNCTIONS_BASE = `${import.meta.env.VITE_SUPABASE_URL as string}/functions/v1`

/**
 * 사용자 지역 결정(PRD v1.7 항목1 — 전국 테스터 대응).
 * 기본값: 선택 지역(파일럿=홍성)의 중심좌표+시도/시군.
 * "내 위치" 사용 시: 브라우저 위치 → 좌표 + (카카오 지오코더 가용 시) 실제 시도/시군.
 * 좌표는 조회에만 쓰고 저장하지 않는다(v1.3 §4.1).
 */
export interface UserArea {
  lat: number
  lon: number
  sido: string | null
  sigungu: string | null
  source: 'region' | 'geo'
}

export function useUserArea() {
  const { regionId } = useSelectedRegion()
  const { data: regions } = useRegions()
  const [geoArea, setGeoArea] = useState<UserArea | null>(null)
  const [locating, setLocating] = useState(false)
  const [geoError, setGeoError] = useState(false)

  // 선택 지역 기반 기본값: 읍·면의 부모(시/군) 이름으로 sido/sigungu를 유도한다.
  let regionArea: UserArea | null = null
  if (regions && regionId) {
    const town = regions.find((r) => r.id === regionId)
    const county = town?.parent_id ? regions.find((r) => r.id === town.parent_id) : undefined
    const centroid = town?.centroid_lat != null ? town : county
    if (centroid?.centroid_lat != null && centroid.centroid_lng != null) {
      const names = (county?.names ?? {}) as Record<string, string>
      const sigungu = names.ko ?? null
      regionArea = {
        lat: centroid.centroid_lat,
        lon: centroid.centroid_lng,
        // 파일럿 데이터는 시/군까지만 있으므로 시도는 지오코더로만 정확히 안다.
        // 사업 API 필터는 sigungu(센터명 부분일치)만으로도 동작한다.
        sido: null,
        sigungu,
        source: 'region',
      }
    }
  }

  const useMyLocation = useCallback(async () => {
    setLocating(true)
    setGeoError(false)
    try {
      const pos = await getCurrentPosition()
      const region = await coordToRegion(pos.lat, pos.lng) // 실패 시 null(조용한 폴백)
      setGeoArea({
        lat: pos.lat,
        lon: pos.lng,
        sido: region?.sido ?? null,
        sigungu: region?.sigungu ?? null,
        source: 'geo',
      })
    } catch {
      setGeoError(true)
    } finally {
      setLocating(false)
    }
  }, [])

  return { area: geoArea ?? regionArea, useMyLocation, locating, geoError }
}

interface WeatherPayload {
  tempC: number | null
  feelsC: number | null
  humidity: number | null
  windMs: number | null
  main: string | null
  desc: string | null
  icon: string | null
  name: string | null
}

/** 현재 날씨(서버 프록시 — 키 미노출, 30분 캐시). 실패 시 카드 숨김(부가 정보). */
export function useWeather(lat: number | undefined, lon: number | undefined) {
  return useQuery({
    queryKey: ['weather', lat?.toFixed(1), lon?.toFixed(1)],
    queryFn: async (): Promise<WeatherPayload | null> => {
      // 정밀 좌표를 네트워크에 싣지 않는다(재검수 P1-2) — 0.1°(≈11km)면 날씨엔 충분
      const r = await fetch(
        `${FUNCTIONS_BASE}/weather?lat=${(lat as number).toFixed(1)}&lon=${(lon as number).toFixed(1)}`,
      )
      if (!r.ok) return null
      const d = await r.json()
      return d?.error ? null : (d as WeatherPayload)
    },
    enabled: lat != null && lon != null,
    staleTime: 30 * 60_000,
    retry: 1,
  })
}

export interface RuralProgram {
  year: string
  id: string
  sido: string
  center: string
  name: string
  category: string
  amount: string
}

/**
 * 우리 지역 농촌지도사업(농진청 실데이터, 서버 캐시). sigungu에서 "군/시" 접미는
 * 센터명 부분일치에 그대로 유효("홍성군" ⊂ "홍성군농업기술센터").
 */
export function useRuralPrograms(sido: string | null, sigungu: string | null) {
  const center = (sigungu ?? '').replace(/(특별시|광역시)$/, '')
  return useQuery({
    queryKey: ['ruralPrograms', sido, center],
    queryFn: async (): Promise<{ total: number; items: RuralProgram[] } | null> => {
      const params = new URLSearchParams()
      if (sido) params.set('sido', sido)
      if (center) params.set('center', center)
      const r = await fetch(`${FUNCTIONS_BASE}/rural-programs?${params.toString()}`)
      if (!r.ok) return null
      const d = await r.json()
      return d?.error ? null : { total: d.total, items: d.items ?? [] }
    },
    enabled: Boolean(sido || center),
    staleTime: 60 * 60_000,
    retry: 1,
  })
}
