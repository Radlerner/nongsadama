import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useTranslation } from '../i18n/useTranslation'
import { useRegions, countyRegionIds, countyOf } from '../hooks/useRegions'
import { regionConfig } from '../config/app'
import { useSelectedRegion } from '../context/SelectedRegionContext'
import { useLifeInfoList, type LifeInfo } from '../hooks/useLifeInfo'
import { useUserArea, useWeather } from '../hooks/useRegionalInfo'
import { LIFE_INFO_CATEGORIES, categoryLabelKey } from '../lib/categories'
import { localizedContent } from '../lib/localizedContent'
import { regionLabel } from '../lib/regionName'
import { FreshnessBadge } from '../components/FreshnessBadge'
import { formatTemp, weatherIconName } from '../components/farm/weather'
import { STALE_AFTER_MONTHS_SUPPORT } from '../lib/freshness'
import { getCurrentPosition, nearestServiceRegion, OUT_OF_AREA_KM } from '../lib/geo'
import {
  mapProvider,
  loadKakaoMaps,
  kakaoDirectionsUrl,
  type MapProvider,
  type KakaoMap,
  type KakaoMapsNs,
  type KakaoOverlay,
} from '../lib/kakaoMap'
import {
  Button,
  CategoryGlyph,
  EmptyState,
  ErrorState,
  Icon,
  IconButton,
  LoadingState,
  PillTabs,
  SkeletonBlock,
  Spinner,
  buttonClasses,
  categoryGlyphSrc,
  cn,
  useOnline,
  useSlow,
} from '../components/ui'
import type { Tables } from '../types/database'

type Region = Tables<'regions'>

const FILTERS = ['all', ...LIFE_INFO_CATEGORIES] as const

/**
 * 지도 타일 상태: 첫 타일이 올 때까지 loading → ready | error.
 * dismissed = "그만 기다리기"로 덮개만 닫음(작은 '아직 불러오는 중 · 다시 시도' 알약이 남는다).
 * dismissed에서도 첫 타일·4초 타이머면 ready, 끝내 하나도 못 받으면 error로 넘어간다.
 */
type TileState = 'loading' | 'ready' | 'error' | 'dismissed'

const OSM_TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
const OSM_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'

/**
 * 지도 초기 보기(v1.1, D-033): 선택 지역 중심 → 부모 시·군 중심 → 설정값(전역 보기).
 * 예전의 "중심좌표가 있는 아무 지역"(DB 반환 순서 의존) 폴백과 홍성 좌표 상수는 다지역에서
 * 엉뚱한 시·군을 보여 주므로 제거했다. 지역 미선택이면 전역 보기(전체 핀)로 연다.
 */
function initialView(
  regions: Region[],
  regionId: string | null,
): { center: [number, number]; kakaoLevel: number; leafletZoom: number } {
  const selected = regionId ? regions.find((r) => r.id === regionId) : undefined
  const county = countyOf(regions, selected)
  const anchor =
    selected?.centroid_lat != null && selected.centroid_lng != null
      ? selected
      : county?.centroid_lat != null && county.centroid_lng != null
        ? county
        : null
  if (anchor) {
    const isCity = anchor.level === 'city'
    return {
      center: [anchor.centroid_lat as number, anchor.centroid_lng as number],
      kakaoLevel: isCity ? regionConfig.cityMapKakaoLevel : regionConfig.regionMapKakaoLevel,
      leafletZoom: isCity ? regionConfig.cityMapLeafletZoom : regionConfig.regionMapLeafletZoom,
    }
  }
  return {
    center: [regionConfig.defaultMapCenter.lat, regionConfig.defaultMapCenter.lng],
    kakaoLevel: regionConfig.defaultMapKakaoLevel,
    leafletZoom: regionConfig.defaultMapLeafletZoom,
  }
}

/** 핀 하나: 실좌표 개별 항목 또는 지역 중심 묶음(또는 화면에서 겹쳐 합친 묶음). category 'all' = 여러 종류 묶음 */
interface Pin {
  key: string
  lat: number
  lng: number
  category: string
  count: number
  items: LifeInfo[]
}

/** 핀 중심끼리 이만큼(px)보다 가까우면 한 핀으로 합친다(누르는 영역 44px이 겹치지 않게) */
const MERGE_PX = 44
/** 이 확대 단계부터 고르지 않은 개별 핀 아래에도 이름표를 단다 */
const LABEL_ZOOM = 14

/** 합친 핀('m:' + 맨 앞 핀 키)과 그 맨 앞 핀을 같은 핀으로 본다(확대해 묶음이 풀려도 고른 핀이 표시되게) */
const baseKey = (k: string) => k.replace(/^m:/, '')

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    c === '&' ? '&amp;' : c === '<' ? '&lt;' : c === '>' ? '&gt;' : c === '"' ? '&quot;' : '&#39;',
  )
}

/** 전화 링크: 숫자와 +만 남긴다(표기용 '-'·공백·괄호 제거, main v1.4). */
function telHref(phone: string): string {
  return `tel:${phone.replace(/[^0-9+]/g, '')}`
}

/*
 * 지도 핀 HTML(리플릿 divIcon·카카오 CustomOverlay 공용). 이모지 대신 카테고리 그림:
 * 흰 원 + 1px 선, 고른 핀은 커지고 초록(홈 정체성) 2px 테두리 + 이름표. 누르는 영역은 44px 이상.
 * Tailwind가 이 파일의 문자열에서 클래스를 찾으므로 클래스 이름을 쪼개지 않는다.
 */
function pinInnerHtml(pin: Pin, selected: boolean, tag: string, showLabel = false): string {
  const size = selected ? 28 : 22
  const glyph =
    pin.category === 'all'
      ? `<svg width="${size}" height="${size}" viewBox="0 0 32 32" aria-hidden="true" class="block"><rect x="3.5" y="3.5" width="11.5" height="11.5" rx="3.5" class="fill-nong-500"></rect><rect x="17" y="3.5" width="11.5" height="11.5" rx="3.5" class="fill-da-500"></rect><rect x="3.5" y="17" width="11.5" height="11.5" rx="3.5" class="fill-ma-500"></rect><rect x="17" y="17" width="11.5" height="11.5" rx="3.5" class="fill-nong-200"></rect></svg>`
      : `<img src="${categoryGlyphSrc(pin.category)}" alt="" width="${size}" height="${size}" draggable="false" class="block" style="width:${size}px;height:${size}px">`
  const circle = selected
    ? 'relative flex h-12 w-12 items-center justify-center rounded-full border-2 border-nong-600 bg-white'
    : 'relative flex h-10 w-10 items-center justify-center rounded-full border border-ink/30 bg-white'
  const badge =
    pin.count > 1
      ? `<span class="absolute -right-1.5 -top-1.5 flex h-[22px] min-w-[22px] items-center justify-center rounded-full border-2 border-white bg-nong-600 px-1 text-caption font-bold leading-none text-white">${pin.count}</span>`
      : ''
  const label = selected
    ? `<span data-pin-label class="pointer-events-none absolute left-1/2 top-full mt-1 -translate-x-1/2 whitespace-nowrap rounded-full bg-ink px-2.5 text-caption font-bold leading-6 text-white">${escapeHtml(tag)}</span>`
    : showLabel
      ? `<span class="pointer-events-none absolute left-1/2 top-full mt-0.5 max-w-36 -translate-x-1/2 truncate rounded-full border border-line-strong bg-white px-2.5 text-caption font-bold leading-6 text-ink">${escapeHtml(tag)}</span>`
      : ''
  return `<span class="flex h-full w-full items-center justify-center"><span class="${circle}">${glyph}${badge}</span></span>${label}`
}

function pinIcon(pin: Pin, selected: boolean, tag: string, showLabel: boolean): L.DivIcon {
  const box = selected ? 52 : 44
  return L.divIcon({
    className: '',
    html: pinInnerHtml(pin, selected, tag, showLabel),
    iconSize: [box, box],
    iconAnchor: [box / 2, box / 2],
  })
}

