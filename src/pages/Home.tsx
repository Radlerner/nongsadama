import { Link } from 'react-router-dom'
import { useTranslation } from '../i18n/useTranslation'
import { useAuth } from '../context/AuthContext'
import { useOwnProfile } from '../hooks/useOwnProfile'
import { useNeighbors } from '../hooks/useNeighbors'
import { useRegions } from '../hooks/useRegions'
import { matchScore } from '../lib/matching'
import { NeighborCard } from '../components/NeighborCard'

export function Home() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const { data: profile } = useOwnProfile(user?.id)
  const optedIn = Boolean(profile?.is_matching_visible)
  const { data: neighbors, isLoading } = useNeighbors(Boolean(user) && optedIn)
  const { data: regions } = useRegions()

  const regionsById = new Map((regions ?? []).map((r) => [r.id, r]))
  const viewer = {
    preferred_locale: profile?.preferred_locale ?? '',
    crop_type: profile?.crop_type ?? null,
    country_code: profile?.country_code ?? null,
    region_id: profile?.region_id ?? null,
  }
  const top = (neighbors ?? [])
    .filter((n) => n.id !== user?.id)
    .map((n) => ({ n, score: matchScore(viewer, n, regionsById) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)

  return (
    <section className="flex flex-col gap-6">
      <div>
        <h1 className="mb-3 text-lg font-bold">{t('home.neighborsTitle')}</h1>
        {user && optedIn ? (
          isLoading ? (
            <p className="rounded-md bg-gray-50 px-4 py-6 text-center text-sm text-gray-500">
              {t('neighbors.loading')}
            </p>
          ) : top.length === 0 ? (
            <p className="rounded-md bg-gray-50 px-4 py-6 text-center text-sm text-gray-500">
              {t('neighbors.empty')}
            </p>
          ) : (
            <>
              <ul className="flex flex-col gap-2">
                {top.map(({ n }) => (
                  <NeighborCard
                    key={n.id}
                    neighbor={n}
                    regionsById={regionsById}
                    viewerRegionId={viewer.region_id}
                  />
                ))}
              </ul>
              <Link to="/neighbors" className="mt-3 inline-block text-sm text-green-700 underline">
                {t('home.neighborsAll')}
              </Link>
            </>
          )
        ) : (
          <div className="rounded-md border border-gray-200 px-4 py-6 text-center">
            <p className="text-sm text-gray-700">{t('home.neighborsTeaser')}</p>
            <Link
              to={user ? '/profile/edit' : '/login'}
              className="mt-3 inline-flex min-h-[44px] items-center justify-center rounded-md bg-green-700 px-6 py-3 text-sm font-semibold text-white"
            >
              {user ? t('neighbors.consentCta') : t('profile.loginCta')}
            </Link>
          </div>
        )}
      </div>

      <div>
        <h2 className="mb-3 text-base font-bold">{t('home.shortcutsTitle')}</h2>
        <div className="grid grid-cols-2 gap-2">
          <Link
            to="/board"
            className="flex min-h-[64px] items-center justify-center rounded-md border border-gray-200 text-sm font-semibold text-gray-800"
          >
            {t('nav.board')}
          </Link>
          <Link
            to="/life-info"
            className="flex min-h-[64px] items-center justify-center rounded-md border border-gray-200 text-sm font-semibold text-gray-800"
          >
            {t('nav.lifeInfo')}
          </Link>
        </div>
      </div>
    </section>
  )
}
