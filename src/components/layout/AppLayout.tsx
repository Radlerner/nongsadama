import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { BottomNav } from './BottomNav'
import { LanguageSwitcher } from './LanguageSwitcher'
import { OfflineBanner } from '../OfflineBanner'
import { useTranslation } from '../../i18n/useTranslation'
import { useStaleRegionCleanup } from '../../hooks/useRegions'
import { pageVariants } from '../../lib/motion'
import { ChevronLeft } from 'lucide-react'

export function AppLayout() {
  const { t } = useTranslation()
  const location = useLocation()
  const navigate = useNavigate()
  // v1.1(D-033): 비활성·삭제된 지역 id가 localStorage에 남아 조용히 '전체 범위'가 되지 않도록 정리
  useStaleRegionCleanup()
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
              <ChevronLeft size={26} strokeWidth={2.25} />
            </button>
          ) : null}
          {/* v1.1: 로고+브랜드 영역 전체가 홈(/home) 링크 — 앱 셸의 홈은 /home(BottomNav·뒤로가기 폴백과 동일).
              전체 새로고침 없는 SPA 이동을 위해 anchor 대신 Link. 44px 터치 높이·포커스 링(접근성). */}
          <Link
            to="/home"
            aria-label={`${t('app.name')} · ${t('nav.home')}`}
            className="flex min-h-[44px] cursor-pointer items-center rounded-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-green-700"
          >
            <img
              src={`${import.meta.env.BASE_URL}favicon.png`}
              alt=""
              aria-hidden
              className="ml-1 h-6 w-6"
            />
            <span className="px-1 text-base font-extrabold tracking-tight text-green-800">
              {t('app.name')}
            </span>
          </Link>
        </div>
        <LanguageSwitcher />
      </header>
      <OfflineBanner />
      <main className="flex-1 px-4 py-4">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={location.pathname}
            variants={pageVariants}
            initial="hidden"
            animate="show"
            exit="exit"
          >
            <Outlet />
          </motion.div>
        </AnimatePresence>
      </main>
      <BottomNav />
    </div>
  )
}
