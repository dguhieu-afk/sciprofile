import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Check, X, ShieldCheck, Users, FileClock, ScrollText } from 'lucide-react'
import { supabase } from '../supabase'
import { useAuth } from '../AuthContext'

const typeNames = {
  JOURNAL: 'Bài báo', CONFERENCE: 'Hội nghị', BOOK: 'Sách',
  BOOK_CHAPTER: 'Chương sách', THESIS: 'Luận văn', RESEARCH_PROJECT: 'Đề tài', OTHER: 'Khác',
}
const fmt = d => new Date(d).toLocaleString('vi-VN')

export default function Admin() {
  const { user, profile, isAdmin, ready } = useAuth()
  const navigate = useNavigate()
  const [tab, setTab] = useState('pending')
  const [pending, setPending] = useState([])
  const [users, setUsers] = useState([])
  const [logs, setLogs] = useState([])
  const [stats, setStats] = useState({})

  useEffect(() => {
    if (!ready) return
    if (!user) navigate('/login')
    else if (profile && !isAdmin) navigate('/')
  }, [ready, user, profile, isAdmin, navigate])

  async function loadAll() {
    const [p, u, l, a, pe, us] = await Promise.all([
      supabase.from('publications')
        .select('id,title,abstract,publication_type,publication_year,journal,created_at,publication_authors(author_order,researchers(full_name))')
        .eq('status', 'PENDING').order('created_at'),
      supabase.from('profiles').select('id,email,role,created_at,researchers(full_name)').order('created_at', { ascending: false }),
      supabase.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(50),
      supabase.from('publications').select('*', { count: 'exact', head: true }).eq('status', 'APPROVED'),
      supabase.from('publications').select('*', { count: 'exact', head: true }).eq('status', 'PENDING'),
      supabase.from('profiles').select('*', { count: 'exact', head: true }),
    ])
    setPending(p.data || []); setUsers(u.data || []); setLogs(l.data || [])
    setStats({ approved: a.count, pending: pe.count, users: us.count })
  }
  useEffect(() => { if (isAdmin) loadAll() }, [isAdmin])

  const log = (action, type, eid, oldV, newV) =>
    supabase.from('audit_logs').insert({
      user_id: user.id, action, entity_type: type, entity_id: String(eid), old_value: oldV, new_value: newV,
    })

  async function approve(p) {
    const { error } = await supabase.from('publications').update({ status: 'APPROVED', admin_note: null }).eq('id', p.id)
    if (error) { alert(error.message); return }
    await log('APPROVE', 'PUBLICATION', p.id, { status: 'PENDING' }, { status: 'APPROVED' })
    loadAll()
  }
  async function reject(p) {
    const note = prompt('Lý do từ chối (người nộp sẽ thấy):')
    if (note === null) return
    const { error } = await supabase.from('publications').update({ status: 'REJECTED', admin_note: note || 'Chưa đạt yêu cầu' }).eq('id', p.id)
    if (error) { alert(error.message); return }
    await log('REJECT', 'PUBLICATION', p.id, { status: 'PENDING' }, { status: 'REJECTED', note })
    loadAll()
  }
  async function changeRole(u, role) {
    if (!confirm(`Đổi vai trò của ${u.email} thành ${role}?`)) return
    const { error } = await supabase.from('profiles').update({ role }).eq('id', u.id)
    if (error) { alert(error.message); return }
    await log('CHANGE_ROLE', 'USER', u.id, { role: u.role }, { role })
    loadAll()
  }

  if (!isAdmin) return <main className="container page"><div className="empty">Đang kiểm tra quyền...</div></main>

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

      <div className="cite-tabs" style={{ marginBottom: 16 }}>
        <button className={tab === 'pending' ? 'on' : ''} onClick={() => setTab('pending')}>Chờ duyệt ({pending.length})</button>
        <button className={tab === 'users' ? 'on' : ''} onClick={() => setTab('users')}>Người dùng</button>
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
                <button className="btn btn-primary" onClick={() => approve(p)}><Check size={16} /> Duyệt</button>
                <button className="btn btn-ghost" onClick={() => reject(p)}><X size={16} /> Từ chối</button>
              </div>
            </article>
          ))}
        </div>
      )}

      {tab === 'users' && (
        <div className="table-wrap">
          <table>
            <thead><tr><th>Họ tên</th><th>Email</th><th>Ngày tạo</th><th>Vai trò</th></tr></thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id}>
                  <td>{nameOf(u)}</td><td>{u.email}</td><td>{fmt(u.created_at)}</td>
                  <td>
                    <select value={u.role} disabled={u.id === user.id} onChange={e => changeRole(u, e.target.value)}>
                      <option>ADMIN</option><option>RESEARCHER</option><option>USER</option>
                    </select>
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