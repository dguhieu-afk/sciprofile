import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Plus, Pencil, Send, Trash2, FileText, Clock, CheckCircle2, XCircle, Info } from 'lucide-react'
import { supabase } from '../supabase'
import { useAuth } from '../AuthContext'

const statusInfo = {
  DRAFT: { label: 'Bản nháp', cls: 's-draft' },
  PENDING: { label: 'Chờ duyệt', cls: 's-pending' },
  APPROVED: { label: 'Đã công khai', cls: 's-ok' },
  REJECTED: { label: 'Bị từ chối', cls: 's-bad' },
  ARCHIVED: { label: 'Lưu trữ', cls: 's-draft' },
}
const WAIT_NOTE = 'Chúng tôi đã ghi nhận dữ liệu của bạn. Chúng tôi sẽ cập nhật dữ liệu cho bạn trong khoảng 1-2 ngày. Xin chân thành cảm ơn!'

export default function Dashboard() {
  const { user, researcher, ready } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [justSent, setJustSent] = useState(Boolean(location.state?.submitted))

  useEffect(() => { if (ready && !user) navigate('/login') }, [ready, user, navigate])

  async function load() {
    if (!user) return
    const { data } = await supabase.from('publications')
      .select('id,title,publication_type,publication_year,journal,status,admin_note,citation_count')
      .eq('created_by', user.id).order('created_at', { ascending: false })
    setItems(data || [])
    setLoading(false)
  }
  useEffect(() => { load() }, [user]) // eslint-disable-line

  async function submitForReview(id) {
    if (!confirm('Gửi công trình này cho quản trị viên kiểm duyệt?')) return
    await supabase.from('publications').update({ status: 'PENDING', admin_note: null }).eq('id', id)
    setJustSent(true)
    load()
  }
  async function remove(id) {
    if (!confirm('Xóa bản nháp này?')) return
    await supabase.from('publications').delete().eq('id', id)
    load()
  }

  const count = s => items.filter(i => i.status === s).length
  const cites = items.filter(i => i.status === 'APPROVED').reduce((s, i) => s + i.citation_count, 0)

  return (
    <main className="container page">
      <div className="page-head row-between">
        <div>
          <h1>Xin chào, {researcher?.full_name || 'bạn'} 👋</h1>
          <p>Quản lý các công trình nghiên cứu của bạn.</p>
        </div>
        <Link to="/dashboard/new" className="btn btn-primary"><Plus size={16} /> Thêm công trình</Link>
      </div>

      {justSent && (
        <div className="ok-msg note-big">
          <Info size={18} /> <span>{WAIT_NOTE}</span>
        </div>
      )}

      <div className="cv-stats" style={{ marginTop: 24 }}>
        <div><FileText size={18} /><b>{items.length}</b><span>Tổng công trình</span></div>
        <div><CheckCircle2 size={18} /><b>{count('APPROVED')}</b><span>Đã công khai ({cites} trích dẫn)</span></div>
        <div><Clock size={18} /><b>{count('PENDING')}</b><span>Chờ duyệt</span></div>
        <div><XCircle size={18} /><b>{count('REJECTED')}</b><span>Bị từ chối</span></div>
      </div>

      <div className="list">
        {loading && <div className="empty">Đang tải...</div>}
        {!loading && items.length === 0 && (
          <div className="empty">Bạn chưa có công trình nào. Bấm <b>Thêm công trình</b> để bắt đầu.</div>
        )}
        {items.map(p => (
          <article className="card result" key={p.id}>
            <div className="row">
              <span className={`status ${statusInfo[p.status].cls}`}>{statusInfo[p.status].label}</span>
              <span className="authors">{p.publication_year}</span>
            </div>
            <h3>{p.title}</h3>
            <p className="authors">{p.journal}</p>
            {p.status === 'PENDING' && (
              <div className="wait-note"><Info size={16} /> <span>{WAIT_NOTE}</span></div>
            )}
            {p.status === 'REJECTED' && p.admin_note && (
              <div className="auth-error"><b>Lý do từ chối:</b> {p.admin_note}</div>
            )}
            <div className="meta">
              <span>{p.citation_count} trích dẫn</span>
              <span className="actions">
                {p.status === 'APPROVED' && <Link to={`/research/${p.id}`} className="link-btn">Xem công khai</Link>}
                {(p.status === 'DRAFT' || p.status === 'REJECTED') && (
                  <>
                    <Link to={`/dashboard/edit/${p.id}`} className="link-btn"><Pencil size={14} /> Sửa</Link>
                    <button className="link-btn" onClick={() => submitForReview(p.id)}><Send size={14} /> Gửi duyệt</button>
                  </>
                )}
                {p.status === 'DRAFT' && (
                  <button className="link-btn danger" onClick={() => remove(p.id)}><Trash2 size={14} /> Xóa</button>
                )}
              </span>
            </div>
          </article>
        ))}
      </div>
    </main>
  )
}