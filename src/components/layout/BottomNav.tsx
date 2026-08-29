import { NavLink } from 'react-router-dom'
import { useTranslation } from '../../i18n/useTranslation'

interface NavItem {
  to: string
  labelKey: string
  icon: string
  center?: boolean
}

// v1.5 §2: 5탭 — 중앙 🎤 말하기를 크게 강조(포켓몬고식 중앙 버튼). 아이콘+텍스트 병행.
const NAV_ITEMS: NavItem[] = [
  { to: '/home', labelKey: 'nav.home', icon: '🗺️' },
  { to: '/board', labelKey: 'nav.board', icon: '💬' },
  { to: '/talk', labelKey: 'nav.talk', icon: '🎤', center: true },
  { to: '/neighbors', labelKey: 'nav.neighbors', icon: '👥' },
  { to: '/profile', labelKey: 'nav.profile', icon: '👤' },
]

export function BottomNav() {
  const { t } = useTranslation()

  return (
    <nav
      className="sticky bottom-0 z-10 border-t border-gray-200 bg-white"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <ul className="mx-auto flex max-w-screen-sm items-end">
        {NAV_ITEMS.map((item) => (
          <li key={item.to} className="flex-1">
            {item.center ? (
              <NavLink to={item.to} className="flex flex-col items-center justify-end pb-1">
                {({ isActive }) => (
                  <>
                    <span
                      aria-hidden
                      className={[
                        '-mt-5 flex h-14 w-14 items-center justify-center rounded-full text-2xl shadow-md',
                        isActive ? 'bg-brand-greenDark' : 'bg-green-600',
                      ].join(' ')}
                    >
                      🎤
                    </span>
                    <span
                      className={[
                        'mt-0.5 text-[11px]',
                        isActive ? 'font-semibold text-green-700' : 'text-gray-500',
                      ].join(' ')}
                    >
                      {t(item.labelKey)}
                    </span>
                  </>
                )}
              </NavLink>
            ) : (
              <NavLink
                to={item.to}
                className={({ isActive }) =>
                  [
                    'flex h-14 min-h-[44px] flex-col items-center justify-center text-[11px] leading-tight',
                    isActive ? 'font-semibold text-green-800' : 'text-gray-500',
                  ].join(' ')
                }
              >
                {({ isActive }) => (
                  <>
                    {/* 활성 = 연초록 알약(현재 위치가 글자 없이도 보임 — DESIGN.md §4) */}
                    <span
                      aria-hidden
                      className={[
                        'text-lg leading-6',
                        isActive ? 'rounded-full bg-green-100 px-4' : 'px-4',
                      ].join(' ')}
                    >
                      {item.icon}
                    </span>
                    {t(item.labelKey)}
                  </>
                )}
              </NavLink>
            )}
          </li>
        ))}
      </ul>
    </nav>
  )
}
