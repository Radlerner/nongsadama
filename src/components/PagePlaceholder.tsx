import type { ReactNode } from 'react'

interface PagePlaceholderProps {
  title: string
  message: string
  children?: ReactNode
}

/**
 * v0.1.0 골격용 화면 틀. 제목과 빈 상태 메시지를 보여준다.
 * 실제 데이터 목록/상세는 후속 작업에서 이 자리를 대체한다.
 * 디자인 v5: 화면 제목(22/30 800) + 1px 선 카드 안 한 줄(그림자 없음).
 */
export function PagePlaceholder({ title, message, children }: PagePlaceholderProps) {
  return (
    <section>
      <h1 className="text-title text-ink">{title}</h1>
      <p className="mt-4 rounded-xl border border-line px-5 py-8 text-center text-body text-ink-muted">{message}</p>
      {children}
    </section>
  )
}
