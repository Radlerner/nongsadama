import { Outlet } from 'react-router-dom'
import { BottomNav } from './BottomNav'
import { LanguageSwitcher } from './LanguageSwitcher'
import { useTranslation } from '../../i18n/useTranslation'

export function AppLayout() {
  const { t } = useTranslation()

  return (
    <div className="mx-auto flex min-h-screen max-w-screen-sm flex-col bg-white text-gray-900">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-200 bg-white px-4 py-3">
        <span className="text-base font-semibold text-green-700">{t('app.name')}</span>
        <LanguageSwitcher />
      </header>
      <main className="flex-1 px-4 py-4">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  )
}
