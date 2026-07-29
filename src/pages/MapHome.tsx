import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useTranslation } from '../i18n/useTranslation'
import { useRegions, countyRegionIds } from '../hooks/useRegions'
import { useSelectedRegion } from '../context/SelectedRegionContext'
import { useLifeInfoList, type LifeInfo } from '../hooks/useLifeInfo'
import {
  LIFE_INFO_CATEGORIES,
  LIFE_INFO_CATEGORY_ICONS,
  categoryLabelKey,
} from '../lib/categories'
import { localizedContent } from '../lib/localizedContent'
import { regionLabel } from '../lib/regionName'
import { FreshnessBadge } from '../components/FreshnessBadge'
import { STALE_AFTER_MONTHS_SUPPORT } from '../lib/freshness'
import { getCurrentPosition, nearestTown, OUT_OF_AREA_KM } from '../lib/geo'
import {
  mapProvider,
  loadKakaoMaps,
  emojiMarkerEl,
  type KakaoMap,
  type KakaoMapsNs,
  type KakaoOverlay,
} from '../lib/kakaoMap'
import type { Tables } from '../types/database'

type Region = Tables<'regions'>

const FILTERS = ['all', ...LIFE_INFO_CATEGORIES] as const

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
  const { regionId, setRegionId } = useSelectedRegion()
  const scopeIds = countyRegionIds(regions ?? [], regionId)
  const scopeReady = !regionId || regions !== undefined
  const { data: items, isLoading } = useLifeInfoList(scopeIds, scopeReady)

  const [category, setCategory] = useState<string>('all')
  const [sheet, setSheet] = useState<LifeInfo[] | null>(null)
  const [locating, setLocating] = useState(false)
  const [geoError, setGeoError] = useState(false)
  const [nearest, setNearest] = useState<{
    region: Region
    distanceKm: number
    outOfArea: boolean
  } | null>(null)

  const provider = mapProvider() // 'kakao'(키 존재 시) | 'osm'
  const mapRef = useRef<L.Map | null>(null)
  const layerRef = useRef<L.LayerGroup | null>(null)
  const userMarkerRef = useRef<L.Marker | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const kakaoNsRef = useRef<KakaoMapsNs | null>(null)
  const kakaoMapRef = useRef<KakaoMap | null>(null)
  const kakaoOverlaysRef = useRef<KakaoOverlay[]>([])
  const kakaoUserOverlayRef = useRef<KakaoOverlay | null>(null)
  const [kakaoError, setKakaoError] = useState(false)

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
        emoji: LIFE_INFO_CATEGORY_ICONS[item.category] ?? 'ℹ️',
        count: 1,
        items: [item],
      })
    }
    const groups = new Map<string, LifeInfo[]>()
    for (const item of withoutCoords) {
      const region = regionsById.get(item.region_id)
      if (!item.address && region?.level === 'city') continue
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
        emoji: group.length === 1 ? LIFE_INFO_CATEGORY_ICONS[group[0].category] ?? 'ℹ️' : '📍',
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
    if (regions === undefined) return
    const selected = regionId ? regionsById.get(regionId) : undefined
    const anyCentroid =
      selected && selected.centroid_lat != null
        ? selected
        : (regions ?? []).find((r) => r.centroid_lat != null)
    const center: [number, number] = anyCentroid
      ? [anyCentroid.centroid_lat as number, anyCentroid.centroid_lng as number]
      : [36.6, 126.66]
    loadKakaoMaps()
      .then((ns) => {
        if (!containerRef.current || kakaoMapRef.current) return
        kakaoNsRef.current = ns
        kakaoMapRef.current = new ns.Map(containerRef.current, {
          center: new ns.LatLng(center[0], center[1]),
          level: 9,
        })
        setKakaoReady(true)
      })
      .catch(() => setKakaoError(true))
  }, [provider, regions, regionId, regionsById])

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
    if (!containerRef.current || mapRef.current || regions === undefined) return
    const selected = regionId ? regionsById.get(regionId) : undefined
    const anyCentroid =
      selected && selected.centroid_lat != null
        ? selected
        : (regions ?? []).find((r) => r.centroid_lat != null)
    const center: [number, number] = anyCentroid
      ? [anyCentroid.centroid_lat as number, anyCentroid.centroid_lng as number]
      : [36.6, 126.66]
    const map = L.map(containerRef.current, { zoomControl: true }).setView(center, 11)
    // 타일: OSM 표준(§10-B 확정 전 잠정, 저트래픽 데모 — attribution 필수)
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map)
    layerRef.current = L.layerGroup().addTo(map)
    mapRef.current = map
  }, [regions, regionId, regionsById])

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
      if (provider === 'kakao') {
        const ns = kakaoNsRef.current
        const kmap = kakaoMapRef.current
        if (ns && kmap) {
          kakaoUserOverlayRef.current?.setMap(null)
          const ov = new ns.CustomOverlay({
            position: new ns.LatLng(pos.lat, pos.lng),
            content: emojiMarkerEl('🧍'),
          })
          ov.setMap(kmap)
          kakaoUserOverlayRef.current = ov
          kmap.setCenter(new ns.LatLng(pos.lat, pos.lng))
        }
      } else {
        const map = mapRef.current
        if (map) {
          if (userMarkerRef.current) userMarkerRef.current.remove()
          userMarkerRef.current = L.marker([pos.lat, pos.lng], {
            icon: emojiIcon('🧍'),
          }).addTo(map)
          map.setView([pos.lat, pos.lng], 12)
        }
      }
      const near = nearestTown(regions ?? [], pos.lat, pos.lng)
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
      <div className="flex gap-2 overflow-x-auto pb-1">
        {FILTERS.map((c) => {
          const active = category === c
          return (
            <button
              key={c}
              type="button"
              onClick={() => {
                setCategory(c)
                setSheet(null)
              }}
              aria-pressed={active}
              className={[
                'inline-flex min-h-[44px] shrink-0 items-center rounded-full border px-3 text-sm',
                active
                  ? 'border-green-700 bg-green-700 font-semibold text-white'
                  : 'border-gray-300 text-gray-700',
              ].join(' ')}
            >
              {c === 'all' ? (
                t('lifeInfo.category.all')
              ) : (
                <>
                  <span aria-hidden className="mr-1">{LIFE_INFO_CATEGORY_ICONS[c]}</span>
                  {t(categoryLabelKey(c))}
                </>
              )}
            </button>
          )
        })}
      </div>

      <div className="relative">
        <div
          ref={containerRef}
          className="z-0 h-[52dvh] min-h-[300px] w-full rounded-md border border-gray-200"
        />
        <button
          type="button"
          onClick={() => void locate()}
          disabled={locating}
          className="absolute right-2 top-2 z-[500] flex min-h-[56px] min-w-[56px] items-center justify-center rounded-full bg-white text-2xl shadow-md disabled:opacity-60"
          aria-label={t('map.locate')}
        >
          {locating ? '⏳' : '📍'}
        </button>
      </div>

      {isLoading ? (
        <p className="rounded-md bg-gray-50 px-4 py-3 text-center text-sm text-gray-500">
          {t('lifeInfo.loading')}
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
                setRegionId(nearest.region.id)
                setNearest(null)
                setSheet(null)
              }}
              className="mt-2 min-h-[44px] w-full rounded-md bg-green-700 px-4 font-semibold text-white"
            >
              {t('map.useRegion')}
            </button>
          ) : null}
        </div>
      ) : null}

      {sheet && sheet.length > 0 ? (
        <div className="rounded-md border border-gray-200">
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
                      <span aria-hidden>{LIFE_INFO_CATEGORY_ICONS[item.category] ?? 'ℹ️'}</span>
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
        <span aria-hidden>📋</span>
        {t('map.listView')}
      </Link>
    </section>
  )
}
