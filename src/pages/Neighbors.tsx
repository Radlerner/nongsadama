import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { listContainer } from '../lib/motion'
import { useAuth } from '../context/AuthContext'
import { useTranslation } from '../i18n/useTranslation'
import { useOwnProfile } from '../hooks/useOwnProfile'
import { useNeighbors } from '../hooks/useNeighbors'
import { useBlockedIds } from '../hooks/useModeration'
import { useRegions } from '../hooks/useRegions'
import { matchScore } from '../lib/matching'
import { NeighborCard } from '../components/NeighborCard'
import { EmptyBox, ErrorBox, LoadingBox } from '../components/ui/StateBoxes'

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
  const { data: blockedIds } = useBlockedIds(user?.id)

  if (initializing || (user && profileLoading)) {
    return (
      <p className="rounded-card bg-white/70 px-4 py-3 text-center text-sm text-gray-500">
        {t('neighbors.loading')}
      </p>
    )
  }

  if (!user) {
    return (
      <section>
        <h1 className="mb-4 text-xl font-extrabold tracking-tight">{t('neighbors.title')}</h1>
        <p className="mb-4 rounded-card bg-white/70 px-4 py-3 text-center text-sm text-gray-500">
          {t('neighbors.loginRequired')}
        </p>
        <Link
          to="/login"
          className="flex min-h-[44px] items-center justify-center rounded-full bg-brand-greenDark px-6 py-3 text-base font-semibold text-white"
        >
          {t('profile.loginCta')}
        </Link>
      </section>
    )
  }

  if (!optedIn) {
    return (
      <section>
        <h1 className="mb-4 text-xl font-extrabold tracking-tight">{t('neighbors.title')}</h1>
        <div className="rounded-card border border-gray-100 bg-white shadow-card px-4 py-6 text-center">
          <p className="text-sm text-gray-700">{t('neighbors.consentRequired')}</p>
          <p className="mt-2 text-xs text-gray-500">{t('neighbors.consentWhy')}</p>
          <Link
            to="/profile/edit"
            className="mt-4 inline-flex min-h-[44px] items-center justify-center rounded-full bg-brand-greenDark px-6 py-3 text-base font-semibold text-white"
          >
            {t('neighbors.consentCta')}
          </Link>
        </div>
      </section>
    )
  }

  // v1.1(D-033): 이웃 범위는 프로필 지역의 시·군 기준(DB 뷰). 지역이 없으면 항상 0명이 되므로
  // '이웃이 없다'가 아니라 '지역을 정하라'고 알려 준다(다지역에서 특히 중요).
  if (!profile?.region_id) {
    return (
      <section>
        <h1 className="mb-4 text-xl font-extrabold tracking-tight">{t('neighbors.title')}</h1>
        <div className="rounded-card border border-gray-100 bg-white shadow-card px-4 py-6 text-center">
          <p className="text-sm text-gray-700">{t('neighbors.regionRequired')}</p>
          <Link
            to="/profile/edit"
            className="mt-4 inline-flex min-h-[44px] items-center justify-center rounded-full bg-brand-greenDark px-6 py-3 text-base font-semibold text-white"
          >
            {t('neighbors.regionCta')}
          </Link>
        </div>
      </section>
    )
  }

  const regionsById = new Map((regions ?? []).map((r) => [r.id, r]))
  // 차단한 이웃 숨김(D-022)
  const others = (neighbors ?? []).filter(
    (n) => n.id !== user.id && !(n.id && blockedIds?.has(n.id)),
  )
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
      <h1 className="mb-4 text-xl font-extrabold tracking-tight">{t('neighbors.title')}</h1>

      {isLoading ? (
        <LoadingBox text={t('neighbors.loading')} />
      ) : isError ? (
        <ErrorBox
          text={t('neighbors.error')}
          retryLabel={t('common.retry')}
          onRetry={() => void refetch()}
          retrying={isFetching}
        />
      ) : ranked.length === 0 ? (
        <EmptyBox text={t('neighbors.empty')} />
      ) : (
        <motion.ul
          variants={listContainer}
          initial="hidden"
          animate="show"
          className="flex flex-col gap-2"
        >
          {ranked.map(({ n }) => (
            <NeighborCard
              key={n.id}
              neighbor={n}
              regionsById={regionsById}
              viewerRegionId={viewer.region_id}
            />
          ))}
        </motion.ul>
      )}

      <p className="mt-4 text-xs text-gray-400">{t('neighbors.privacyNote')}</p>
    </section>
  )
}
