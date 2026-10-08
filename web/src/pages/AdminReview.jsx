import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Check, X, AlertTriangle, FileText } from 'lucide-react'
import { supabase } from '../supabase'
import { useAuth } from '../AuthContext'

const typeNames = {
  JOURNAL: 'Bài báo tạp chí', CONFERENCE: 'Hội nghị', BOOK: 'Sách',
  BOOK_CHAPTER: 'Chương sách', THESIS: 'Luận văn / luận án',
  RESEARCH_PROJECT: 'Đề tài nghiên cứu', OTHER: 'Khác',
}
const statusName = { DRAFT: 'Bản nháp', PENDING: 'Chờ duyệt', APPROVED: 'Đã công khai', REJECTED: 'Bị từ chối', ARCHIVED: 'Lưu trữ' }
const fmt = d => new Date(d).toLocaleString('vi-VN')

export default function AdminReview() {
  const { id } = useParams()
  const { user, profile, isAdmin, ready } = useAuth()
  const navigate = useNavigate()
  const [p, setP] = useState(null)
  const [owner, setOwner] = useState('')
  const [similar, setSimilar] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadErr, setLoadErr] = useState('')

  useEffect(() => {
    if (!ready) return
    if (!user) navigate('/login')
    else if (profile && !isAdmin) navigate('/')
  }, [ready, user, profile, isAdmin, navigate])

  useEffect(() => {
    if (!isAdmin) return
    async function load() {
      setLoading(true); setLoadErr('')
      try {
        const { data, error } = await supabase.from('publications').select(`*,
          publication_authors(author_order,is_corresponding,researchers(id,full_name,academic_title)),
          publication_research_areas(research_areas(name)),
          publication_keywords(keywords(name))`).eq('id', id).maybeSingle()
        if (error) throw error
        setP(data)

        if (data) {
          if (data.created_by) {
            const { data: owner } = await supabase.from('profiles').select('email').eq('id', data.created_by).maybeSingle()
            setOwner(owner?.email || '')
          }
          const { data: sim } = await supabase.rpc('find_similar_publications', { t: data.title })
          setSimilar((sim || []).filter(s => String(s.id) !== String(id)))
        }
      } catch (e) {
        console.error('AdminReview:', e)
        setLoadErr(e.message || String(e))
      }
      setLoading(false)
    }
    load()
  }, [id, isAdmin])

  const log = (action, oldV, newV) => supabase.from('audit_logs').insert({
    user_id: user.id, action, entity_type: 'PUBLICATION', entity_id: String(id), old_value: oldV, new_value: newV,
  })

  async function approve() {
    const { error } = await supabase.from('publications').update({ status: 'APPROVED', admin_note: null }).eq('id', id)
    if (error) { alert(error.message); return }
    await log('APPROVE', { status: 'PENDING' }, { status: 'APPROVED' })
    navigate('/admin')
  }
  async function reject() {
    const note = prompt('Lý do từ chối (người nộp sẽ thấy):')
    if (note === null) return
    const { error } = await supabase.from('publications').update({ status: 'REJECTED', admin_note: note || 'Chưa đạt yêu cầu' }).eq('id', id)
    if (error) { alert(error.message); return }
    await log('REJECT', { status: 'PENDING' }, { status: 'REJECTED', note })
    navigate('/admin')
  }

  if (!isAdmin) return <main className="container page"><div className="empty">Đang kiểm tra quyền...</div></main>
  if (loading) return <main className="container page"><div className="empty">Đang tải...</div></main>
  if (loadErr) return (
    <main className="container page">
      <Link to="/admin" className="back"><ArrowLeft size={16} /> Quay lại</Link>
      <div className="auth-error"><b>Lỗi tải dữ liệu:</b> {loadErr}</div>
    </main>
  )
  if (!p) return (
    <main className="container page">
      <Link to="/admin" className="back"><ArrowLeft size={16} /> Quay lại</Link>
      <div className="empty">Không tìm thấy công trình này.</div>
    </main>
  )

  const authors = [...p.publication_authors].sort((a, b) => a.author_order - b.author_order)
  const row = (label, value) => (
    <>
      <dt>{label}</dt><dd>{value || <span className="muted">—</span>}</dd>
    </>
  )

  return (
    <main className="container page">
      <Link to="/admin" className="back"><ArrowLeft size={16} /> Quay lại danh sách chờ duyệt</Link>

      <div className="detail-main">
        <div className="row-between" style={{ alignItems: 'center' }}>
          <span className="badge">{typeNames[p.publication_type] || 'Khác'}</span>
          <span className={`status ${p.status === 'PENDING' ? 's-pending' : p.status === 'APPROVED' ? 's-ok' : 's-draft'}`}>
            {statusName[p.status]}
          </span>
        </div>
        <h1>{p.title}</h1>

        {similar.length > 0 && (
          <div className="warn" style={{ marginBottom: 14 }}>
            <AlertTriangle size={16} />
            <div>
              <b>Nghi ngờ trùng lặp với công trình đã công khai:</b>
              {similar.map(s => (
                <div key={s.id}>• <Link to={`/research/${s.id}`} className="link-btn">{s.title}</Link> (giống {Math.round(s.sim * 100)}%)</div>
              ))}
            </div>
          </div>
        )}

        <h2>Thông tin nộp bài</h2>
        <dl className="review-grid">
          {row('Người nộp (tài khoản)', owner)}
          {row('Thời gian nộp', fmt(p.created_at))}
          {row('Cập nhật lần cuối', fmt(p.updated_at))}
        </dl>

        <h2>Tác giả</h2>
        <div className="author-list">
          {authors.map(a => (
            <Link to={`/researchers/${a.researchers.id}`} key={a.researchers.id} className="author-pill">
              <span className="mini-avatar">{a.researchers.full_name.split(' ').pop()[0]}</span>
              {a.researchers.full_name}{a.is_corresponding && ' ★ Tác giả chính'}
            </Link>
          ))}
        </div>

        <h2>Tóm tắt</h2>
        <p className="abstract">{p.abstract || <span className="muted">Chưa có tóm tắt.</span>}</p>

        <h2>Phân loại</h2>
        <dl className="review-grid">
          <dt>Lĩnh vực</dt>
          <dd>{p.publication_research_areas.length
            ? <span className="tags">{p.publication_research_areas.map(a => <span className="tag-sm" key={a.research_areas.name}>{a.research_areas.name}</span>)}</span>
            : <span className="muted">—</span>}</dd>
          <dt>Từ khóa</dt>
          <dd>{p.publication_keywords.length
            ? <span className="tags">{p.publication_keywords.map(k => <span className="tag-sm" key={k.keywords.name}>{k.keywords.name}</span>)}</span>
            : <span className="muted">—</span>}</dd>
        </dl>

        <h2>Thông tin xuất bản</h2>
        <dl className="review-grid">
          {row('Năm công bố', p.publication_year)}
          {row('Tạp chí / Hội nghị / NXB', p.journal)}
          {row('Tập (Volume)', p.volume)}
          {row('Số (Issue)', p.issue)}
          {row('Trang', p.pages)}
          {row('DOI', p.doi)}
          {row('ISSN', p.issn)}
          {row('ISBN', p.isbn)}
          {row('Số trích dẫn', p.citation_count)}
        </dl>

        <h2>Tài liệu đính kèm</h2>
        {p.pdf_url
          ? <a className="btn btn-ghost" href={p.pdf_url} target="_blank" rel="noreferrer"><FileText size={16} /> Mở file để kiểm tra</a>
          : <p className="muted">Không có file đính kèm.</p>}

        {p.status === 'PENDING' && (
          <div className="form-actions">
            <button className="btn btn-ghost" onClick={reject}><X size={16} /> Từ chối</button>
            <button className="btn btn-primary" onClick={approve}><Check size={16} /> Duyệt công khai</button>
          </div>
        )}
      </div>
    </main>
  )
}