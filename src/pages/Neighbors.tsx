import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useTranslation } from '../i18n/useTranslation'
import { useOwnProfile } from '../hooks/useOwnProfile'
import { useNeighbors } from '../hooks/useNeighbors'
import { useBlockedIds } from '../hooks/useModeration'
import { useRegions } from '../hooks/useRegions'
import { matchScore } from '../lib/matching'
import { NeighborCard } from '../components/NeighborCard'
import { FROM_DETAIL_STATE } from '../components/layout/flash'
import { Button, EmptyState, ErrorState, Icon, LoadingState, Skeleton } from '../components/ui'

/**
 * 이웃 목록(PRD v1.4 §2.1). 로그인 + 본인 매칭 동의(상호성)가 전제이며,
 * 실제 강제는 DB(neighbor_profiles 뷰 GRANT·WHERE)가 한다. UI는 상태 안내만 담당.
 * 디자인 v5: 이웃 = 마(황토) — 아바타·스피너·링크. 주 버튼은 어느 탭이나 초록 하나.
 */
export function Neighbors() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { user, initializing } = useAuth()
  const {
    data: profile,
    isPending: profilePending,
    isError: profileError,
    refetch: refetchProfile,
    isFetching: profileFetching,
  } = useOwnProfile(user?.id)
  const optedIn = Boolean(profile?.is_matching_visible)
  // 지역이 없으면 뷰는 늘 0행이다 — 부르지도, 빈 목록을 캐시에 남기지도 않는다
  const { data: neighbors, isPending, isError, refetch, isFetching } = useNeighbors(
    Boolean(user) && optedIn && Boolean(profile?.region_id),
  )
  const { data: regions } = useRegions()
  const { data: blockedIds } = useBlockedIds(user?.id)

  const title = <h1 className="text-title text-ink">{t('neighbors.title')}</h1>

  // 오프라인으로 멈춘 첫 요청(paused)도 isPending이다 — 그때는 '느려요' 대신 연결을 기다린다는 줄(LoadingState)
  const loadingRows = (
    <LoadingState
      variant="inline"
      tone="ma"
      label={t('neighbors.loading')}
      offlineLabel={t('neighbors.waitingNetwork')}
      className="mt-3"
    >
      <Skeleton variant="rows" lead="avatar" count={4} className="mt-1" />
    </LoadingState>
  )

  // 동의·지역을 고치는 화면으로 — 저장하면 이 화면으로 돌아온다(ProfileEdit의 cameFromDetail → 뒤로 + 토스트)
  const goEdit = () => navigate('/profile/edit', { state: FROM_DETAIL_STATE })

  // 내 프로필(동의 여부·지역)을 아직 모르면 기다린다 — 가짜 '동의 안 함'을 보여 주지 않는다
  if (initializing || (user && profilePending && !profileError)) {
    return (
      <section>
        {title}
        {loadingRows}
      </section>
    )
  }

  if (!user) {
    return (
      <section>
        {title}
        <EmptyState
          className="mt-4"
          icon="neighbors"
          title={t('neighbors.loginRequired')}
          action={{ label: t('profile.loginCta'), to: '/login', primary: true }}
        />
      </section>
    )
  }

  if (profileError && !profile) {
    return (
      <section>
        {title}
        <ErrorState
          className="mt-4"
          title={t('neighbors.error')}
          tone="ma"
          onRetry={() => void refetchProfile()}
          retrying={profileFetching}
          fallback={{ label: t('neighbors.goBoard'), to: '/board' }}
        />
      </section>
    )
  }

  if (!optedIn) {
    return (
      <section>
        {title}
        <EmptyState
          className="mt-4"
          icon="lock"
          title={t('neighbors.consentRequired')}
          body={t('neighbors.consentWhy')}
          action={{ label: t('neighbors.consentCta'), onClick: goEdit, primary: true }}
        />
      </section>
    )
  }

  // v1.1(D-033): 이웃 범위는 프로필 지역의 시·군 기준(DB 뷰). 지역이 없으면 항상 0명이 되므로
  // '이웃이 없다'가 아니라 '지역을 정하라'고 알려 준다(다지역에서 특히 중요).
  if (!profile?.region_id) {
    return (
      <section>
        {title}
        <EmptyState
          className="mt-4"
          icon="pin"
          title={t('neighbors.regionRequired')}
          action={{ label: t('neighbors.regionCta'), onClick: goEdit, primary: true }}
        />
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

  const showList = neighbors !== undefined
  let content: ReactNode
  if (isError && !showList) {
    content = (
      <ErrorState
        className="mt-4"
        title={t('neighbors.error')}
        tone="ma"
        onRetry={() => void refetch()}
        retrying={isFetching}
        fallback={{ label: t('neighbors.goBoard'), to: '/board' }}
      />
    )
  } else if (isPending) {
    content = loadingRows
  } else if (ranked.length === 0) {
    content = (
      <EmptyState
        className="mt-4"
        icon="neighbors"
        title={t('neighbors.empty')}
        body={t('neighbors.emptyBody')}
        action={{ label: t('neighbors.emptyAction'), to: '/board/new', icon: 'edit' }}
      />
    )
  } else {
    content = (
      <ul className="mt-1">
        {ranked.map(({ n }, i) => (
          <NeighborCard
            key={n.id ?? `n-${i}`}
            neighbor={n}
            regionsById={regionsById}
            viewerRegionId={viewer.region_id}
            last={i === ranked.length - 1}
          />
        ))}
      </ul>
    )
  }

  return (
    <section>
      <div className="flex min-h-11 items-center justify-between gap-3">
        {title}
        {showList && ranked.length > 0 ? (
          <span className="shrink-0 text-label text-ink-muted">
            {t('neighbors.count').replace('{n}', String(ranked.length))}
          </span>
        ) : null}
      </div>

      {/* 받아 둔 목록이 있는데 다시 읽기만 실패: 목록은 그대로 두고 작은 줄로 알린다 */}
      {isError && showList ? (
        <div className="mt-2 flex flex-wrap items-center gap-x-2">
          <p role="alert" className="flex min-w-0 flex-1 items-start gap-1.5 text-small text-danger">
            <Icon name="alert" size={18} className="mt-px shrink-0" />
            <span>{t('neighbors.error')}</span>
          </p>
          <Button
            variant="ghost"
            size="sm"
            tone="ma"
            icon="refresh"
            loading={isFetching}
            loadingLabel={t('state.retrying')}
            onClick={() => void refetch()}
          >
            {t('common.retry')}
          </Button>
        </div>
      ) : null}

      {content}

      <div className="mt-6 flex items-start gap-2.5 rounded-xl bg-surface px-3.5 py-3 text-small text-ink-body">
        <Icon name="lock" size={18} className="mt-0.5 shrink-0 text-ink-muted" />
        <p>{t('neighbors.privacyNote')}</p>
      </div>
    </section>
  )
}
