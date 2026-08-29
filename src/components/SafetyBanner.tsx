import { useTranslation } from '../i18n/useTranslation'
import { LifeBuoy, Phone, Users, type LucideIcon } from './ui/icons'

/**
 * 상시 도움 배너 (PRD v1.5 §3.2-1, 협상 불가 완료 조건).
 * 라우터의 모든 결과 경로에 노출 — 사용자가 어떤 선택을 해도 전문 도움 경로가 항상 보인다.
 * 큰 전화 버튼(56px+), 아이콘+색 병행.
 */
export function SafetyBanner() {
  const { t } = useTranslation()
  const items = [
    { icon: LifeBuoy as LucideIcon, tel: '1345', labelKey: 'safety.call1345' },
    { icon: Phone as LucideIcon, tel: '112', labelKey: 'safety.call112' },
    { icon: Users as LucideIcon, tel: '1577-1366', labelKey: 'safety.call1366' },
  ]
  return (
    <aside className="rounded-md border border-amber-300 bg-amber-50 px-3 py-3">
      <p className="mb-2 text-xs font-semibold text-amber-900">{t('safety.title')}</p>
      <div className="flex flex-col gap-2">
        {items.map((it) => (
          <a
            key={it.tel}
            href={`tel:${it.tel}`}
            className="flex min-h-[56px] items-center gap-3 rounded-md bg-white px-3 text-sm font-semibold text-amber-900 shadow-sm"
          >
            <it.icon aria-hidden size={22} strokeWidth={2.25} className="shrink-0 text-amber-700" />
            <span>
              {t(it.labelKey)} <span className="font-bold">{it.tel}</span>
            </span>
          </a>
        ))}
      </div>
    </aside>
  )
}
