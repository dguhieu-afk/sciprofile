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
    async function google() {
    setError('')
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    })
    if (error) setError(error.message)
  }

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

        {mode !== 'forgot' && (
          <>
            <button type="button" className="google-btn" onClick={google}>
              <svg width="18" height="18" viewBox="0 0 48 48">
                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
              </svg>
              Tiếp tục với Google
            </button>
            <div className="or"><span>hoặc dùng email</span></div>
          </>
        )}
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