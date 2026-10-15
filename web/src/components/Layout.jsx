import { useRouteTitle } from '../useRouteTitle'
import '../UTEAnimations.css'
import Avatar from './Avatar'
import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  GraduationCap, LogOut, ChevronDown, UserCircle, Eye, FolderOpen,
  Heart, ShieldCheck,
} from 'lucide-react'
import { useAuth } from '../AuthContext'

export default function Layout() {
  const { user, researcher, isAdmin, signOut } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  useRouteTitle()
  const [open, setOpen] = useState(false)
  const box = useRef(null)

  useEffect(() => {
    const close = e => { if (box.current && !box.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])

  const name = researcher?.full_name || user?.email || ''

  return (
    <>
      <header className="nav">
        <div className="container nav-inner">
          <Link className="logo" to="/">
            <span className="logo-mark"><GraduationCap size={20} /></span>
            UTEProfile
          </Link>

          <nav className="nav-links">
            <NavLink to="/research">Kho nghiên cứu</NavLink>
            <NavLink to="/researchers">Nhà nghiên cứu</NavLink>
            <NavLink to="/network">Mạng lưới</NavLink>
            <NavLink to="/stats">Thống kê</NavLink>
          </nav>

          <div className="nav-actions">
            {user ? (
              <div className="user-menu" ref={box}>
                <button className="user-btn" onClick={() => setOpen(!open)}>
                                    <Avatar name={name} url={researcher?.avatar_url} size="xs" />
                  <span className="user-name">{name}</span>
                  <ChevronDown size={16} />
                </button>
                {open && (
                  <div className="menu" onClick={() => setOpen(false)}>
                    <Link to="/profile/edit"><UserCircle size={16} /> Chỉnh sửa hồ sơ</Link>
                    {researcher && <Link to={`/researchers/${researcher.id}`}><Eye size={16} /> Hồ sơ công khai</Link>}
                    <Link to="/dashboard"><FolderOpen size={16} /> Công trình của tôi</Link>
                    <Link to="/favorites"><Heart size={16} /> Yêu thích</Link>
                    {isAdmin && (
                      <>
                        <div className="menu-label">DÀNH CHO QUẢN TRỊ VIÊN</div>
                        <Link to="/admin"><ShieldCheck size={16} /> Trung tâm quản trị Admin</Link>
                      </>
                    )}
                    <div className="menu-sep" />
                    <button onClick={async () => { await signOut(); navigate('/') }}>
                      <LogOut size={16} /> Đăng xuất
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <>
                <button className="btn btn-ghost" onClick={() => navigate('/login')}>Đăng nhập</button>
                <button className="btn btn-primary" onClick={() => navigate('/login?mode=register')}>Đăng ký</button>
              </>
            )}
          </div>
        </div>
      </header>

      <div className="ute-route-enter" key={location.pathname}>
        <Outlet />
      </div>

      <footer className="footer">
        © 2026 UTEProfile – Phát triển by nguyentrunghieu - dguhieu@gmail.com
      </footer>
    </>
  )
}