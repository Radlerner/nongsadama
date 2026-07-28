import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter } from 'react-router-dom'
import { App } from './App'
import { I18nProvider } from './i18n/I18nContext'
import { SelectedRegionProvider } from './context/SelectedRegionContext'
import { AuthProvider } from './context/AuthContext'
import { queryClient } from './lib/queryClient'
import './index.css'

const rootElement = document.getElementById('root')
if (!rootElement) {
  throw new Error('Root element #root not found in index.html')
}

// 배포 base(예: GitHub Pages의 '/nongsadama/')에 맞춰 라우터 basename을 설정한다.
// React Router는 trailing slash가 붙은 basename을 처리하지 못하므로 제거한다.
const routerBasename = import.meta.env.BASE_URL.replace(/\/+$/, '') || '/'

createRoot(rootElement).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <I18nProvider>
        <SelectedRegionProvider>
          <AuthProvider>
            <BrowserRouter basename={routerBasename}>
              <App />
            </BrowserRouter>
          </AuthProvider>
        </SelectedRegionProvider>
      </I18nProvider>
    </QueryClientProvider>
  </StrictMode>,
)
