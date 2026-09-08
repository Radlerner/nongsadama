import { useEffect } from 'react'

/**
 * 화면 전용 문서 제목을 설정하고, 떠날 때 원래 제목(index.html 공통 제목)으로 되돌린다.
 * 공개 법적 페이지(/privacy·/delete-account·/child-safety)처럼 탭·북마크·심사 스크린샷에
 * 페이지 제목이 그대로 보여야 하는 곳에서 쓴다(재검수 P2 — SPA 공통 제목 노출).
 */
export function useDocumentTitle(title: string): void {
  useEffect(() => {
    if (typeof document === 'undefined') return
    const previous = document.title
    document.title = title
    return () => {
      document.title = previous
    }
  }, [title])
}
