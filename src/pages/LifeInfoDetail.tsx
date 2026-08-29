import { Link, useParams } from 'react-router-dom'
import { useTranslation } from '../i18n/useTranslation'
import { useLifeInfoItem } from '../hooks/useLifeInfo'
import { useRegions } from '../hooks/useRegions'
import { localizedContent } from '../lib/localizedContent'
import { categoryLabelKey } from '../lib/categories'
import { regionLabel } from '../lib/regionName'
import { FreshnessBadge } from '../components/FreshnessBadge'
import { freshnessOf, STALE_AFTER_MONTHS_SUPPORT } from '../lib/freshness'
import { SafetyBanner } from '../components/SafetyBanner'
import { isTtsAvailable, speak } from '../lib/tts'

export function LifeInfoDetail() {
  const { t, locale } = useTranslation()
  const { infoId } = useParams()
  const { data: item, isLoading, isError, refetch, isFetching } = useLifeInfoItem(infoId)
  const { data: regions } = useRegions()

  if (isLoading) {
    return (
      <p className="rounded-card bg-white/70 px-4 py-8 text-center text-sm text-gray-500">
        {t('lifeInfo.loading')}
      </p>
    )
  }

  if (isError) {
    return (
      <div className="rounded-card bg-red-50 px-4 py-8 text-center text-sm text-red-700">
        <p className="mb-3">{t('lifeInfo.error')}</p>
        <button
          type="button"
          onClick={() => void refetch()}
          disabled={isFetching}
          className="min-h-[44px] rounded-full border border-red-300 px-4 text-red-700 disabled:opacity-50"
        >
          {t('common.retry')}
        </button>
      </div>
    )
  }

  if (!item) {
    return (
      <div className="text-center">
        <p className="rounded-card bg-white/70 px-4 py-8 text-sm text-gray-500">
          {t('lifeInfoDetail.empty')}
        </p>
        <Link to="/life-info" className="mt-4 inline-block text-green-700 underline">
          {t('lifeInfoDetail.back')}
        </Link>
      </div>
    )
  }

  const { name, description } = localizedContent(item.localized_content, locale)
  const region = (regions ?? []).find((r) => r.id === item.region_id)
  const regionName = region ? regionLabel(region.id, region.names, locale) : ''

  return (
    <article className="flex flex-col gap-4">
      <header>
        <div className="flex items-start justify-between gap-2">
          <h1 className="text-xl font-extrabold tracking-tight text-gray-900">{name || t('lifeInfo.untitled')}</h1>
          {isTtsAvailable() ? (
            <button
              type="button"
              onClick={() =>
                speak(
                  [name, description, item.phone ? `${t('lifeInfoDetail.call')} ${item.phone}` : '']
                    .filter(Boolean)
                    .join('. '),
                  locale,
                )
              }
              className="flex min-h-[44px] shrink-0 items-center gap-1 rounded-full border border-gray-300 px-3 text-sm text-gray-700"
            >
              <span aria-hidden>🔊</span>
              {t('talk.readAloud')}
            </button>
          ) : null}
        </div>
        <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-gray-500">
          <span>
            {t(categoryLabelKey(item.category))}
            {regionName ? ` · ${regionName}` : ''}
          </span>
          <FreshnessBadge
            verifiedAt={item.verified_at}
            staleAfterMonths={item.category === 'support' ? STALE_AFTER_MONTHS_SUPPORT : undefined}
          />
        </p>
      </header>

      {item.category === 'support' ? <SafetyBanner /> : null}

      {freshnessOf(
        item.verified_at,
        new Date(),
        item.category === 'support' ? STALE_AFTER_MONTHS_SUPPORT : undefined,
      ).kind !== 'fresh' ? (
        <p className="rounded-md bg-amber-50 px-4 py-3 text-xs text-amber-800">
          {t('lifeInfoDetail.freshnessNotice')}
        </p>
      ) : null}

      {description ? (
        <p className="whitespace-pre-line text-sm text-gray-800">{description}</p>
      ) : null}

      <section className="flex flex-col gap-2 text-sm">
        {item.phone ? (
          <a
            href={`tel:${item.phone}`}
            className="flex min-h-[56px] items-center justify-center gap-2 rounded-full bg-brand-greenDark px-6 text-base font-bold text-white"
          >
            <span aria-hidden className="text-xl">☎</span>
            {t('lifeInfoDetail.call')} {item.phone}
          </a>
        ) : null}
        {item.address ? (
          <p className="text-gray-800">{item.address}</p>
        ) : null}
        {!item.phone && !item.address ? (
          <p className="text-gray-500">{t('lifeInfoDetail.noContact')}</p>
        ) : null}
      </section>

      {item.verified_at || item.source_url ? (
        <section className="text-xs text-gray-500">
          {item.verified_at ? (
            <p>
              {t('lifeInfoDetail.verifiedAt')}: {item.verified_at}
            </p>
          ) : null}
          {item.source_url ? (
            <a href={item.source_url} target="_blank" rel="noreferrer" className="underline">
              {t('lifeInfoDetail.source')}
            </a>
          ) : null}
        </section>
      ) : null}

      <p className="rounded-md bg-amber-50 px-4 py-3 text-xs text-amber-800">
        {t('lifeInfoDetail.visitNotice')}
      </p>

      <Link to="/life-info" className="text-green-700 underline">
        {t('lifeInfoDetail.back')}
      </Link>
    </article>
  )
}
