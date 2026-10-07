import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Plus, X, Star, AlertTriangle } from 'lucide-react'
import { supabase } from '../supabase'
import { useAuth } from '../AuthContext'
import FileUpload from '../components/FileUpload'

const types = {
  JOURNAL: 'Bài báo tạp chí', CONFERENCE: 'Hội nghị', BOOK: 'Sách',
  BOOK_CHAPTER: 'Chương sách', THESIS: 'Luận văn / luận án',
  RESEARCH_PROJECT: 'Đề tài nghiên cứu', OTHER: 'Khác',
}
const clean = s => (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase()
const blank = {
  title: '', abstract: '', publication_type: 'JOURNAL',
  publication_year: new Date().getFullYear(),
  journal: '', volume: '', issue: '', pages: '', doi: '', issn: '', isbn: '',
  pdf_url: '', keywords: '',
}

export default function PublicationForm() {
  const { id } = useParams()
  const editing = Boolean(id)
  const { user, researcher, ready } = useAuth()
  const navigate = useNavigate()

  const [f, setF] = useState(blank)
  const [areas, setAreas] = useState([])
  const [areaIds, setAreaIds] = useState([])
  const [allRes, setAllRes] = useState([])
  const [authors, setAuthors] = useState([])
  const [q, setQ] = useState('')
  const [newName, setNewName] = useState('')
  const [similar, setSimilar] = useState([])
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [loaded, setLoaded] = useState(!editing)

  useEffect(() => { if (ready && !user) navigate('/login') }, [ready, user, navigate])

  useEffect(() => {
    supabase.from('research_areas').select('id,name').order('id').then(({ data }) => setAreas(data || []))
    supabase.from('researchers').select('id,full_name,academic_title').order('full_name')
      .then(({ data }) => setAllRes(data || []))
  }, [])

  // Tác giả mặc định là chính mình
  useEffect(() => {
    if (!editing && researcher && authors.length === 0) {
      setAuthors([{ id: researcher.id, full_name: researcher.full_name, corresponding: true }])
    }
  }, [researcher, editing]) // eslint-disable-line

  // Nạp dữ liệu khi sửa
  useEffect(() => {
    if (!editing || !user) return
    async function load() {
      const { data: p } = await supabase.from('publications').select(`*,
        publication_authors(author_order,is_corresponding,researchers(id,full_name)),
        publication_research_areas(research_area_id),
        publication_keywords(keywords(name))`).eq('id', id).maybeSingle()
      if (!p || p.created_by !== user.id || !['DRAFT', 'REJECTED'].includes(p.status)) {
        navigate('/dashboard'); return
      }
      setF({
        title: p.title || '', abstract: p.abstract || '',
        publication_type: p.publication_type, publication_year: p.publication_year || '',
        journal: p.journal || '', volume: p.volume || '', issue: p.issue || '', pages: p.pages || '',
        doi: p.doi || '', issn: p.issn || '', isbn: p.isbn || '', pdf_url: p.pdf_url || '',
        keywords: p.publication_keywords.map(k => k.keywords.name).join(', '),
      })
      setAreaIds(p.publication_research_areas.map(a => a.research_area_id))
      setAuthors([...p.publication_authors].sort((a, b) => a.author_order - b.author_order)
        .map(a => ({ id: a.researchers.id, full_name: a.researchers.full_name, corresponding: a.is_corresponding })))
      setLoaded(true)
    }
    load()
  }, [id, user]) // eslint-disable-line

  // Phát hiện trùng lặp theo tiêu đề
  useEffect(() => {
    if (f.title.trim().length < 10) { setSimilar([]); return }
    const t = setTimeout(async () => {
      const { data } = await supabase.rpc('find_similar_publications', { t: f.title.trim() })
      setSimilar(data || [])
    }, 600)
    return () => clearTimeout(t)
  }, [f.title])

  const set = k => e => setF({ ...f, [k]: e.target.value })
  const toggleArea = aid => setAreaIds(a => a.includes(aid) ? a.filter(x => x !== aid) : [...a, aid])

  const suggestions = useMemo(() => {
    const k = clean(q.trim())
    if (!k) return []
    return allRes.filter(r => !authors.some(a => a.id === r.id) && clean(r.full_name).includes(k)).slice(0, 5)
  }, [q, allRes, authors])

  function addAuthor(r) {
    setAuthors([...authors, { id: r.id, full_name: r.full_name, corresponding: false }])
    setQ('')
  }
  async function createAuthor() {
    const name = newName.trim()
    if (name.length < 2) return
    const { data, error } = await supabase.from('researchers').insert({ full_name: name }).select('id,full_name').single()
    if (error) { setErr(error.message); return }
    setAllRes([...allRes, data])
    setAuthors([...authors, { id: data.id, full_name: data.full_name, corresponding: false }])
    setNewName('')
  }
  const removeAuthor = aid => setAuthors(authors.filter(a => a.id !== aid))
  const setCorr = aid => setAuthors(authors.map(a => ({ ...a, corresponding: a.id === aid })))
  const move = (i, d) => {
    const j = i + d
    if (j < 0 || j >= authors.length) return
    const copy = [...authors];[copy[i], copy[j]] = [copy[j], copy[i]]
    setAuthors(copy)
  }

  async function save(status) {
    setErr('')
    if (f.title.trim().length < 5) { setErr('Vui lòng nhập tiêu đề (ít nhất 5 ký tự).'); return }
    if (authors.length === 0) { setErr('Cần có ít nhất một tác giả.'); return }
    const year = parseInt(f.publication_year, 10)
    if (!year || year < 1950 || year > new Date().getFullYear() + 1) { setErr('Năm công bố không hợp lệ.'); return }
    if (status === 'PENDING') {
      if (!f.abstract.trim()) { setErr('Cần nhập tóm tắt trước khi gửi duyệt.'); return }
      if (areaIds.length === 0) { setErr('Hãy chọn ít nhất một lĩnh vực trước khi gửi duyệt.'); return }
    }
    setBusy(true)
    const t = v => (String(v).trim() || null)
    const payload = {
      title: f.title.trim(), abstract: t(f.abstract), publication_type: f.publication_type,
      publication_year: year, journal: t(f.journal), volume: t(f.volume), issue: t(f.issue),
      pages: t(f.pages), doi: t(f.doi), issn: t(f.issn), isbn: t(f.isbn), pdf_url: t(f.pdf_url),
      status, admin_note: null, updated_at: new Date().toISOString(),
    }
    let pid = id
    if (editing) {
      const { error } = await supabase.from('publications').update(payload).eq('id', id)
      if (error) { setErr(error.message); setBusy(false); return }
      await supabase.from('publication_authors').delete().eq('publication_id', id)
      await supabase.from('publication_research_areas').delete().eq('publication_id', id)
      await supabase.from('publication_keywords').delete().eq('publication_id', id)
    } else {
      const { data, error } = await supabase.from('publications')
        .insert({ ...payload, created_by: user.id }).select('id').single()
      if (error) { setErr(error.message); setBusy(false); return }
      pid = data.id
    }

    const a = await supabase.from('publication_authors').insert(authors.map((x, i) => ({
      publication_id: pid, researcher_id: x.id, author_order: i + 1, is_corresponding: x.corresponding,
    })))
    if (a.error) { setErr(a.error.message); setBusy(false); return }

    if (areaIds.length) {
      await supabase.from('publication_research_areas')
        .insert(areaIds.map(aid => ({ publication_id: pid, research_area_id: aid })))
    }

    const names = [...new Set(f.keywords.split(',').map(s => s.trim().toLowerCase()).filter(Boolean))]
    if (names.length) {
      await supabase.from('keywords').upsert(names.map(name => ({ name })), { onConflict: 'name', ignoreDuplicates: true })
      const { data: kws } = await supabase.from('keywords').select('id').in('name', names)
      if (kws?.length) {
        await supabase.from('publication_keywords')
          .insert(kws.map(k => ({ publication_id: pid, keyword_id: k.id })))
      }
    }
    setBusy(false)
    navigate('/dashboard')
  }

  if (!loaded) return <main className="container page"><div className="empty">Đang tải...</div></main>

  return (
    <main className="container page">
      <div className="page-head">
        <h1>{editing ? 'Sửa công trình' : 'Thêm công trình mới'}</h1>
        <p>Lưu nháp để làm tiếp sau, hoặc gửi duyệt để công trình xuất hiện trong kho công khai.</p>
      </div>

      <div className="form-card">
        <h2>Thông tin chính</h2>
        <div className="form-grid">
          <label className="wide">Tên công trình *
            <input value={f.title} onChange={set('title')} placeholder="Artificial Intelligence in Education" />
          </label>
          {similar.length > 0 && (
            <div className="wide warn">
              <AlertTriangle size={16} />
              <div>
                <b>Có thể trùng với công trình đã có:</b>
                {similar.map(s => (
                  <div key={s.id}>• {s.title} <span className="muted">(giống {Math.round(s.sim * 100)}%)</span></div>
                ))}
              </div>
            </div>
          )}
          <label>Loại tài liệu
            <select value={f.publication_type} onChange={set('publication_type')}>
              {Object.entries(types).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </label>
          <label>Năm công bố *
            <input type="number" value={f.publication_year} onChange={set('publication_year')} />
          </label>
          <label>Tạp chí / Hội nghị / Nhà xuất bản
            <input value={f.journal} onChange={set('journal')} />
          </label>
          <label className="wide">Tóm tắt
            <textarea rows={5} value={f.abstract} onChange={set('abstract')} placeholder="Nghiên cứu này tập trung vào..." />
          </label>
          <label className="wide">Từ khóa (cách nhau bằng dấu phẩy)
            <input value={f.keywords} onChange={set('keywords')} placeholder="AI, Machine Learning, Education" />
          </label>
        </div>

        <h2>Lĩnh vực nghiên cứu</h2>
        <div className="chips-pick">
          {areas.map(a => (
            <button type="button" key={a.id} className={areaIds.includes(a.id) ? 'on' : ''} onClick={() => toggleArea(a.id)}>
              {a.name}
            </button>
          ))}
        </div>

        <h2>Tác giả và đồng tác giả</h2>
        <div className="item-list">
          {authors.map((a, i) => (
            <div className="item" key={a.id}>
              <div><b>{i + 1}. {a.full_name}</b>{a.corresponding && <span className="item-sub"> ★ Tác giả chính</span>}</div>
              <div className="actions">
                <button type="button" className="link-btn" onClick={() => move(i, -1)}>↑</button>
                <button type="button" className="link-btn" onClick={() => move(i, 1)}>↓</button>
                <button type="button" className="link-btn" onClick={() => setCorr(a.id)}><Star size={14} /> Tác giả chính</button>
                {a.id !== researcher?.id && (
                  <button type="button" className="icon-btn" onClick={() => removeAuthor(a.id)}><X size={16} /></button>
                )}
              </div>
            </div>
          ))}
        </div>
        <div className="form-grid">
          <label>Tìm nhà nghiên cứu trong hệ thống
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Gõ tên..." />
            {suggestions.length > 0 && (
              <div className="suggest">
                {suggestions.map(r => (
                  <button type="button" key={r.id} onClick={() => addAuthor(r)}>
                    {r.full_name} <span className="muted">{r.academic_title}</span>
                  </button>
                ))}
              </div>
            )}
          </label>
          <label>Hoặc thêm tác giả chưa có tài khoản
            <div className="inline">
              <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Họ và tên" />
              <button type="button" className="btn btn-ghost" onClick={createAuthor}><Plus size={16} /></button>
            </div>
          </label>
        </div>

        <h2>Thông tin xuất bản</h2>
        <div className="form-grid">
          <label>DOI<input value={f.doi} onChange={set('doi')} placeholder="10.1000/xyz123" /></label>
          <label>ISSN<input value={f.issn} onChange={set('issn')} /></label>
          <label>ISBN<input value={f.isbn} onChange={set('isbn')} /></label>
          <label>Tập (Volume)<input value={f.volume} onChange={set('volume')} /></label>
          <label>Số (Issue)<input value={f.issue} onChange={set('issue')} /></label>
          <label>Trang<input value={f.pages} onChange={set('pages')} placeholder="12-25" /></label>
                    <div className="wide">
            <FileUpload value={f.pdf_url} userId={user?.id}
              onChange={v => setF(prev => ({ ...prev, pdf_url: v }))} />
          </div>
        </div>

        {err && <div className="auth-error" style={{ marginTop: 16 }}>{err}</div>}
        <div className="form-actions">
          <button className="btn btn-ghost" disabled={busy} onClick={() => save('DRAFT')}>Lưu nháp</button>
          <button className="btn btn-primary" disabled={busy} onClick={() => save('PENDING')}>
            {busy ? 'Đang lưu...' : 'Gửi kiểm duyệt'}
          </button>
        </div>
      </div>
    </main>
  )
}