import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from '../i18n/useTranslation'
import { useRegions, countyRegionIds } from '../hooks/useRegions'
import { useSelectedRegion } from '../context/SelectedRegionContext'
import { useLifeInfoList, type LifeInfo as LifeInfoRow } from '../hooks/useLifeInfo'
import { LIFE_INFO_CATEGORIES, categoryLabelKey } from '../lib/categories'
import { localizedContent } from '../lib/localizedContent'
import { regionLabel } from '../lib/regionName'

const FILTERS = ['all', ...LIFE_INFO_CATEGORIES] as const

export function LifeInfo() {
  const { t, locale } = useTranslation()
  const { data: regions, isLoading: regionsLoading } = useRegions()
  const { regionId } = useSelectedRegion()
  const scopeIds = countyRegionIds(regions ?? [], regionId)
  const { data: items, isLoading, isError, refetch, isFetching } = useLifeInfoList(scopeIds)
  const [category, setCategory] = useState<string>('all')

  const regionNameOf = (id: string) => {
    const r = (regions ?? []).find((x) => x.id === id)
    return r ? regionLabel(r.id, r.names, locale) : ''
  }

  const filtered = (items ?? []).filter((i) => category === 'all' || i.category === category)
  const loading = regionsLoading || isLoading

  return (
    <section>
      <h1 className="mb-4 text-lg font-bold">{t('lifeInfo.title')}</h1>

      <div className="mb-4 flex flex-wrap gap-2">
        {FILTERS.map((c) => {
          const active = category === c
          return (
            <button
              key={c}
              type="button"
              onClick={() => setCategory(c)}
              aria-pressed={active}
              className={[
                'inline-flex min-h-[44px] items-center rounded-full border px-4 text-sm',
                active
                  ? 'border-green-700 bg-green-700 font-semibold text-white'
                  : 'border-gray-300 text-gray-700',
              ].join(' ')}
            >
              {c === 'all' ? t('lifeInfo.category.all') : t(categoryLabelKey(c))}
            </button>
          )
        })}
      </div>

      {loading ? (
        <p className="rounded-md bg-gray-50 px-4 py-8 text-center text-sm text-gray-500">
          {t('lifeInfo.loading')}
        </p>
      ) : isError ? (
        <div className="rounded-md bg-red-50 px-4 py-8 text-center text-sm text-red-700">
          <p className="mb-3">{t('lifeInfo.error')}</p>
          <button
            type="button"
            onClick={() => void refetch()}
            disabled={isFetching}
            className="min-h-[44px] rounded-md border border-red-300 px-4 text-red-700 disabled:opacity-50"
          >
            {t('common.retry')}
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <p className="rounded-md bg-gray-50 px-4 py-8 text-center text-sm text-gray-500">
          {t('lifeInfo.empty')}
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {filtered.map((item) => (
            <LifeInfoCard
              key={item.id}
              item={item}
              regionName={regionNameOf(item.region_id)}
            />
          ))}
        </ul>
      )}
    </section>
  )
}

function LifeInfoCard({ item, regionName }: { item: LifeInfoRow; regionName: string }) {
  const { t, locale } = useTranslation()
  const { name } = localizedContent(item.localized_content, locale)
  return (
    <li>
      <Link
        to={`/life-info/${item.id}`}
        className="block rounded-md border border-gray-200 px-4 py-3 active:bg-gray-50"
      >
        <p className="font-semibold text-gray-900">{name || t('lifeInfo.untitled')}</p>
        <p className="mt-1 text-xs text-gray-500">
          {t(categoryLabelKey(item.category))}
          {regionName ? ` · ${regionName}` : ''}
        </p>
      </Link>
    </li>
  )
}
