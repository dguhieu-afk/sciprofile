import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Search, Users, GraduationCap, BookOpen } from 'lucide-react'
import { supabase } from '../supabase'
import { useAuth } from '../AuthContext'

const normalize = text => String(text || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()

export default function ResearchCollaboration() {
  const { user } = useAuth()
  const [items, setItems] = useState([])
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!user) { setLoading(false); return }
    let active = true
    supabase.rpc('research_collaboration_directory').then(({ data, error: err }) => {
      if (!active) return
      setLoading(false)
      if (err) setError('Không tải được danh sách hợp tác. Kiểm tra SQL chức năng tìm cộng sự: ' + err.message)
      else setItems(Array.isArray(data) ? data : [])
    })
    return () => { active = false }
  }, [user])

  const results = useMemo(() => {
    const term = normalize(query.trim())
    if (!term) return items
    return items.filter(item => normalize([item.full_name, item.research_interests, item.academic_degree, item.organization].join(' ')).includes(term))
  }, [query, items])

  if (!user) return <main className="container page"><h1>Tìm cộng sự nghiên cứu</h1><p>Vui lòng đăng nhập để tra cứu những nhà nghiên cứu đã đồng ý kết nối.</p><Link className="btn btn-primary" to="/login">Đăng nhập</Link></main>

  return <main className="container page" style={{ maxWidth: 1130 }}>
    <header style={{ marginBottom: 25 }}>
      <h1 style={{ marginBottom: 8 }}>Tìm cộng sự nghiên cứu</h1>
      <p className="muted">Kết nối với những người dùng UTEProfile đã chủ động bật nguyện vọng hợp tác nghiên cứu.</p>
    </header>
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: '#fff', border: '1px solid #d8e2f1', borderRadius: 14, padding: '10px 16px', marginBottom: 20 }}>
      <Search size={19} aria-hidden="true" />
      <input aria-label="Tìm theo họ tên, lĩnh vực hoặc đơn vị" value={query} onChange={e => setQuery(e.target.value)}
        placeholder="Tìm theo họ tên, lĩnh vực nghiên cứu, đơn vị..." style={{ flex: 1, border: 0, background: 'transparent', minWidth: 0, outline: 0 }} />
    </div>
    {error && <p role="alert" className="auth-error">{error}</p>}
    {loading ? <p>Đang tải danh sách...</p> : !error && <>
      <p className="muted" style={{ marginBottom: 12 }}>{results.length} nhà nghiên cứu phù hợp</p>
      {!results.length && <div className="empty">Chưa có nhà nghiên cứu nào phù hợp. Bạn có thể thay đổi từ khóa hoặc đăng ký nguyện vọng hợp tác trong hồ sơ cá nhân.</div>}
      <div style={{ display: 'grid', gap: 14, gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%,310px),1fr))' }}>
        {results.map(item => <article key={item.id} style={{ background: '#fff', border: '1px solid #d8e2f1', borderRadius: 16, padding: 20 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10, color: '#3154d9' }}><Users size={17}/><span style={{ fontSize: 12, fontWeight: 700 }}>Sẵn sàng hợp tác</span></div>
          <h2 style={{ fontSize: 20, margin: '0 0 8px' }}>{item.full_name}</h2>
          {item.organization && <p className="muted" style={{ margin: '4px 0' }}>{item.organization}</p>}
          {item.academic_degree && <p style={{ margin: '9px 0' }}><GraduationCap size={15} style={{ verticalAlign: 'middle' }}/> {item.academic_degree}</p>}
          {item.research_interests && <p style={{ lineHeight: 1.6 }}><BookOpen size={15} style={{ verticalAlign: 'middle' }}/> {item.research_interests}</p>}
          <Link to={`/researchers/${item.id}`} className="btn btn-primary" style={{ marginTop: 12 }}>Xem hồ sơ khoa học</Link>
        </article>)}
      </div>
    </>}
  </main>
}
