import { useCallback, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getCurrentPosition } from '../lib/geo'
import { coordToRegion } from '../lib/kakaoMap'
import { useRegions, countyOf } from './useRegions'
import { useSelectedRegion } from '../context/SelectedRegionContext'
import type { Json } from '../types/database'

const FUNCTIONS_BASE = `${import.meta.env.VITE_SUPABASE_URL as string}/functions/v1`

/** regions.names의 한국어 행정명(공공 API 매칭용). 폴백 없음 — 없으면 null. */
function koreanName(names: Json): string | null {
  if (names && typeof names === 'object' && !Array.isArray(names)) {
    const ko = (names as Record<string, Json | undefined>).ko
    if (typeof ko === 'string' && ko.trim() !== '') return ko
  }
  return null
}

/**
 * 사용자 지역 결정(PRD v1.7 항목1 — 전국 테스터 대응).
 * 기본값: 선택 지역(읍·면 또는 시·군, v1.1 D-033)의 중심좌표 + 그 시·군 이름.
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

  // 선택 지역 기반 기본값: 선택 단위(읍·면이든 시·군이든)의 중심좌표 + 그 시·군 이름.
  let regionArea: UserArea | null = null
  if (regions && regionId) {
    const selected = regions.find((r) => r.id === regionId)
    const county = countyOf(regions, selected)
    const centroid = selected?.centroid_lat != null ? selected : county
    if (centroid?.centroid_lat != null && centroid.centroid_lng != null) {
      // 농진청 사업 필터는 한국어 행정명 부분일치("○○군" ⊂ "○○군농업기술센터")라 표시 언어와
      // 무관하게 한국어 이름만 쓴다(데이터 규칙: 시·군 names에 'ko' 필수). 다른 언어로 폴백하면
      // 잘못된 파라미터가 전송되므로 폴백 없이 읽고, 없으면 카드를 생략한다(재검수 P2).
      const sigungu = county ? koreanName(county.names) : null
      regionArea = {
        lat: centroid.centroid_lat,
        lon: centroid.centroid_lng,
        // regions에는 시도 단계가 없어(level city/town) 시도는 지오코더 경로에서만 안다.
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
 * 센터명 부분일치에 그대로 유효("○○군" ⊂ "○○군농업기술센터").
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
