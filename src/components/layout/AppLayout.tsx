import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { BottomNav } from './BottomNav'
import { LanguageSwitcher } from './LanguageSwitcher'
import { OfflineBanner } from '../OfflineBanner'
import { useTranslation } from '../../i18n/useTranslation'

export function AppLayout() {
  const { t } = useTranslation()
  const location = useLocation()
  const navigate = useNavigate()
  // 10세 원칙: 뒤로 가기는 항상 화면 상단에(홈 제외). history가 없으면 홈으로.
  const showBack = location.pathname !== '/home'

  return (
    // 디자인 v1(DESIGN.md §1·§2): 크림 '종이' 그라운드 + 흰 카드 — 로고 세계관, 야외 시인성
    <div className="mx-auto flex min-h-screen max-w-screen-sm flex-col bg-brand-cream text-gray-900">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-black/5 bg-brand-cream px-2 py-2">
        <div className="flex items-center gap-1">
          {showBack ? (
            <button
              type="button"
              onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/home'))}
              aria-label={t('common.back')}
              className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md text-2xl text-gray-700"
            >
              ←
            </button>
          ) : null}
          <img
            src={`${import.meta.env.BASE_URL}favicon.png`}
            alt=""
            aria-hidden
            className="ml-1 h-6 w-6"
          />
          <span className="px-1 text-base font-extrabold tracking-tight text-green-800">
            {t('app.name')}
          </span>
        </div>
        <LanguageSwitcher />
      </header>
      <OfflineBanner />
      <main className="flex-1 px-4 py-4">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  )
}
