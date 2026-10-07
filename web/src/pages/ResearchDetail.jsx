import { useEffect, useMemo, useState } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Copy, Check, Calendar, BookOpen, Hash, Quote, Heart, Flag, X } from 'lucide-react'
import { supabase } from '../supabase'
import { useAuth } from '../AuthContext'

const typeNames = {
  JOURNAL: 'Bài báo', CONFERENCE: 'Hội nghị', BOOK: 'Sách',
  BOOK_CHAPTER: 'Chương sách', THESIS: 'Luận văn',
  RESEARCH_PROJECT: 'Đề tài', OTHER: 'Khác',
}
const reasons = [
  'Sai thông tin tác giả', 'Nghi ngờ trùng lặp', 'Vi phạm bản quyền',
  'Nội dung không phù hợp', 'File không đúng', 'Khác',
]

function splitName(full) {
  const parts = full.trim().split(/\s+/)
  return { last: parts[0], given: parts.slice(1) }
}
const initials = given => given.map(g => g[0].toUpperCase() + '.').join(' ')

function joinList(list, last = '&') {
  if (list.length <= 1) return list.join('')
  return list.slice(0, -1).join(', ') + (list.length > 2 ? ',' : '') + ` ${last} ` + list[list.length - 1]
}

function makeCitations(p, authors) {
  const names = authors.map(splitName)
  const doi = p.doi ? `https://doi.org/${p.doi}` : ''
  const year = p.publication_year || 'n.d.'
  const venue = p.journal || ''

  const apa = joinList(names.map(n => `${n.last}, ${initials(n.given)}`.trim()))
    + ` (${year}). ${p.title}. ${venue}.${doi ? ' ' + doi : ''}`

  const ieee = joinList(names.map(n => `${initials(n.given)} ${n.last}`.trim()), 'and')
    + `, "${p.title}," ${venue}, ${year}.${p.doi ? ' doi: ' + p.doi + '.' : ''}`

  const mlaNames = names.length > 2
    ? `${names[0].last}, ${names[0].given.join(' ')}, et al.`
    : joinList(names.map((n, i) => i === 0
        ? `${n.last}, ${n.given.join(' ')}`
        : `${n.given.join(' ')} ${n.last}`), 'and') + '.'
  const mla = `${mlaNames} "${p.title}." ${venue}, ${year}.${doi ? ' ' + doi + '.' : ''}`

  const entry = p.publication_type === 'CONFERENCE' ? 'inproceedings'
    : p.publication_type === 'JOURNAL' ? 'article' : 'misc'
  const venueField = entry === 'inproceedings' ? 'booktitle' : 'journal'
  const key = `${(names[0]?.last || 'ref').normalize('NFD').replace(/[^\w]/g, '')}${year}`
  const bibtex = `@${entry}{${key},\n`
    + `  author = {${names.map(n => `${n.last}, ${n.given.join(' ')}`).join(' and ')}},\n`
    + `  title = {${p.title}},\n`
    + (venue ? `  ${venueField} = {${venue}},\n` : '')
    + `  year = {${year}}` + (p.doi ? `,\n  doi = {${p.doi}}` : '') + '\n}'

  return { APA: apa, IEEE: ieee, MLA: mla, BibTeX: bibtex }
}

