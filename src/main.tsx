import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter } from 'react-router-dom'
import { App } from './App'
import { ErrorBoundary } from './components/ErrorBoundary'
import { I18nProvider } from './i18n/I18nContext'
import { SelectedRegionProvider } from './context/SelectedRegionContext'
import { AuthProvider } from './context/AuthContext'
import { AnalyticsListener } from './components/AnalyticsListener'
import { queryClient } from './lib/queryClient'
import './index.css'

const rootElement = document.getElementById('root')
if (!rootElement) {
  throw new Error('Root element #root not found in index.html')
}

// PWA 서비스워커(D-023): 프로덕션에서만 등록(dev는 HMR과 충돌·캐시 혼선 방지).
// scope=BASE_URL — GH Pages(/nongsadama/)와 루트 배포 모두 대응.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register(`${import.meta.env.BASE_URL}sw.js`, { scope: import.meta.env.BASE_URL })
      .catch(() => undefined) // 등록 실패는 앱 동작에 영향 없음(점진적 향상)
  })
}

// 배포 base(예: GitHub Pages의 '/nongsadama/')에 맞춰 라우터 basename을 설정한다.
// React Router는 trailing slash가 붙은 basename을 처리하지 못하므로 제거한다.
const routerBasename = import.meta.env.BASE_URL.replace(/\/+$/, '') || '/'

createRoot(rootElement).render(
  <StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
      <I18nProvider>
        <SelectedRegionProvider>
          <AuthProvider>
            <BrowserRouter basename={routerBasename}>
              <AnalyticsListener />
              <App />
            </BrowserRouter>
          </AuthProvider>
        </SelectedRegionProvider>
      </I18nProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  </StrictMode>,
)
