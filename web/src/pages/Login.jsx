import { useState } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { GraduationCap } from 'lucide-react'
import { supabase } from '../supabase'
import { liveCap, titleCase } from '../utils'

export default function Login() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const [mode, setMode] = useState(params.get('mode') === 'register' ? 'register' : 'login')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e) {
    e.preventDefault()
    setError('')
    setBusy(true)

    if (mode === 'register') {
      if (name.trim().length < 2) { setError('Vui lòng nhập họ tên.'); setBusy(false); return }
      if (password.length < 6) { setError('Mật khẩu cần ít nhất 6 ký tự.'); setBusy(false); return }
      const { data, error } = await supabase.auth.signUp({
        email, password, options: { data: { full_name: name.trim() } },
      })
      if (error) { setError(error.message); setBusy(false); return }
      if (!data.session) {
        setError('Đã đăng ký. Hãy kiểm tra email để xác nhận rồi đăng nhập.')
        setBusy(false); return
      }
      navigate('/profile/edit')
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) { setError('Email hoặc mật khẩu không đúng.'); setBusy(false); return }
      navigate('/')
    }
    setBusy(false)
  }

  return (
    <main className="auth-wrap">
      <div className="auth-card">
        <Link to="/" className="logo" style={{ justifyContent: 'center', marginBottom: 8 }}>
          <span className="logo-mark"><GraduationCap size={20} /></span>
          SciProfile
        </Link>
        <h1>{mode === 'login' ? 'Chào mừng trở lại' : 'Tạo tài khoản nhà nghiên cứu'}</h1>
        <p className="auth-sub">
          {mode === 'login' ? 'Đăng nhập để quản lý hồ sơ và công trình.' : 'Xây dựng lý lịch khoa học của bạn chỉ trong vài phút.'}
        </p>
        <form onSubmit={submit}>
          {mode === 'register' && (
            <label>Họ và tên
              <input value={name} onChange={e => setName(e.target.value)} placeholder="Nguyễn Văn A" required />
            </label>
          )}
          <label>Email
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="ban@truong.edu.vn" required />
          </label>
          <label>Mật khẩu
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Tối thiểu 6 ký tự" required />
          </label>
          {error && <div className="auth-error">{error}</div>}
          <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }} disabled={busy}>
            {busy ? 'Đang xử lý...' : mode === 'login' ? 'Đăng nhập' : 'Đăng ký'}
          </button>
        </form>
        <p className="auth-switch">
          {mode === 'login' ? 'Chưa có tài khoản? ' : 'Đã có tài khoản? '}
          <button className="link-btn" onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError('') }}>
            {mode === 'login' ? 'Đăng ký ngay' : 'Đăng nhập'}
          </button>
        </p>
      </div>
    </main>
  )
}