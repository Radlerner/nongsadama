import { useTranslation } from '../i18n/useTranslation'
import { Icon } from './ui/Icon'

/**
 * 상시 도움 배너 (PRD v1.5 §3.2-1, 협상 불가 완료 조건).
 * 라우터의 모든 결과 경로에 노출 — 사용자가 어떤 선택을 해도 전문 도움 경로가 항상 보인다.
 * 큰 전화 버튼(56px+), 아이콘+글자 병행. 디자인 v5: 흰 카드 + 1px 선, 줄은 surface 면, 그림자 없음.
 */
export function SafetyBanner() {
  const { t } = useTranslation()
  const items = [
    { tel: '1345', labelKey: 'safety.call1345', urgent: false },
    { tel: '112', labelKey: 'safety.call112', urgent: true },
    { tel: '1577-1366', labelKey: 'safety.call1366', urgent: false },
  ]
  return (
    <aside className="rounded-xl border border-line bg-white p-3">
      <p className="flex items-center gap-2 px-1 pb-2 pt-0.5 text-small font-bold text-ink">
        <Icon name="shield" size={20} className="text-nong-600" />
        {t('safety.title')}
      </p>
      <div className="flex flex-col gap-2">
        {items.map((it) => (
          <a
            key={it.tel}
            href={`tel:${it.tel}`}
            className="flex min-h-[56px] items-center gap-3 rounded-xl bg-surface px-3 py-2 text-ink no-underline hover:bg-surface-2 active:bg-surface-2"
          >
            <span
              className={[
                'flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white',
                it.urgent ? 'text-danger' : 'text-nong-600',
              ].join(' ')}
            >
              <Icon name="phone" size={20} />
            </span>
            <span className="min-w-0 flex-1 text-small">{t(it.labelKey)}</span>
            <span className="shrink-0 whitespace-nowrap text-label text-ink">{it.tel}</span>
          </a>
        ))}
      </div>
    </aside>
  )
}
