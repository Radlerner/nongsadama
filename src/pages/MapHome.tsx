import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useTranslation } from '../i18n/useTranslation'
import { useRegions, countyOf } from '../hooks/useRegions'
import { regionConfig } from '../config/app'
import { useRegionChoice, viewRegionId } from '../context/RegionChoiceContext'
import { regionChoiceStore } from '../lib/regionChoiceStore'
import { lifeInfoScope } from '../lib/regionScope'
import { RegionViewBar } from '../components/RegionViewBar'
import { RegionNeededBox } from '../components/RegionNeededBox'
import { ErrorBox } from '../components/ui/StateBoxes'
import { useLifeInfoList, type LifeInfo } from '../hooks/useLifeInfo'
import {
  LIFE_INFO_CATEGORIES,
  LIFE_INFO_CATEGORY_TINTS,
  categoryLabelKey,
} from '../lib/categories'
import {
  CATEGORY_ICONS,
  Info as InfoIcon,
  LayoutGrid,
  List,
  MapPin,
  Sprout,
} from '../components/ui/icons'
import { categoryPinMarkup, personPinMarkup } from '../lib/pinIcons'
import { localizedContent } from '../lib/localizedContent'
import { regionLabel } from '../lib/regionName'
import { FreshnessBadge } from '../components/FreshnessBadge'
import { IconTile } from '../components/ui/IconTile'
import { ShareButtons } from '../components/ShareButtons'
import { STALE_AFTER_MONTHS_SUPPORT } from '../lib/freshness'
import { getCurrentPosition, nearestServiceRegion, OUT_OF_AREA_KM } from '../lib/geo'
import {
  mapProvider,
  loadKakaoMaps,
  emojiMarkerEl,
  type MapProvider,
  type KakaoMap,
  type KakaoMapsNs,
  type KakaoOverlay,
} from '../lib/kakaoMap'
import type { Tables } from '../types/database'

type Region = Tables<'regions'>

const FILTERS = ['all', ...LIFE_INFO_CATEGORIES] as const

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

function emojiIcon(emoji: string, count?: number): L.DivIcon {
  const badge =
    count && count > 1
      ? `<span style="position:absolute;top:-6px;right:-6px;background:#15803d;color:#fff;border-radius:9999px;font-size:11px;font-weight:700;min-width:18px;height:18px;line-height:18px;text-align:center;padding:0 3px;">${count}</span>`
      : ''
  return L.divIcon({
    className: '',
    html: `<div style="position:relative;width:38px;height:38px;background:#fff;border:2px solid #15803d;border-radius:9999px;display:flex;align-items:center;justify-content:center;font-size:19px;box-shadow:0 1px 3px rgba(0,0,0,.3);">${emoji}${badge}</div>`,
    iconSize: [38, 38],
    iconAnchor: [19, 19],
  })
}

/**
 * 지도 홈 (PRD v1.5 §2·§4 — 데모: 생활정보 전용, 인적 핀 없음).
 * - 검수 실좌표는 개별 핀, 좌표 없는 항목은 읍·면 중심 묶음 핀("위치 검수 전")
 * - 내 위치: 일회성 조회로 가까운 서비스 지역 안내(좌표 저장·전송 없음, v1.3 §4.1)
 */
