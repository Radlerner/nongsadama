import { Suspense, lazy, useEffect } from 'react'
import { Navigate, Route, Routes, useNavigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import { AppLayout } from './components/layout/AppLayout'
import { RouteErrorBoundary } from './components/layout/RouteErrorBoundary'
import { LoadingState } from './components/ui/LoadingState'
import { useTranslation } from './i18n/useTranslation'
import { Landing } from './pages/Landing'
import { Select } from './pages/Select'
import { Login } from './pages/Login'

// 지도(Leaflet)는 무겁고 홈 전용이므로 별도 청크로 분리한다(코드 스플리팅, v1.5 §4).
const MapHome = lazy(() => import('./pages/MapHome'))
import { Board } from './pages/Board'
import { BoardPostDetail } from './pages/BoardPostDetail'
import { PostForm } from './pages/PostForm'
import { LifeInfo } from './pages/LifeInfo'
import { LifeInfoDetail } from './pages/LifeInfoDetail'
import { FarmTips } from './pages/FarmTips'
import { FarmTipDetail } from './pages/FarmTipDetail'
import { Profile } from './pages/Profile'
import { ProfileEdit } from './pages/ProfileEdit'
import { Neighbors } from './pages/Neighbors'
import { Talk } from './pages/Talk'
import { Privacy } from './pages/Privacy'
import { DeleteAccount } from './pages/DeleteAccount'
import { ChildSafety } from './pages/ChildSafety'
import { NotFound } from './pages/NotFound'

/** 지도 청크를 받는 동안: 무엇을 기다리는지 + 8초 뒤 느린 연결 안내(오프라인이면 연결 대기) + 목록으로 보기. */
function HomeLoading() {
  const { t } = useTranslation()
  return (
    <LoadingState className="px-5" label={t('state.mapLoading')} fallback={{ label: t('map.listView'), to: '/life-info' }} />
  )
}

export function App() {
  const { oauthCallbackStatus, clearOAuthCallbackStatus } = useAuth()
  const navigate = useNavigate()
  useEffect(() => {
    if (!oauthCallbackStatus) return
    clearOAuthCallbackStatus()
    navigate(oauthCallbackStatus === 'success' ? '/home' : '/login', { replace: true })
  }, [oauthCallbackStatus, clearOAuthCallbackStatus, navigate])
  // 첫 화면이 그려진 뒤 지도 청크를 미리 받아 둔다(서비스워커가 캐시 → 나중에 오프라인이어도 /home이 열린다).
  // 오프라인이면 건너뛴다(실패한 모듈을 브라우저가 기억해 나중의 /home까지 막지 않게).
  useEffect(() => {
    const id = window.setTimeout(() => {
      if (navigator.onLine) void import('./pages/MapHome').catch(() => undefined)
    }, 3000)
    return () => window.clearTimeout(id)
  }, [])
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/select" element={<Select />} />
      <Route path="/login" element={<Login />} />
      <Route path="/privacy" element={<Privacy />} />
      {/* Google Play 계정 삭제 URL 제출용 — 인증·지역 선택 무관 공개 페이지 */}
      <Route path="/delete-account" element={<DeleteAccount />} />
      {/* Google Play 아동 안전 표준 제출용 — 인증·지역 선택 무관 공개 페이지 */}
      <Route path="/child-safety" element={<ChildSafety />} />
      <Route element={<AppLayout />}>
        <Route
          path="/home"
          element={
            <RouteErrorBoundary>
              <Suspense fallback={<HomeLoading />}>
                <MapHome />
              </Suspense>
            </RouteErrorBoundary>
          }
        />
        <Route path="/board" element={<Board />} />
        <Route path="/board/new" element={<PostForm />} />
        <Route path="/board/:postId" element={<BoardPostDetail />} />
        <Route path="/board/:postId/edit" element={<PostForm />} />
        <Route path="/life-info" element={<LifeInfo />} />
        <Route path="/life-info/:infoId" element={<LifeInfoDetail />} />
        <Route path="/farm" element={<FarmTips />} />
        <Route path="/farm/:tipId" element={<FarmTipDetail />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/profile/edit" element={<ProfileEdit />} />
        <Route path="/neighbors" element={<Neighbors />} />
        <Route path="/talk" element={<Talk />} />
      </Route>
      <Route path="/index.html" element={<Navigate to="/" replace />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}
