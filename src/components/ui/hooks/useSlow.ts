import { useEffect, useState } from 'react'

/** 느린 연결 안내를 띄우기까지 기다리는 시간(ms). */
export const SLOW_AFTER_MS = 8000

/**
 * active가 켜진 채로 ms가 지나면 true. active가 꺼지면 즉시 false로 돌아간다.
 * 예: const slow = useSlow(query.isLoading)
 */
export function useSlow(active: boolean, ms: number = SLOW_AFTER_MS): boolean {
  const [slow, setSlow] = useState(false)
  useEffect(() => {
    if (!active) {
      setSlow(false)
      return
    }
    const id = window.setTimeout(() => setSlow(true), ms)
    return () => window.clearTimeout(id)
  }, [active, ms])
  return active && slow
}
