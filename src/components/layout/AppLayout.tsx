import { useEffect, useState } from 'react'
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { BottomNav } from './BottomNav'
import { LanguageSwitcher } from './LanguageSwitcher'
import { OfflineBanner } from '../OfflineBanner'
import { useTranslation } from '../../i18n/useTranslation'
import { useStaleRegionCleanup } from '../../hooks/useRegions'
import { cn } from '../ui/cn'
import { Icon } from '../ui/Icon'
import { IndicatorBar, toneForPath } from '../ui/IndicatorBar'
import { LogoMark, Wordmark } from '../ui/Logo'
import { Toast } from '../ui/Toast'
import { takeFlash } from './flash'

/** 하단 탭의 뿌리 화면: 뒤로 가기 없이 로고만 보인다. 그 밖(상세·글쓰기·수정·생활정보·농사 도움 …)은 뒤로 가기 + 로고. */
const TAB_ROOTS = ['/home', '/board', '/talk', '/neighbors', '/profile']

/*
 * 앱 셸(디자인 v5, 키트 2·3장)
 *  - 헤더: 상태 표시줄 높이(--safe-top) + 56px 줄 + 4px 인디케이터 바. 스크롤해도 위에 붙어 있다(z-30).
 *    왼쪽 = (뒤로 44px) + 원본 로고 + 글자 워드마크(누르면 /home, D-033), 오른쪽 = 언어 버튼(언어 창).
 *  - 오프라인 배너: 인디케이터 바 바로 아래(헤더와 같이 붙어 있음).
 *  - main: px-5 pt-3 pb-10(솟은 말하기 원이 마지막 줄을 가리지 않게). /home만 여백 없이 꽉 채운다(화면이 직접 px-5).
 *  - 하단 탭: 64px + --safe-bottom, 문서 흐름 안에서 아래에 붙음(sticky z-30) → 내용이 탭 뒤로 숨지 않는다.
 *  - 확인 토스트: navigate(to, { state: { toast: 'state.posted' } }) 또는 flashToast('state.saved') 뒤 navigate(-1).
 * 치수는 index.css의 --header-h / --nav-h / --float-bottom과 같다.
 */
export function AppLayout() {
  const { t } = useTranslation()
  const location = useLocation()
  const navigate = useNavigate()
  // v1.1(D-033): 비활성·삭제된 지역 id가 localStorage에 남아 조용히 '전체 범위'가 되지 않도록 정리
  useStaleRegionCleanup()
  const path = location.pathname.replace(/\/+$/, '') || '/'
  // 10세 원칙: 탭 뿌리가 아니면 뒤로 가기는 항상 화면 상단에. history가 없으면 홈으로.
  // 이웃에서 들어온 작성자 글 목록(/board?author=)은 하위 화면
  const authorFilter = path === '/board' && new URLSearchParams(location.search).has('author')
  const showBack = !TAB_ROOTS.includes(path) || authorFilter
  const isHome = path === '/home'

  // 확인 토스트(키트 4.10): navigate(to, { state: { toast: 'state.posted' } })면 도착 화면에서 한 번 보여 준다.
  // 'state.' 키만 받는다. 보여 준 뒤 history state에서 지워 새로고침·뒤로 가기로 다시 뜨지 않게 한다.
  const rawToast = (location.state as { toast?: unknown } | null)?.toast
  const flashKey = typeof rawToast === 'string' ? rawToast : undefined
  const [flash, setFlash] = useState<{ key: string; at: number } | null>(null)
  useEffect(() => {
    if (!flashKey || !flashKey.startsWith('state.')) return
    setFlash({ key: flashKey, at: Date.now() })
    const { toast: _shown, ...rest } = location.state as Record<string, unknown>
    navigate(location.pathname + location.search + location.hash, {
      replace: true,
      state: Object.keys(rest).length > 0 ? rest : null,
    })
    // 새 토스트 키가 올 때만 돈다(location·navigate는 일부러 뺐다)
  }, [flashKey])
  // 뒤로 가기로 돌아온 화면의 토스트(flash.ts) — 수정 저장 후 원래 화면으로 돌아갈 때
  useEffect(() => {
    const key = takeFlash()
    if (key && key.startsWith('state.')) setFlash({ key, at: Date.now() })
  }, [location.key])

  return (
    <div className="mx-auto flex min-h-app max-w-screen-sm flex-col bg-white text-ink">
      <header className="sticky top-0 z-30 bg-white pt-[var(--safe-top)]">
        <div className={cn('flex h-14 items-center justify-between gap-1 pr-2', showBack ? 'pl-1' : 'pl-4')}>
          <div className="flex min-w-0 items-center">
            {showBack ? (
              <button
                type="button"
                onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/home'))}
                aria-label={t('common.back')}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-ink hover:bg-surface active:bg-surface-2"
              >
                <Icon name="back" strokeWidth={2} />
              </button>
            ) : null}
            {/* 로고+워드마크 전체가 홈(/home) 링크(D-033). 전체 새로고침 없는 SPA 이동을 위해 anchor 대신 Link */}
            <Link
              to="/home"
              aria-label={t('a11y.home')}
              className="flex h-11 min-w-0 items-center gap-2 overflow-hidden rounded-lg pr-1"
            >
              <LogoMark />
              {/* 200% 확대(약 195px 폭)에서는 글자 로고를 숨겨 언어 버튼 밑으로 겹치지 않게 한다 */}
              <Wordmark className="max-[269px]:hidden" />
            </Link>
          </div>
          <LanguageSwitcher />
        </div>
        <IndicatorBar active={toneForPath(path)} />
        <OfflineBanner />
      </header>
      <main className={isHome ? 'flex flex-1 flex-col' : 'flex-1 px-5 pb-10 pt-3'}>
        <Outlet />
      </main>
      <BottomNav />
      <Toast
        open={flash !== null}
        message={flash ? t(flash.key) : ''}
        showKey={flash?.at}
        onClose={() => setFlash(null)}
      />
    </div>
  )
}
