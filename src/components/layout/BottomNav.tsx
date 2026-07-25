import { NavLink } from 'react-router-dom'
import { useTranslation } from '../../i18n/useTranslation'

interface NavItem {
  to: string
  labelKey: string
}

const NAV_ITEMS: NavItem[] = [
  { to: '/home', labelKey: 'nav.home' },
  { to: '/board', labelKey: 'nav.board' },
  { to: '/life-info', labelKey: 'nav.lifeInfo' },
  { to: '/profile', labelKey: 'nav.profile' },
]

export function BottomNav() {
  const { t } = useTranslation()

  return (
    <nav
      className="sticky bottom-0 z-10 border-t border-gray-200 bg-white"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <ul className="mx-auto flex max-w-screen-sm">
        {NAV_ITEMS.map((item) => (
          <li key={item.to} className="flex-1">
            <NavLink
              to={item.to}
              className={({ isActive }) =>
                [
                  'flex h-14 min-h-[44px] items-center justify-center text-sm',
                  isActive ? 'font-semibold text-green-700' : 'text-gray-500',
                ].join(' ')
              }
            >
              {t(item.labelKey)}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
