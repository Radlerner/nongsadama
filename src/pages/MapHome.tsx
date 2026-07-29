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

  const mapRef = useRef<L.Map | null>(null)
  const layerRef = useRef<L.LayerGroup | null>(null)
  const userMarkerRef = useRef<L.Marker | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)

  const regionsById = useMemo(
    () => new Map((regions ?? []).map((r) => [r.id, r])),
    [regions],
  )

  const filtered = useMemo(
    () => (items ?? []).filter((i) => category === 'all' || i.category === category),
    [items, category],
  )

  // 지도 초기화(1회)
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return
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
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map)
    layerRef.current = L.layerGroup().addTo(map)
    mapRef.current = map
    return () => {
      map.remove()
      mapRef.current = null
      layerRef.current = null
      userMarkerRef.current = null
    }
    // eslint 없음 — 초기화는 regions 로드 이후 한 번이면 충분(regionsById 최초값 사용)
  }, [regions, regionId, regionsById])

  // 핀 갱신(데이터·필터 변경 시)
  useEffect(() => {
    const layer = layerRef.current
    if (!layer) return
    layer.clearLayers()

    const withCoords = filtered.filter((i) => i.latitude != null && i.longitude != null)
    const withoutCoords = filtered.filter((i) => i.latitude == null || i.longitude == null)

    for (const item of withCoords) {
      const icon = emojiIcon(LIFE_INFO_CATEGORY_ICONS[item.category] ?? 'ℹ️')
      L.marker([item.latitude as number, item.longitude as number], { icon })
        .on('click', () => setSheet([item]))
        .addTo(layer)
    }

    const groups = new Map<string, LifeInfo[]>()
    for (const item of withoutCoords) {
      const arr = groups.get(item.region_id) ?? []
      arr.push(item)
      groups.set(item.region_id, arr)
    }
    for (const [rid, group] of groups) {
      const region = regionsById.get(rid)
      if (!region || region.centroid_lat == null || region.centroid_lng == null) continue
      const emoji =
        group.length === 1 ? LIFE_INFO_CATEGORY_ICONS[group[0].category] ?? 'ℹ️' : '📍'
      L.marker([region.centroid_lat, region.centroid_lng], {
        icon: emojiIcon(emoji, group.length),
      })
        .on('click', () => setSheet(group))
        .addTo(layer)
    }
  }, [filtered, regionsById])

  const locate = async () => {
    setGeoError(false)
    setLocating(true)
    try {
      const pos = await getCurrentPosition()
      const map = mapRef.current
      if (map) {
        if (userMarkerRef.current) userMarkerRef.current.remove()
        userMarkerRef.current = L.marker([pos.lat, pos.lng], {
          icon: emojiIcon('🧍'),
        }).addTo(map)
        map.setView([pos.lat, pos.lng], 12)
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

      <Link to="/life-info" className="text-center text-sm text-green-700 underline">
        {t('map.listView')}
      </Link>
    </section>
  )
}
