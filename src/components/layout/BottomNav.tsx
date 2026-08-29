import { NavLink } from 'react-router-dom'
import { useTranslation } from '../../i18n/useTranslation'
import { NAV_ICONS, Mic } from '../ui/icons'

interface NavItem {
  to: string
  labelKey: string
  center?: boolean
}

// v1.5 §2: 5탭 — 중앙 말하기를 크게 강조(포켓몬고식 중앙 버튼). 아이콘+텍스트 병행.
// 아이콘은 lucide 라인 세트(디자인 v1.6 — 이모지 전면 대체, DESIGN.md §7).
const NAV_ITEMS: NavItem[] = [
  { to: '/home', labelKey: 'nav.home' },
  { to: '/board', labelKey: 'nav.board' },
  { to: '/talk', labelKey: 'nav.talk', center: true },
  { to: '/neighbors', labelKey: 'nav.neighbors' },
  { to: '/profile', labelKey: 'nav.profile' },
]

export function BottomNav() {
  const { t } = useTranslation()

  return (
    <nav
      className="sticky bottom-0 z-10 border-t border-gray-200 bg-white"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <ul className="mx-auto flex max-w-screen-sm items-end">
        {NAV_ITEMS.map((item) => {
          const Icon = NAV_ICONS[item.to] ?? Mic
          return (
            <li key={item.to} className="flex-1">
              {item.center ? (
                <NavLink to={item.to} className="flex flex-col items-center justify-end pb-1">
                  {({ isActive }) => (
                    <>
                      <span
                        aria-hidden
                        className={[
                          '-mt-5 flex h-14 w-14 items-center justify-center rounded-full text-white shadow-md',
                          isActive ? 'bg-brand-greenDark' : 'bg-green-600',
                        ].join(' ')}
                      >
                        <Mic size={26} strokeWidth={2.25} />
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
                      'flex h-14 min-h-[44px] flex-col items-center justify-center gap-0.5 text-[11px] leading-tight',
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
                          'flex h-6 items-center justify-center rounded-full px-4',
                          isActive ? 'bg-green-100' : '',
                        ].join(' ')}
                      >
                        <Icon size={20} strokeWidth={isActive ? 2.25 : 2} />
                      </span>
                      {t(item.labelKey)}
                    </>
                  )}
                </NavLink>
              )}
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
