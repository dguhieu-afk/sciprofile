import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../supabase'
import { useAuth } from '../AuthContext'

const fmt = d => new Date(d).toLocaleString('vi-VN')

export default function AdminReports() {
  const { user, profile, isAdmin, ready } = useAuth()
  const navigate = useNavigate()
  const [list, setList] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!ready) return
    if (!user) navigate('/login')
    else if (profile && !isAdmin) navigate('/')
  }, [ready, user, profile, isAdmin, navigate])

  async function load() {
    const { data } = await supabase.from('reports')
      .select('*,publications(id,title,status),profiles(email)')
      .order('created_at', { ascending: false })
    setList(data || [])
    setLoading(false)
  }
  useEffect(() => { if (isAdmin) load() }, [isAdmin])

  async function resolve(r, status) {
    const note = prompt('Ghi chú xử lý (không bắt buộc):') ?? ''
    await supabase.from('reports').update({
      status, admin_note: note || null, resolved_at: new Date().toISOString(),
    }).eq('id', r.id)
    await supabase.from('audit_logs').insert({
      user_id: user.id, action: 'RESOLVE_REPORT', entity_type: 'REPORT', entity_id: String(r.id),
      old_value: { status: r.status }, new_value: { status },
    })
    load()
  }

  async function archive(r) {
    if (!confirm('Gỡ công trình này khỏi kho công khai (chuyển sang lưu trữ)?')) return
    await supabase.from('publications').update({ status: 'ARCHIVED' }).eq('id', r.publication_id)
    await supabase.from('audit_logs').insert({
      user_id: user.id, action: 'ARCHIVE', entity_type: 'PUBLICATION', entity_id: String(r.publication_id),
      old_value: { status: 'APPROVED' }, new_value: { status: 'ARCHIVED' },
    })
    resolve(r, 'RESOLVED')
  }

  if (!isAdmin) return <main className="container page"><div className="empty">Đang kiểm tra quyền...</div></main>

  return (
    <main className="container page">
      <div className="page-head">
        <h1>Báo cáo vi phạm</h1>
        <p>Các báo cáo do người dùng gửi về công trình trong kho.</p>
      </div>
      <div className="list" style={{ marginTop: 24 }}>
        {loading && <div className="empty">Đang tải...</div>}
        {!loading && list.length === 0 && <div className="empty">Chưa có báo cáo nào.</div>}
        {list.map(r => (
          <article className="card result" key={r.id}>
            <div className="row">
              <span className={`status ${r.status === 'OPEN' ? 's-pending' : r.status === 'RESOLVED' ? 's-ok' : 's-draft'}`}>
                {r.status === 'OPEN' ? 'Chưa xử lý' : r.status === 'RESOLVED' ? 'Đã xử lý' : 'Đã bỏ qua'}
              </span>
              <span className="authors">{fmt(r.created_at)}</span>
            </div>
            <h3><Link to={`/research/${r.publication_id}`}>{r.publications?.title}</Link></h3>
            <p><b>Lý do:</b> {r.reason}</p>
            {r.description && <p className="abs">{r.description}</p>}
            <p className="authors">Người báo cáo: {r.profiles?.email || '—'}</p>
            {r.admin_note && <p className="authors">Ghi chú admin: {r.admin_note}</p>}
            {r.status === 'OPEN' && (
              <div className="form-actions" style={{ justifyContent: 'flex-start', marginTop: 4 }}>
                <button className="btn btn-primary" onClick={() => resolve(r, 'RESOLVED')}>Đánh dấu đã xử lý</button>
                <button className="btn btn-ghost" onClick={() => resolve(r, 'DISMISSED')}>Bỏ qua</button>
                {r.publications?.status === 'APPROVED' && (
                  <button className="btn btn-ghost" onClick={() => archive(r)}>Gỡ công trình</button>
                )}
              </div>
            )}
          </article>
        ))}
      </div>
    </main>
  )
}