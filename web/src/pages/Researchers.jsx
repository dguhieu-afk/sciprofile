import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Search } from 'lucide-react'
import { supabase } from '../supabase'

const clean = s => (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase()

export default function Researchers() {
  const [list, setList] = useState([])
  const [q, setQ] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.from('researchers')
      .select('id,full_name,academic_title,academic_degree,research_interests,organizations(name),publication_authors(publication_id)')
      .then(({ data }) => {
        setList((data || []).map(r => ({ ...r, works: r.publication_authors.length }))
          .sort((a, b) => b.works - a.works))
        setLoading(false)
      })
  }, [])

  const shown = useMemo(() => {
    const k = clean(q.trim())
    return list.filter(r => !k || clean([r.full_name, r.research_interests, r.organizations?.name].join(' ')).includes(k))
  }, [list, q])

  return (
    <main className="container page">
      <div className="page-head">
        <h1>Nhà nghiên cứu</h1>
        <p>Danh sách nhà nghiên cứu và hồ sơ khoa học công khai.</p>
      </div>
      <div className="filters" style={{ gridTemplateColumns: '1fr' }}>
        <div className="filter-search">
          <Search size={18} color="#64748b" />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Tìm theo tên, lĩnh vực, đơn vị..." />
        </div>
      </div>
      <div className="result-bar"><span>{loading ? 'Đang tải...' : `${shown.length} nhà nghiên cứu`}</span></div>
      <div className="grid-3">
        {shown.map(r => (
          <Link to={`/researchers/${r.id}`} className="card person" key={r.id}>
            <div className="avatar">{r.full_name.trim().split(' ').pop()[0]}</div>
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