/** 카카오용 핀: 키보드로도 누를 수 있게 button으로 만든다. */
function kakaoPinEl(pin: Pin, selected: boolean, tag: string, aria: string, showLabel: boolean): HTMLElement {
  const el = document.createElement('button')
  el.type = 'button'
  el.className = selected ? 'relative block h-[52px] w-[52px] cursor-pointer' : 'relative block h-11 w-11 cursor-pointer'
  el.setAttribute('aria-label', aria)
  el.setAttribute('aria-pressed', String(selected))
  el.innerHTML = pinInnerHtml(pin, selected, tag, showLabel)
  return el
}

/** 내 위치 점(기기 안에서만 그림 — 좌표는 저장·전송하지 않는다, v1.3 §4.1) */
const USER_DOT_HTML =
  '<span class="flex h-7 w-7 items-center justify-center rounded-full bg-nong-600/20"><span class="block h-4 w-4 rounded-full border-2 border-white bg-nong-600"></span></span>'

function userIcon(): L.DivIcon {
  return L.divIcon({ className: '', html: USER_DOT_HTML, iconSize: [28, 28], iconAnchor: [14, 14] })
}

function userDotEl(label: string): HTMLElement {
  const el = document.createElement('div')
  el.setAttribute('role', 'img')
  el.setAttribute('aria-label', label)
  el.innerHTML = USER_DOT_HTML
  return el
}

/** 지도 위에 뜨는 흰 카드(1px 선, 그림자 없음) + 닫기. 결과는 지도 화면의 sr-only 상태 줄이 읽어 준다. */
function FloatCard({ children, onClose, closeLabel }: { children: ReactNode; onClose?: () => void; closeLabel: string }) {
  return (
    <div className="anim-fade pointer-events-auto relative shrink-0 rounded-xl border border-line bg-white py-3 pl-4 pr-12">
      {children}
      {onClose ? (
        <IconButton icon="x" iconSize={20} label={closeLabel} onClick={onClose} className="absolute right-1 top-1 text-ink-muted" />
      ) : null}
    </div>
  )
}

/**
 * 지도 홈 (PRD v1.5 §2·§4 — 데모: 생활정보 전용, 인적 핀 없음).
 * - 검수 실좌표는 개별 핀, 좌표 없는 항목은 지역 중심 묶음 핀("위치 검수 전")
 * - 지도 제공자: map_config(Supabase)에 카카오 키가 있으면 카카오, 없거나 SDK 실패면 OSM(§4 폴백 원칙)
 * - 내 위치: 일회성 조회로 가까운 서비스 지역 안내(좌표 저장·전송 없음, v1.3 §4.1). 안드로이드는 Capacitor 위치(lib/geo)
 * - 디자인 v5: 헤더~아래 줄을 지도로 채우고, 지도 아래 흰 줄에 카테고리 알약 + 농사 도움(오늘 날씨) 한 줄.
 *   모든 기다림·실패를 지도 위에 보인다. 공유 버튼은 생활정보 목록 아래로 옮겼다(지도 화면은 스크롤하지 않는다).
 */
