import { freshnessOf } from '../lib/freshness'
import { useTranslation } from '../i18n/useTranslation'
import { Icon } from './ui/Icon'
import { cn } from './ui/cn'

/**
 * 생활정보 신선도 표시(디자인 v5: 13px 메타 글자 + 작은 아이콘, 색 면 없음).
 * 최근 확인 = 초록 체크, 확인일 없음/오래됨 = 회색 시계. 글자는 늘 함께 보인다(색만으로 구분하지 않음).
 * (지금의 시딩 샘플은 verified_at이 없어 "확인 날짜 없음"이 그대로 드러난다 — 의도됨)
 */
export function FreshnessBadge({
  verifiedAt,
  staleAfterMonths,
  className,
}: {
  verifiedAt: string | null
  staleAfterMonths?: number
  className?: string
}) {
  const { t } = useTranslation()
  const f = freshnessOf(verifiedAt, new Date(), staleAfterMonths)
  const label =
    f.kind === 'unverified'
      ? t('lifeInfo.freshness.unverified')
      : f.months === 0
        ? t('lifeInfo.freshness.thisMonth')
        : t('lifeInfo.freshness.monthsAgo').replace('{n}', String(f.months))
  const fresh = f.kind === 'fresh'
  return (
    <span className={cn('inline-flex items-center gap-1 whitespace-nowrap text-caption text-ink-muted', className)}>
      <Icon
        name={fresh ? 'check' : 'clock'}
        size={14}
        strokeWidth={2}
        className={fresh ? 'text-nong-600' : 'text-ink-muted'}
      />
      {label}
    </span>
  )
}
