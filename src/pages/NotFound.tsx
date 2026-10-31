import { Link } from 'react-router-dom'
import { useTranslation } from '../i18n/useTranslation'
import { BottomNav } from '../components/layout/BottomNav'
import { EntryHeader } from '../components/layout/EntryHeader'
import { buttonClasses, Icon } from '../components/ui'

/**
 * 없는 주소(404). 앱 셸 밖 라우트라 같은 치수의 머리줄과 아래 5탭을 직접 둔다 —
 * 어디서 길을 잃어도 홈·게시판·말하기·이웃·내 정보로 바로 갈 수 있게.
 */
export function NotFound() {
  const { t } = useTranslation()
  return (
    <div className="mx-auto flex min-h-app max-w-screen-sm flex-col bg-white text-ink">
      <EntryHeader logoTo="/home" />
      <main className="flex flex-1 flex-col items-center justify-center px-5 pb-16 pt-10 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-surface text-ink-muted">
          <Icon name="search" size={26} />
        </span>
        <h1 className="mt-4 text-title text-ink">{t('notFound.title')}</h1>
        <p className="mt-1 max-w-[300px] text-body text-ink-body">{t('notFound.body')}</p>
        <Link to="/home" className={buttonClasses({ className: 'mt-6 min-w-[220px]' })}>
          <Icon name="home" size={20} strokeWidth={2} />
          {t('notFound.back')}
        </Link>
      </main>
      {/* 없는 주소는 어느 탭에도 속하지 않는다(/board/x/y에서 게시판이 켜지지 않게) */}
      <BottomNav activePath={null} />
    </div>
  )
}
