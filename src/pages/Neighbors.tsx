import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useTranslation } from '../i18n/useTranslation'
import { useOwnProfile } from '../hooks/useOwnProfile'
import { useNeighbors } from '../hooks/useNeighbors'
import { useRegions } from '../hooks/useRegions'
import { matchScore } from '../lib/matching'
import { NeighborCard } from '../components/NeighborCard'

/**
 * 이웃 목록(PRD v1.4 §2.1). 로그인 + 본인 매칭 동의(상호성)가 전제이며,
 * 실제 강제는 DB(neighbor_profiles 뷰 GRANT·WHERE)가 한다. UI는 상태 안내만 담당.
 */
export function Neighbors() {
  const { t } = useTranslation()
  const { user, initializing } = useAuth()
  const { data: profile, isLoading: profileLoading } = useOwnProfile(user?.id)
  const optedIn = Boolean(profile?.is_matching_visible)
  const { data: neighbors, isLoading, isError, refetch, isFetching } = useNeighbors(
    Boolean(user) && optedIn,
  )
  const { data: regions } = useRegions()

  if (initializing || (user && profileLoading)) {
    return (
      <p className="rounded-md bg-gray-50 px-4 py-8 text-center text-sm text-gray-500">
        {t('neighbors.loading')}
      </p>
    )
  }

  if (!user) {
    return (
      <section>
        <h1 className="mb-4 text-lg font-bold">{t('neighbors.title')}</h1>
        <p className="mb-4 rounded-md bg-gray-50 px-4 py-8 text-center text-sm text-gray-500">
          {t('neighbors.loginRequired')}
        </p>
        <Link
          to="/login"
          className="flex min-h-[44px] items-center justify-center rounded-md bg-green-700 px-6 py-3 text-base font-semibold text-white"
        >
          {t('profile.loginCta')}
        </Link>
      </section>
    )
  }

  if (!optedIn) {
    return (
      <section>
        <h1 className="mb-4 text-lg font-bold">{t('neighbors.title')}</h1>
        <div className="rounded-md border border-gray-200 px-4 py-6 text-center">
          <p className="text-sm text-gray-700">{t('neighbors.consentRequired')}</p>
          <p className="mt-2 text-xs text-gray-500">{t('neighbors.consentWhy')}</p>
          <Link
            to="/profile/edit"
            className="mt-4 inline-flex min-h-[44px] items-center justify-center rounded-md bg-green-700 px-6 py-3 text-base font-semibold text-white"
          >
            {t('neighbors.consentCta')}
          </Link>
        </div>
      </section>
    )
  }

  const regionsById = new Map((regions ?? []).map((r) => [r.id, r]))
  const others = (neighbors ?? []).filter((n) => n.id !== user.id)
  const viewer = {
    preferred_locale: profile?.preferred_locale ?? '',
    crop_type: profile?.crop_type ?? null,
    country_code: profile?.country_code ?? null,
    region_id: profile?.region_id ?? null,
  }
  const ranked = others
    .map((n) => ({ n, score: matchScore(viewer, n, regionsById) }))
    .sort((a, b) => b.score - a.score)

  return (
    <section>
      <h1 className="mb-4 text-lg font-bold">{t('neighbors.title')}</h1>

      {isLoading ? (
        <p className="rounded-md bg-gray-50 px-4 py-8 text-center text-sm text-gray-500">
          {t('neighbors.loading')}
        </p>
      ) : isError ? (
        <div className="rounded-md bg-red-50 px-4 py-8 text-center text-sm text-red-700">
          <p className="mb-3">{t('neighbors.error')}</p>
          <button
            type="button"
            onClick={() => void refetch()}
            disabled={isFetching}
            className="min-h-[44px] rounded-md border border-red-300 px-4 text-red-700 disabled:opacity-50"
          >
            {t('common.retry')}
          </button>
        </div>
      ) : ranked.length === 0 ? (
        <p className="rounded-md bg-gray-50 px-4 py-8 text-center text-sm text-gray-500">
          {t('neighbors.empty')}
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {ranked.map(({ n }) => (
            <NeighborCard
              key={n.id}
              neighbor={n}
              regionsById={regionsById}
              viewerRegionId={viewer.region_id}
            />
          ))}
        </ul>
      )}

      <p className="mt-4 text-xs text-gray-400">{t('neighbors.privacyNote')}</p>
    </section>
  )
}
