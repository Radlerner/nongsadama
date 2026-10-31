import { Link } from 'react-router-dom'
import { useTranslation } from '../../i18n/useTranslation'
import { OfflineBanner } from '../OfflineBanner'
import { cn, IconButton, LogoMark, Wordmark } from '../ui'
import { LanguageSwitcher } from './LanguageSwitcher'

/**
 * 앱 셸(AppLayout) 밖 화면(랜딩·언어/지역 선택·로그인·개인정보·404)의 머리줄.
 * AppLayout 헤더와 같은 치수: safe-top + 56px, 뒤로(44px) + 로고 로크업, 오른쪽 언어 바꾸기, 아래 오프라인 배너.
 * 로고는 원본 이미지(LogoMark) 그대로.
 */
export function EntryHeader({
  onBack,
  logo = true,
  logoTo,
  language = true,
}: {
  /** 있으면 왼쪽에 뒤로 가기(44px) */
  onBack?: () => void
  /** 로고 로크업(로고 + 워드마크) 표시. 랜딩은 가운데 큰 로고가 있어 끈다 */
  logo?: boolean
  /** 로고를 누르면 갈 곳. 없으면 그냥 표시 */
  logoTo?: string
  /** 오른쪽 언어 바꾸기 */
  language?: boolean
}) {
  const { t } = useTranslation()
  // 200% 확대(약 195px 폭)에서는 글자 로고를 숨겨 언어 버튼 밑으로 겹치지 않게 한다(원본 로고 이미지는 그대로)
  const lockup = (
    <>
      <LogoMark />
      <Wordmark className="max-[269px]:hidden" />
    </>
  )
  return (
    <header className="sticky top-0 z-30 bg-white pt-[var(--safe-top)]">
      <div className={cn('flex h-14 items-center justify-between gap-1 pr-2', onBack ? 'pl-1' : 'pl-4')}>
        <div className="flex min-w-0 items-center">
          {onBack ? <IconButton icon="back" label={t('common.back')} onClick={onBack} /> : null}
          {logo ? (
            logoTo ? (
              <Link
                to={logoTo}
                aria-label={t('a11y.home')}
                className="flex h-11 min-w-0 items-center gap-2 overflow-hidden rounded-lg pr-1"
              >
                {lockup}
              </Link>
            ) : (
              <span className="flex h-11 min-w-0 items-center gap-2 overflow-hidden">
                {lockup}
                <span className="sr-only">{t('app.name')}</span>
              </span>
            )
          ) : null}
        </div>
        {language ? <LanguageSwitcher /> : null}
      </div>
      {/* 앱 셸과 같이 머리줄 바로 아래에 오프라인 안내(연결되면 사라짐) */}
      <OfflineBanner />
    </header>
  )
}
