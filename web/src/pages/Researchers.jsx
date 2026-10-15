import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Search } from 'lucide-react'
import { supabase } from '../supabase'
import Avatar from '../components/Avatar'

const clean = s => (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase()

export default function Researchers() {
  const [list, setList] = useState([])
  const [q, setQ] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    async function loadResearchers() {
      // Chỉ hiển thị hồ sơ liên kết tài khoản có lịch sử đăng nhập thực tế.
      const [active, result] = await Promise.all([
        supabase.rpc('public_logged_in_researcher_ids'),
        supabase.from('researchers')
          .select('id,user_id,avatar_url,full_name,academic_title,academic_degree,research_interests,organizations(name),publication_authors(publication_id)')
      ])
      if (active.error || result.error) {
        setError(active.error?.message || result.error?.message)
        setLoading(false)
        return
      }
      const validIds = new Set((active.data || []).map(x => String(x.researcher_id)))
      setList((result.data || []).filter(r => r.user_id && validIds.has(String(r.id)))
        .map(r => ({ ...r, works: r.publication_authors?.length || 0 }))
        .sort((a, b) => b.works - a.works))
      setLoading(false)
    }
    loadResearchers()
  }, [])

  const shown = useMemo(() => {
    const k = clean(q.trim())
    return list.filter(r => !k || clean([r.full_name, r.research_interests, r.organizations?.name].join(' ')).includes(k))
  }, [list, q])

  return (
    <main className="container page">
      <div className="page-head">
        <h1>Nhà nghiên cứu</h1>
        <p>Danh sách nhà nghiên cứu đã đăng nhập hệ thống và có hồ sơ công khai.</p>
      </div>
      <div className="filters" style={{ gridTemplateColumns: '1fr' }}>
        <div className="filter-search">
          <Search size={18} color="#64748b" />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Tìm theo tên, lĩnh vực, đơn vị..." />
        </div>
      </div>
      <div className="result-bar"><span>{loading ? 'Đang tải...' : `${shown.length} nhà nghiên cứu`}</span></div>
      {error && <p className="auth-error" role="alert">Không tải được danh sách: {error}. Kiểm tra SQL bổ sung.</p>}
      <div className="grid-3">
        {shown.map(r => (
          <Link to={`/researchers/${r.id}`} className="card person" key={r.id}>
            <Avatar name={r.full_name} url={r.avatar_url} size="lg" />
            <h3>{r.full_name}</h3>
            <small>{[r.academic_title, r.academic_degree].filter(Boolean).join(' • ')}</small>
            <small>{r.organizations?.name}</small>
            <span className="badge">{r.works} công trình</span>
          </Link>
        ))}
      </div>
    </main>
  )
}