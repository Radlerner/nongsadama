import { Link } from 'react-router-dom'
import { useTranslation } from '../../i18n/useTranslation'
import { cn } from './cn'
import { Icon } from './Icon'
import { TONE_TEXT, type Tone } from './tone'

export interface SectionHeaderProps {
  title: string
  /** 기본 h2 */
  as?: 'h2' | 'h3'
  /** "전체 보기 >" 링크. label 기본 common.seeAll */
  seeAll?: { to: string; label?: string }
  /** 링크 색(영역 정체성). 기본 nong */
  tone?: Tone
  id?: string
  className?: string
}

/** 섹션 제목(키트 4.5): 19/26 800. 섹션끼리는 mt-8(32px) 간격. */
export function SectionHeader({ title, as: Tag = 'h2', seeAll, tone = 'nong', id, className }: SectionHeaderProps) {
  const { t } = useTranslation()
  if (!seeAll) {
    return (
      <Tag id={id} className={cn('mb-3 text-section text-ink', className)}>
        {title}
      </Tag>
    )
  }
  return (
    <div className={cn('mb-2 flex items-center justify-between gap-3', className)}>
      <Tag id={id} className="min-w-0 text-section text-ink">
        {title}
      </Tag>
      <Link
        to={seeAll.to}
        className={cn('-mr-1 flex h-11 shrink-0 items-center gap-0.5 whitespace-nowrap pl-2 text-label', TONE_TEXT[tone])}
      >
        {seeAll.label ?? t('common.seeAll')}
        <Icon name="chevron" size={18} strokeWidth={2} />
      </Link>
    </div>
  )
}
