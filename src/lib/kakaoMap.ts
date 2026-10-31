// 카카오맵 JS SDK 로더·어댑터
// - VITE_KAKAO_MAP_KEY가 있으면 우선 사용하고, 없으면 Supabase map_config에서 읽는다.
// - 유효한 키가 없으면 어떤 외부 요청도 발생하지 않는다(기본: Leaflet/OSM — 검증된 경로).
// - 키 발급(운영자, 약 5분): developers.kakao.com → 내 애플리케이션 → 앱 생성 →
//   [앱 키] JavaScript 키 복사 → [플랫폼] Web에 사이트 도메인 등록
//   (https://nongsadama.app, https://radlerner.github.io, http://localhost,
//   http://localhost:5173) → Supabase map_config에 JavaScript 키 등록.

import { getSupabaseClient, isSupabaseConfigured } from './supabase'

const envKakaoMapKey = (import.meta.env.VITE_KAKAO_MAP_KEY as string | undefined)?.trim()
let kakaoMapKeyPromise: Promise<string | undefined> | null = null
/** map_config 조회를 기다리는 최대 시간. 지도 덮개의 8초 느림 안내·'그만 기다리기'가 먼저 보이도록 그보다 길게 둔다. */
const MAP_CONFIG_TIMEOUT_MS = 12_000

/**
 * 카카오 JavaScript 키. 확답(행 있음/없음)만 기억한다: 조회 오류·실패·시간 초과는 undefined(= OSM)로
 * 답하되 기억하지 않아, 다음 지도 화면에서 다시 묻는다(멈춘 조회를 계속 붙들지 않게).
 */
export function getKakaoMapKey(): Promise<string | undefined> {
  if (/^[0-9a-f]{32}$/i.test(envKakaoMapKey ?? '')) return Promise.resolve(envKakaoMapKey)
  if (!isSupabaseConfigured) return Promise.resolve(undefined)
  if (kakaoMapKeyPromise) return kakaoMapKeyPromise
  const query = getSupabaseClient()
    .from('map_config')
    .select('kakao_javascript_key')
    .eq('id', true)
    .maybeSingle()
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<'timeout'>((resolve) => {
    timer = setTimeout(() => resolve('timeout'), MAP_CONFIG_TIMEOUT_MS)
  })
  const forget = () => {
    if (kakaoMapKeyPromise === promise) kakaoMapKeyPromise = null
    return undefined
  }
  const promise: Promise<string | undefined> = Promise.race([Promise.resolve(query), timeout])
    .then((res) => {
      if (res === 'timeout' || res.error) return forget()
      const key = res.data?.kakao_javascript_key?.trim()
      return /^[0-9a-f]{32}$/i.test(key ?? '') ? key : undefined
    }, forget)
    .finally(() => clearTimeout(timer))
  kakaoMapKeyPromise = promise
  return promise
}

export type MapProvider = 'kakao' | 'osm'

export async function mapProvider(): Promise<MapProvider> {
  return (await getKakaoMapKey()) ? 'kakao' : 'osm'
}

// SDK 최소 타입(공식 @types 부재)
export interface KakaoLatLng { getLat(): number; getLng(): number }
export interface KakaoMap {
  setCenter(latlng: KakaoLatLng): void
  setLevel(level: number): void
  getLevel(): number
  /** 화면 픽셀만큼 지도를 민다 */
  panBy?(dx: number, dy: number): void
  getProjection?(): { containerPointFromCoords(ll: KakaoLatLng): { x: number; y: number } }
  /** 지도 칸 크기가 바뀐 뒤 다시 맞춘다 */
  relayout?(): void
}
export interface KakaoOverlay { setMap(map: KakaoMap | null): void }
export interface KakaoRegionCode {
  region_type: string
  region_1depth_name: string
  region_2depth_name: string
}
export interface KakaoMapsNs {
  load(cb: () => void): void
  LatLng: new (lat: number, lng: number) => KakaoLatLng
  Map: new (el: HTMLElement, opts: { center: KakaoLatLng; level: number }) => KakaoMap
  CustomOverlay: new (opts: {
    position: KakaoLatLng
    content: HTMLElement
    yAnchor?: number
    zIndex?: number
  }) => KakaoOverlay
  /** 지도 이벤트(tilesloaded·zoom_changed) */
  event?: { addListener(target: unknown, type: string, cb: () => void): void }
  services?: {
    Geocoder: new () => {
      coord2RegionCode(
        lng: number,
        lat: number,
        cb: (result: KakaoRegionCode[], status: string) => void,
      ): void
    }
    Status: { OK: string }
  }
}

