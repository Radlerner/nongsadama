import { Suspense, lazy } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { AppLayout } from './components/layout/AppLayout'
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

export function App() {
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
            <Suspense
              fallback={
                <p className="rounded-md bg-gray-50 px-4 py-8 text-center text-sm text-gray-500">
                  …
                </p>
              }
            >
              <MapHome />
            </Suspense>
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
