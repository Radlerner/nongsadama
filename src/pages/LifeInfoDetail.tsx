import { useState, type ReactNode } from 'react'
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
import { kakaoDirectionsUrl } from '../lib/kakaoMap'
import {
  CategoryGlyph,
  EmptyState,
  ErrorState,
  Icon,
  IconButton,
  LoadingState,
  Skeleton,
  SkeletonBlock,
  Toast,
  buttonClasses,
  type IconName,
} from '../components/ui'

/** 정보 한 줄(키트 4.7 모양): 40px 아이콘 타일 + 이름표 + 값 + (선택) 오른쪽 버튼. */
function InfoRow({
  icon,
  label,
  children,
  aside,
}: {
  icon: IconName
  label: string
  children: ReactNode
  aside?: ReactNode
}) {
  return (
    <li className="flex min-h-16 items-center gap-3 border-b border-line py-2.5 last:border-b-0">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-surface text-ink-body">
        <Icon name={icon} size={22} />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-caption text-ink-muted">{label}</span>
        <span className="break-words text-body text-ink">{children}</span>
      </span>
      {aside}
    </li>
  )
}

/** 안내 한 줄(흰 바탕 + 1px 선, 색 면 없음). */
function Note({ icon, children }: { icon: IconName; children: ReactNode }) {
  return (
    <p className="flex items-start gap-2.5 rounded-xl border border-line px-4 py-3 text-small text-ink-body">
      <Icon name={icon} size={20} className="mt-px text-ink-muted" />
      <span className="min-w-0 flex-1">{children}</span>
    </p>
  )
}