declare global {
  interface Window { kakao?: { maps: KakaoMapsNs } }
}

let loadPromise: Promise<KakaoMapsNs> | null = null

/** SDK를 1회 로드한다(autoload=false → load 콜백에서 준비 완료). */
export async function loadKakaoMaps(): Promise<KakaoMapsNs> {
  if (loadPromise) return loadPromise
  const kakaoMapKey = await getKakaoMapKey()
  if (!kakaoMapKey) throw new Error('kakao-key-missing')
  loadPromise = new Promise((resolve, reject) => {
    if (window.kakao?.maps) {
      window.kakao.maps.load(() => resolve(window.kakao!.maps))
      return
    }
    const script = document.createElement('script')
    // services: 좌표→행정구역 지오코더(위치 기반 정보, PRD v1.7 항목1)
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${encodeURIComponent(kakaoMapKey)}&autoload=false&libraries=services`
    script.async = true
    script.onload = () => {
      if (!window.kakao?.maps) {
        reject(new Error('kakao-sdk-broken'))
        return
      }
      window.kakao.maps.load(() => resolve(window.kakao!.maps))
    }
    script.onerror = () => reject(new Error('kakao-sdk-load-failed'))
    document.head.appendChild(script)
  })
  return loadPromise
}

/**
 * 좌표 → {시도, 시군구}(행정동 기준). 카카오 키 없거나 실패 시 null(부가 기능 — 조용한 폴백).
 * 좌표는 변환에만 쓰이고 저장·전송되지 않는다(PRD v1.3 §4.1 위치 원칙).
 */
export async function coordToRegion(
  lat: number,
  lng: number,
): Promise<{ sido: string; sigungu: string } | null> {
  try {
    const ns = await loadKakaoMaps()
    if (!ns.services) return null
    const geocoder = new ns.services.Geocoder()
    return await new Promise((resolve) => {
      geocoder.coord2RegionCode(Math.round(lng * 10) / 10, Math.round(lat * 10) / 10, (result, status) => {
        if (status !== ns.services!.Status.OK) return resolve(null)
        const r = result.find((x) => x.region_type === 'H') ?? result[0]
        if (!r) return resolve(null)
        // 일반구가 있는 시는 region_2depth_name이 '천안시 동남구'처럼 두 토큰이다. 농진청 센터명은
        // 시·군 단위('천안시농업기술센터')라 첫 토큰만 시·군으로 쓴다(v1.1 D-033 누락 점검, 라이브 확인:
        // center='천안시 동남구' → 0건, '천안시' → 22건).
        resolve({ sido: r.region_1depth_name, sigungu: r.region_2depth_name.split(' ')[0] })
      })
    })
  } catch {
    return null
  }
}

/**
 * 카카오맵 길찾기 링크(도착지). 장소 좌표만 보낸다 — 내 위치는 보내지 않는다(v1.3 §4.1).
 * 카카오는 `이름,위도,경도`로 읽으므로 이름 속 ','와 '/'는 구분자로 오해된다
 * (예: 'Vietnam Nosang Sikdang, Naepo branch') → 공백으로 바꾼다.
 */
export function kakaoDirectionsUrl(name: string, lat: number, lng: number): string {
  const label = name.replace(/[,/]/g, ' ').replace(/\s+/g, ' ').trim() || '목적지'
  return `https://map.kakao.com/link/to/${encodeURIComponent(label)},${lat},${lng}`
}
