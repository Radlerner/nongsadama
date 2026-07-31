import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { initAnalytics, trackPageView } from '../lib/analytics'

/**
 * 모든 페이지 방문 측정: 초기 로드 1회 init 후, 라우트(pathname/search) 변경마다
 * page_view를 전송한다. 측정 ID가 없는 빌드(로컬 dev)에서는 아무것도 하지 않는다.
 */
export function AnalyticsListener() {
  const location = useLocation()

  useEffect(() => {
    initAnalytics()
  }, [])

  useEffect(() => {
    trackPageView()
  }, [location.pathname, location.search])

  return null
}
