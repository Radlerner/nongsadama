// 생활정보 신선도 판정 (PRD 6.3 "출처와 최종 확인일 표시" 보강).
// verified_at(date)로부터 경과 개월을 계산해 오래된/미검수 정보를 사용자에게 드러낸다.

export type Freshness =
  | { kind: 'unverified' }
  | { kind: 'fresh'; months: number }
  | { kind: 'stale'; months: number }

/** 이 개월 수 이상 지난 확인일은 "오래됨"으로 표시한다. */
export const STALE_AFTER_MONTHS = 6
/** 상담기관(support)은 위기 자원이므로 더 짧게 본다(PRD v1.5 §6). */
export const STALE_AFTER_MONTHS_SUPPORT = 3

export function freshnessOf(
  verifiedAt: string | null,
  now: Date = new Date(),
  staleAfterMonths: number = STALE_AFTER_MONTHS,
): Freshness {
  if (!verifiedAt) return { kind: 'unverified' }
  const d = new Date(`${verifiedAt}T00:00:00`)
  if (Number.isNaN(d.getTime())) return { kind: 'unverified' }
  const months =
    (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth())
  const m = Math.max(0, months)
  return m >= staleAfterMonths ? { kind: 'stale', months: m } : { kind: 'fresh', months: m }
}