export default function ResearchDetail() {
  const { id } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [pub, setPub] = useState(null)
  const [all, setAll] = useState([])
  const [loading, setLoading] = useState(true)
  const [style, setStyle] = useState('APA')
  const [copied, setCopied] = useState(false)
  const [fav, setFav] = useState(false)
  const [showReport, setShowReport] = useState(false)
  const [reason, setReason] = useState(reasons[0])
  const [desc, setDesc] = useState('')
  const [reportMsg, setReportMsg] = useState('')

  useEffect(() => {
    setLoading(true)
    window.scrollTo(0, 0)
    async function load() {
      const { data } = await supabase
        .from('publications')
        .select(`*,
          publication_authors(author_order,is_corresponding,researchers(id,full_name,academic_title)),
          publication_research_areas(research_areas(id,name))`)
        .eq('status', 'APPROVED')
      const list = (data || []).map(p => ({
        ...p,
        authors: [...p.publication_authors].sort((a, b) => a.author_order - b.author_order)
          .map(a => ({ ...a.researchers, corresponding: a.is_corresponding })),
        areas: p.publication_research_areas.map(a => a.research_areas),
      }))
      setAll(list)
      setPub(list.find(p => String(p.id) === id) || null)
      setLoading(false)
    }
    load()
  }, [id])

  useEffect(() => {
    if (!user) { setFav(false); return }
    supabase.from('favorites').select('publication_id')
      .eq('user_id', user.id).eq('publication_id', id).maybeSingle()
      .then(({ data }) => setFav(Boolean(data)))
  }, [user, id])

  const citations = useMemo(
    () => pub ? makeCitations(pub, pub.authors.map(a => a.full_name)) : {},
    [pub]
  )

  const related = useMemo(() => {
    if (!pub) return []
    const areaIds = new Set(pub.areas.map(a => a.id))
    const authorIds = new Set(pub.authors.map(a => a.id))
    return all
      .filter(p => p.id !== pub.id)
      .map(p => ({
        ...p,
        score: p.areas.filter(a => areaIds.has(a.id)).length * 2
             + p.authors.filter(a => authorIds.has(a.id)).length * 3,
      }))
      .filter(p => p.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
  }, [pub, all])

  async function copy() {
    try {
      await navigator.clipboard.writeText(citations[style])
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      alert('Không copy được, hãy bôi đen và copy thủ công.')
    }
  }

  async function toggleFav() {
    if (!user) { navigate('/login'); return }
    if (fav) {
      await supabase.from('favorites').delete().eq('user_id', user.id).eq('publication_id', pub.id)
      setFav(false)
    } else {
      const { error } = await supabase.from('favorites').insert({ user_id: user.id, publication_id: pub.id })
      if (!error) setFav(true)
    }
  }

  function openReport() {
    if (!user) { navigate('/login'); return }
    setReportMsg(''); setShowReport(true)
  }

  async function sendReport() {
    const { error } = await supabase.from('reports').insert({
      publication_id: pub.id, reported_by: user.id, reason, description: desc.trim() || null,
    })
    if (error) { setReportMsg('Lỗi: ' + error.message); return }
    setReportMsg('Đã gửi báo cáo. Cảm ơn bạn, quản trị viên sẽ xem xét.')
    setDesc('')
  }

  if (loading) return <main className="container page"><div className="empty">Đang tải...</div></main>
  if (!pub) return (
    <main className="container page">
      <div className="empty">
        Không tìm thấy nghiên cứu này (có thể chưa được duyệt).<br />
        <Link to="/research" className="link-btn">← Về Kho nghiên cứu</Link>
      </div>
    </main>
  )

  const code = `RP-${pub.publication_year || 0}-${String(pub.id).padStart(5, '0')}`

  return (
    <main className="container page">
      <Link to="/research" className="back"><ArrowLeft size={16} /> Kho nghiên cứu</Link>

      <div className="detail">
        <article className="detail-main">
          <div className="row-between" style={{ alignItems: 'center' }}>
            <span className="badge">{typeNames[pub.publication_type] || 'Khác'}</span>
            <div className="actions">
              <button className={`btn btn-ghost ${fav ? 'fav-on' : ''}`} onClick={toggleFav}>
                <Heart size={16} fill={fav ? 'currentColor' : 'none'} /> {fav ? 'Đã yêu thích' : 'Yêu thích'}
              </button>
              <button className="btn btn-ghost" onClick={openReport}><Flag size={16} /> Báo cáo</button>
            </div>
          </div>
          <h1>{pub.title}</h1>

          <div className="author-list">
            {pub.authors.map(a => (
              <Link to={`/researchers/${a.id}`} key={a.id} className="author-pill">
                <span className="mini-avatar">{a.full_name.split(' ').pop()[0]}</span>
                {a.full_name}{a.corresponding && ' ★'}
              </Link>
            ))}
          </div>

          <div className="facts">
            <span><Calendar size={15} /> {pub.publication_year}</span>
            <span><BookOpen size={15} /> {pub.journal}</span>
            <span><Quote size={15} /> {pub.citation_count} trích dẫn</span>
          </div>

          <h2>Tóm tắt</h2>
          <p className="abstract">{pub.abstract || 'Chưa có tóm tắt.'}</p>

          <h2>Lĩnh vực</h2>
          <div className="tags">
            {pub.areas.map(a => <span className="tag-sm" key={a.id}>{a.name}</span>)}
          </div>

          <h2>Trích dẫn</h2>
          <div className="cite-box">
            <div className="cite-tabs">
              {['APA', 'IEEE', 'MLA', 'BibTeX'].map(s => (
                <button key={s} className={style === s ? 'on' : ''} onClick={() => setStyle(s)}>{s}</button>
              ))}
            </div>
            <pre className="cite-text">{citations[style]}</pre>
            <button className="btn btn-primary" onClick={copy}>
              {copied ? <><Check size={16} /> Đã copy</> : <><Copy size={16} /> Copy trích dẫn</>}
            </button>
          </div>
        </article>

        <aside className="detail-side">
          <div className="side-card">
            <h3>Thông tin xuất bản</h3>
            <dl>
              <dt><Hash size={13} /> Mã nghiên cứu</dt><dd>{code}</dd>
              <dt>DOI</dt><dd>{pub.doi || '—'}</dd>
              <dt>ISSN</dt><dd>{pub.issn || '—'}</dd>
              <dt>ISBN</dt><dd>{pub.isbn || '—'}</dd>
            </dl>
            {pub.pdf_url && (
              <a className="btn btn-primary" style={{ marginTop: 16, width: '100%', justifyContent: 'center' }}
                href={pub.pdf_url} target="_blank" rel="noreferrer">Đọc / tải PDF</a>
            )}
          </div>
        </aside>
      </div>

      {related.length > 0 && (
        <section className="section">
          <div className="section-head"><h2>Có thể bạn quan tâm</h2></div>
          <div className="grid-3">
            {related.map(p => (
              <Link to={`/research/${p.id}`} className="card" key={p.id}>
                <span className="badge">{typeNames[p.publication_type] || 'Khác'}</span>
                <h3>{p.title}</h3>
                <p className="authors">{p.authors.map(a => a.full_name).join(', ')}</p>
                <div className="meta">
                  <span>{p.publication_year}</span>
                  <span>{p.citation_count} trích dẫn</span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {showReport && (
        <div className="modal-bg" onClick={() => setShowReport(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="row-between" style={{ alignItems: 'center' }}>
              <h3>Báo cáo nghiên cứu</h3>
              <button className="icon-btn" style={{ color: '#64748b' }} onClick={() => setShowReport(false)}><X size={18} /></button>
            </div>
            <div className="radio-list">
              {reasons.map(r => (
                <label key={r}><input type="radio" checked={reason === r} onChange={() => setReason(r)} /> {r}</label>
              ))}
            </div>
            <textarea rows={3} value={desc} onChange={e => setDesc(e.target.value)} placeholder="Mô tả thêm (không bắt buộc)..." />
            {reportMsg && <div className={reportMsg.startsWith('Đã') ? 'ok-msg' : 'auth-error'} style={{ marginTop: 12 }}>{reportMsg}</div>}
            <div className="form-actions">
              <button className="btn btn-ghost" onClick={() => setShowReport(false)}>Đóng</button>
              <button className="btn btn-primary" onClick={sendReport}>Gửi báo cáo</button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}