export default function MapHome() {
  const { t, locale } = useTranslation()
  const { data: regions } = useRegions()
  // 지금 보는 지역(v1.6 D-047) — 목록 화면과 같은 판단·같은 조회 범위(같은 캐시 키)
  const { view, pickRegion, retry } = useRegionChoice()
  const regionId = viewRegionId(view)
  const decided = view.status !== 'deciding'
  const { data: list, isLoading } = useLifeInfoList(lifeInfoScope(regions, view))
  const items = list?.rows

  const [category, setCategory] = useState<string>('all')
  const [sheet, setSheet] = useState<LifeInfo[] | null>(null)
  const [locating, setLocating] = useState(false)
  const [geoError, setGeoError] = useState(false)
  const [nearest, setNearest] = useState<{
    region: Region
    distanceKm: number
    outOfArea: boolean
  } | null>(null)

  // 'kakao'(키 존재 시) | 'osm'. 카카오 SDK 로드 실패 시 OSM으로 자동 폴백한다(§4 폴백 원칙).
  const [provider, setProvider] = useState<MapProvider | null>(null)
  const mapRef = useRef<L.Map | null>(null)
  const layerRef = useRef<L.LayerGroup | null>(null)
  const userMarkerRef = useRef<L.Marker | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const kakaoNsRef = useRef<KakaoMapsNs | null>(null)
  const kakaoMapRef = useRef<KakaoMap | null>(null)
  const kakaoOverlaysRef = useRef<KakaoOverlay[]>([])
  const kakaoUserOverlayRef = useRef<KakaoOverlay | null>(null)
  const [kakaoError, setKakaoError] = useState(false)
  // 지도를 만들 때는 그 순간의 보는 지역을 쓴다(SDK를 기다리는 동안 지역이 정해져도 옛 값으로 만들지 않게)
  const viewTargetRef = useRef(initialView(regions ?? [], regionId))
  viewTargetRef.current = initialView(regions ?? [], regionId)
  const regionIdRef = useRef(regionId)
  regionIdRef.current = regionId
  // 지도가 지금 어느 보는 지역에 맞춰져 있는가(undefined = 아직 지도 없음), 사용자가 직접 움직였는가
  const centredForRef = useRef<string | null | undefined>(undefined)
  const userMovedRef = useRef(false)
  const localPickRef = useRef(regionChoiceStore.getLocalPickRev())

  useEffect(() => {
    let active = true
    void mapProvider().then((value) => {
      if (active) setProvider(value)
    })
    return () => {
      active = false
    }
  }, [])

  const regionsById = useMemo(
    () => new Map((regions ?? []).map((r) => [r.id, r])),
    [regions],
  )

  const filtered = useMemo(
    () => (items ?? []).filter((i) => category === 'all' || i.category === category),
    [items, category],
  )

  // 제공자 공용 핀 데이터(실좌표 개별 + 읍·면 묶음, 전화 전용 시/군 항목 제외)
  const pins = useMemo(() => {
    const out: { lat: number; lng: number; emoji: string; count: number; items: LifeInfo[] }[] = []
    const withCoords = filtered.filter((i) => i.latitude != null && i.longitude != null)
    const withoutCoords = filtered.filter((i) => i.latitude == null || i.longitude == null)
    for (const item of withCoords) {
      out.push({
        lat: item.latitude as number,
        lng: item.longitude as number,
        emoji: categoryPinMarkup(item.category),
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
      out.push({
        lat: region.centroid_lat,
        lng: region.centroid_lng,
        emoji: group.length === 1 ? categoryPinMarkup(group[0].category) : categoryPinMarkup(null),
        count: group.length,
        items: group,
      })
    }
    return out
  }, [filtered, regionsById])

  const [kakaoReady, setKakaoReady] = useState(false)

  // ── kakao 제공자: SDK 로드·지도 생성(키 존재 시에만) ──────────────────────
  useEffect(() => {
    if (provider !== 'kakao' || !containerRef.current || kakaoMapRef.current) return
    // 보는 지역이 정해진 뒤에만 만든다 — 전국 보기로 먼저 열렸다가 튀지 않게(D-047)
    if (regions === undefined || !decided) return
    loadKakaoMaps()
      .then((ns) => {
        if (!containerRef.current || kakaoMapRef.current) return
        const target = viewTargetRef.current
        kakaoNsRef.current = ns
        const map = new ns.Map(containerRef.current, {
          center: new ns.LatLng(target.center[0], target.center[1]),
          level: target.kakaoLevel,
        })
        kakaoMapRef.current = map
        ns.event?.addListener(map, 'dragstart', () => {
          userMovedRef.current = true
        })
        centredForRef.current = regionIdRef.current
        setKakaoReady(true)
      })
      .catch(() => {
        setKakaoError(true)
        setProvider('osm') // 검증된 기본 지도로 자동 폴백
      })
  }, [provider, regions, decided])

  // kakao 핀(CustomOverlay) 갱신
  useEffect(() => {
    if (provider !== 'kakao' || !kakaoReady) return
    const ns = kakaoNsRef.current
    const map = kakaoMapRef.current
    if (!ns || !map) return
    for (const o of kakaoOverlaysRef.current) o.setMap(null)
    kakaoOverlaysRef.current = []
    for (const pin of pins) {
      const el = emojiMarkerEl(pin.emoji, pin.count)
      el.addEventListener('click', () => setSheet(pin.items))
      const ov = new ns.CustomOverlay({ position: new ns.LatLng(pin.lat, pin.lng), content: el })
      ov.setMap(map)
      kakaoOverlaysRef.current.push(ov)
    }
  }, [provider, kakaoReady, pins])

  // ── osm(Leaflet) 제공자: 초기화 — regions 준비 후 정확히 1회 ─────────────
  useEffect(() => {
    if (provider !== 'osm') return
    if (!containerRef.current || mapRef.current || regions === undefined || !decided) return
    const target = viewTargetRef.current
    const map = L.map(containerRef.current, { zoomControl: true }).setView(
      target.center,
      target.leafletZoom,
    )
    map.on('dragstart', () => {
      userMovedRef.current = true
    })
    centredForRef.current = regionIdRef.current
    // 타일: OSM 표준(§10-B 확정 전 잠정, 저트래픽 데모 — attribution 필수)
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map)
    layerRef.current = L.layerGroup().addTo(map)
    mapRef.current = map
  }, [provider, regions, decided])

  // 보는 지역이 바뀌면 다시 가운데 맞춘다. 이 탭에서 직접 고른 경우는 늘, 그 밖(다른 탭·프로필 갱신)은
  // 사용자가 지도를 움직이거나 "내 위치"를 쓰지 않았을 때만(D-047).
  useEffect(() => {
    if (!decided || centredForRef.current === undefined || centredForRef.current === regionId) return
    centredForRef.current = regionId
    const pickRev = regionChoiceStore.getLocalPickRev()
    const explicit = pickRev !== localPickRef.current
    localPickRef.current = pickRev
    if (!explicit && userMovedRef.current) return
    userMovedRef.current = false
    const target = viewTargetRef.current
    if (provider === 'kakao') {
      const ns = kakaoNsRef.current
      const kmap = kakaoMapRef.current
      if (ns && kmap) {
        kmap.setCenter(new ns.LatLng(target.center[0], target.center[1]))
        kmap.setLevel(target.kakaoLevel)
      }
    } else {
      mapRef.current?.setView(target.center, target.leafletZoom)
    }
  }, [decided, regionId, provider, kakaoReady])

  // 언마운트 시에만 지도 해제
  useEffect(
    () => () => {
      mapRef.current?.remove()
      mapRef.current = null
      layerRef.current = null
      userMarkerRef.current = null
    },
    [],
  )

  // osm(Leaflet) 핀 갱신
  useEffect(() => {
    if (provider !== 'osm') return
    const layer = layerRef.current
    if (!layer) return
    layer.clearLayers()
    for (const pin of pins) {
      L.marker([pin.lat, pin.lng], { icon: emojiIcon(pin.emoji, pin.count > 1 ? pin.count : undefined) })
        .on('click', () => setSheet(pin.items))
        .addTo(layer)
    }
  }, [provider, pins])

  const locate = async () => {
    setGeoError(false)
    setLocating(true)
    try {
      const pos = await getCurrentPosition()
      // 내 위치로 옮긴 뒤에는 다른 탭·프로필 갱신으로 지도를 다시 옮기지 않는다
      userMovedRef.current = true
      if (provider === 'kakao') {
        const ns = kakaoNsRef.current
        const kmap = kakaoMapRef.current
        if (ns && kmap) {
          kakaoUserOverlayRef.current?.setMap(null)
          const ov = new ns.CustomOverlay({
            position: new ns.LatLng(pos.lat, pos.lng),
            content: emojiMarkerEl(personPinMarkup()),
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
            icon: emojiIcon(personPinMarkup()),
          }).addTo(map)
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

  return (
    <section className="flex flex-col gap-3">
      <RegionViewBar />
      {/* 카테고리 = 아이콘 타일 행(디자인 v1.5) — 색+그림 이중 부호화, 글 없이도 구분 */}
      <div className="flex gap-3 overflow-x-auto pb-1">
        {FILTERS.map((c) => {
          const active = category === c
          const tint =
            c === 'all'
              ? { bg: 'bg-white', text: 'text-gray-700' }
              : (LIFE_INFO_CATEGORY_TINTS[c] ?? { bg: 'bg-gray-100', text: 'text-gray-600' })
          return (
            <button
              key={c}
              type="button"
              onClick={() => {
                setCategory(c)
                setSheet(null)
              }}
              aria-pressed={active}
              className="flex min-w-[56px] shrink-0 flex-col items-center gap-1"
            >
              <span
                aria-hidden
                className={[
                  'flex h-12 w-12 items-center justify-center rounded-2xl text-2xl transition-shadow',
                  tint.bg,
                  active ? 'ring-2 ring-green-700 shadow-card' : 'border border-black/5',
                ].join(' ')}
              >
                {c === 'all' ? (
                  <LayoutGrid size={22} strokeWidth={2} className="text-gray-600" />
                ) : (
                  (() => {
                    const I = CATEGORY_ICONS[c] ?? InfoIcon
                    return <I size={22} strokeWidth={2} className={tint.text} />
                  })()
                )}
              </span>
              <span
                className={[
                  'text-[11px] leading-tight',
                  active ? 'font-bold text-green-800' : 'text-gray-600',
                ].join(' ')}
              >
                {c === 'all' ? t('lifeInfo.category.all') : t(categoryLabelKey(c))}
              </span>
            </button>
          )
        })}
      </div>

      <div className="relative">
        <div
          ref={containerRef}
          className="z-0 h-[52dvh] min-h-[300px] w-full overflow-hidden rounded-card border border-gray-100 bg-white shadow-card"
        />
        <button
          type="button"
          onClick={() => void locate()}
          disabled={locating}
          className="absolute right-2 top-2 z-[500] flex min-h-[56px] min-w-[56px] items-center justify-center rounded-full bg-white text-2xl shadow-md disabled:opacity-60"
          aria-label={t('map.locate')}
        >
          <MapPin size={24} strokeWidth={2.25} className={locating ? 'animate-pulse text-gray-400' : 'text-green-800'} />
        </button>
        {/* 지역을 정하는 중·없음·목록 오류는 같은 크기의 지도 틀 안에 덮는다(아래 버튼이 밀리지 않게, D-047) */}
        {view.status === 'deciding' ? (
          <div className="absolute inset-0 z-[600] flex items-center justify-center rounded-card bg-white/90 px-4 text-center text-sm text-gray-500">
            {t('region.bar.deciding')}
          </div>
        ) : view.status === 'none' ? (
          <div className="absolute inset-0 z-[600] flex items-center overflow-y-auto rounded-card bg-brand-cream/95 p-3">
            <div className="w-full">
              <RegionNeededBox returnTo="/home" />
            </div>
          </div>
        ) : view.status === 'error' ? (
          <div className="absolute inset-0 z-[600] flex items-center rounded-card bg-brand-cream/95 p-3">
            <div className="w-full">
              <ErrorBox text={t('select.regionError')} retryLabel={t('common.retry')} onRetry={retry} />
            </div>
          </div>
        ) : null}
      </div>

      {list?.truncated ? (
        <p className="rounded-card bg-amber-50 px-4 py-3 text-center text-sm text-amber-900">{t('lifeInfo.truncated')}</p>
      ) : null}

      {isLoading ? (
        <p className="rounded-card bg-white/70 px-4 py-3 text-center text-sm text-gray-500">
          {t('lifeInfo.loading')}
        </p>
      ) : items && filtered.length === 0 ? (
        /* v1.1(D-033): 등록 정보가 없는 지역·종류는 오류가 아니라 빈 상태로 알린다 */
        <p className="rounded-card bg-white/70 px-4 py-3 text-center text-sm text-gray-500">
          {t(items.length > 0 ? 'lifeInfo.emptyFiltered' : 'lifeInfo.empty')}
        </p>
      ) : null}

      {geoError ? (
        <p className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{t('map.geoError')}</p>
      ) : null}

      {kakaoError ? (
        <p className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{t('map.kakaoError')}</p>
      ) : null}

      {nearest ? (
        <div className="rounded-md border border-green-300 bg-green-50 px-4 py-3 text-sm text-green-900">
          {nearest.outOfArea ? <p className="mb-1">{t('map.outOfArea')}</p> : null}
          <p>
            {t('map.nearest')
              .replace('{name}', regionLabel(nearest.region.id, nearest.region.names, locale))
              .replace('{n}', String(Math.max(1, Math.round(nearest.distanceKm))))}
          </p>
          {nearest.region.id !== regionId ? (
            <button
              type="button"
              onClick={() => {
                pickRegion(nearest.region.id)
                setNearest(null)
                setSheet(null)
              }}
              className="mt-2 min-h-[44px] w-full rounded-full bg-brand-greenDark px-4 font-semibold text-white"
            >
              {t('map.useRegion')}
            </button>
          ) : null}
        </div>
      ) : null}

      {sheet && sheet.length > 0 ? (
        <div className="rounded-card border border-gray-100 bg-white shadow-card">
          <p className="border-b border-gray-100 px-4 py-2 text-xs font-semibold text-gray-500">
            {t('map.sheetTitle').replace('{n}', String(sheet.length))}
          </p>
          <ul className="max-h-64 overflow-y-auto">
            {sheet.map((item) => {
              const { name } = localizedContent(item.localized_content, locale)
              const region = regionsById.get(item.region_id)
              const noCoords = item.latitude == null || item.longitude == null
              return (
                <li key={item.id} className="border-b border-gray-100 last:border-b-0">
                  <Link to={`/life-info/${item.id}`} className="block px-4 py-3 active:bg-gray-50">
                    <p className="flex items-center gap-2 font-semibold text-gray-900">
                      {(() => {
                        const I = CATEGORY_ICONS[item.category] ?? InfoIcon
                        return <I aria-hidden size={18} strokeWidth={2} className="shrink-0 text-green-800" />
                      })()}
                      {name || t('lifeInfo.untitled')}
                    </p>
                    <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-gray-500">
                      {region ? <span>{regionLabel(region.id, region.names, locale)}</span> : null}
                      {item.address ? <span>{item.address}</span> : null}
                      {noCoords ? <span className="text-amber-700">{t('map.unlocated')}</span> : null}
                      <FreshnessBadge
                        verifiedAt={item.verified_at}
                        staleAfterMonths={
                          item.category === 'support' ? STALE_AFTER_MONTHS_SUPPORT : undefined
                        }
                      />
                    </p>
                  </Link>
                </li>
              )
            })}
          </ul>
        </div>
      ) : null}

      <Link
        to="/life-info"
        className="flex min-h-[44px] items-center justify-center gap-2 rounded-full border border-green-300 bg-green-50 text-sm font-semibold text-green-800"
      >
        <List aria-hidden size={18} strokeWidth={2.25} />
        {t('map.listView')}
      </Link>

      {/* 🌾 농사 도움 진입(PRD v1.7 §1) — 홈에서 한 번의 탭, 비로그인 가용 */}
      <Link
        to="/farm"
        className="flex min-h-[56px] items-center gap-3 rounded-card border border-gray-100 bg-white px-4 shadow-card active:bg-gray-50"
      >
        <IconTile icon={Sprout} tint="bg-green-50" iconClass="text-green-800" size="lg" />
        <span className="flex-1">
          <span className="block text-sm font-semibold text-gray-900">{t('farm.homeEntry')}</span>
          <span className="block text-xs text-gray-500">{t('farm.homeEntryDesc')}</span>
        </span>
        <span aria-hidden className="text-gray-400">
          ›
        </span>
      </Link>

      <ShareButtons />
    </section>
  )
}
