import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../supabase'
import { useAuth } from '../AuthContext'

export default function Favorites() {
  const { user, ready } = useAuth()
  const navigate = useNavigate()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { if (ready && !user) navigate('/login') }, [ready, user, navigate])

  useEffect(() => {
    if (!user) return
    supabase.from('favorites')
      .select('created_at,publications(id,title,journal,publication_year,citation_count,status)')
      .eq('user_id', user.id).order('created_at', { ascending: false })
      .then(({ data }) => {
        setItems((data || []).map(d => d.publications).filter(p => p && p.status === 'APPROVED'))
        setLoading(false)
      })
  }, [user])

  async function remove(id) {
    await supabase.from('favorites').delete().eq('user_id', user.id).eq('publication_id', id)
    setItems(items.filter(i => i.id !== id))
  }

  return (
    <main className="container page">
      <div className="page-head">
        <h1>Công trình yêu thích</h1>
        <p>Những nghiên cứu bạn đã lưu lại để đọc sau.</p>
      </div>
      <div className="list" style={{ marginTop: 24 }}>
        {loading && <div className="empty">Đang tải...</div>}
        {!loading && items.length === 0 && (
          <div className="empty">Bạn chưa lưu công trình nào. Vào <Link to="/research" className="link-btn">Kho nghiên cứu</Link> và bấm Yêu thích.</div>
        )}
        {items.map(p => (
          <article className="card result" key={p.id}>
            <Link to={`/research/${p.id}`}><h3>{p.title}</h3></Link>
            <p className="authors">{p.journal} • {p.publication_year}</p>
            <div className="meta">
              <span>{p.citation_count} trích dẫn</span>
              <button className="link-btn danger" onClick={() => remove(p.id)}>Bỏ yêu thích</button>
            </div>
          </article>
        ))}
      </div>
    </main>
  )
}