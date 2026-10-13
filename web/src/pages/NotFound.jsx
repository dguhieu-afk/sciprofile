import { Link } from 'react-router-dom'

export default function NotFound() {
  return (
    <main className="container page" style={{ textAlign: 'center', paddingTop: 80 }}>
      <div style={{ fontFamily: "'Source Serif 4', serif", fontSize: 96, fontWeight: 700, color: 'var(--teal-600)', lineHeight: 1 }}>404</div>
      <h1 style={{ marginTop: 12 }}>Không tìm thấy trang</h1>
      <p className="muted" style={{ margin: '10px 0 24px' }}>Đường dẫn không tồn tại hoặc đã bị di chuyển.</p>
      <div className="actions" style={{ justifyContent: 'center' }}>
        <Link to="/" className="btn btn-primary">Về trang chủ</Link>
        <Link to="/research" className="btn btn-ghost">Xem kho nghiên cứu</Link>
      </div>
    </main>
  )
}