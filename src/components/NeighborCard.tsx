import { Link } from 'react-router-dom'
import { useTranslation } from '../i18n/useTranslation'
import { getLocaleLabel } from '../config/app'
import { regionLabel } from '../lib/regionName'
import { regionDistanceKm, type NeighborRow } from '../lib/matching'
import type { Tables } from '../types/database'

type Region = Tables<'regions'>

interface NeighborCardProps {
  neighbor: NeighborRow
  regionsById: Map<string, Region>
  viewerRegionId: string | null
}

/**
 * 이웃 한 명 카드: 닉네임·읍면·근사거리·언어/작목/국적 칩. 연락처·정확 위치는 없다.
 * 카드 탭 → 그 이웃의 공개 게시글 목록(PRD v1.4 §2.1 연결 동선).
 */
export function NeighborCard({ neighbor, regionsById, viewerRegionId }: NeighborCardProps) {
  const { t, locale } = useTranslation()

  const region = neighbor.region_id ? regionsById.get(neighbor.region_id) : undefined
  const viewerRegion = viewerRegionId ? regionsById.get(viewerRegionId) : undefined
  const dist = regionDistanceKm(viewerRegion, region)

  const distanceLabel =
    dist === null
      ? null
      : dist === 0
        ? t('neighbors.sameTown')
        : t('neighbors.aboutKm').replace('{n}', String(Math.max(1, Math.round(dist))))

  const chips: string[] = []
  if (neighbor.preferred_locale) chips.push(getLocaleLabel(neighbor.preferred_locale))
  if (neighbor.crop_type) chips.push(neighbor.crop_type)
  if (neighbor.country_code) chips.push(neighbor.country_code)

  const body = (
    <>
      <div className="flex items-center justify-between gap-2">
        <p className="font-semibold text-gray-900">{neighbor.nickname}</p>
        {distanceLabel ? <span className="text-xs text-gray-500">{distanceLabel}</span> : null}
      </div>
      <p className="mt-1 text-xs text-gray-500">
        {region ? regionLabel(region.id, region.names, locale) : ''}
      </p>
      {chips.length > 0 ? (
        <p className="mt-2 flex flex-wrap gap-1">
          {chips.map((c, i) => (
            <span
              key={`${i}-${c}`}
              className="rounded-full bg-green-50 px-2 py-0.5 text-[11px] font-medium text-green-800"
            >
              {c}
            </span>
          ))}
        </p>
      ) : null}
      <p className="mt-2 text-[11px] text-green-700 underline">{t('neighbors.viewPosts')}</p>
    </>
  )

  return (
    <li className="rounded-md border border-gray-200 active:bg-gray-50">
      {neighbor.id ? (
        <Link to={`/board?author=${neighbor.id}`} className="block px-4 py-3">
          {body}
        </Link>
      ) : (
        <div className="px-4 py-3">{body}</div>
      )}
    </li>
  )
}