export function LifeInfoDetail() {
  const { t, locale } = useTranslation()
  const { infoId } = useParams()
  const { data: item, isLoading, isError, refetch, isFetching, fetchStatus } = useLifeInfoItem(infoId)
  const { data: regions } = useRegions()
  // at: 같은 안내를 다시 띄울 때 Toast의 닫힘 타이머를 새로 시작한다(showKey)
  const [toast, setToast] = useState<{ message: string; ok: boolean; at: number } | null>(null)
  // 오프라인이면 첫 조회가 멈춘 채(paused) 기다린다: "찾을 수 없어요"가 아니라 "연결되면 불러와요"로 보여 준다
  const waitingNetwork = fetchStatus === 'paused' && item === undefined

  if (isLoading || waitingNetwork) {
    return (
      <div>
        <div className="flex items-start gap-3">
          <SkeletonBlock className="h-12 w-12 shrink-0 rounded-xl" />
          <span className="flex-1 pt-1">
            <SkeletonBlock className="h-3.5 w-[30%] rounded-full" />
            <SkeletonBlock className="mt-3 h-5 w-[70%] rounded-full" />
          </span>
        </div>
        <LoadingState
          variant="inline"
          label={t('lifeInfoDetail.loading')}
          offlineLabel={t('lifeInfo.waitingNetwork')}
          className="mt-4"
        >
          <Skeleton variant="lines" count={4} className="mt-3" />
        </LoadingState>
      </div>
    )
  }

  // 무언 실패 금지: 네트워크 오류를 "정보 없음"으로 오표시하지 않는다.
  if (isError) {
    return (
      <ErrorState
        title={t('lifeInfo.error')}
        onRetry={() => void refetch()}
        retrying={isFetching}
        fallback={{ label: t('lifeInfoDetail.back'), to: '/life-info' }}
      />
    )
  }

  if (!item) {
    return (
      <EmptyState
        icon="search"
        title={t('lifeInfoDetail.empty')}
        body={t('lifeInfoDetail.notFoundBody')}
        action={{ label: t('lifeInfoDetail.back'), to: '/life-info', icon: 'list' }}
      />
    )
  }

  const { name, description } = localizedContent(item.localized_content, locale)
  const region = (regions ?? []).find((r) => r.id === item.region_id)
  const regionName = region ? regionLabel(region.id, region.names, locale) : ''
  const displayName = name || t('lifeInfo.untitled')
  const hasCoords = item.latitude != null && item.longitude != null
  const stale =
    freshnessOf(
      item.verified_at,
      new Date(),
      item.category === 'support' ? STALE_AFTER_MONTHS_SUPPORT : undefined,
    ).kind !== 'fresh'

  const copyAddress = async (address: string) => {
    try {
      if (!navigator.clipboard) throw new Error('clipboard-unavailable')
      await navigator.clipboard.writeText(address)
      setToast({ message: t('lifeInfoDetail.copied'), ok: true, at: Date.now() })
    } catch {
      setToast({ message: t('lifeInfoDetail.copyFailed'), ok: false, at: Date.now() })
    }
  }

  return (
    <article className="anim-fade flex flex-col">
      <header>
        <div className="flex items-start gap-3">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-surface">
            <CategoryGlyph category={item.category} size={28} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-caption text-ink-muted">
              {t(categoryLabelKey(item.category))}
              {regionName ? ` · ${regionName}` : ''}
            </p>
            <h1 className="break-words text-title text-ink">{displayName}</h1>
          </div>
        </div>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          <FreshnessBadge
            verifiedAt={item.verified_at}
            staleAfterMonths={item.category === 'support' ? STALE_AFTER_MONTHS_SUPPORT : undefined}
          />
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
              className={buttonClasses({ variant: 'secondary', size: 'sm' })}
            >
              <Icon name="speaker" size={18} strokeWidth={2} />
              {t('talk.readAloud')}
            </button>
          ) : null}
        </div>
      </header>

      {item.category === 'support' ? (
        <div className="mt-5">
          <SafetyBanner />
        </div>
      ) : null}

      {stale ? (
        <div className="mt-4">
          <Note icon="clock">{t('lifeInfoDetail.freshnessNotice')}</Note>
        </div>
      ) : null}

      {description ? (
        <p className="mt-5 whitespace-pre-line text-body text-ink-body">{description}</p>
      ) : null}

      <section className="mt-6" aria-label={t('lifeInfoDetail.contact')}>
        {item.phone ? (
          // 전화 링크는 숫자와 +만(표기용 '-'·공백 제거, main v1.4)
          <a href={`tel:${item.phone.replace(/[^0-9+]/g, '')}`} className={buttonClasses({ fullWidth: true })}>
            <Icon name="phone" size={20} strokeWidth={2} />
            {t('lifeInfoDetail.call')} {item.phone}
          </a>
        ) : null}

        {item.address || item.opening_hours || item.language_support ? (
          <ul className="mt-2">
            {item.address ? (
              <InfoRow
                icon="pin"
                label={t('lifeInfoDetail.address')}
                aside={
                  <IconButton
                    icon="copy"
                    iconSize={20}
                    label={t('lifeInfoDetail.copyAddress')}
                    onClick={() => void copyAddress(item.address as string)}
                    className="-mr-2 text-ink-body"
                  />
                }
              >
                {item.address}
              </InfoRow>
            ) : null}
            {item.opening_hours ? (
              <InfoRow icon="clock" label={t('lifeInfoDetail.hours')}>
                {item.opening_hours}
              </InfoRow>
            ) : null}
            {item.language_support ? (
              <InfoRow icon="translate" label={t('lifeInfoDetail.languages')}>
                {item.language_support}
              </InfoRow>
            ) : null}
          </ul>
        ) : null}

        {hasCoords ? (
          <div className="mt-3">
            <a
              href={kakaoDirectionsUrl(displayName, item.latitude as number, item.longitude as number)}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonClasses({ variant: item.phone ? 'secondary' : 'primary', fullWidth: true })}
            >
              <Icon name="navigate" size={20} strokeWidth={2} />
              {t('map.directions')}
            </a>
            <p className="mt-2 text-center text-caption text-ink-muted">{t('map.directionsNote')}</p>
          </div>
        ) : null}

        {!item.phone && !item.address ? (
          <p className="text-small text-ink-muted">{t('lifeInfoDetail.noContact')}</p>
        ) : null}
      </section>

      {item.verified_at || item.source_url ? (
        <section className="mt-6 flex flex-wrap items-center gap-x-3 text-caption text-ink-muted">
          {item.verified_at ? (
            <p>
              {t('lifeInfoDetail.verifiedAt')}: {item.verified_at}
            </p>
          ) : null}
          {item.source_url ? (
            <a
              href={item.source_url}
              target="_blank"
              rel="noreferrer"
              className={buttonClasses({ variant: 'ghost', size: 'sm', className: '-ml-3' })}
            >
              <Icon name="document" size={18} strokeWidth={2} />
              {t('lifeInfoDetail.source')}
            </a>
          ) : null}
        </section>
      ) : null}

      <div className="mt-4">
        <Note icon="info">{t('lifeInfoDetail.visitNotice')}</Note>
      </div>

      <div className="mt-6">
        <Link to="/life-info" className={buttonClasses({ variant: 'ghost', size: 'sm', className: '-ml-3' })}>
          <Icon name="list" size={18} strokeWidth={2} />
          {t('lifeInfoDetail.back')}
        </Link>
      </div>

      <Toast
        open={toast !== null}
        message={toast?.message ?? ''}
        icon={toast?.ok === false ? 'alert' : 'check'}
        showKey={toast?.at}
        onClose={() => setToast(null)}
      />
    </article>
  )
}
