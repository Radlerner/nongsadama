import { useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useTranslation } from '../i18n/useTranslation'
import { EntryHeader } from '../components/layout/EntryHeader'
import { useSelectedRegion } from '../context/SelectedRegionContext'
import { buttonClasses, LogoMark, Wordmark } from '../components/ui'

export function Landing() {
  const { t } = useTranslation()
  const { regionId } = useSelectedRegion()
  const { initializing, session } = useAuth()
  const navigate = useNavigate()

  // 복귀 사용자: 지역이 이미 저장돼 있으면 온보딩을 건너뛰고 바로 홈으로(M-10).
  // 단, 세션 복원이 끝난 뒤에만 이동한다(재검수 P0-1): OAuth·이메일 확인 복귀 URL의
  // #access_token 해시를 supabase가 소비하기 전에 navigate가 URL을 교체하면
  // 토큰이 영구 소실되어 로그인이 무언 실패한다. initializing=false 시점에는
  // getSession()이 완료되어 해시가 이미 처리·제거된 상태다.
  useEffect(() => {
    if (!initializing && regionId) navigate('/home', { replace: true })
  }, [initializing, regionId, navigate])

  // 디자인 v5: 흰 바탕 + 원본 로고(크게) + 워드마크 + 한 줄 + 주 버튼 하나(시작하기) + 조용한 로그인 링크.
  // (v1.x의 기능 미리보기 3칩은 모두 /select로 가는 링크였다 — 같은 길인 '시작하기' 하나로 합쳤다.)
  return (
    <div className="mx-auto flex min-h-app max-w-screen-sm flex-col bg-white text-ink">
      <EntryHeader logo={false} />
      <main className="flex flex-1 flex-col items-center justify-center px-5 pb-6 text-center">
        <LogoMark size="large" />
        <h1 className="mt-6">
          {/* 워드마크는 글자색 3개로 된 그림 같은 표기(aria-hidden) — 읽기는 아래 sr-only 이름으로 */}
          <Wordmark className="!text-[34px] !leading-[42px] !tracking-[-0.6px]" />
          <span className="sr-only">{t('landing.title')}</span>
        </h1>
        <p className="mt-3 max-w-[300px] text-body text-ink-body">{t('landing.value')}</p>
      </main>
      <div className="px-5 pb-[calc(16px+var(--safe-bottom))]">
        <Link to="/select" className={buttonClasses({ fullWidth: true })}>
          {t('landing.enter')}
        </Link>
        {/* 이미 로그인한 사람(예: 카카오 로그인 뒤 지역 없이 돌아옴)에게는 로그인을 다시 권하지 않는다. 시작하기가 /select로 이어 준다 */}
        {!session ? (
          <Link to="/login" className={buttonClasses({ variant: 'ghost', fullWidth: true, className: 'mt-2' })}>
            {t('landing.login')}
          </Link>
        ) : null}
        <div className="mt-2 flex justify-center">
          <Link
            to="/privacy"
            className="inline-flex min-h-11 items-center px-3 text-caption text-ink-muted underline underline-offset-2"
          >
            {t('common.privacy')}
          </Link>
        </div>
      </div>
    </div>
  )
}
