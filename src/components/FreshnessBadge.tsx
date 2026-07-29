import { freshnessOf } from '../lib/freshness'
import { useTranslation } from '../i18n/useTranslation'

/**
 * 생활정보 신선도 배지. 확인일 미기재/오래됨은 경고색, 최근 확인은 중립색으로 표시한다.
 * (지금의 시딩 샘플은 verified_at이 없어 "검수 확인일 없음" 경고가 그대로 드러난다 — 의도됨)
 */
export function FreshnessBadge({
  verifiedAt,
  staleAfterMonths,
}: {
  verifiedAt: string | null
  staleAfterMonths?: number
}) {
  const { t } = useTranslation()
  const f = freshnessOf(verifiedAt, new Date(), staleAfterMonths)
  const label =
    f.kind === 'unverified'
      ? t('lifeInfo.freshness.unverified')
      : f.months === 0
        ? t('lifeInfo.freshness.thisMonth')
        : t('lifeInfo.freshness.monthsAgo').replace('{n}', String(f.months))
  const warn = f.kind !== 'fresh'
  return (
    <span
      className={[
        'inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium',
        warn ? 'bg-amber-100 text-amber-800' : 'bg-gray-100 text-gray-600',
      ].join(' ')}
    >
      {label}
    </span>
  )
}
