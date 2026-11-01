import { useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useTranslation } from '../i18n/useTranslation'
import { LanguageSwitcher } from '../components/layout/LanguageSwitcher'
import { useRegionChoice } from '../context/RegionChoiceContext'
import { Map as MapIcon, MessagesSquare, Mic, type LucideIcon } from '../components/ui/icons'

export function Landing() {
  const { t } = useTranslation()
  const { view } = useRegionChoice()
  const { initializing, user } = useAuth()
  const navigate = useNavigate()

  // 복귀 사용자: 보는 지역(또는 직접 고른 전국 보기)이 있으면 온보딩을 건너뛰고 바로 홈으로(M-10).
  // 로그인한 사용자는 지역이 없어도 홈으로 — 홈에서 지역 고르기·내 지역 저장을 안내한다(v1.6 D-047).
  // 단, 세션 복원이 끝난 뒤에만 이동한다(재검수 P0-1): OAuth·이메일 확인 복귀 URL의
  // #access_token 해시를 supabase가 소비하기 전에 navigate가 URL을 교체하면
  // 토큰이 영구 소실되어 로그인이 무언 실패한다. initializing=false 시점에는
  // getSession()이 완료되어 해시가 이미 처리·제거된 상태다.
  const ready = view.status === 'region' || view.status === 'all' || (Boolean(user) && view.status !== 'deciding')
  useEffect(() => {
    if (!initializing && ready) navigate('/home', { replace: true })
  }, [initializing, ready, navigate])

  // 기능 미리보기 3칩(디자인 v0) — 아이콘·라벨은 하단 탭과 동일한 어휘를 재사용해 학습 비용 0
  const previews = [
    { icon: MapIcon as LucideIcon, key: 'nav.home' },
    { icon: MessagesSquare as LucideIcon, key: 'nav.board' },
    { icon: Mic as LucideIcon, key: 'nav.talk' },
  ] as const

  return (
    <div className="mx-auto flex min-h-screen max-w-screen-sm flex-col bg-brand-cream px-6 text-gray-900">
      <div className="flex justify-end py-3">
        <LanguageSwitcher />
      </div>
      <div className="flex flex-1 flex-col items-center justify-center gap-6 pb-12 text-center">
        <img
          src={`${import.meta.env.BASE_URL}icons/icon-192.png`}
          alt=""
          aria-hidden
          className="h-28 w-28 rounded-card shadow-card"
        />
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-green-800">{t('landing.title')}</h1>
          <p className="mt-2 text-sm text-gray-600">{t('landing.subtitle')}</p>
        </div>
        <Link
          to="/select"
          className="inline-flex min-h-[56px] w-full max-w-xs items-center justify-center rounded-full bg-brand-greenDark px-6 py-3 text-base font-semibold text-white shadow-card"
        >
          {t('landing.enter')}
        </Link>
        {/* 기능 3칩은 탭 가능(재검수 P1-2) — 오인 클릭이 정답 동작(/select)이 되게 Link 승격 */}
        <ul className="flex gap-3">
          {previews.map((p) => (
            <li key={p.key}>
              <Link
                to="/select"
                className="flex min-h-[44px] min-w-[88px] flex-col items-center gap-1 rounded-card bg-white px-4 py-3 shadow-card active:bg-gray-50"
              >
                <p.icon aria-hidden size={24} strokeWidth={2} className="text-green-800" />
                <span className="text-xs font-semibold text-gray-700">{t(p.key)}</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
      <div className="pb-4 text-center">
        <Link to="/privacy" className="text-xs text-gray-400 underline">
          {t('common.privacy')}
        </Link>
      </div>
    </div>
  )
}
