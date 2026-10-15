import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Check, X, ShieldCheck, Users, FileClock, ScrollText, Trash2, Search } from 'lucide-react'
import { supabase } from '../supabase'
import { useAuth } from '../AuthContext'
import { useUI } from '../ui'
import { approvePub } from '../review'
import Loading from '../components/Loading'
import ExportCvButton from '../components/ExportCvButton'

const typeNames = {
  JOURNAL: 'Bài báo', CONFERENCE: 'Hội nghị', BOOK: 'Sách',
  BOOK_CHAPTER: 'Chương sách', THESIS: 'Luận văn', RESEARCH_PROJECT: 'Đề tài', OTHER: 'Khác',
}
const statusName = { DRAFT: 'Bản nháp', PENDING: 'Chờ duyệt', APPROVED: 'Đã công khai', REJECTED: 'Bị từ chối', ARCHIVED: 'Lưu trữ' }
const statusCls = { DRAFT: 's-draft', PENDING: 's-pending', APPROVED: 's-ok', REJECTED: 's-bad', ARCHIVED: 's-draft' }
const fmt = d => new Date(d).toLocaleString('vi-VN')
const clean = s => (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase()

export default function Admin() {
  const { user, profile, isAdmin, ready } = useAuth()
  const { confirm, prompt, toast } = useUI()
  const navigate = useNavigate()
  const [tab, setTab] = useState('pending')
  const [pending, setPending] = useState([])
  const [allPubs, setAllPubs] = useState([])
  const [users, setUsers] = useState([])
  const [logs, setLogs] = useState([])
  const [stats, setStats] = useState({})
  const [q, setQ] = useState('')
  const [st, setSt] = useState('')
  const [interest, setInterest] = useState([])
  const [interestFilter, setInterestFilter] = useState('all')
  const [userSearch, setUserSearch] = useState('')
  const [yearQuarter, setYearQuarter] = useState('')
  const [loadError, setLoadError] = useState('')

  useEffect(() => {
    if (!ready) return
    if (!user) navigate('/login')
    else if (profile && !isAdmin) navigate('/')
  }, [ready, user, profile, isAdmin, navigate])

  async function loadAll() {
    setLoadError('')
    const [p, u, l, a, pe, us, ap, interests] = await Promise.all([
      supabase.from('publications')
        .select('id,title,abstract,doi,publication_type,publication_year,journal,created_at,publication_authors(author_order,researchers(full_name))')
        .eq('status', 'PENDING').order('created_at'),
      supabase.from('profiles').select('id,email,role,created_at,researchers(id,full_name)').order('created_at', { ascending: false }),
      supabase.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(50),
      supabase.from('publications').select('*', { count: 'exact', head: true }).eq('status', 'APPROVED'),
      supabase.from('publications').select('*', { count: 'exact', head: true }).eq('status', 'PENDING'),
      supabase.from('profiles').select('*', { count: 'exact', head: true }),
      supabase.from('publications')
        .select('id,title,status,publication_year,created_at,pdf_url,publication_authors(author_order,researchers(full_name))')
        .order('created_at', { ascending: false }).range(0, 1999),
      supabase.rpc('admin_interest_flags'),
    ])
    setPending(p.data || []); setUsers(u.data || []); setLogs(l.data || []); setAllPubs(ap.data || [])
    setStats({ approved: a.count, pending: pe.count, users: us.count })
    setInterest(interests.data || [])
    const errors = [p, u, ap, interests].filter(x => x.error).map(x => x.error.message)
    if (errors.length) setLoadError(errors.join(' • '))
  }
  useEffect(() => { if (isAdmin) loadAll() }, [isAdmin])

  const log = (action, type, eid, oldV, newV) =>
    supabase.from('audit_logs').insert({
      user_id: user.id, action, entity_type: type, entity_id: String(eid), old_value: oldV, new_value: newV,
    })

  async function approve(p) {
    try {
      const c = await approvePub(p, user.id)
      toast(c != null ? `Đã duyệt công trình (trích dẫn xác thực: ${c}).` : 'Đã duyệt công trình.', 'success')
      loadAll()
    } catch (e) { toast('Không duyệt được: ' + e.message, 'error') }
  }

  async function reject(p) {
    const note = await prompt({
      title: 'Từ chối công trình', message: p.title,
      label: 'Lý do từ chối (người nộp sẽ thấy)', placeholder: 'Ví dụ: Thiếu tóm tắt, sai thông tin tác giả...',
      confirmText: 'Từ chối', danger: true,
    })
    if (note === null) return
    const { error } = await supabase.from('publications').update({ status: 'REJECTED', admin_note: note || 'Chưa đạt yêu cầu' }).eq('id', p.id)
    if (error) { toast(error.message, 'error'); return }
    await log('REJECT', 'PUBLICATION', p.id, { status: 'PENDING' }, { status: 'REJECTED', note })
    toast('Đã từ chối công trình.', 'success')
    loadAll()
  }

  async function deletePub(p) {
    const ok = await confirm({
      title: 'Xóa công trình này?',
      message: `"${p.title}" sẽ bị xóa vĩnh viễn cùng danh sách tác giả, lượt yêu thích và báo cáo liên quan. Không thể hoàn tác.`,
      confirmText: 'Xóa vĩnh viễn', danger: true,
    })
    if (!ok) return
    const { error } = await supabase.from('publications').delete().eq('id', p.id)
    if (error) { toast('Không xóa được: ' + error.message, 'error'); return }
    // Xóa file đính kèm nếu nằm trong kho của hệ thống
    if (p.pdf_url && !/^https?:\/\//i.test(p.pdf_url)) {
      await supabase.storage.from('documents').remove([p.pdf_url])
    }
    await log('DELETE_PUBLICATION', 'PUBLICATION', p.id, { title: p.title, status: p.status }, null)
    toast('Đã xóa công trình.', 'success')
    loadAll()
  }

  async function changeRole(u, role) {
    const ok = await confirm({
      title: 'Đổi vai trò người dùng?', message: `${u.email}: ${u.role} → ${role}`, confirmText: 'Đổi vai trò',
    })
    if (!ok) { loadAll(); return }
    const { error } = await supabase.from('profiles').update({ role }).eq('id', u.id)
    if (error) { toast(error.message, 'error'); return }
    await log('CHANGE_ROLE', 'USER', u.id, { role: u.role }, { role })
    toast('Đã đổi vai trò.', 'success')
    loadAll()
  }

  async function deleteUser(u) {
    // Bước 1: gõ lại email để xác nhận
    const typed = await prompt({
      title: 'Xóa tài khoản người dùng?',
      message: `Tài khoản ${u.email} sẽ không thể đăng nhập nữa. Thao tác không thể hoàn tác.`,
      label: 'Gõ lại email của tài khoản để xác nhận', placeholder: u.email,
      confirmText: 'Tiếp tục', danger: true, required: true,
    })
    if (typed === null) return
    if (typed.trim().toLowerCase() !== u.email.toLowerCase()) {
      toast('Email xác nhận không khớp, chưa xóa gì.', 'error'); return
    }
    // Bước 2: giữ hay xóa công trình của họ (Esc hoặc bấm Giữ lại = giữ)
    const removeContent = await confirm({
      title: 'Xử lý hồ sơ và công trình của tài khoản này',
      message: 'Chọn "Xóa cả công trình" để xóa luôn hồ sơ nhà nghiên cứu và mọi công trình tài khoản này đã đăng. Chọn "Giữ lại" để chỉ xóa tài khoản (hồ sơ và bài vẫn còn, hiển thị là chưa có tài khoản).',
      confirmText: 'Xóa cả công trình', cancelText: 'Giữ lại', danger: true,
    })
    const { error } = await supabase.rpc('admin_delete_user', { uid: u.id, remove_content: removeContent })
    if (error) { toast('Không xóa được: ' + error.message, 'error'); return }
    toast('Đã xóa tài khoản.', 'success')
    loadAll()
  }

  const shownPubs = useMemo(() => {
    const k = clean(q.trim())
    return allPubs.filter(p =>
      (!st || p.status === st) &&
      (!k || clean(p.title + ' ' + p.publication_authors.map(a => a.researchers.full_name).join(' ')).includes(k)))
  }, [allPubs, q, st])

  const flagsByResearcher = useMemo(() => new Map(interest.map(x => [String(x.researcher_id), x])), [interest])
  const userRows = useMemo(() => users.filter(u => {
    const r = Array.isArray(u.researchers) ? u.researchers[0] : u.researchers
    const flags = flagsByResearcher.get(String(r?.id)) || {}
    const matchesType = interestFilter === 'all' ||
      (interestFilter === 'lecture' && flags.available_guest_lecturing) ||
      (interestFilter === 'consult' && flags.available_business_consulting) ||
      (interestFilter === 'both' && flags.available_guest_lecturing && flags.available_business_consulting)
    return matchesType && clean([u.email, r?.full_name].join(' ')).includes(clean(userSearch))
  }), [users, flagsByResearcher, interestFilter, userSearch])
  const quarterlyYears = useMemo(() => [...new Set(allPubs.map(p => new Date(p.created_at).getFullYear()).filter(Number.isFinite))].sort((x,y)=>y-x), [allPubs])
  const selectedYear = yearQuarter ? Number(yearQuarter) : (quarterlyYears[0] ?? new Date().getFullYear())
  const quarterly = useMemo(() => [1,2,3,4].map(q => {
    const matching = allPubs.filter(p => {
      const date = new Date(p.created_at)
      return !Number.isNaN(date.getTime()) && date.getFullYear() === selectedYear && Math.floor(date.getMonth()/3)+1 === q
    })
    return { q, count: matching.length, approved: matching.filter(p => p.status === 'APPROVED').length,
      pending: matching.filter(p => p.status === 'PENDING').length }
  }), [allPubs, selectedYear])
  const maxQuarter = Math.max(1, ...quarterly.map(q => q.count))
  const lectureCount = interest.filter(x => x.available_guest_lecturing).length
  const consultCount = interest.filter(x => x.available_business_consulting).length

  if (!isAdmin) return <main className="container page"><Loading text="Đang kiểm tra quyền..." /></main>

  const nameOf = u => (Array.isArray(u.researchers) ? u.researchers[0] : u.researchers)?.full_name || '—'
  const researcherOf = u => Array.isArray(u.researchers) ? u.researchers[0] : u.researchers

  return (
    <main className="container page">
      <div className="page-head">
        <h1>Quản trị hệ thống</h1>
        <p>Kiểm duyệt công trình, theo dõi báo cáo và kết nối giảng viên với hoạt động chuyên môn.</p>
      </div>

      {loadError && <div className="auth-error" role="alert">Không tải được một phần dữ liệu quản trị: {loadError}. Nếu thiếu hàm SQL, hãy chạy file SQL đi kèm.</div>}
      <div className="cv-stats" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', marginTop: 24 }}>
        <div><Users size={18} /><b>{stats.users ?? '…'}</b><span>Tài khoản</span></div>
        <div><ShieldCheck size={18} /><b>{stats.approved ?? '…'}</b><span>Công trình công khai</span></div>
        <div><FileClock size={18} /><b>{stats.pending ?? '…'}</b><span>Đang chờ duyệt</span></div>
        <div><Users size={18} /><b>{lectureCount}</b><span>Sẵn sàng thỉnh giảng</span></div>
        <div><Users size={18} /><b>{consultCount}</b><span>Tư vấn doanh nghiệp</span></div>
      </div>

      <div className="cite-tabs" style={{ marginBottom: 16, flexWrap: 'wrap' }}>
        <button className={tab === 'pending' ? 'on' : ''} onClick={() => setTab('pending')}>Chờ duyệt ({pending.length})</button>
        <button className={tab === 'pubs' ? 'on' : ''} onClick={() => setTab('pubs')}>Công trình ({allPubs.length})</button>
        <button className={tab === 'users' ? 'on' : ''} onClick={() => setTab('users')}>Người dùng ({users.length})</button>
        <button className={tab === 'quarter' ? 'on' : ''} onClick={() => setTab('quarter')}>Thống kê theo quý</button>
        <button className={tab === 'opportunities' ? 'on' : ''} onClick={() => setTab('opportunities')}>Thỉnh giảng & tư vấn</button>
        <button className={tab === 'logs' ? 'on' : ''} onClick={() => setTab('logs')}><ScrollText size={13} /> Nhật ký</button>
      </div>

      {tab === 'quarter' && (
        <section className="card" style={{ padding: 22 }}>
          <div className="row-between" style={{ gap: 16, flexWrap: 'wrap' }}>
            <div><h2 style={{ margin: 0 }}>Thống kê công trình theo quý</h2>
              <p className="hint">Tính theo ngày tải lên hệ thống, không phải năm xuất bản. Gồm mọi trạng thái.</p></div>
            <label>Năm tải lên{' '}
              <select value={selectedYear} onChange={e => setYearQuarter(e.target.value)}>
                {quarterlyYears.length === 0 && <option value={selectedYear}>{selectedYear}</option>}
                {quarterlyYears.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </label>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,minmax(0,1fr))', gap: 12 }}>
            {quarterly.map(item => <div key={item.q} style={{ textAlign: 'center', minWidth: 0 }}>
              <div style={{ background: '#f1f5fc', borderRadius: 10, height: 150, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', alignItems: 'center', padding: 12 }}>
                <b>{item.count}</b>
                <div style={{ width: '65%', maxWidth: 85, height: Math.max(3,item.count/maxQuarter*90), background: '#3458d4', borderRadius: '6px 6px 0 0' }} />
              </div>
              <strong>Quý {item.q}</strong>
              <div className="hint">{item.approved} công khai • {item.pending} chờ duyệt</div>
            </div>)}
          </div>
          <p className="hint">Thống kê từ {allPubs.length} công trình đã tải vào danh sách quản trị (tối đa 2.000 bản ghi). Để báo cáo chính thức với dữ liệu lớn, cần thống kê trực tiếp bằng SQL.</p>
        </section>
      )}
      {tab === 'opportunities' && (
        <section className="card" style={{ padding: 20 }}>
          <h2 style={{ marginTop: 0 }}>Nhu cầu thỉnh giảng và tư vấn doanh nghiệp</h2>
          <p className="hint">Chỉ quản trị viên xem được thông tin đăng ký từ hồ sơ riêng tư. Không hiển thị CCCD, địa chỉ hoặc số điện thoại riêng tư.</p>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
            <select aria-label="Lọc nhu cầu" value={interestFilter} onChange={e => setInterestFilter(e.target.value)}>
              <option value="all">Tất cả tài khoản</option>
              <option value="lecture">Muốn thỉnh giảng</option>
              <option value="consult">Muốn tư vấn doanh nghiệp</option>
              <option value="both">Cả hai hoạt động</option>
            </select>
            <input aria-label="Tìm người dùng" value={userSearch} onChange={e => setUserSearch(e.target.value)} placeholder="Tìm tên hoặc email..." />
          </div>
          <div className="table-wrap"><table><thead><tr><th>Nhà nghiên cứu</th><th>Email</th><th>Thỉnh giảng</th><th>Tư vấn doanh nghiệp</th><th>Hồ sơ</th></tr></thead><tbody>
            {userRows.filter(u => {
              const r = Array.isArray(u.researchers) ? u.researchers[0] : u.researchers
              const f = flagsByResearcher.get(String(r?.id)) || {}
              return f.available_guest_lecturing || f.available_business_consulting
            }).map(u => {
              const r = Array.isArray(u.researchers) ? u.researchers[0] : u.researchers
              const f = flagsByResearcher.get(String(r?.id)) || {}
              return <tr key={u.id}><td>{r?.full_name || '—'}</td><td>{u.email}</td><td>{f.available_guest_lecturing ? 'Có' : '—'}</td><td>{f.available_business_consulting ? 'Có' : '—'}</td><td>{r?.id ? <Link to={`/researchers/${r.id}`}>Xem CV</Link> : '—'}</td></tr>
            })}
            {!userRows.some(u => { const r = Array.isArray(u.researchers) ? u.researchers[0] : u.researchers; const f = flagsByResearcher.get(String(r?.id)) || {}; return f.available_guest_lecturing || f.available_business_consulting }) && <tr><td colSpan="5">Chưa có người đăng ký phù hợp.</td></tr>}
          </tbody></table></div>
        </section>
      )}
      {tab === 'pending' && (
        <div className="list">
          {pending.length === 0 && <div className="empty">Không có công trình nào đang chờ duyệt. 🎉</div>}
          {pending.map(p => (
            <article className="card result" key={p.id}>
              <div className="row">
                <span className="badge">{typeNames[p.publication_type] || 'Khác'}</span>
                <span className="authors">Gửi lúc {fmt(p.created_at)}</span>
              </div>
              <h3>{p.title}</h3>
              <p className="authors">
                {[...p.publication_authors].sort((a, b) => a.author_order - b.author_order).map(a => a.researchers.full_name).join(', ')}
                {' • '}{p.journal} • {p.publication_year}
              </p>
              {p.abstract && <p className="abs">{p.abstract}</p>}
              <div className="form-actions" style={{ justifyContent: 'flex-start', marginTop: 4 }}>
                <Link to={`/admin/review/${p.id}`} className="btn btn-ghost">Xem chi tiết</Link>
                <button className="btn btn-primary" onClick={() => approve(p)}><Check size={16} /> Duyệt</button>
                <button className="btn btn-ghost" onClick={() => reject(p)}><X size={16} /> Từ chối</button>
              </div>
            </article>
          ))}
        </div>
      )}

      {tab === 'pubs' && (
        <>
          <div className="filters" style={{ gridTemplateColumns: '2fr 1fr', marginTop: 0 }}>
            <div className="filter-search">
              <Search size={18} color="#64748b" />
              <input value={q} onChange={e => setQ(e.target.value)} placeholder="Tìm theo tiêu đề hoặc tác giả..." />
            </div>
            <select value={st} onChange={e => setSt(e.target.value)}>
              <option value="">Mọi trạng thái</option>
              {Object.entries(statusName).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div className="result-bar"><span>{shownPubs.length} công trình</span></div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Tiêu đề</th><th>Tác giả</th><th>Trạng thái</th><th>Ngày tạo</th><th></th></tr></thead>
              <tbody>
                {shownPubs.length === 0 && <tr><td colSpan="5" className="muted">Không có công trình phù hợp.</td></tr>}
                {shownPubs.map(p => (
                  <tr key={p.id}>
                    <td style={{ maxWidth: 320 }}>
                      <Link to={p.status === 'PENDING' ? `/admin/review/${p.id}` : `/research/${p.id}`} className="link-btn">{p.title}</Link>
                    </td>
                    <td>{[...p.publication_authors].sort((a, b) => a.author_order - b.author_order).map(a => a.researchers.full_name).join(', ')}</td>
                    <td><span className={`status ${statusCls[p.status]}`}>{statusName[p.status]}</span></td>
                    <td>{new Date(p.created_at).toLocaleDateString('vi-VN')}</td>
                    <td><button className="link-btn danger" onClick={() => deletePub(p)}><Trash2 size={14} /> Xóa</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === 'users' && (
        <div>
          <div className="filters" style={{ gridTemplateColumns: '2fr 1fr', marginBottom: 14 }}>
            <input value={userSearch} onChange={e => setUserSearch(e.target.value)} placeholder="Tìm theo họ tên hoặc email..." />
            <select value={interestFilter} onChange={e => setInterestFilter(e.target.value)}>
              <option value="all">Tất cả nhu cầu</option><option value="lecture">Muốn thỉnh giảng</option>
              <option value="consult">Muốn tư vấn doanh nghiệp</option><option value="both">Cả hai</option>
            </select>
          </div>
          <div className="table-wrap">
          <table>
            <thead><tr><th>Họ tên</th><th>Email</th><th>Ngày tạo</th><th>Vai trò</th><th>Thỉnh giảng</th><th>Tư vấn DN</th><th>CV / Hồ sơ</th><th></th></tr></thead>
            <tbody>
              {userRows.map(u => (
                <tr key={u.id}>
                  <td>{nameOf(u)}</td><td>{u.email}</td><td>{fmt(u.created_at)}</td>
                  <td>
                    <select value={u.role} disabled={u.id === user.id} onChange={e => changeRole(u, e.target.value)}>
                      <option>ADMIN</option><option>RESEARCHER</option><option>USER</option>
                    </select>
                  </td>
                  <td>{flagsByResearcher.get(String(researcherOf(u)?.id))?.available_guest_lecturing ? 'Có' : '—'}</td>
                  <td>{flagsByResearcher.get(String(researcherOf(u)?.id))?.available_business_consulting ? 'Có' : '—'}</td>
                  <td>
                    {researcherOf(u)?.id ? (
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                        <Link className="btn btn-ghost" to={`/researchers/${researcherOf(u).id}`}>Xem CV</Link>
                        <ExportCvButton researcherId={researcherOf(u).id} className="btn btn-ghost" />
                      </div>
                    ) : <span className="muted">Chưa có hồ sơ</span>}
                  </td>
                  <td>
                    {u.id === user.id || u.role === 'ADMIN'
                      ? <span className="muted" style={{ fontSize: 12 }}>{u.id === user.id ? 'Tài khoản của bạn' : 'Hạ quyền để xóa'}</span>
                      : <button className="link-btn danger" onClick={() => deleteUser(u)}><Trash2 size={14} /> Xóa</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div></div>
      )}

      {tab === 'logs' && (
        <div className="table-wrap">
          <table>
            <thead><tr><th>Thời gian</th><th>Hành động</th><th>Đối tượng</th><th>Chi tiết</th></tr></thead>
            <tbody>
              {logs.length === 0 && <tr><td colSpan="4" className="muted">Chưa có nhật ký.</td></tr>}
              {logs.map(l => (
                <tr key={l.id}>
                  <td>{fmt(l.created_at)}</td><td><b>{l.action}</b></td>
                  <td>{l.entity_type} #{l.entity_id}</td>
                  <td className="muted">{JSON.stringify(l.old_value)} → {JSON.stringify(l.new_value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="muted" style={{ marginTop: 18 }}><Link to="/research" className="link-btn">Xem kho nghiên cứu công khai →</Link></p>
    </main>
  )
}