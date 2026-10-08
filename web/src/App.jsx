import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import Home from './pages/Home'
import Research from './pages/Research'
import ResearchDetail from './pages/ResearchDetail'
import Login from './pages/Login'
import ResetPassword from './pages/ResetPassword'
import Researchers from './pages/Researchers'
import ResearcherProfile from './pages/ResearcherProfile'
import ProfileEdit from './pages/ProfileEdit'
import Dashboard from './pages/Dashboard'
import PublicationForm from './pages/PublicationForm'
import Admin from './pages/Admin'
import AdminReview from './pages/AdminReview'
import AdminReports from './pages/AdminReports'
import Favorites from './pages/Favorites'
import Network from './pages/Network'
import Stats from './pages/Stats'

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route element={<Layout />}>
        <Route path="/" element={<Home />} />
        <Route path="/research" element={<Research />} />
        <Route path="/research/:id" element={<ResearchDetail />} />
        <Route path="/researchers" element={<Researchers />} />
        <Route path="/researchers/:id" element={<ResearcherProfile />} />
        <Route path="/network" element={<Network />} />
        <Route path="/stats" element={<Stats />} />
        <Route path="/profile/edit" element={<ProfileEdit />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/dashboard/new" element={<PublicationForm />} />
        <Route path="/dashboard/edit/:id" element={<PublicationForm />} />
        <Route path="/favorites" element={<Favorites />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="/admin/review/:id" element={<AdminReview />} />
        <Route path="/admin/reports" element={<AdminReports />} />
      </Route>
    </Routes>
  )
}