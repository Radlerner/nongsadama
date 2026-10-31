import { Link, useParams } from 'react-router-dom'
import { useTranslation } from '../i18n/useTranslation'
import { useFarmTip } from '../hooks/useFarmTips'
import { localizedContent } from '../lib/localizedContent'
import { isTtsAvailable, speak } from '../lib/tts'
import { FreshnessBadge } from '../components/FreshnessBadge'
import {
  EmptyState,
  ErrorState,
  Icon,
  LoadingState,
  Skeleton,
  SkeletonBlock,
  buttonClasses,
} from '../components/ui'

/** 🌾 농사 도움 상세 — 비로그인·TTS 읽어주기(저문해력, PRD v1.5 §1 원칙 재사용). 디자인 v5: 생활정보 상세와 같은 틀. */
export function FarmTipDetail() {
  const { t, locale } = useTranslation()
  const { tipId } = useParams()
  const { data: tip, isLoading, isError, refetch, isFetching, fetchStatus } = useFarmTip(tipId)
  // 오프라인이면 첫 조회가 멈춘 채(paused) 기다린다: "찾을 수 없어요"가 아니라 연결 대기로 보여 준다
  const waitingNetwork = fetchStatus === 'paused' && tip === undefined

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
        <LoadingState variant="inline" label={t('farm.loading')} className="mt-4">
          <Skeleton variant="lines" count={5} className="mt-3" />
        </LoadingState>
      </div>
    )
  }

  // 무언 실패 금지(재검수 P1-2): 네트워크 오류를 "정보 없음"으로 오표시하지 않는다.
  if (isError) {
    return (
      <ErrorState
        title={t('farm.error')}
        onRetry={() => void refetch()}
        retrying={isFetching}
        fallback={{ label: t('farm.back'), to: '/farm' }}
      />
    )
  }

  if (!tip) {
    return (
      <EmptyState
        icon="search"
        title={t('lifeInfoDetail.empty')}
        body={t('lifeInfoDetail.notFoundBody')}
        action={{ label: t('farm.back'), to: '/farm', icon: 'sprout' }}
      />
    )
  }

  const c = localizedContent(tip.localized_content, locale)

  return (
    <article className="anim-fade flex flex-col">
      <header>
        <div className="flex items-start gap-3">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-surface text-nong-600">
            <Icon name="sprout" size={28} strokeWidth={2} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-caption text-ink-muted">
              {t('farm.title')}
              {tip.crop_type ? ` · ${tip.crop_type}` : ''}
            </p>
            <h1 className="break-words text-title text-ink">{c.name}</h1>
          </div>
        </div>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          {/* verified_at 검수 모델 표시(재검수 P2-5) — life_info와 같은 표시·어휘 */}
          <FreshnessBadge verifiedAt={tip.verified_at} />
          {isTtsAvailable() ? (
            <button
              type="button"
              onClick={() => speak(`${c.name}. ${c.description}`, locale)}
              className={buttonClasses({ variant: 'secondary', size: 'sm' })}
            >
              <Icon name="speaker" size={18} strokeWidth={2} />
              {t('talk.readAloud')}
            </button>
          ) : null}
        </div>
      </header>

      {c.description ? (
        <p className="mt-5 whitespace-pre-line text-body text-ink-body">{c.description}</p>
      ) : null}

      <div className="mt-6 rounded-xl border border-line px-4 py-3">
        <p className="flex items-start gap-2.5 text-small text-ink-body">
          <Icon name="info" size={20} className="mt-px text-ink-muted" />
          <span className="min-w-0 flex-1">{t('farm.sourceNotice')}</span>
        </p>
        {tip.source_url ? (
          // wrap: 긴 번역(mn·ru)은 카드 안에서 줄을 바꾼다. wrap이 넣는 text-center가 CSS에서 뒤에 오므로 !text-left로 왼쪽 정렬
          <a
            href={tip.source_url}
            target="_blank"
            rel="noopener noreferrer"
            className={buttonClasses({ variant: 'ghost', size: 'sm', wrap: true, className: 'ml-5 mt-1 !text-left' })}
          >
            <Icon name="external" size={18} strokeWidth={2} />
            {t('farm.source')}
          </a>
        ) : null}
      </div>

      <div className="mt-6">
        <Link to="/farm" className={buttonClasses({ variant: 'ghost', size: 'sm', className: '-ml-3' })}>
          <Icon name="sprout" size={18} strokeWidth={2} />
          {t('farm.back')}
        </Link>
      </div>
    </article>
  )
}
