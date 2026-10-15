import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Plus, X, Star, AlertTriangle, Wand2, CheckCircle2 } from 'lucide-react'
import { supabase } from '../supabase'
import { useAuth } from '../AuthContext'
import FileUpload from '../components/FileUpload'
import { extractDoi, fetchByDoi } from '../doiLookup'
import { suggestAreas } from '../areaSuggest'

const types = {
  JOURNAL: 'Bài báo tạp chí', CONFERENCE: 'Hội nghị', BOOK: 'Sách',
  BOOK_CHAPTER: 'Chương sách', THESIS: 'Luận văn / luận án',
  RESEARCH_PROJECT: 'Đề tài nghiên cứu', OTHER: 'Khác',
}
const clean = s => (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase().replace(/\s+/g, ' ').trim()
const blank = {
  title: '', abstract: '', publication_type: 'JOURNAL',
  publication_year: new Date().getFullYear(),
  journal: '', volume: '', issue: '', pages: '', doi: '', issn: '', isbn: '',
  pdf_url: '', keywords: '', citation_count: 0,
}

export default function PublicationForm() {
  const { id } = useParams()
  const editing = Boolean(id)
  const { user, researcher, ready } = useAuth()
  const navigate = useNavigate()

  const [f, setF] = useState(blank)
  const [areas, setAreas] = useState([])
  const [areaIds, setAreaIds] = useState([])
    const [sugg, setSugg] = useState([])
  const [suggTried, setSuggTried] = useState(false)
  const [allRes, setAllRes] = useState([])
  const [authors, setAuthors] = useState([])
  const [q, setQ] = useState('')
  const [newName, setNewName] = useState('')
  const [similar, setSimilar] = useState([])
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [loaded, setLoaded] = useState(!editing)

  // Nhập nhanh bằng DOI
  const [doiInput, setDoiInput] = useState('')
  const [doiBusy, setDoiBusy] = useState(false)
  const [doiMsg, setDoiMsg] = useState(null) // { ok, text }
  const [dupDoi, setDupDoi] = useState([])
  const [verifiedDoi, setVerifiedDoi] = useState('')
  const autoPublishReady = !editing && Boolean(verifiedDoi) && extractDoi(f.doi)?.toLowerCase() === verifiedDoi

  useEffect(() => { if (ready && !user) navigate('/login') }, [ready, user, navigate])

  useEffect(() => {
    supabase.from('research_areas').select('id,name,parent_id').order('id').then(({ data }) => setAreas(data || []))
    supabase.from('researchers').select('id,full_name,academic_title').order('full_name')
      .then(({ data }) => setAllRes(data || []))
  }, [])

  useEffect(() => {
    if (!editing && researcher && authors.length === 0) {
      setAuthors([{ id: researcher.id, full_name: researcher.full_name, corresponding: true }])
    }
  }, [researcher, editing]) // eslint-disable-line

  useEffect(() => {
    if (!editing || !user) return
    async function load() {
      const { data: p } = await supabase.from('publications').select(`*,
        publication_authors(author_order,is_corresponding,researchers(id,full_name)),
        publication_research_areas(research_area_id),
        publication_keywords(keywords(name))`).eq('id', id).maybeSingle()
      if (!p || p.created_by !== user.id || !['DRAFT', 'REJECTED', 'APPROVED'].includes(p.status)) {
        navigate('/dashboard'); return
      }
      setF({
        title: p.title || '', abstract: p.abstract || '', status: p.status,
        publication_type: p.publication_type, publication_year: p.publication_year || '',
        journal: p.journal || '', volume: p.volume || '', issue: p.issue || '', pages: p.pages || '',
        doi: p.doi || '', issn: p.issn || '', isbn: p.isbn || '', pdf_url: p.pdf_url || '',
        citation_count: p.citation_count || 0,
        keywords: (p.publication_keywords || []).map(k => k.keywords?.name).filter(Boolean).join(', '),
      })
      setAreaIds((p.publication_research_areas || []).map(a => a.research_area_id))
      setAuthors([...(p.publication_authors || [])].sort((a, b) => a.author_order - b.author_order)
        .filter(a => a.researchers).map(a => ({ id: a.researchers.id, full_name: a.researchers.full_name, corresponding: a.is_corresponding })))
      setLoaded(true)
    }
    load()
  }, [id, user]) // eslint-disable-line

  useEffect(() => {
    if (f.title.trim().length < 10) { setSimilar([]); return }
    const t = setTimeout(async () => {
      const { data } = await supabase.rpc('find_similar_publications', { t: f.title.trim() })
      setSimilar(data || [])
    }, 600)
    return () => clearTimeout(t)
  }, [f.title])

  // Nếu người dùng sửa dữ liệu thư mục học thuật sau khi tra cứu,
  // yêu cầu tra cứu DOI lại trước khi cho phép tự động công khai.
  const set = k => e => {
    if (['doi', 'title', 'publication_year', 'publication_type'].includes(k)) {
      setVerifiedDoi('')
      setDoiMsg(null)
    }
    setF(prev => ({ ...prev, [k]: e.target.value }))
  }
  const toggleArea = aid => setAreaIds(a => a.includes(aid) ? a.filter(x => x !== aid) : [...a, aid])
    function autoSuggest() {
    const picked = suggestAreas(areas, { title: f.title, keywords: f.keywords, abstract: f.abstract })
    setSugg(picked)
    setSuggTried(true)
    setAreaIds(prev => [...new Set([...prev, ...picked])])
  }

  async function lookup() {
    setDoiMsg(null); setDupDoi([]); setVerifiedDoi('')
    const doi = extractDoi(doiInput)
    if (!doi) {
      setDoiMsg({ ok: false, text: 'Không thấy DOI trong nội dung vừa dán. DOI bắt đầu bằng "10." (ví dụ 10.1038/nature14539). Nếu dán link của nhà xuất bản, hãy tìm DOI ghi trên trang bài báo.' })
      return
    }
    setDoiBusy(true)
    try {
      const d = await fetchByDoi(doi)
      if (!d?.doi || !d?.title) throw new Error('Không xác minh được DOI.')

      // Kiểm tra DOI đã có trong hệ thống chưa
      const { data: dup } = await supabase.from('publications').select('id,title,status').ilike('doi', doi)
      setDupDoi((dup || []).filter(x => String(x.id) !== String(id)))

      // Ghép tác giả: trùng tên với người đã có thì dùng lại, còn lại tạo mới khi lưu
      const list = d.authors.map((name, i) => {
        const hit = allRes.find(r => clean(r.full_name) === clean(name))
          || (researcher && clean(researcher.full_name) === clean(name) ? researcher : null)
        return hit
          ? { id: hit.id, full_name: hit.full_name, corresponding: i === 0 }
          : { id: `new-${i}`, full_name: name, corresponding: i === 0 }
      })
      if (list.length) setAuthors(list)

      setF(prev => ({
        ...prev,
        title: d.title || prev.title, abstract: d.abstract || prev.abstract,
        publication_type: d.publication_type, publication_year: d.publication_year || prev.publication_year,
        journal: d.journal, volume: d.volume, issue: d.issue, pages: d.pages,
        doi: d.doi, issn: d.issn, isbn: d.isbn, keywords: d.keywords,
        citation_count: d.citation_count,
      }))
            const picked = suggestAreas(areas, { title: d.title, keywords: d.keywords, abstract: d.abstract })
      setSugg(picked)
      setSuggTried(true)
      setAreaIds(prev => [...new Set([...prev, ...picked])])
      setVerifiedDoi(d.doi.trim().toLowerCase())
      setDoiMsg({ ok: true, text: `Đã điền thông tin  (${d.authors.length} tác giả, ${d.citation_count} trích dẫn). ${picked.length ? `Đã gợi ý ${picked.length} lĩnh vực ở mục bên dưới, hãy kiểm tra lại.` : 'Chưa gợi ý được lĩnh vực, hãy tự chọn.'} Nếu dữ liệu DOI khớp, bài sẽ công khai ngay sau khi bạn bấm Xác minh & công khai.` })
    } catch (e) {
      setDoiMsg({ ok: false, text: e.message })
    }
    setDoiBusy(false)
  }

  const suggestions = useMemo(() => {
    const k = clean(q)
    if (!k) return []
    return allRes.filter(r => !authors.some(a => a.id === r.id) && clean(r.full_name).includes(k)).slice(0, 5)
  }, [q, allRes, authors])

  function addAuthor(r) {
    setAuthors([...authors, { id: r.id, full_name: r.full_name, corresponding: false }])
    setQ('')
  }
  function addNewAuthor() {
    const name = newName.trim()
    if (name.length < 2) return
    setAuthors([...authors, { id: `new-${Date.now()}`, full_name: name, corresponding: false }])
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

  async function save(requestedStatus) {
    setErr('')
    // Chỉ công khai ngay khi DOI đã được tra cứu thành công ở phiên này.
    // Bài đang chỉnh sửa vẫn gửi duyệt lại để tránh sửa nội dung đã xác minh.
    const isVerifiedDoi = autoPublishReady
    const status = requestedStatus // Trình duyệt không tự ghi APPROVED
    if (f.title.trim().length < 5) { setErr('Vui lòng nhập tiêu đề (ít nhất 5 ký tự).'); return }
    if (authors.length === 0) { setErr('Cần có ít nhất một tác giả.'); return }
    const year = parseInt(f.publication_year, 10)
    if (!year || year < 1950 || year > new Date().getFullYear() + 1) { setErr('Năm công bố không hợp lệ.'); return }
    if (status === 'PENDING' || status === 'APPROVED') {
      if (areaIds.length === 0) { setErr('Hãy chọn ít nhất một lĩnh vực trước khi gửi duyệt.'); return }
    }
    // Ngăn một tài khoản tạo lại cùng DOI, kể cả bài đã công khai hoặc đang chờ duyệt.
    const normalizedDoi = extractDoi(f.doi)?.toLowerCase()
    if (normalizedDoi && user?.id) {
      const { data: ownDoi, error: doiReadError } = await supabase.from('publications')
        .select('id,doi,title').eq('created_by', user.id).not('doi', 'is', null)
      if (doiReadError) { setErr('Không kiểm tra được DOI trùng: ' + doiReadError.message); return }
      const existing = (ownDoi || []).find(p => String(p.id) !== String(id || '') &&
        extractDoi(p.doi)?.toLowerCase() === normalizedDoi)
      if (existing) { setErr('Bạn đã đăng DOI này ở công trình "' + existing.title + '". Hãy sửa công trình cũ thay vì thêm mới.'); return }
    }
    setBusy(true)
    const t = v => (String(v ?? '').trim() || null)
    const payload = {
      title: f.title.trim(), abstract: t(f.abstract), publication_type: f.publication_type,
      publication_year: year, journal: t(f.journal), volume: t(f.volume), issue: t(f.issue),
      pages: t(f.pages), doi: t(f.doi), issn: t(f.issn), isbn: t(f.isbn), pdf_url: t(f.pdf_url),
      citation_count: Number(f.citation_count) || 0,
      status, admin_note: null, updated_at: new Date().toISOString(),
    }

    // Tạo hồ sơ cho các tác giả chưa có trong hệ thống
    const resolved = []
    for (const a of authors) {
      if (String(a.id).startsWith('new-')) {
        const { data, error } = await supabase.from('researchers')
          .insert({ full_name: a.full_name }).select('id').single()
        if (error) { setErr(error.message); setBusy(false); return }
        resolved.push({ ...a, id: data.id })
      } else resolved.push(a)
    }

    let pid = id
    if (editing) {
      const { data: updated, error } = await supabase.from('publications')
        .update(payload).eq('id', id).eq('created_by', user.id).select('id')
      if (error || !updated?.length) {
        setErr(error?.message || 'Không thể sửa bài: không phải chủ sở hữu hoặc thiếu quyền trong Supabase.')
        setBusy(false)
        return
      }
      for (const table of ['publication_authors', 'publication_research_areas', 'publication_keywords']) {
        const { error: unlinkError } = await supabase.from(table).delete().eq('publication_id', id)
        if (unlinkError) { setErr('Không cập nhật được liên kết ' + table + ': ' + unlinkError.message); setBusy(false); return }
      }
    } else {
      const { data, error } = await supabase.from('publications')
        .insert({ ...payload, created_by: user.id }).select('id').single()
      if (error) { setErr(error.message); setBusy(false); return }
      pid = data.id
    }

    const a = await supabase.from('publication_authors').insert(resolved.map((x, i) => ({
      publication_id: pid, researcher_id: x.id, author_order: i + 1, is_corresponding: x.corresponding,
    })))
    if (a.error) { setErr(a.error.message); setBusy(false); return }

    if (areaIds.length) {
      const { error: areaError } = await supabase.from('publication_research_areas')
        .insert(areaIds.map(aid => ({ publication_id: pid, research_area_id: aid })))
      if (areaError) { setErr('Lỗi lưu lĩnh vực: ' + areaError.message); setBusy(false); return }
    }

    const names = [...new Set(f.keywords.split(',').map(s => s.trim().toLowerCase()).filter(Boolean))]
    if (names.length) {
      const { error: kwError } = await supabase.from('keywords').upsert(
        names.map(name => ({ name })), { onConflict: 'name', ignoreDuplicates: true })
      if (kwError) { setErr('Lỗi lưu từ khóa: ' + kwError.message); setBusy(false); return }
      const { data: kws, error: kwReadError } = await supabase.from('keywords').select('id').in('name', names)
      if (kwReadError) { setErr(kwReadError.message); setBusy(false); return }
      if (kws?.length) {
        const { error: attachError } = await supabase.from('publication_keywords')
          .insert(kws.map(k => ({ publication_id: pid, keyword_id: k.id })))
        if (attachError) { setErr('Lỗi gắn từ khóa: ' + attachError.message); setBusy(false); return }
      }
    }
    // Gọi Edge Function ngay trong thao tác đăng bài: không phải chờ Admin xét duyệt.
    // PENDING chỉ là trạng thái nội bộ tạm thời trước khi xác minh DOI phía máy chủ.
    if (status === 'PENDING' && isVerifiedDoi) {
      const { data: outcome, error: approvalError } = await supabase.functions.invoke('verify-publication-doi', {
        body: { publication_id: pid },
      })
      if (approvalError || !outcome?.approved) {
        setErr('Không thể công khai tự động. Công trình đã được lưu tạm ở trạng thái Chờ duyệt; nguyên nhân: ' +
          (outcome?.error || approvalError?.message || 'DOI chưa xác minh thành công.') +
          ' Bạn có thể kiểm tra lại DOI và dữ liệu bài báo, sau đó liên hệ quản trị viên nếu lỗi vẫn tiếp diễn.')
        setBusy(false)
        return
      }
    }
    setBusy(false)
    navigate('/dashboard', { state: { submitted: status === 'PENDING' && !isVerifiedDoi, doiPublished: Boolean(isVerifiedDoi && status === 'PENDING') } })
  }

  if (!loaded) return <main className="container page"><div className="empty">Đang tải...</div></main>

  return (
    <main className="container page">
      <div className="page-head">
        <h1>{editing ? 'Sửa công trình' : 'Thêm công trình mới'}</h1>
        <p>{editing ? 'Bạn có thể cập nhật thông tin công trình. Nếu sửa công trình đã công khai, bài sẽ chuyển sang chờ duyệt lại.' : 'Bài tra cứu DOI hợp lệ sẽ tự động công khai ngay sau khi xác minh trên máy chủ. Bài nhập thủ công cần Admin duyệt.'}</p>
      </div>

      {!editing && (
        <div className="form-card doi-card">
          <h2><Wand2 size={18} style={{ verticalAlign: '-3px' }} /> Nhập nhanh bằng DOI</h2>
          <p className="hint">Dán DOI hoặc đường dẫn doi.org để hệ thống tự động điền thông tin và xác minh trước khi công khai. Ví dụ: 10.1038/nature14539</p>
          <div className="inline" style={{ marginTop: 12 }}>
            <input value={doiInput} onChange={e => setDoiInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); lookup() } }}
              placeholder="10.xxxx/xxxxx hoặc https://doi.org/10.xxxx/xxxxx" />
            <button type="button" className="btn btn-primary" onClick={lookup} disabled={doiBusy || !doiInput.trim()}>
              {doiBusy ? 'Đang tìm...' : 'Tự động điền'}
            </button>
          </div>
          {doiMsg && (
            <div className={doiMsg.ok ? 'ok-msg' : 'auth-error'} style={{ marginTop: 12 }}>
              {doiMsg.ok && <CheckCircle2 size={14} style={{ verticalAlign: '-2px' }} />} {doiMsg.text}
            </div>
          )}
          {dupDoi.length > 0 && (
            <div className="warn" style={{ marginTop: 12 }}>
              <AlertTriangle size={16} />
              <div><b>DOI này đã có trong hệ thống:</b>
                {dupDoi.map(d => <div key={d.id}>• {d.title}</div>)}
              </div>
            </div>
          )}
        </div>
      )}

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
          <label className="wide">Tóm tắt (không bắt buộc)
            <textarea rows={5} value={f.abstract} onChange={set('abstract')} placeholder="Nghiên cứu này tập trung vào..." />
          </label>
          <label className="wide">Từ khóa (cách nhau bằng dấu phẩy)
            <input value={f.keywords} onChange={set('keywords')} placeholder="AI, Machine Learning, Education" />
          </label>
        </div>

                <div className="row-between" style={{ alignItems: 'center' }}>
          <h2>Lĩnh vực nghiên cứu</h2>
          <button type="button" className="btn btn-ghost" onClick={autoSuggest}><Wand2 size={15} /> Gợi ý lĩnh vực</button>
        </div>
        <div className="chips-pick">
                  {areas.filter(a => !a.parent_id).map(root => {
          const kids = areas.filter(a => a.parent_id === root.id)
          const grand = areas.filter(a => kids.some(k => k.id === a.parent_id))
          const group = [root, ...kids, ...grand]
          return (
            <div key={root.id} className="area-group">
              <div className="area-title">{root.name}</div>
              <div className="chips-pick">
                {group.map(a => (
                  <button type="button" key={a.id}
                    className={areaIds.includes(a.id) ? 'on' : ''} onClick={() => toggleArea(a.id)}>
                    {a.name}{sugg.includes(a.id) && areaIds.includes(a.id) && ' ✦'}
                  </button>
                ))}
              </div>
            </div>
          )
        })}
        </div>
        {suggTried && (
          <p className="hint" style={{ marginTop: 10 }}>
            {sugg.length
              ? 'Các ô có dấu ✦ được hệ thống gợi ý theo tiêu đề và từ khóa. Bạn bấm vào ô để bỏ chọn hoặc chọn thêm.'
              : 'Chưa tìm thấy lĩnh vực phù hợp, hãy tự chọn bên trên.'}
          </p>
        )}

        <h2>Tác giả và đồng tác giả</h2>
        <div className="item-list">
          {authors.map((a, i) => (
            <div className="item" key={a.id}>
              <div>
                <b>{i + 1}. {a.full_name}</b>
                {a.corresponding && <span className="item-sub"> ★ Tác giả chính</span>}
                {String(a.id).startsWith('new-') && <span className="item-sub"> · chưa có tài khoản</span>}
              </div>
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
              <button type="button" className="btn btn-ghost" onClick={addNewAuthor}><Plus size={16} /></button>
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
        <p className="hint" style={{ marginTop: 14 }}>DOI được tra cứu và xác minh thành công: công khai ngay, không cần Admin duyệt. Bài nhập thủ công vẫn gửi kiểm duyệt. Nếu bạn sửa tiêu đề, năm, loại bài hoặc DOI, hãy tra cứu lại.</p>
        <div className="form-actions">
          {!(editing && f.status === 'APPROVED') && (
            <button className="btn btn-ghost" disabled={busy} onClick={() => save('DRAFT')}>Lưu nháp</button>
          )}
          <button className="btn btn-primary" disabled={busy} onClick={() => save('PENDING')}>
            {busy ? (autoPublishReady ? 'Đang xác minh và công khai...' : 'Đang lưu...') : (autoPublishReady ? 'Xác minh & công khai ngay' : 'Gửi kiểm duyệt')}
          </button>
        </div>
      </div>
    </main>
  )
}