export default function MapHome() {
  const { t, locale } = useTranslation()
  const {
    data: regions,
    isError: regionsError,
    refetch: refetchRegions,
    isFetching: regionsFetching,
  } = useRegions()
  const { regionId, setRegionId } = useSelectedRegion()
  const scopeIds = countyRegionIds(regions ?? [], regionId)
  const scopeReady = !regionId || regions !== undefined
  const {
    data: items,
    isLoading,
    isError: itemsError,
    refetch: refetchItems,
    isFetching: itemsFetching,
    fetchStatus: itemsFetchStatus,
  } = useLifeInfoList(scopeIds, scopeReady)

  const [category, setCategory] = useState<string>('all')
  // 누른 핀의 사본. 확대·축소로 핀이 합쳐지거나 풀려도 열린 시트(건수·목록)는 그대로 둔다
  // (필터·지역이 바뀌면 닫힘).
  const [selectedPin, setSelectedPin] = useState<Pin | null>(null)
  const selectedKey = selectedPin?.key ?? null
  const [locating, setLocating] = useState(false)
  const [geoError, setGeoError] = useState(false)
  const [nearest, setNearest] = useState<{
    region: Region
    distanceKm: number
    outOfArea: boolean
  } | null>(null)

  // 'kakao'(키 존재 시) | 'osm'. null = map_config 확인 중(지도 덮개가 '불러오는 중'을 보인다).
  // 카카오 SDK 로드 실패 시 OSM으로 자동 폴백한다(§4 폴백 원칙).
  const [provider, setProvider] = useState<MapProvider | null>(null)
  const mapRef = useRef<L.Map | null>(null)
  const layerRef = useRef<L.LayerGroup | null>(null)
  const tileLayerRef = useRef<L.TileLayer | null>(null)
  const tileTimerRef = useRef<number | null>(null)
  const userMarkerRef = useRef<L.Marker | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const wrapRef = useRef<HTMLDivElement | null>(null)
  const sheetRef = useRef<HTMLDivElement | null>(null)
  // 시트를 닫으면 키보드 초점을 그 핀으로 돌려준다(핀은 다시 그려지므로 키로 찾는다)
  const restoreFocusKeyRef = useRef<string | null>(null)
  // 고른 핀의 DOM(리플릿 마커 / 카카오 버튼). 시트를 열 때 핀과 이름표가 다 보이게 지도를 옮기는 데 쓴다.
  const selectedPinElRef = useRef<HTMLElement | null>(null)
  const kakaoNsRef = useRef<KakaoMapsNs | null>(null)
  const kakaoMapRef = useRef<KakaoMap | null>(null)
  const kakaoOverlaysRef = useRef<KakaoOverlay[]>([])
  const kakaoUserOverlayRef = useRef<KakaoOverlay | null>(null)
  const [kakaoError, setKakaoError] = useState(false)
  const [kakaoReady, setKakaoReady] = useState(false)
  const [tileState, setTileState] = useState<TileState>('loading')
  // 오프라인이면 "연결되면 지도를 불러와요"로 보여 주고, 연결이 돌아오면 타일을 저절로 다시 받는다
  const online = useOnline()
  // 지금 확대 단계(OSM getZoom, 카카오는 20 − level로 어림). 겹친 핀 합치기·이름표에 쓴다.
  const [mapZoom, setMapZoom] = useState<number | null>(null)

  useEffect(() => {
    let active = true
    // '그만 기다리기'로 이미 OSM이 정해졌으면 늦게 온 답은 버린다(리플릿이 든 칸에 카카오 지도를 만들지 않게)
    mapProvider()
      .then((value) => {
        if (active) setProvider((p) => p ?? value)
      })
      .catch(() => {
        if (active) setProvider((p) => p ?? 'osm')
      })
    return () => {
      active = false
    }
  }, [])

  const regionsById = useMemo(
    () => new Map((regions ?? []).map((r) => [r.id, r])),
    [regions],
  )

  // 지역이 바뀌면 열린 시트를 닫는다(시트는 누른 핀의 사본이라 저절로 사라지지 않는다)
  useEffect(() => {
    setSelectedPin(null)
  }, [regionId])

  const filtered = useMemo(
    () => (items ?? []).filter((i) => category === 'all' || i.category === category),
    [items, category],
  )

  // 제공자 공용 핀 데이터(실좌표 개별 + 지역 중심 묶음, 전화 전용 시/군 항목 제외)
  const pins = useMemo(() => {
    const out: Pin[] = []
    const withCoords = filtered.filter((i) => i.latitude != null && i.longitude != null)
    const withoutCoords = filtered.filter((i) => i.latitude == null || i.longitude == null)
    for (const item of withCoords) {
      out.push({
        key: item.id,
        lat: item.latitude as number,
        lng: item.longitude as number,
        category: item.category,
        count: 1,
        items: [item],
      })
    }
    const groups = new Map<string, LifeInfo[]>()
    for (const item of withoutCoords) {
      const region = regionsById.get(item.region_id)
      // 전화 전용 항목(전국 핫라인: 시·군 행·주소 없음·support)만 지도에서 뺀다. 예전 규칙은 '시·군 행 +
      // 주소 없음'이면 모두 제외했는데, 읍·면이 없는 시·군(v1.1)은 모든 정보가 시·군 행이라 병원·마트까지
      // 사라지는 무언 누락이 생긴다(D-033 누락 점검). 이제 데이터 속성(category)으로 판정한다.
      if (!item.address && region?.level === 'city' && item.category === 'support') continue
      const arr = groups.get(item.region_id) ?? []
      arr.push(item)
      groups.set(item.region_id, arr)
    }
    for (const [rid, group] of groups) {
      const region = regionsById.get(rid)
      if (!region || region.centroid_lat == null || region.centroid_lng == null) continue
      const cats = new Set(group.map((g) => g.category))
      out.push({
        key: `g:${rid}`,
        lat: region.centroid_lat,
        lng: region.centroid_lng,
        category: cats.size === 1 ? group[0].category : 'all',
        count: group.length,
        items: group,
      })
    }
    return out
  }, [filtered, regionsById])

  /*
   * 화면에서 겹치는 핀을 한 핀으로 합친다(새 의존성 없이). 많이 묶인 핀부터 두어 지역 묶음 핀이 이웃을 흡수하고,
   * 중심이 MERGE_PX 안에 든 핀은 먼저 둔 핀에 합친다(위치는 먼저 둔 핀). 합친 핀을 누르면 묶음 시트가 열린다.
   */
  const shownPins = useMemo(() => {
    if (mapZoom == null) return pins
    const kept: { pin: Pin; pt: L.Point }[] = []
    for (const p of [...pins].sort((a, b) => b.count - a.count)) {
      const pt = L.CRS.EPSG3857.latLngToPoint(L.latLng(p.lat, p.lng), mapZoom)
      const hit = kept.find((k) => k.pt.distanceTo(pt) < MERGE_PX)
      if (!hit) {
        kept.push({ pin: p, pt })
        continue
      }
      const a = hit.pin
      hit.pin = {
        key: a.key.startsWith('m:') ? a.key : `m:${a.key}`,
        lat: a.lat,
        lng: a.lng,
        category: a.category === p.category ? a.category : 'all',
        count: a.count + p.count,
        items: [...a.items, ...p.items],
      }
    }
    return kept.map((k) => k.pin)
  }, [pins, mapZoom])

  const sheet = selectedPin?.items ?? null
  // 시트가 여러 지역(읍·면)에 걸치면 줄마다 지역 이름을 보인다(main처럼 어느 동네인지 알 수 있게)
  const multiRegion = sheet != null && new Set(sheet.map((i) => i.region_id)).size > 1

  /** 핀 이름표(고른 핀 아래) */
  const pinTag = useCallback(
    (pin: Pin): string => {
      if (pin.count === 1) {
        return localizedContent(pin.items[0].localized_content, locale).name || t('lifeInfo.untitled')
      }
      const count = t('map.placesCount').replace('{n}', String(pin.count))
      // 여러 지역이 합쳐진 핀은 한 동네 이름을 대지 않는다(첫 묶음 이름이 전체인 것처럼 보이지 않게)
      if (new Set(pin.items.map((i) => i.region_id)).size > 1) return count
      const region = regionsById.get(pin.items[0].region_id)
      return region ? regionLabel(region.id, region.names, locale) : count
    },
    [locale, regionsById, t],
  )

  /** 핀 읽기 이름(스크린리더) */
  const pinAria = useCallback(
    (pin: Pin): string => {
      if (pin.count === 1) return `${pinTag(pin)}, ${t(categoryLabelKey(pin.items[0].category))}`
      const tag = pinTag(pin)
      const count = t('map.placesCount').replace('{n}', String(pin.count))
      return tag === count ? count : `${tag}, ${count}`
    },
    [pinTag, t],
  )

  /*
   * 이름표(확대 LABEL_ZOOM부터, 합치지 않은 개별 핀 아래 흰 알약). 다른 핀이나 먼저 단 이름표와 겹치면 달지 않는다
   * (이름표는 핀 요소 안에 있어 아래쪽 핀에 가려지므로).
   */
  const labelKeys = useMemo(() => {
    const keys = new Set<string>()
    if (mapZoom == null || mapZoom < LABEL_ZOOM) return keys
    type Box = [number, number, number, number]
    const pts = shownPins.map((p) => ({ p, pt: L.CRS.EPSG3857.latLngToPoint(L.latLng(p.lat, p.lng), mapZoom) }))
    const boxes: Box[] = pts.map(({ pt }) => [pt.x - 22, pt.y - 22, pt.x + 22, pt.y + 22])
    const hits = (b: Box) => boxes.some((o) => b[0] < o[2] && o[0] < b[2] && b[1] < o[3] && o[1] < b[3])
    for (const { p, pt } of pts) {
      if (p.count !== 1) continue
      const half = Math.min(144, 22 + pinTag(p).length * 13) / 2 // 이름표 너비 어림(최대 max-w-36)
      const box: Box = [pt.x - half, pt.y + 22, pt.x + half, pt.y + 50]
      if (hits(box)) continue
      keys.add(p.key)
      boxes.push(box)
    }
    return keys
  }, [shownPins, mapZoom, pinTag])

  // ── kakao 제공자: SDK 로드·지도 생성(키 존재 시에만) ──────────────────────
  useEffect(() => {
    if (provider !== 'kakao' || !containerRef.current || kakaoMapRef.current) return
    if (regions === undefined) return
    // 제공자가 OSM으로 바뀌거나(그만 기다리기) 화면을 떠난 뒤 늦게 온 SDK가 같은 칸에 지도를 만들지 않게
    let cancelled = false
    const view = initialView(regions, regionId)
    loadKakaoMaps()
      .then((ns) => {
        if (cancelled || !containerRef.current || kakaoMapRef.current) return
        kakaoNsRef.current = ns
        const kmap = new ns.Map(containerRef.current, {
          center: new ns.LatLng(view.center[0], view.center[1]),
          level: view.kakaoLevel,
        })
        kakaoMapRef.current = kmap
        // 첫 타일이 다 오면 덮개를 걷는다. 이벤트 API가 없으면 바로 준비 완료로 본다.
        if (ns.event) {
          ns.event.addListener(kmap, 'tilesloaded', () =>
            setTileState((s) => (s === 'loading' || s === 'dismissed' ? 'ready' : s)),
          )
        } else setTileState('ready')
        // 카카오 level(1 = 가장 크게) → 리플릿 확대 단계로 어림(level 9 ≈ zoom 11)
        const sync = () => setMapZoom(20 - kmap.getLevel())
        sync()
        ns.event?.addListener(kmap, 'zoom_changed', sync)
        setKakaoReady(true)
      })
      .catch(() => {
        if (cancelled) return
        setKakaoError(true)
        setProvider('osm') // 검증된 기본 지도로 자동 폴백
      })
    return () => {
      cancelled = true
    }
  }, [provider, regions, regionId])

  // kakao 핀(CustomOverlay) 갱신
  useEffect(() => {
    if (provider !== 'kakao' || !kakaoReady) return
    const ns = kakaoNsRef.current
    const map = kakaoMapRef.current
    if (!ns || !map) return
    for (const o of kakaoOverlaysRef.current) o.setMap(null)
    kakaoOverlaysRef.current = []
    selectedPinElRef.current = null
    for (const pin of shownPins) {
      const selected = selectedKey != null && baseKey(pin.key) === baseKey(selectedKey)
      const el = kakaoPinEl(pin, selected, pinTag(pin), pinAria(pin), labelKeys.has(pin.key))
      if (selected) selectedPinElRef.current = el
      el.addEventListener('click', () => setSelectedPin(pin))
      // 고른 핀 > 묶음 핀 > 개별 핀 순으로 위에 그린다(묶음 숫자가 가려지지 않게)
      const ov = new ns.CustomOverlay({
        position: new ns.LatLng(pin.lat, pin.lng),
        content: el,
        zIndex: selected ? 3 : pin.count > 1 ? 2 : 1,
      })
      ov.setMap(map)
      kakaoOverlaysRef.current.push(ov)
      // 시트를 닫으면 초점을 그 핀으로 돌려준다(OSM과 같게)
      if (restoreFocusKeyRef.current != null && baseKey(pin.key) === baseKey(restoreFocusKeyRef.current)) {
        restoreFocusKeyRef.current = null
        const f = () => el.focus({ preventScroll: true })
        if (el.isConnected) f()
        else requestAnimationFrame(f)
      }
    }
    restoreFocusKeyRef.current = null
  }, [provider, kakaoReady, shownPins, selectedKey, pinTag, pinAria, labelKeys])

  /**
   * OSM 타일 층을 (다시) 붙이고 첫 로딩을 지켜본다.
   * 'load'(보이는 타일이 다 끝남) 때 하나라도 받았으면 ready, 하나도 못 받았으면 error.
   * 일부만 오고 나머지가 오래 걸리면 첫 타일 4초 뒤 ready로 넘어간다(덮개가 영원히 남지 않게).
   */
  const attachTiles = useCallback((map: L.Map) => {
    tileLayerRef.current?.remove()
    if (tileTimerRef.current) window.clearTimeout(tileTimerRef.current)
    tileTimerRef.current = null
    let loaded = 0
    // '그만 기다리기'(dismissed) 뒤에도 결과를 반영한다: 타일이 오면 ready, 하나도 못 받으면 error 카드
    const settle = (next: TileState) => setTileState((s) => (s === 'loading' || s === 'dismissed' ? next : s))
    const layer = L.tileLayer(OSM_TILE_URL, {
      // 타일: OSM 표준(§10-B 확정 전 잠정, 저트래픽 데모 — attribution 필수)
      maxZoom: 18,
      attribution: OSM_ATTRIBUTION,
    })
    layer.on('tileload', () => {
      loaded += 1
      if (loaded === 1) tileTimerRef.current = window.setTimeout(() => settle('ready'), 4000)
    })
    layer.on('load', () => settle(loaded > 0 ? 'ready' : 'error'))
    layer.addTo(map)
    tileLayerRef.current = layer
  }, [])

  // ── osm(Leaflet) 제공자: 초기화 — regions 준비 후 정확히 1회 ─────────────
  useEffect(() => {
    if (provider !== 'osm') return
    if (!containerRef.current || mapRef.current || regions === undefined) return
    const view = initialView(regions, regionId)
    // 확대·축소는 지도 위 44px 버튼으로 한다(리플릿 기본 버튼은 30px). 두 손가락·키보드 확대는 그대로.
    const map = L.map(containerRef.current, { zoomControl: false }).setView(view.center, view.leafletZoom)
    setTileState('loading')
    attachTiles(map)
    layerRef.current = L.layerGroup().addTo(map)
    mapRef.current = map
    setMapZoom(map.getZoom())
    map.on('zoomend', () => setMapZoom(map.getZoom()))
  }, [provider, regions, regionId, attachTiles])

  // 언마운트 시에만 지도 해제
  useEffect(
    () => () => {
      if (tileTimerRef.current) window.clearTimeout(tileTimerRef.current)
      mapRef.current?.remove()
      mapRef.current = null
      layerRef.current = null
      tileLayerRef.current = null
      userMarkerRef.current = null
    },
    [],
  )

  // 지도 칸 크기가 바뀌면(오프라인 배너, 회전 등) 다시 맞춘다
  useEffect(() => {
    const el = wrapRef.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(() => {
      mapRef.current?.invalidateSize()
      kakaoMapRef.current?.relayout?.()
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // osm(Leaflet) 핀 갱신
  useEffect(() => {
    if (provider !== 'osm') return
    const layer = layerRef.current
    if (!layer) return
    layer.clearLayers()
    selectedPinElRef.current = null
    for (const pin of shownPins) {
      const selected = selectedKey != null && baseKey(pin.key) === baseKey(selectedKey)
      const marker = L.marker([pin.lat, pin.lng], {
        icon: pinIcon(pin, selected, pinTag(pin), labelKeys.has(pin.key)),
        // 고른 핀 > 묶음 핀 > 개별 핀 순으로 위에 그린다(묶음 숫자가 가려지지 않게)
        zIndexOffset: selected ? 1000 : pin.count > 1 ? 500 : 0,
        riseOnHover: true,
      })
        .on('click', () => setSelectedPin(pin))
        // 리플릿 1.9는 핀(role=button)에서 Enter를 click으로 바꿔 주지 않는다 → 직접 연다
        .on('keydown', (e) => {
          const ke = (e as L.LeafletKeyboardEvent).originalEvent
          if (ke.key === 'Enter' || ke.key === ' ') {
            ke.preventDefault()
            setSelectedPin(pin)
          }
        })
        .addTo(layer)
      const el = marker.getElement()
      el?.setAttribute('aria-label', pinAria(pin))
      el?.setAttribute('aria-pressed', String(selected))
      if (selected && el) selectedPinElRef.current = el
      if (el && restoreFocusKeyRef.current != null && baseKey(pin.key) === baseKey(restoreFocusKeyRef.current)) {
        restoreFocusKeyRef.current = null
        el.focus({ preventScroll: true })
      }
    }
    restoreFocusKeyRef.current = null
  }, [provider, shownPins, selectedKey, pinTag, pinAria, labelKeys])

  // 시트가 열리면 시트로 초점을 옮긴다(스크린리더가 이름을 읽고, Tab이 버튼으로 간다)
  useEffect(() => {
    if (selectedKey) sheetRef.current?.focus({ preventScroll: true })
  }, [selectedKey])

  /*
   * 고른 핀이 시트·위 칩·화면 가장자리에 가리면 지도를 옮겨 핀과 이름표가 다 보이게 한다(OSM·카카오).
   * 투영 계산 대신 그려진 핀·이름표(data-pin-label)의 실제 상자를 재서, 시트 위 빈 지도 칸 안에 들게 민다.
   */
  const selLat = selectedPin?.lat
  const selLng = selectedPin?.lng
  useEffect(() => {
    if (selLat == null || selLng == null) return
    let id = 0
    let tries = 0
    const run = () => {
      const wrap = wrapRef.current
      const sheetEl = sheetRef.current
      const el = selectedPinElRef.current
      if (!wrap || !sheetEl || !el) return
      // 카카오 오버레이는 다음 그리기에서 DOM에 붙을 수 있다 → 몇 프레임 더 기다린다
      if (!el.isConnected || el.getBoundingClientRect().width === 0) {
        if (++tries < 3) id = window.requestAnimationFrame(run)
        return
      }
      let pan: (dx: number, dy: number) => void
      if (provider === 'kakao') {
        const km = kakaoMapRef.current
        if (!km?.panBy) return
        // Map.panBy(dx, dy): '중심 좌표를 지정한 픽셀 만큼 부드럽게 이동한다'(카카오맵 Web API 문서) — 양수 dx·dy면
        // 중심이 오른쪽·아래로 가고 그림은 왼쪽·위로 간다(리플릿·구글과 같은 방향). 이 환경에서는 문서
        // (apis.map.kakao.com/web/documentation/#Map_panBy)에 닿지 못해 이 방향을 가정으로 두었다.
        const panBy = km.panBy.bind(km)
        pan = (dx, dy) => panBy(dx, dy)
      } else {
        const map = mapRef.current
        if (!map) return
        pan = (dx, dy) => map.panBy([dx, dy])
      }
      const w = wrap.getBoundingClientRect()
      const pinRect = el.getBoundingClientRect()
      const labelRect = el.querySelector('[data-pin-label]')?.getBoundingClientRect()
      const box = {
        left: Math.min(pinRect.left, labelRect?.left ?? pinRect.left) - w.left,
        right: Math.max(pinRect.right, labelRect?.right ?? pinRect.right) - w.left,
        top: Math.min(pinRect.top, labelRect?.top ?? pinRect.top) - w.top,
        bottom: Math.max(pinRect.bottom, labelRect?.bottom ?? pinRect.bottom) - w.top,
      }
      // 빈 지도 칸: 양옆 12px, 위 칩·버튼 줄 아래(12 + 44 = 56 → 60), 시트 위 12px
      const left = 12
      const right = wrap.clientWidth - 12
      const top = 60
      const bottom = wrap.clientHeight - sheetEl.offsetHeight - 12
      const dx =
        box.right - box.left > right - left || box.left < left
          ? box.left - left
          : box.right > right
            ? box.right - right
            : 0
      let dy = 0
      if (box.top < top || box.bottom > bottom) {
        const h = box.bottom - box.top
        // 칸이 상자보다 작으면(시트가 높을 때) 이름표가 시트에 가리지 않게 상자 아래를 시트 위에 맞춘다
        dy = bottom - top > h ? box.top - (top + (bottom - top - h) / 2) : box.bottom - bottom
      }
      if (dx !== 0 || dy !== 0) pan(dx, dy)
    }
    id = window.requestAnimationFrame(run)
    return () => window.cancelAnimationFrame(id)
  }, [provider, selectedKey, selLat, selLng])

  const closeSheet = () => {
    restoreFocusKeyRef.current = selectedKey
    setSelectedPin(null)
  }

  const retryTiles = () => {
    if (regions === undefined && regionsError) {
      void refetchRegions()
      return
    }
    setTileState('loading')
    if (provider === 'osm' && mapRef.current) attachTiles(mapRef.current)
    // 카카오: 보이는 타일을 SDK가 다시 청하게 한다(결과는 tilesloaded 리스너가 정리)
    else if (provider === 'kakao' && kakaoMapRef.current) kakaoMapRef.current.relayout?.()
  }

  /**
   * '그만 기다리기': 덮개를 닫는다. 지도가 아직 없으면 기다리지 않고 기본 지도(OSM)로 바꾼다(§4 폴백):
   * map_config 답이 아직 안 왔거나(provider null — 늦게 온 답은 위 효과가 버린다) 키는 있는데 카카오 SDK가 멈춘 경우
   * (SDK 실패와 같은 안내를 띄우고, 늦게 온 SDK는 무시한다). 지도가 이미 있으면 덮개만 닫는다.
   */
  const stopWaiting = () => {
    // map_config가 아직 안 왔거나(provider null) 카카오 SDK가 멈춤 → OSM
    if (provider !== 'osm' && !kakaoMapRef.current) {
      if (provider === 'kakao') setKakaoError(true)
      setProvider('osm')
      return
    }
    setTileState('dismissed')
  }

  // 연결이 돌아오면 못 받은 타일을 다시 받는다(지역 목록은 React Query가 스스로 다시 불러온다).
  // online이 바뀔 때만 돈다: 그때의 tileState·retryTiles를 읽으면 된다.
  useEffect(() => {
    if (online && (tileState === 'error' || tileState === 'dismissed')) retryTiles()
  }, [online]) // eslint-disable-line react-hooks/exhaustive-deps

  const zoom = (dir: 1 | -1) => {
    if (provider === 'kakao') {
      const kmap = kakaoMapRef.current
      if (kmap) kmap.setLevel(kmap.getLevel() - dir)
      return
    }
    if (dir > 0) mapRef.current?.zoomIn()
    else mapRef.current?.zoomOut()
  }

  const locate = async () => {
    setGeoError(false)
    setLocating(true)
    try {
      const pos = await getCurrentPosition()
      if (provider === 'kakao') {
        const ns = kakaoNsRef.current
        const kmap = kakaoMapRef.current
        if (ns && kmap) {
          kakaoUserOverlayRef.current?.setMap(null)
          const ov = new ns.CustomOverlay({
            position: new ns.LatLng(pos.lat, pos.lng),
            content: userDotEl(t('map.locate')),
          })
          ov.setMap(kmap)
          kakaoUserOverlayRef.current = ov
          kmap.setCenter(new ns.LatLng(pos.lat, pos.lng))
          // 전국 보기(level 13)에서 눌렀을 때 동네가 보이도록 최소 확대. 이미 더 가까우면 그대로.
          if (kmap.getLevel() > regionConfig.locateKakaoLevel) kmap.setLevel(regionConfig.locateKakaoLevel)
        }
      } else {
        const map = mapRef.current
        if (map) {
          if (userMarkerRef.current) userMarkerRef.current.remove()
          userMarkerRef.current = L.marker([pos.lat, pos.lng], {
            icon: userIcon(),
            keyboard: false,
            interactive: false,
          }).addTo(map)
          const el = userMarkerRef.current.getElement()
          el?.setAttribute('role', 'img')
          el?.setAttribute('aria-label', t('map.locate'))
          map.setView([pos.lat, pos.lng], Math.max(map.getZoom(), regionConfig.locateLeafletZoom))
        }
      }
      const near = nearestServiceRegion(regions ?? [], pos.lat, pos.lng)
      if (near) {
        setNearest({ ...near, outOfArea: near.distanceKm > OUT_OF_AREA_KM })
      }
    } catch {
      setGeoError(true)
    } finally {
      setLocating(false)
    }
  }

  // ── 화면 상태 ─────────────────────────────────────────────────────────────
  const mapBlocked = regions === undefined && regionsError // 지도 중심을 정할 지역 목록을 못 받음
  // 오프라인이라 타일을 못 받은 것은 '실패'가 아니라 연결 대기다: 덮개가 '인터넷이 연결되면 지도를 불러와요'를 보이고
  // 연결되면 저절로 다시 받는다(아래 online 효과)
  const tilesOffline = !online && tileState === 'error'
  const mapError = mapBlocked || (tileState === 'error' && !tilesOffline)
  const mapLoading = !mapError && (tileState === 'loading' || tilesOffline)
  // 오프라인 동안은 느림 안내 대신 '연결되면 불러와요'를 보이고, 연결된 뒤부터 8초를 센다
  const mapSlow = useSlow(mapLoading && online)
  const mapVisible = !mapError && !mapLoading
  // 오프라인이면 첫 조회가 멈춘 채(paused) 기다린다: "정보 없음"이 아니라 "연결되면 불러와요"로 보여 준다
  const itemsWaitingNetwork = itemsFetchStatus === 'paused' && items === undefined
  const dataLoading = !itemsError && (isLoading || !scopeReady || itemsWaitingNetwork)
  const dataEmpty = !dataLoading && !itemsError && filtered.length === 0
  const locateSlow = useSlow(locating)

  // 내 위치 결과는 늘 붙어 있는 sr-only 상태 줄이 읽는다(카드는 이미 채워진 채 나타나 읽히지 않을 수 있다)
  const nearestText = nearest
    ? t('map.nearest')
        .replace('{name}', regionLabel(nearest.region.id, nearest.region.names, locale))
        .replace('{n}', String(Math.max(1, Math.round(nearest.distanceKm))))
    : ''
  const locateStatus = locating
    ? locateSlow
      ? t('map.locateSlow')
      : t('map.locating')
    : geoError
      ? `${t('map.geoErrorTitle')} ${t('map.geoError')}`
      : nearest
        ? `${nearest.outOfArea ? `${t('map.outOfArea')} ` : ''}${nearestText}`
        : ''

  // 덮개(불러오는 중·실패)가 지도를 가리는 동안 지도와 핀을 Tab·스크린리더에서 뺀다(@types/react 18엔 inert 속성이 없어 DOM에 직접)
  useEffect(() => {
    const el = containerRef.current
    if (el) el.inert = mapError || mapLoading
  }, [mapError, mapLoading])

  const selectedRegion = regionId ? regionsById.get(regionId) : undefined
  const regionName = selectedRegion ? regionLabel(selectedRegion.id, selectedRegion.names, locale) : ''
  const listHref = category === 'all' ? '/life-info' : `/life-info?category=${category}`

  const pillOptions = FILTERS.map((c) => ({
    value: c as string,
    label: t(c === 'all' ? 'lifeInfo.category.all' : categoryLabelKey(c)),
    glyph: <CategoryGlyph category={c} size={20} />,
  }))

  /** '이 지역으로 보기': 지역을 바꾸고 지도를 그 지역 중심으로 옮긴다(내 위치 점은 그대로, 좌표는 저장·전송하지 않음). */
  const goToNearestRegion = (r: Region) => {
    setRegionId(r.id)
    setNearest(null)
    setSelectedPin(null)
    if (r.centroid_lat != null && r.centroid_lng != null) {
      const isCity = r.level === 'city'
      if (provider === 'kakao') {
        const ns = kakaoNsRef.current
        const kmap = kakaoMapRef.current
        if (ns && kmap) {
          kmap.setCenter(new ns.LatLng(r.centroid_lat, r.centroid_lng))
          kmap.setLevel(isCity ? regionConfig.cityMapKakaoLevel : regionConfig.regionMapKakaoLevel)
        }
      } else {
        mapRef.current?.setView(
          [r.centroid_lat, r.centroid_lng],
          isCity ? regionConfig.cityMapLeafletZoom : regionConfig.regionMapLeafletZoom,
        )
      }
    }
  }

  return (
    <section className="flex min-h-0 flex-1 flex-col" aria-label={t('map.ariaLabel')}>
      <h1 className="sr-only">{t('map.ariaLabel')}</h1>
      <div ref={wrapRef} className="relative isolate min-h-[320px] flex-1 overflow-hidden bg-surface">
        {/* 위: 지역 칩 + 내 위치. 지도보다 먼저 두어 Tab이 핀보다 먼저 닿는다(그리기 순서는 z-30 / z-0) */}
        {!mapError ? (
          <div className="pointer-events-none absolute inset-x-0 top-0 z-30 flex items-start justify-between gap-2 p-3">
            {regionId && regions === undefined ? (
              <span className="flex h-11 items-center" aria-hidden="true">
                <span className="flex h-9 w-24 items-center rounded-full border border-line bg-white px-3">
                  <SkeletonBlock className="h-3 w-full rounded-full" />
                </span>
              </span>
            ) : (
              <Link to="/select" className="pointer-events-auto flex h-11 min-w-0 max-w-[60%] shrink-0 items-center">
                <span className="flex h-9 min-w-0 items-center gap-1 rounded-full border border-line-strong bg-white pl-2.5 pr-3 text-small font-bold text-ink">
                  <Icon name="pin" size={16} strokeWidth={2} className="text-nong-600" />
                  <span className="truncate">{regionName || t('map.chooseRegion')}</span>
                  <span className="sr-only">{t('map.changeRegion')}</span>
                  <Icon name="chevron-down" size={16} strokeWidth={2} className="text-ink-muted" />
                </span>
              </Link>
            )}
            <button
              type="button"
              onClick={() => void locate()}
              disabled={locating}
              aria-busy={locating || undefined}
              aria-label={t('map.locate')}
              className="pointer-events-auto flex h-11 min-w-0 items-center gap-1.5 rounded-full border border-line-strong bg-white pl-3 pr-4 text-label text-ink hover:bg-surface disabled:cursor-default max-[269px]:pr-3"
            >
              {locating ? <Spinner /> : <Icon name="navigate" size={18} strokeWidth={2} className="shrink-0 text-nong-600" />}
              {/* 좁은 화면·긴 번역에서는 지역 칩이 먼저 자리를 갖고 이 글자가 줄어든다. 아주 좁으면(200% 확대) 숨긴다(이름은 aria-label) */}
              <span aria-hidden="true" className="min-w-0 truncate max-[269px]:hidden">
                {locating ? t('map.locating') : t('map.locate')}
              </span>
            </button>
          </div>
        ) : null}

        {/* 지도 자리(리플릿/카카오가 이 칸을 다룬다 — React 자식 없음) */}
        <div ref={containerRef} className="absolute inset-0 z-0 !bg-surface" />

        <p className="sr-only" role="status" aria-live="polite">
          {locateStatus}
        </p>

        {/*
          위에서 아래로 한 줄: (그만 기다린 뒤) 아직 불러오는 중 · 위치 찾는 중(느림) · 위치 실패 · 가까운 지역 · 카카오 폴백 안내,
          그리고 장소 없음(가운데)·장소 실패(아래). 지도를 불러오는 중에도 위치 카드는 덮개 위(z-30)에 보인다.
          줄 자체는 누름을 통과시켜 카드 사이로 지도를 끌 수 있다.
        */}
        {!mapError &&
        (tileState === 'dismissed' ||
          locateSlow ||
          geoError ||
          nearest ||
          kakaoError ||
          (mapVisible && (itemsError || dataEmpty))) ? (
          <div className="pointer-events-none absolute inset-x-3 bottom-4 top-[60px] z-30 flex flex-col gap-2 overflow-y-auto">
            {mapVisible && tileState === 'dismissed' ? (
              <div
                role="status"
                aria-live="polite"
                className="pointer-events-auto mx-auto flex h-11 shrink-0 items-center gap-2 rounded-full border border-line bg-white pl-3.5 pr-1 text-small font-bold text-ink"
              >
                <Spinner />
                {t('map.stillLoading')}
                <Button variant="ghost" size="sm" onClick={retryTiles}>
                  {t('common.retry')}
                </Button>
              </div>
            ) : null}
            {locateSlow ? (
              <FloatCard closeLabel={t('common.close')}>
                <p className="text-small text-ink-body">{t('map.locateSlow')}</p>
                <Link to="/select" className={buttonClasses({ variant: 'ghost', size: 'sm', className: '-ml-3 mt-1' })}>
                  {t('map.chooseRegionManually')}
                </Link>
              </FloatCard>
            ) : null}
            {geoError ? (
              <FloatCard onClose={() => setGeoError(false)} closeLabel={t('common.close')}>
                <p className="flex items-center gap-1.5 text-body font-bold text-ink">
                  <Icon name="alert" size={18} strokeWidth={2} className="text-danger" />
                  {t('map.geoErrorTitle')}
                </p>
                <p className="mt-0.5 text-small text-ink-muted">{t('map.geoError')}</p>
                <Link
                  to="/select"
                  className={buttonClasses({ variant: 'secondary', size: 'sm', className: 'mt-3' })}
                >
                  <Icon name="pin" size={18} />
                  {t('map.chooseRegionManually')}
                </Link>
              </FloatCard>
            ) : null}
            {nearest ? (
              <FloatCard onClose={() => setNearest(null)} closeLabel={t('common.close')}>
                {nearest.outOfArea ? <p className="mb-1 text-small text-ink-body">{t('map.outOfArea')}</p> : null}
                <p className="flex items-start gap-1.5 text-body font-bold text-ink">
                  <Icon name="pin" size={18} strokeWidth={2} className="mt-[3px] text-nong-600" />
                  <span>{nearestText}</span>
                </p>
                {nearest.region.id !== regionId ? (
                  // -mr-8: 버튼은 카드 양쪽 16px 여백에 맞추고, 글은 닫기 버튼 자리(pr-12)를 비켜 둔다
                  <div className="-mr-8 mt-3">
                    <Button
                      variant={sheet ? 'secondary' : 'primary'}
                      size="sm"
                      fullWidth
                      onClick={() => goToNearestRegion(nearest.region)}
                    >
                      {t('map.useRegion')}
                    </Button>
                  </div>
                ) : null}
              </FloatCard>
            ) : null}
            {kakaoError ? (
              <FloatCard onClose={() => setKakaoError(false)} closeLabel={t('common.close')}>
                <p className="flex items-start gap-1.5 text-small text-ink-body">
                  <Icon name="info" size={18} className="mt-px text-ink-muted" />
                  <span>{t('map.kakaoError')}</span>
                </p>
              </FloatCard>
            ) : null}
            {mapVisible && dataEmpty ? (
              <div className="pointer-events-auto my-auto shrink-0 px-2">
                {(items ?? []).length > 0 ? (
                  <EmptyState
                    icon="search"
                    title={t('lifeInfo.emptyFiltered')}
                    body={t('lifeInfo.emptyFilteredBody')}
                    action={{ label: t('common.seeAll'), onClick: () => setCategory('all') }}
                    className="bg-white"
                  />
                ) : (
                  // v1.1(D-033)·D-043: 등록 정보가 없는 지역은 오류가 아니라 빈 상태 + 이웃이 추천한 우리 동네로 가는 길
                  <EmptyState
                    icon="search"
                    title={t('lifeInfo.empty')}
                    body={t('lifeInfo.neighborTipsHint')}
                    action={{ label: t('lifeInfo.neighborTips'), to: '/board?category=recommend', icon: 'message' }}
                    className="bg-white"
                  />
                )}
              </div>
            ) : null}
            {mapVisible && itemsError ? (
              <div className="pointer-events-auto mt-auto shrink-0">
                <ErrorState
                  title={t('map.placesError')}
                  onRetry={() => void refetchItems()}
                  retrying={itemsFetching}
                  fallback={{ label: t('map.listView'), to: '/life-info' }}
                  className="bg-white"
                />
              </div>
            ) : null}
          </div>
        ) : null}

        {/* 아래: 목록 N곳 / 장소 불러오는 중 · 확대 버튼 */}
        {mapVisible ? (
          <>
            <div className="absolute bottom-8 right-3 z-20 flex flex-col overflow-hidden rounded-xl border border-line-strong bg-white max-[269px]:bottom-[72px]">
              <button
                type="button"
                onClick={() => zoom(1)}
                aria-label={t('map.zoomIn')}
                className="flex h-11 w-11 items-center justify-center text-ink hover:bg-surface focus-visible:-outline-offset-2 active:bg-surface-2"
              >
                <Icon name="plus" size={20} strokeWidth={2} />
              </button>
              <span aria-hidden="true" className="mx-2 h-px bg-line" />
              <button
                type="button"
                onClick={() => zoom(-1)}
                aria-label={t('map.zoomOut')}
                className="flex h-11 w-11 items-center justify-center text-ink hover:bg-surface focus-visible:-outline-offset-2 active:bg-surface-2"
              >
                <Icon name="minus" size={20} strokeWidth={2} />
              </button>
            </div>

            {dataLoading ? (
              <div className="absolute inset-x-0 bottom-4 z-20 flex justify-center px-16 max-[269px]:bottom-10">
                <div className="rounded-xl border border-line bg-white px-4">
                  <LoadingState
                    variant="inline"
                    label={t('map.placesLoading')}
                    offlineLabel={t('lifeInfo.waitingNetwork')}
                  />
                </div>
              </div>
            ) : !itemsError && !dataEmpty ? (
              <div className="pointer-events-none absolute inset-x-0 bottom-4 z-20 flex justify-center max-[269px]:bottom-10">
                <Link
                  to={listHref}
                  className="pointer-events-auto flex h-11 items-center gap-1.5 rounded-full bg-ink pl-3.5 pr-[18px] text-label text-white no-underline"
                >
                  <Icon name="list" size={18} strokeWidth={2} />
                  {t('map.listCount').replace('{n}', String(filtered.length))}
                </Link>
              </div>
            ) : null}
          </>
        ) : null}
        {/* 지도 불러오는 중(키트 4.14): 반짝이는 면 + 스피너 + 글자 + 기다리지 않을 길. 8초 뒤 느림 안내 */}
        {mapLoading ? (
          <div className="skel absolute inset-0 z-20 flex items-center justify-center px-6">
            <div role="status" aria-live="polite" className="w-full max-w-sm rounded-xl border border-line bg-white px-4 pb-1.5 pt-[18px] text-center">
              <p className="flex items-center justify-center gap-2.5 text-label text-ink">
                <Spinner />
                {t('state.mapLoading')}
              </p>
              {!online ? (
                // 오프라인: 느림 안내·그만 기다리기 없이 연결 대기 줄 + 목록으로 가는 길(연결되면 저절로 불러온다)
                <>
                  <p className="mt-2 text-small text-ink-muted">{t('map.waitingNetwork')}</p>
                  <Link
                    to="/life-info"
                    className={buttonClasses({ variant: 'secondary', fullWidth: true, className: 'mb-2.5 mt-3.5 px-2.5' })}
                  >
                    <Icon name="list" size={18} strokeWidth={2} />
                    {t('map.listView')}
                  </Link>
                </>
              ) : mapSlow ? (
                <>
                  <p className="mt-2 text-small text-ink-muted">{t('map.slowHint')}</p>
                  {/* 위아래로 쌓는다: 긴 번역(ru·uz·km)도 줄바꿈 없이 48px 버튼에 들어간다 */}
                  <div className="mb-2.5 mt-3.5 flex flex-col gap-2">
                    <Link to="/life-info" className={buttonClasses({ variant: 'secondary', wrap: true, fullWidth: true })}>
                      <Icon name="list" size={18} strokeWidth={2} />
                      {t('map.listView')}
                    </Link>
                    <Button variant="tertiary" wrap fullWidth onClick={stopWaiting}>
                      {t('map.stopWaiting')}
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <p className="mt-2 text-small text-ink-muted">{t('map.loadingHint')}</p>
                  <Link to="/life-info" className={buttonClasses({ variant: 'ghost', size: 'sm', className: 'mt-1' })}>
                    {t('map.skipWait')}
                  </Link>
                </>
              )}
            </div>
          </div>
        ) : null}

        {/* 지도 실패(키트 4.14 error): 무엇이 안 됐는지 + 다시 시도 + 목록으로 */}
        {mapError ? (
          <div
            aria-live="polite"
            className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-surface px-7 text-center"
          >
            <span className="flex h-14 w-14 items-center justify-center rounded-full border border-line bg-white text-danger">
              <Icon name="alert" size={26} />
            </span>
            <div role="alert">
              <p className="mt-3 text-body font-bold text-ink">{t('state.mapError')}</p>
              <p className="mt-0.5 text-small text-ink-muted">{online ? t('state.errorBody') : t('common.offline')}</p>
            </div>
            <Button
              variant="secondary"
              icon="refresh"
              className="mt-4"
              onClick={retryTiles}
              loading={mapBlocked && regionsFetching}
              loadingLabel={t('state.retrying')}
            >
              {t('common.retry')}
            </Button>
            <Link to="/life-info" className={buttonClasses({ variant: 'ghost', size: 'sm', className: 'mt-1' })}>
              {t('map.listView')}
            </Link>
          </div>
        ) : null}

        {/* 핀을 누르면: 아래에서 올라오는 시트(키트 4.11 모양 — 손잡이·위 둥근 16px·1px 선) */}
        {sheet && sheet.length > 0 && mapVisible ? (
          <div
            ref={sheetRef}
            role="region"
            aria-labelledby="map-sheet-title"
            tabIndex={-1}
            onKeyDown={(e) => {
              if (e.key === 'Escape') closeSheet()
            }}
            className="anim-sheet-up absolute inset-x-0 bottom-0 z-40 max-h-[68%] overflow-y-auto overscroll-contain rounded-t-2xl border-x border-t border-line bg-white px-5 pb-5 pt-2 shadow-sheet outline-none"
          >
            <div aria-hidden="true" data-handle="" className="mx-auto mb-3 h-1 w-9 rounded-sm bg-line-strong" />
            <IconButton
              icon="x"
              iconSize={20}
              label={t('common.close')}
              onClick={closeSheet}
              className="absolute right-2 top-2 text-ink-muted"
            />
            {sheet.length === 1 ? (
              <PlaceCard item={sheet[0]} regionsById={regionsById} />
            ) : (
              <>
                <h2 id="map-sheet-title" className="pr-10 text-section text-ink">
                  {t('map.sheetTitle').replace('{n}', String(sheet.length))}
                </h2>
                {/* 여러 지역이 합쳐진 묶음은 줄마다 지역 이름을 달고, 제목 아래 건수 줄(pinTag)은 겹치므로 뺀다 */}
                {!multiRegion ? (
                  <p className="mt-0.5 text-small text-ink-body">{selectedPin ? pinTag(selectedPin) : ''}</p>
                ) : null}
                {sheet.some((i) => i.latitude == null || i.longitude == null) ? (
                  <p className="mt-0.5 flex items-center gap-1.5 text-caption text-ink-muted">
                    <Icon name="info" size={14} strokeWidth={2} />
                    {t('map.unlocated')}
                  </p>
                ) : null}
                <ul className="mt-1">
                  {sheet.map((item, i) => (
                    <PlaceRow
                      key={item.id}
                      item={item}
                      last={i === sheet.length - 1}
                      region={multiRegion ? regionsById.get(item.region_id) : undefined}
                    />
                  ))}
                </ul>
              </>
            )}
          </div>
        ) : null}
      </div>

      {/* 지도 아래 흰 줄: 카테고리 알약 + 농사 도움(오늘 날씨). 아래 32px은 솟은 말하기 버튼 자리 */}
      <div className="shrink-0 border-t border-line bg-white pb-8 pt-2">
        <PillTabs
          ariaLabel={t('map.filterLabel')}
          variant="outline"
          tone="nong"
          bleed={false}
          className="px-4"
          value={category}
          onChange={(c) => {
            setCategory(c)
            setSelectedPin(null)
          }}
          options={pillOptions}
        />
        <FarmEntry />
      </div>
    </section>
  )
}

/**
 * 🌾 농사 도움 진입(PRD v1.7 §1) — 홈에서 한 번의 탭, 비로그인 가용. 오늘 날씨를 한눈에 붙인다
 * (선택 지역 중심 0.1° 좌표 — 농사 도움 화면과 같은 조회라 그 화면은 바로 열린다). 기다림·실패도 이 줄에서 보인다:
 * 불러오는 중(8초 뒤 느림, 오프라인이면 연결 대기) · 실패 + 다시 시도(옆 버튼) · 지역 없음/날씨 없음 = 기본 설명.
 */
function FarmEntry() {
  const { t } = useTranslation()
  const online = useOnline()
  const { regionId } = useSelectedRegion()
  const { data: regions, isError: regionsError } = useRegions()
  const { area } = useUserArea()
  const weather = useWeather(area?.lat, area?.lon)
  const w = weather.data
  // 지역은 골랐는데 지역 목록(중심 좌표)이 아직 없으면 그것도 날씨를 기다리는 중이다
  const regionsPending = Boolean(regionId) && regions === undefined && !regionsError
  const waiting =
    regionsPending || (Boolean(area) && w === undefined && !weather.isError && weather.fetchStatus !== 'idle')
  const slow = useSlow(waiting && online)
  const failed = Boolean(area) && weather.isError && w === undefined
  const retrying = failed && weather.isFetching

  const sub = waiting
    ? !online
      ? t('state.waitingNetwork')
      : slow
        ? t('state.slow')
        : t('farm.weatherLoading')
    : retrying
      ? t('state.retrying')
      : failed
        ? t('farm.weatherError')
        : t('farm.homeEntryDesc')

  return (
    <div className="mx-5 mt-2 flex min-h-16 items-center rounded-xl border border-line bg-white">
      <Link
        to="/farm"
        className="flex min-h-16 min-w-0 flex-1 items-center gap-3 rounded-xl py-2 pl-3 pr-2 text-ink no-underline active:bg-surface"
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-surface text-nong-600">
          <Icon name="sprout" size={22} strokeWidth={2} />
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="text-body font-bold text-ink">{t('farm.homeEntry')}</span>
          <span className={cn('line-clamp-2 text-small', failed && !retrying ? 'text-ink-body' : 'text-ink-muted')}>
            {sub}
          </span>
        </span>
        {waiting || retrying ? (
          <Spinner />
        ) : w && area ? (
          <span className="flex shrink-0 items-center gap-1 text-label text-ink">
            <Icon name={weatherIconName(w.icon)} size={22} strokeWidth={2} className="text-ink-body" />
            {formatTemp(w.tempC)}
          </span>
        ) : null}
        <Icon name="chevron" size={20} className="shrink-0 text-ink-muted" />
      </Link>
      {failed && !retrying ? (
        <IconButton
          icon="refresh"
          iconSize={20}
          label={t('common.retry')}
          onClick={() => void weather.refetch()}
          className="mr-1 shrink-0 text-ink-body"
        />
      ) : null}
    </div>
  )
}

/** 시트 속 한 곳(실좌표 개별 핀): 그림 타일 + 이름(상세 링크) + 메타 + 길찾기·전화. */
function PlaceCard({ item, regionsById }: { item: LifeInfo; regionsById: Map<string, Region> }) {
  const { t, locale } = useTranslation()
  const { name } = localizedContent(item.localized_content, locale)
  const displayName = name || t('lifeInfo.untitled')
  const region = regionsById.get(item.region_id)
  const noCoords = item.latitude == null || item.longitude == null
  return (
    <div>
      <Link
        to={`/life-info/${item.id}`}
        className="flex items-start gap-3 pr-10 text-ink no-underline"
      >
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-surface">
          <CategoryGlyph category={item.category} size={28} />
        </span>
        <span className="min-w-0 flex-1 pt-px">
          <span id="map-sheet-title" className="flex items-center gap-1 text-body font-bold text-ink">
            <span className="min-w-0">{displayName}</span>
            <Icon name="chevron" size={18} strokeWidth={2} className="text-ink-muted" />
          </span>
          <span className="flex flex-wrap items-center gap-x-1.5 text-caption text-ink-muted">
            <span>
              {t(categoryLabelKey(item.category))}
              {region ? ` · ${regionLabel(region.id, region.names, locale)}` : ''}
            </span>
            <span aria-hidden="true">·</span>
            <FreshnessBadge
              verifiedAt={item.verified_at}
              staleAfterMonths={item.category === 'support' ? STALE_AFTER_MONTHS_SUPPORT : undefined}
            />
          </span>
          {item.address ? <span className="mt-0.5 block text-small text-ink-body">{item.address}</span> : null}
          {noCoords ? <span className="mt-0.5 block text-caption text-ink-muted">{t('map.unlocated')}</span> : null}
        </span>
      </Link>

      {!noCoords || item.phone ? (
        <div className="mt-4 flex gap-2">
          {!noCoords ? (
            <a
              href={kakaoDirectionsUrl(displayName, item.latitude as number, item.longitude as number)}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonClasses({ className: 'flex-1 px-3' })}
            >
              <Icon name="navigate" size={18} strokeWidth={2} />
              {t('map.directions')}
            </a>
          ) : null}
          {item.phone ? (
            <a
              href={telHref(item.phone)}
              aria-label={t('map.callLabel').replace('{name}', displayName)}
              className={buttonClasses({
                variant: noCoords ? 'primary' : 'secondary',
                className: cn('px-3', noCoords ? 'flex-1' : 'w-28 shrink-0'),
              })}
            >
              <Icon name="phone" size={18} strokeWidth={2} />
              {t('map.call')}
            </a>
          ) : null}
        </div>
      ) : null}
      {!noCoords ? <p className="mt-2 text-center text-caption text-ink-muted">{t('map.directionsNote')}</p> : null}
    </div>
  )
}

/** 시트 속 묶음 목록 한 줄(키트 4.7). region: 여러 지역이 섞인 묶음일 때만 넘겨 메타 줄에 지역 이름을 단다. */
function PlaceRow({ item, last, region }: { item: LifeInfo; last: boolean; region?: Region }) {
  const { t, locale } = useTranslation()
  const { name } = localizedContent(item.localized_content, locale)
  return (
    <li>
      <Link
        to={`/life-info/${item.id}`}
        className="flex min-h-16 items-center gap-3 text-ink no-underline active:bg-surface"
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-surface">
          <CategoryGlyph category={item.category} size={24} />
        </span>
        <span
          className={cn(
            'flex min-w-0 flex-1 items-center gap-2 self-stretch border-b',
            last ? 'border-transparent' : 'border-line',
          )}
        >
          <span className="flex min-w-0 flex-1 flex-col py-2.5">
            <span className="text-body font-bold text-ink">{name || t('lifeInfo.untitled')}</span>
            <span className="flex flex-wrap items-center gap-x-1.5 text-caption text-ink-muted">
              <span>{t(categoryLabelKey(item.category))}</span>
              {region ? <span>· {regionLabel(region.id, region.names, locale)}</span> : null}
              {item.address ? <span>· {item.address}</span> : null}
              <span aria-hidden="true">·</span>
              <FreshnessBadge
                verifiedAt={item.verified_at}
                staleAfterMonths={item.category === 'support' ? STALE_AFTER_MONTHS_SUPPORT : undefined}
              />
            </span>
          </span>
          <Icon name="chevron" size={20} className="text-ink-muted" />
        </span>
      </Link>
    </li>
  )
}
