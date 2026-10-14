import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Check, X, ShieldCheck, Users, FileClock, ScrollText, Trash2, Search } from 'lucide-react'
import { supabase } from '../supabase'
import { useAuth } from '../AuthContext'
import { useUI } from '../ui'
import { approvePub } from '../review'
import Loading from '../components/Loading'

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

  useEffect(() => {
    if (!ready) return
    if (!user) navigate('/login')
    else if (profile && !isAdmin) navigate('/')
  }, [ready, user, profile, isAdmin, navigate])

  async function loadAll() {
    const [p, u, l, a, pe, us, ap] = await Promise.all([
      supabase.from('publications')
        .select('id,title,abstract,doi,publication_type,publication_year,journal,created_at,publication_authors(author_order,researchers(full_name))')
        .eq('status', 'PENDING').order('created_at'),
      supabase.from('profiles').select('id,email,role,created_at,researchers(full_name)').order('created_at', { ascending: false }),
      supabase.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(50),
      supabase.from('publications').select('*', { count: 'exact', head: true }).eq('status', 'APPROVED'),
      supabase.from('publications').select('*', { count: 'exact', head: true }).eq('status', 'PENDING'),
      supabase.from('profiles').select('*', { count: 'exact', head: true }),
      supabase.from('publications')
        .select('id,title,status,publication_year,created_at,pdf_url,publication_authors(author_order,researchers(full_name))')
        .order('created_at', { ascending: false }).limit(500),
    ])
    setPending(p.data || []); setUsers(u.data || []); setLogs(l.data || []); setAllPubs(ap.data || [])
    setStats({ approved: a.count, pending: pe.count, users: us.count })
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

  if (!isAdmin) return <main className="container page"><Loading text="Đang kiểm tra quyền..." /></main>

  const nameOf = u => (Array.isArray(u.researchers) ? u.researchers[0] : u.researchers)?.full_name || '—'

  return (
    <main className="container page">
      <div className="page-head">
        <h1>Quản trị hệ thống</h1>
        <p>Kiểm duyệt công trình, quản lý người dùng và theo dõi nhật ký.</p>
      </div>

      <div className="cv-stats" style={{ gridTemplateColumns: 'repeat(3,1fr)', marginTop: 24 }}>
        <div><Users size={18} /><b>{stats.users ?? '…'}</b><span>Tài khoản</span></div>
        <div><ShieldCheck size={18} /><b>{stats.approved ?? '…'}</b><span>Công trình công khai</span></div>
        <div><FileClock size={18} /><b>{stats.pending ?? '…'}</b><span>Đang chờ duyệt</span></div>
      </div>

      <div className="cite-tabs" style={{ marginBottom: 16, flexWrap: 'wrap' }}>
        <button className={tab === 'pending' ? 'on' : ''} onClick={() => setTab('pending')}>Chờ duyệt ({pending.length})</button>
        <button className={tab === 'pubs' ? 'on' : ''} onClick={() => setTab('pubs')}>Công trình ({allPubs.length})</button>
        <button className={tab === 'users' ? 'on' : ''} onClick={() => setTab('users')}>Người dùng ({users.length})</button>
        <button className={tab === 'logs' ? 'on' : ''} onClick={() => setTab('logs')}><ScrollText size={13} /> Nhật ký</button>
      </div>

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
        <div className="table-wrap">
          <table>
            <thead><tr><th>Họ tên</th><th>Email</th><th>Ngày tạo</th><th>Vai trò</th><th></th></tr></thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id}>
                  <td>{nameOf(u)}</td><td>{u.email}</td><td>{fmt(u.created_at)}</td>
                  <td>
                    <select value={u.role} disabled={u.id === user.id} onChange={e => changeRole(u, e.target.value)}>
                      <option>ADMIN</option><option>RESEARCHER</option><option>USER</option>
                    </select>
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
        </div>
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