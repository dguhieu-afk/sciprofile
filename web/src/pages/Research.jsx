import { useEffect, useMemo, useState } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { Search, SlidersHorizontal } from 'lucide-react'
import { supabase } from '../supabase'

const typeNames = {
  JOURNAL: 'Bài báo', CONFERENCE: 'Hội nghị', BOOK: 'Sách',
  BOOK_CHAPTER: 'Chương sách', THESIS: 'Luận văn',
  RESEARCH_PROJECT: 'Đề tài', OTHER: 'Khác',
}

// Bỏ dấu tiếng Việt để tìm "tri tue" vẫn ra "trí tuệ"
const clean = s =>
  (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase()

export default function Research() {
  const [params] = useSearchParams()
  const [q, setQ] = useState(params.get('q') || '')
  const [type, setType] = useState('')
  const [area, setArea] = useState('')
  const [sort, setSort] = useState('new')
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('publications')
        .select(`id,title,abstract,publication_type,publication_year,journal,citation_count,
          publication_authors(author_order,researchers(full_name)),
          publication_research_areas(research_areas(id,name))`)
        .eq('status', 'APPROVED')
      setItems((data || []).map(p => ({
        ...p,
        authors: [...p.publication_authors]
          .sort((a, b) => a.author_order - b.author_order)
          .map(a => a.researchers.full_name),
        areas: p.publication_research_areas.map(a => a.research_areas),
      })))
      setLoading(false)
    }
    load()
  }, [])

  const areaOptions = useMemo(() => {
    const map = new Map()
    items.forEach(p => p.areas.forEach(a => map.set(a.id, a.name)))
    return [...map.entries()]
  }, [items])

  const results = useMemo(() => {
    const key = clean(q.trim())
    return items
      .filter(p => !type || p.publication_type === type)
      .filter(p => !area || p.areas.some(a => String(a.id) === area))
      .filter(p => {
        if (!key) return true
        const text = clean([p.title, p.abstract, p.journal, p.authors.join(' '),
          p.areas.map(a => a.name).join(' ')].join(' '))
        return text.includes(key)
      })
      .sort((a, b) => sort === 'cite'
        ? b.citation_count - a.citation_count
        : (b.publication_year || 0) - (a.publication_year || 0))
  }, [items, q, type, area, sort])

  function reset() { setQ(''); setType(''); setArea(''); setSort('new') }

  return (
    <main className="container page">
      <div className="page-head">
        <h1>Kho nghiên cứu</h1>
        <p>Tìm kiếm trong các công trình đã được kiểm duyệt.</p>
      </div>

      <div className="filters">
        <div className="filter-search">
          <Search size={18} color="#64748b" />
          <input
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Tiêu đề, tác giả, từ khóa, lĩnh vực..."
          />
        </div>
        <select value={type} onChange={e => setType(e.target.value)}>
          <option value="">Mọi loại tài liệu</option>
          {Object.entries(typeNames).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select value={area} onChange={e => setArea(e.target.value)}>
          <option value="">Mọi lĩnh vực</option>
          {areaOptions.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
        </select>
        <select value={sort} onChange={e => setSort(e.target.value)}>
          <option value="new">Mới nhất</option>
          <option value="cite">Nhiều trích dẫn nhất</option>
        </select>
      </div>

      <div className="result-bar">
        <span><SlidersHorizontal size={14} /> {loading ? 'Đang tải...' : `${results.length} kết quả`}</span>
        <button className="link-btn" onClick={reset}>Xóa bộ lọc</button>
      </div>

      <div className="list">
        {results.map(p => (
        <Link to={`/research/${p.id}`} className="card result" key={p.id}>
            <div className="row">
              <span className="badge">{typeNames[p.publication_type] || 'Khác'}</span>
              <span className="authors">{p.publication_year}</span>
            </div>
            <h3>{p.title}</h3>
            <p className="authors">{p.authors.join(', ')}</p>
            <p className="authors">{p.journal}</p>
            {p.abstract && <p className="abs">{p.abstract}</p>}
            <div className="tags">
              {p.areas.map(a => <span className="tag-sm" key={a.id}>{a.name}</span>)}
            </div>
            <div className="meta">
              <span>{p.citation_count} trích dẫn</span>
              <span>Xem chi tiết →</span>
            </div>
      </Link>
        ))}
        {!loading && results.length === 0 && (
          <div className="empty">Không tìm thấy nghiên cứu phù hợp. Hãy thử từ khóa khác.</div>
        )}
      </div>
    </main>
  )
}