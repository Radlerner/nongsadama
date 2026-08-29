import type { ReactNode } from 'react'

interface PagePlaceholderProps {
  title: string
  message: string
  children?: ReactNode
}

/**
 * v0.1.0 골격용 화면 틀. 제목과 빈 상태 메시지를 보여준다.
 * 실제 데이터 목록/상세는 후속 작업에서 이 자리를 대체한다.
 */
export function PagePlaceholder({ title, message, children }: PagePlaceholderProps) {
  return (
    <section>
      <h1 className="mb-4 text-xl font-extrabold tracking-tight">{title}</h1>
      <p className="rounded-card bg-white/70 px-4 py-8 text-center text-sm text-gray-500">
        {message}
      </p>
      {children}
    </section>
  )
}
