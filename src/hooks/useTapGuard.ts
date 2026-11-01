import { useCallback, useLayoutEffect, useRef } from 'react'
import { TAP_GUARD_MS } from '../components/ui/BottomSheet'

/**
 * 버튼 자리의 내용이 바뀐 직후(늦게 온 데이터)의 탭을 무시한다(v1.4 탭 보호 규칙, D-047).
 * 다른 것을 누르려던 손가락이 "저장"·"내 지역으로"를 누르지 않게 한다. 화면을 그리기 전에 시각을 잡는다.
 */
export function useTapGuard(contentKey: string) {
  const changedAt = useRef(0)
  useLayoutEffect(() => {
    changedAt.current = Date.now()
  }, [contentKey])
  return useCallback(
    (fn: () => void) => () => {
      if (Date.now() - changedAt.current < TAP_GUARD_MS) return
      fn()
    },
    [],
  )
}
