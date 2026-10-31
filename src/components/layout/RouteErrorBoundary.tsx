import { Component, useEffect, type ReactNode } from 'react'
import { useTranslation } from '../../i18n/useTranslation'
import { ErrorState } from '../ui/ErrorState'

/**
 * /home(지도) 지연 청크 전용 오류 경계(설명 문구는 ErrorState 기본값: 오프라인이면 common.offline).
 * import('./pages/MapHome')가 실패하면(청크를 받기 전에 오프라인 · 배포 뒤 옛 해시) 최상위 ErrorBoundary가
 * 앱 전체를 덮지 않도록 AppLayout의 Outlet 안에서 잡는다 → 헤더 · 오프라인 배너 · 하단 탭은 그대로 남는다.
 * 다시 시도는 전체 새로고침이다: React.lazy는 실패한 promise를 기억하고, 브라우저도 실패한 모듈을 기억할 수 있으며,
 * 배포 뒤 새 해시는 새로고침해야만 받는다. /home을 떠나면 언마운트되므로 따로 초기화하지 않는다.
 */
interface Props {
  children: ReactNode
}
interface State {
  failed: boolean
}

export class RouteErrorBoundary extends Component<Props, State> {
  state: State = { failed: false }

  static getDerivedStateFromError(): State {
    return { failed: true }
  }

  componentDidCatch(error: unknown) {
    console.error('[nongsadama] route chunk failed:', error)
  }

  render() {
    if (this.state.failed) return <HomeChunkError />
    return this.props.children
  }
}

function HomeChunkError() {
  const { t } = useTranslation()

  // 오프라인이라 실패했다면, 다시 연결되는 순간 한 번 새로고침해 지도를 다시 받는다.
  useEffect(() => {
    const onOnline = () => window.location.reload()
    window.addEventListener('online', onOnline, { once: true })
    return () => window.removeEventListener('online', onOnline)
  }, [])

  return (
    // /home의 main에는 여백이 없어서 여기서 준다.
    <div className="px-5 pt-6">
      <ErrorState
        title={t('state.mapError')}
        onRetry={() => window.location.reload()}
        fallback={{ label: t('map.listView'), to: '/life-info' }}
      />
    </div>
  )
}
