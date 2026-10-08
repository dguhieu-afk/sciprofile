import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { GraduationCap } from 'lucide-react'
import { supabase } from '../supabase'
import { useAuth } from '../AuthContext'

export default function ResetPassword() {
  const { session, ready } = useAuth()
  const navigate = useNavigate()
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const [busy, setBusy] = useState(false)

  async function submit(e) {
    e.preventDefault()
    setError('')
    if (pw.length < 6) { setError('Mật khẩu cần ít nhất 6 ký tự.'); return }
    if (pw !== pw2) { setError('Hai mật khẩu không khớp.'); return }
    setBusy(true)
    const { error } = await supabase.auth.updateUser({ password: pw })
    setBusy(false)
    if (error) { setError(error.message); return }
    setDone(true)
    setTimeout(() => navigate('/'), 1800)
  }

  return (
    <main className="auth-wrap">
      <div className="auth-card">
        <Link to="/" className="logo" style={{ justifyContent: 'center', marginBottom: 8 }}>
          <span className="logo-mark"><GraduationCap size={20} /></span>
          UTEProfile
        </Link>
        <h1>Đặt lại mật khẩu</h1>

        {!ready && <p className="auth-sub">Đang xác thực liên kết...</p>}

        {ready && !session && (
          <>
            <p className="auth-sub">Liên kết không hợp lệ hoặc đã hết hạn. Hãy yêu cầu gửi lại.</p>
            <Link to="/login" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }}>Về trang đăng nhập</Link>
          </>
        )}

        {ready && session && !done && (
          <form onSubmit={submit}>
            <p className="auth-sub">Nhập mật khẩu mới cho tài khoản {session.user.email}.</p>
            <label>Mật khẩu mới
              <input type="password" value={pw} onChange={e => setPw(e.target.value)} placeholder="Tối thiểu 6 ký tự" required />
            </label>
            <label>Nhập lại mật khẩu
              <input type="password" value={pw2} onChange={e => setPw2(e.target.value)} required />
            </label>
            {error && <div className="auth-error">{error}</div>}
            <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }} disabled={busy}>
              {busy ? 'Đang lưu...' : 'Đổi mật khẩu'}
            </button>
          </form>
        )}

        {done && <div className="ok-msg">Đã đổi mật khẩu thành công. Đang chuyển về trang chủ...</div>}
      </div>
    </main>
  )
}