import { Link, useLocation } from 'react-router-dom'
import { useTranslation } from '../../i18n/useTranslation'
import { cn } from '../ui/cn'
import { Icon, type IconName } from '../ui/Icon'
import { toneForPath } from '../ui/IndicatorBar'

interface NavItem {
  to: string
  labelKey: string
  icon: IconName
  /** 활성일 때 글자·아이콘 색(영역 정체성 600). 말하기·내 정보는 영역 정체성이 없다(말하기 = 브랜드 초록 원) */
  activeClass: string
  center?: boolean
}

// v1.5 §2: 5탭 — 가운데 말하기는 원래 앱처럼 솟은 둥근 버튼(키트 3장). 아이콘+글자 병행.
// 말하기는 /talk 화면으로 간다(그 화면의 "말로 하기"가 음성 팝업 VoicePopup을 연다 — main 동작 그대로).
const NAV_ITEMS: NavItem[] = [
  { to: '/home', labelKey: 'nav.home', icon: 'home', activeClass: 'text-nong-600' },
  { to: '/board', labelKey: 'nav.board', icon: 'board', activeClass: 'text-da-600' },
  { to: '/talk', labelKey: 'nav.talk', icon: 'mic', activeClass: 'text-nong-600', center: true },
  { to: '/neighbors', labelKey: 'nav.neighbors', icon: 'neighbors', activeClass: 'text-ma-600' },
  { to: '/profile', labelKey: 'nav.profile', icon: 'me', activeClass: 'text-ink' },
]

const ITEM =
  'relative flex min-w-0 flex-1 flex-col items-center gap-1 pt-[9px] text-caption leading-[18px] no-underline'
// 키트 3장: 모든 글자가 한 기준선에 한 줄로. 긴 번역도 줄바꿈해서 탭 밖으로 넘치지 않게 한 줄로 자른다
// (사전의 nav.* 는 짧게 유지한다 — 화면 읽기 프로그램에는 잘리지 않은 전체 글자가 읽힌다)
const LABEL = 'block max-w-full truncate'

/**
 * 하단 탭(키트 3장): 64px 흰 바탕 + 위 1px 선 + --safe-bottom.
 * 비활성 = 선 아이콘 + 13px muted, 활성 = 채운 아이콘 + 굵은 글자(영역 600색) + aria-current="page".
 * 활성은 경로로 정한다: 각 탭의 경로와 그 하위 경로. 홈은 인디케이터 바처럼 농사 영역 전체(/home, /life-info*, /farm*).
 * 말하기 = 56px nong-600 원(위로 28px 솟음, 흰 4px 테 + 유일한 탭 그림자 shadow-raised). 글자는 활성일 때만 초록.
 * `activePath`: 활성 탭을 정할 경로를 주소 대신 지정한다. `null`이면 어느 탭도 활성이 아니다(404처럼 앱 셸 밖에서
 * 아래 탭만 빌려 쓰는 화면 — /board/x/y 같은 없는 주소에서 게시판이 켜지지 않게).
 */
export function BottomNav({ activePath }: { activePath?: string | null } = {}) {
  const { t } = useTranslation()
  const { pathname } = useLocation()
  const source = activePath === undefined ? pathname : activePath
  const p = source === null ? null : source.replace(/\/+$/, '') || '/'

  return (
    <nav
      aria-label={t('a11y.mainNav')}
      className="sticky bottom-0 z-30 border-t border-line bg-white pb-[var(--safe-bottom)]"
    >
      <ul className="mx-auto flex h-[63px] max-w-screen-sm">
        {NAV_ITEMS.map((item) => {
          const active =
            p === null
              ? false
              : item.to === '/home'
                ? toneForPath(p) === 'nong'
                : p === item.to || p.startsWith(item.to + '/')
          return (
            <li key={item.to} className="flex min-w-0 flex-1">
              <Link
                to={item.to}
                aria-current={active ? 'page' : undefined}
                className={cn(ITEM, active ? cn('font-bold', item.activeClass) : 'font-normal text-ink-muted')}
              >
                {item.center ? (
                  <>
                    <span
                      aria-hidden="true"
                      className={cn(
                        'absolute -top-7 left-1/2 -ml-7 flex h-14 w-14 items-center justify-center rounded-full text-white shadow-raised transition-colors',
                        active ? 'bg-nong-700' : 'bg-nong-600',
                      )}
                    >
                      <Icon name="mic" size={26} strokeWidth={2} />
                    </span>
                    <span aria-hidden="true" className="block h-6 w-6" />
                    <span className={LABEL}>{t(item.labelKey)}</span>
                  </>
                ) : (
                  <>
                    <Icon name={item.icon} filled={active} />
                    <span className={LABEL}>{t(item.labelKey)}</span>
                  </>
                )}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
