import { Navigate, Route, Routes } from 'react-router-dom'
import { AppLayout } from './components/layout/AppLayout'
import { Landing } from './pages/Landing'
import { Home } from './pages/Home'
import { Board } from './pages/Board'
import { BoardPostDetail } from './pages/BoardPostDetail'
import { LifeInfo } from './pages/LifeInfo'
import { LifeInfoDetail } from './pages/LifeInfoDetail'
import { Profile } from './pages/Profile'
import { NotFound } from './pages/NotFound'

export function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route element={<AppLayout />}>
        <Route path="/home" element={<Home />} />
        <Route path="/board" element={<Board />} />
        <Route path="/board/:postId" element={<BoardPostDetail />} />
        <Route path="/life-info" element={<LifeInfo />} />
        <Route path="/life-info/:infoId" element={<LifeInfoDetail />} />
        <Route path="/profile" element={<Profile />} />
      </Route>
      <Route path="/index.html" element={<Navigate to="/" replace />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}
