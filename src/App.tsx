import { Navigate, Route, Routes } from 'react-router-dom'
import { AppLayout } from './components/layout/AppLayout'
import { Landing } from './pages/Landing'
import { Select } from './pages/Select'
import { Login } from './pages/Login'
import { Home } from './pages/Home'
import { Board } from './pages/Board'
import { BoardPostDetail } from './pages/BoardPostDetail'
import { LifeInfo } from './pages/LifeInfo'
import { LifeInfoDetail } from './pages/LifeInfoDetail'
import { Profile } from './pages/Profile'
import { ProfileEdit } from './pages/ProfileEdit'
import { Neighbors } from './pages/Neighbors'
import { NotFound } from './pages/NotFound'

export function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/select" element={<Select />} />
      <Route path="/login" element={<Login />} />
      <Route element={<AppLayout />}>
        <Route path="/home" element={<Home />} />
        <Route path="/board" element={<Board />} />
        <Route path="/board/:postId" element={<BoardPostDetail />} />
        <Route path="/life-info" element={<LifeInfo />} />
        <Route path="/life-info/:infoId" element={<LifeInfoDetail />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/profile/edit" element={<ProfileEdit />} />
        <Route path="/neighbors" element={<Neighbors />} />
      </Route>
      <Route path="/index.html" element={<Navigate to="/" replace />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}
