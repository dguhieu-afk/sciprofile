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
  const [info, setInfo] = useState('')
  const [busy, setBusy] = useState(false)

  const go = m => { setMode(m); setError(''); setInfo('') }

  async function submit(e) {
    e.preventDefault()
    setError(''); setInfo('')
    setBusy(true)

    if (mode === 'forgot') {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      })
      setBusy(false)
      if (error) { setError(error.message); return }
      setInfo('Đã gửi email đặt lại mật khẩu. Hãy kiểm tra hộp thư (cả mục Spam) và bấm vào liên kết trong email.')
      return
    }

    if (mode === 'register') {
      if (name.trim().length < 2) { setError('Vui lòng nhập họ tên.'); setBusy(false); return }
      if (password.length < 6) { setError('Mật khẩu cần ít nhất 6 ký tự.'); setBusy(false); return }
      const { data, error } = await supabase.auth.signUp({
        email, password, options: { data: { full_name: titleCase(name) } },
      })
      if (error) { setError(error.message); setBusy(false); return }
      if (!data.session) {
        setInfo('Đã đăng ký. Hãy kiểm tra email để xác nhận rồi đăng nhập.')
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

  const titles = {
    login: ['Chào mừng trở lại', 'Đăng nhập để quản lý hồ sơ và công trình.'],
    register: ['Tạo tài khoản nhà nghiên cứu', 'Xây dựng lý lịch khoa học của bạn chỉ trong vài phút.'],
    forgot: ['Quên mật khẩu', 'Nhập email đã đăng ký, chúng tôi sẽ gửi liên kết đặt lại mật khẩu.'],
  }

  return (
    <main className="auth-wrap">
      <div className="auth-card">
        <Link to="/" className="logo" style={{ justifyContent: 'center', marginBottom: 8 }}>
          <span className="logo-mark"><GraduationCap size={20} /></span>
          UTEProfile
        </Link>
        <h1>{titles[mode][0]}</h1>
        <p className="auth-sub">{titles[mode][1]}</p>

        <form onSubmit={submit}>
          {mode === 'register' && (
            <label>Họ và tên
              <input value={name} onChange={e => setName(liveCap(e.target.value))} placeholder="Nguyễn Văn A" required />
            </label>
          )}
          <label>Email
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="ban@truong.edu.vn" required />
          </label>
          {mode !== 'forgot' && (
            <label>Mật khẩu
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Tối thiểu 6 ký tự" required />
            </label>
          )}
          {mode === 'login' && (
            <div style={{ textAlign: 'right', marginTop: -6, marginBottom: 14 }}>
              <button type="button" className="link-btn" onClick={() => go('forgot')}>Quên mật khẩu?</button>
            </div>
          )}
          {error && <div className="auth-error">{error}</div>}
          {info && <div className="ok-msg" style={{ marginTop: 0, marginBottom: 14 }}>{info}</div>}
          <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }} disabled={busy}>
            {busy ? 'Đang xử lý...' : mode === 'login' ? 'Đăng nhập' : mode === 'register' ? 'Đăng ký' : 'Gửi liên kết đặt lại'}
          </button>
        </form>

        <p className="auth-switch">
          {mode === 'login' && <>Chưa có tài khoản? <button className="link-btn" onClick={() => go('register')}>Đăng ký ngay</button></>}
          {mode === 'register' && <>Đã có tài khoản? <button className="link-btn" onClick={() => go('login')}>Đăng nhập</button></>}
          {mode === 'forgot' && <button className="link-btn" onClick={() => go('login')}>← Quay lại đăng nhập</button>}
        </p>
      </div>
    </main>
  )
}