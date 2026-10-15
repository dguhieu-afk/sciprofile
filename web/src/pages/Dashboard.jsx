import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Plus, Pencil, Send, Trash2, FileText, Clock, CheckCircle2, XCircle, Info } from 'lucide-react'
import { supabase } from '../supabase'
import { useAuth } from '../AuthContext'
import { useUI } from '../ui'
import Loading from '../components/Loading'

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
  const { confirm, toast } = useUI()
  const navigate = useNavigate()
  const location = useLocation()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [yearFilter, setYearFilter] = useState('ALL')
  const [sourceFilter, setSourceFilter] = useState('DOI')
  const [justSent, setJustSent] = useState(Boolean(location.state?.submitted))

  useEffect(() => { if (ready && !user) navigate('/login') }, [ready, user, navigate])

  async function load() {
    if (!user) return
    const { data, error } = await supabase.from('publications')
      .select('id,title,publication_type,publication_year,journal,status,admin_note,citation_count,doi,created_at')
      .eq('created_by', user.id).order('created_at', { ascending: false })
    if (error) { toast('Không tải được công trình: ' + error.message, 'error'); setLoading(false); return }
    setItems(data || [])
    setLoading(false)
  }
  useEffect(() => { load() }, [user]) // eslint-disable-line

  async function submitForReview(id) {
    const ok = await confirm({
      title: 'Gửi kiểm duyệt?',
      message: 'Công trình sẽ được gửi cho quản trị viên xem xét. Trong lúc chờ duyệt bạn không sửa được bài.',
      confirmText: 'Gửi duyệt',
    })
    if (!ok) return
    const { data: sent, error } = await supabase.from('publications').update({ status: 'PENDING', admin_note: null }).eq('id', id).eq('created_by', user.id).in('status', ['DRAFT', 'REJECTED']).select('id')
    if (error || !sent?.length) { toast('Không gửi được: ' + (error?.message || 'Không có quyền hoặc trạng thái bài đã thay đổi.'), 'error'); return }
    setJustSent(true)
    toast('Đã gửi kiểm duyệt.', 'success')
    load()
  }

  async function remove(id) {
    const ok = await confirm({
      title: 'Xóa công trình này?', message: 'Công trình sẽ bị xóa vĩnh viễn, kể cả khi đã công khai. Thao tác này không thể hoàn tác.',
      confirmText: 'Xóa', danger: true,
    })
    if (!ok) return
    const { data, error } = await supabase.from('publications').delete().eq('id', id).eq('created_by', user.id).select('id')
    if (error) { toast('Không xóa được: ' + error.message, 'error'); return }
    if (!data?.length) { toast('Không thể xóa công trình. Hãy kiểm tra quyền xóa trong Supabase.', 'error'); return }
    toast('Đã xóa công trình.', 'success')
    load()
  }

  const years = [...new Set(items.map(i => Number(i.publication_year)).filter(Number.isFinite))].sort((a, b) => b - a)
  // Không có trường 'nguồn nhập' trong DB hiện tại. Tạm phân nhóm theo việc có DOI.
  const hasDoi = p => Boolean(String(p.doi || '').trim())
  const doiCount = items.filter(hasDoi).length
  const manualCount = items.length - doiCount
  const visibleItems = items
    .filter(p => (sourceFilter === 'DOI' ? hasDoi(p) : !hasDoi(p)))
    .filter(p => yearFilter === 'ALL' || String(p.publication_year) === yearFilter)
    .sort((a, b) => Number(b.publication_year || 0) - Number(a.publication_year || 0) ||
      new Date(b.created_at || 0) - new Date(a.created_at || 0))
  const count = s => items.filter(i => i.status === s).length
  const cites = items.filter(i => i.status === 'APPROVED').reduce((s, i) => s + Number(i.citation_count || 0), 0)

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
        <div className="ok-msg note-big"><Info size={18} /> <span>{WAIT_NOTE}</span></div>
      )}

      <div className="cv-stats" style={{ marginTop: 24 }}>
        <div><FileText size={18} /><b>{items.length}</b><span>Tổng công trình</span></div>
        <div><CheckCircle2 size={18} /><b>{count('APPROVED')}</b><span>Đã công khai ({cites} trích dẫn)</span></div>
        <div><Clock size={18} /><b>{count('PENDING')}</b><span>Chờ duyệt</span></div>
        <div><XCircle size={18} /><b>{count('REJECTED')}</b><span>Bị từ chối</span></div>
      </div>

      <section style={{ marginTop: 26 }} aria-label="Phân loại công trình">
        <h2 style={{ marginBottom: 12 }}>Công trình của tôi</h2>
        <div role="tablist" aria-label="Loại công trình" style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <button
            type="button" role="tab" aria-selected={sourceFilter === 'DOI'}
            onClick={() => setSourceFilter('DOI')}
            className={`btn ${sourceFilter === 'DOI' ? 'btn-primary' : 'btn-ghost'}`}
            style={{ border: '1px solid #cfdaf4', padding: '12px 18px', borderRadius: 12 }}>
            Công trình mã DOI ({doiCount})
          </button>
          <button
            type="button" role="tab" aria-selected={sourceFilter === 'MANUAL'}
            onClick={() => setSourceFilter('MANUAL')}
            className={`btn ${sourceFilter === 'MANUAL' ? 'btn-primary' : 'btn-ghost'}`}
            style={{ border: '1px solid #cfdaf4', padding: '12px 18px', borderRadius: 12 }}>
            Công trình đăng thủ công ({manualCount})
          </button>
        </div>
      </section>

      <div className="row-between" style={{ margin: '24px 0 12px', gap: 12, flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0 }}>{sourceFilter === 'DOI' ? 'Công trình mã DOI' : 'Công trình thủ công'} ({visibleItems.length})</h2>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          Năm công bố
          <select aria-label="Lọc theo năm công bố" value={yearFilter} onChange={e => setYearFilter(e.target.value)}>
            <option value="ALL">Tất cả năm</option>
            {years.map(y => <option key={y} value={String(y)}>{y}</option>)}
          </select>
        </label>
      </div>
      <div className="list">
        {loading && <Loading />}
        {!loading && items.length === 0 && (
          <div className="empty">Bạn chưa có công trình nào. Bấm <b>Thêm công trình</b> để bắt đầu.</div>
        )}
        {!loading && items.length > 0 && visibleItems.length === 0 && (
          <div className="empty">{yearFilter === 'ALL'
            ? (sourceFilter === 'DOI' ? 'Bạn chưa có công trình mã DOI.' : 'Bạn chưa có công trình đăng thủ công.')
            : 'Không có công trình thuộc nhóm này trong năm được chọn.'}</div>
        )}
        {visibleItems.map(p => (
          <article className="card result" key={p.id}>
            <div className="row">
              <span className={`status ${(statusInfo[p.status] || statusInfo.DRAFT).cls}`}>{(statusInfo[p.status] || statusInfo.DRAFT).label}</span>
              <span className="authors">Năm công bố: {p.publication_year || 'Chưa rõ'}</span>
              {p.doi && <span className="authors" title={p.doi}>Có DOI</span>}
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
                {p.status === 'APPROVED' && (<> <Link to={`/research/${p.id}`} className="link-btn">Xem công khai</Link> <Link to={`/dashboard/edit/${p.id}`} className="link-btn"><Pencil size={14} /> Sửa</Link> </>)}
                {(p.status === 'DRAFT' || p.status === 'REJECTED') && (
                  <>
                    <Link to={`/dashboard/edit/${p.id}`} className="link-btn"><Pencil size={14} /> Sửa</Link>
                    <button className="link-btn" onClick={() => submitForReview(p.id)}><Send size={14} /> Gửi duyệt</button>
                  </>
                )}
                {(p.status === 'DRAFT' || p.status === 'PENDING' || p.status === 'REJECTED' || p.status === 'APPROVED' || p.status === 'ARCHIVED') && (
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