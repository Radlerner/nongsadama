import type { ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { EntryHeader } from '../layout/EntryHeader'
import { buttonClasses, cn, Icon } from '../ui'

/*
 * 공개 법적 페이지(/privacy · /delete-account · /child-safety)의 v5 틀. 문안은 각 페이지가 그대로 갖고,
 * 여기서는 모양만 정한다: 흰 바탕, 앱 셸 밖 머리줄(뒤로 + 원본 로고, 언어 버튼 없음 — 한·영 정적 병기),
 * 읽기 좋은 긴 글(본문 16/25, 구역 제목 19/26 800, 좌우 20px, 구역 사이 32px), 그림자 없는 1px 선 카드.
 */

/** 문장 안 링크: 굵은 초록 밑줄. 위아래 안쪽 여백으로 누르는 높이만 44px 넘게 키운다(줄 간격은 그대로). */
export const LEGAL_INLINE_LINK =
  'rounded-sm py-3.5 font-bold text-nong-600 underline underline-offset-2 [overflow-wrap:anywhere]'

export function LegalPage({ children }: { children: ReactNode }) {
  const navigate = useNavigate()
  return (
    <div className="mx-auto flex min-h-app max-w-screen-sm flex-col bg-white text-ink">
      <EntryHeader
        language={false}
        logoTo="/"
        onBack={() => (window.history.length > 1 ? navigate(-1) : navigate('/'))}
      />
      <main className="flex-1 px-5 pb-[calc(32px+var(--safe-bottom))] pt-3">{children}</main>
    </div>
  )
}

/** 화면 제목(22/30 800) + 아래 메타(13/19) */
export function LegalTitle({ title, meta }: { title: ReactNode; meta?: ReactNode }) {
  return (
    <>
      <h1 className="text-title text-ink">{title}</h1>
      {meta ? <p className="mt-1 text-caption text-ink-muted">{meta}</p> : null}
    </>
  )
}

/** 본문 구역: 제목(h2 또는 h3) + 16/25 문단들(사이 12px). boxed = 1px 선 카드 */
export function LegalSection({
  id,
  title,
  icon,
  as: Heading = 'h2',
  boxed = false,
  first = false,
  lang,
  children,
}: {
  id?: string
  title?: ReactNode
  icon?: 'trash' | 'shield' | 'mail'
  as?: 'h2' | 'h3'
  boxed?: boolean
  /** 묶음 안 첫 카드(위 여백을 줄인다) */
  first?: boolean
  lang?: string
  children: ReactNode
}) {
  return (
    <section
      id={id}
      lang={lang}
      className={boxed ? cn('rounded-xl border border-line px-4 py-4', first ? 'mt-3' : 'mt-4') : 'mt-8'}
    >
      {title ? (
        <Heading
          className={cn('flex items-start gap-2 text-ink', Heading === 'h2' ? 'text-section' : 'text-body font-bold')}
        >
          {icon ? <Icon name={icon} size={22} className="mt-0.5 shrink-0 text-ink" /> : null}
          <span>{title}</span>
        </Heading>
      ) : null}
      <div className={cn('flex flex-col gap-3 text-body text-ink-body', title ? 'mt-2' : null)}>{children}</div>
    </section>
  )
}

/** 언어 묶음 제목(한국어 / English) */
export function LegalLangHeading({ children }: { children: ReactNode }) {
  return <h2 className="mt-8 text-section text-ink">{children}</h2>
}

export function LegalBullets({ children, ordered = false }: { children: ReactNode; ordered?: boolean }) {
  return ordered ? (
    <ol className="flex list-decimal flex-col gap-2 pl-5 marker:font-bold marker:text-ink-muted">{children}</ol>
  ) : (
    <ul className="flex list-disc flex-col gap-1.5 pl-5 marker:text-ink-muted">{children}</ul>
  )
}

/** 강조(굵게, 제목 색) */
export function Strong({ children }: { children: ReactNode }) {
  return <strong className="font-bold text-ink">{children}</strong>
}

/** 맨 아래 홈으로(보조 버튼, 48px) */
export function LegalHomeLink({ children }: { children: ReactNode }) {
  return (
    <Link to="/" className={buttonClasses({ variant: 'secondary', fullWidth: true, wrap: true, className: 'mt-8' })}>
      <Icon name="back" size={20} strokeWidth={2} className="shrink-0" />
      {children}
    </Link>
  )
}
