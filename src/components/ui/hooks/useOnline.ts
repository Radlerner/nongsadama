import { useEffect, useState } from 'react'

/**
 * 지금 인터넷에 붙어 있는지(navigator.onLine + window 'online'/'offline' 이벤트).
 * 예: const online = useOnline() → 오프라인이면 "연결되면 불러와요"로 보여 주고, 돌아오면 다시 시도.
 */
export function useOnline(): boolean {
  const [online, setOnline] = useState(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true,
  )
  useEffect(() => {
    const on = () => setOnline(true)
    const off = () => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    // 첫 렌더와 구독 사이에 바뀌었을 수 있다
    setOnline(navigator.onLine)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
    }
  }, [])
  return online
}
