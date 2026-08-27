import { useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useTranslation } from '../i18n/useTranslation'
import { LanguageSwitcher } from '../components/layout/LanguageSwitcher'
import { useSelectedRegion } from '../context/SelectedRegionContext'

export function Landing() {
  const { t } = useTranslation()
  const { regionId } = useSelectedRegion()
  const { initializing } = useAuth()
  const navigate = useNavigate()

  // 복귀 사용자: 지역이 이미 저장돼 있으면 온보딩을 건너뛰고 바로 홈으로(M-10).
  // 단, 세션 복원이 끝난 뒤에만 이동한다(재검수 P0-1): OAuth·이메일 확인 복귀 URL의
  // #access_token 해시를 supabase가 소비하기 전에 navigate가 URL을 교체하면
  // 토큰이 영구 소실되어 로그인이 무언 실패한다. initializing=false 시점에는
  // getSession()이 완료되어 해시가 이미 처리·제거된 상태다.
  useEffect(() => {
    if (!initializing && regionId) navigate('/home', { replace: true })
  }, [initializing, regionId, navigate])

  return (
    <div className="mx-auto flex min-h-screen max-w-screen-sm flex-col bg-white px-6 text-gray-900">
      <div className="flex justify-end py-3">
        <LanguageSwitcher />
      </div>
      <div className="flex flex-1 flex-col items-center justify-center gap-6 pb-16 text-center">
        <div>
          <h1 className="text-2xl font-bold text-green-700">{t('landing.title')}</h1>
          <p className="mt-2 text-sm text-gray-600">{t('landing.subtitle')}</p>
        </div>
        <Link
          to="/select"
          className="inline-flex min-h-[56px] items-center justify-center rounded-md bg-green-700 px-6 py-3 text-base font-semibold text-white"
        >
          {t('landing.enter')}
        </Link>
      </div>
    </div>
  )
}
