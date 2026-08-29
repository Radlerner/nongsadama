// 카카오맵 JS SDK 로더·어댑터 (환경변수 게이트)
// - VITE_KAKAO_MAP_KEY 가 설정된 경우에만 SDK를 로드하고 지도 제공자를 kakao로 전환한다.
// - 키가 없으면 어떤 외부 요청도 발생하지 않는다(기본: Leaflet/OSM — 검증된 경로).
// - 키 발급(운영자, 약 5분): developers.kakao.com → 내 애플리케이션 → 앱 생성 →
//   [앱 키] JavaScript 키 복사 → [플랫폼] Web에 사이트 도메인 등록
//   (https://radlerner.github.io, http://localhost:5173) → .env.local 및 GitHub
//   저장소 Variables에 VITE_KAKAO_MAP_KEY 추가.

export const kakaoMapKey: string | undefined = import.meta.env.VITE_KAKAO_MAP_KEY as
  | string
  | undefined

export type MapProvider = 'kakao' | 'osm'

export function mapProvider(): MapProvider {
  return kakaoMapKey ? 'kakao' : 'osm'
}

// SDK 최소 타입(공식 @types 부재)
export interface KakaoLatLng { getLat(): number; getLng(): number }
export interface KakaoMap {
  setCenter(latlng: KakaoLatLng): void
  setLevel(level: number): void
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
  CustomOverlay: new (opts: { position: KakaoLatLng; content: HTMLElement; yAnchor?: number }) => KakaoOverlay
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
export function loadKakaoMaps(): Promise<KakaoMapsNs> {
  if (!kakaoMapKey) return Promise.reject(new Error('kakao-key-missing'))
  if (loadPromise) return loadPromise
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
      geocoder.coord2RegionCode(lng, lat, (result, status) => {
        if (status !== ns.services!.Status.OK) return resolve(null)
        const r = result.find((x) => x.region_type === 'H') ?? result[0]
        if (!r) return resolve(null)
        resolve({ sido: r.region_1depth_name, sigungu: r.region_2depth_name })
      })
    })
  } catch {
    return null
  }
}

/**
 * 핀 마커 DOM(리플릿 divIcon과 동일한 시각 언어). onClick은 호출측에서 바인딩.
 * markup은 pinIcons.tsx가 정적 렌더한 자체 SVG 문자열만 받는다(사용자 입력 아님 — innerHTML 안전).
 */
export function emojiMarkerEl(markup: string, count?: number): HTMLElement {
  const el = document.createElement('div')
  el.style.cssText =
    'position:relative;width:38px;height:38px;background:#fff;border:2px solid #15803d;border-radius:9999px;display:flex;align-items:center;justify-content:center;box-shadow:0 1px 3px rgba(0,0,0,.3);cursor:pointer;'
  el.innerHTML = markup
  if (count && count > 1) {
    const badge = document.createElement('span')
    badge.style.cssText =
      'position:absolute;top:-6px;right:-6px;background:#15803d;color:#fff;border-radius:9999px;font-size:11px;font-weight:700;min-width:18px;height:18px;line-height:18px;text-align:center;padding:0 3px;'
    badge.textContent = String(count)
    el.appendChild(badge)
  }
  return el
}
