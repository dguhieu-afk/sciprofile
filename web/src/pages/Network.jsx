import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../supabase'

const W = 900, H = 560

function runLayout(nodes, edges) {
  const n = nodes.map((x, i) => {
    const a = (2 * Math.PI * i) / Math.max(nodes.length, 1)
    return { ...x, x: W / 2 + Math.cos(a) * 200, y: H / 2 + Math.sin(a) * 200, vx: 0, vy: 0 }
  })
  const idx = new Map(n.map((x, i) => [x.id, i]))
  for (let it = 0; it < 350; it++) {
    for (let i = 0; i < n.length; i++) {
      for (let j = i + 1; j < n.length; j++) {
        const dx = n[i].x - n[j].x, dy = n[i].y - n[j].y
        const d2 = Math.max(dx * dx + dy * dy, 1), d = Math.sqrt(d2)
        const f = 12000 / d2
        n[i].vx += (f * dx) / d; n[i].vy += (f * dy) / d
        n[j].vx -= (f * dx) / d; n[j].vy -= (f * dy) / d
      }
    }
    edges.forEach(e => {
      const a = n[idx.get(e.a)], b = n[idx.get(e.b)]
      const dx = b.x - a.x, dy = b.y - a.y
      const d = Math.max(Math.sqrt(dx * dx + dy * dy), 1)
      const f = (d - 150) * 0.02
      a.vx += (f * dx) / d; a.vy += (f * dy) / d
      b.vx -= (f * dx) / d; b.vy -= (f * dy) / d
    })
    n.forEach(p => {
      p.vx += (W / 2 - p.x) * 0.01; p.vy += (H / 2 - p.y) * 0.01
      p.x = Math.min(W - 60, Math.max(60, p.x + p.vx * 0.85))
      p.y = Math.min(H - 40, Math.max(40, p.y + p.vy * 0.85))
      p.vx *= 0.6; p.vy *= 0.6
    })
  }
  return n
}

export default function Network() {
  const navigate = useNavigate()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [hover, setHover] = useState(null)

  useEffect(() => {
    supabase.from('publication_authors')
      .select('publication_id,researcher_id,researchers(id,full_name),publications!inner(status)')
      .eq('publications.status', 'APPROVED')
      .then(({ data }) => { setRows(data || []); setLoading(false) })
  }, [])

  const graph = useMemo(() => {
    const byPub = {}, info = {}
    rows.forEach(r => {
      (byPub[r.publication_id] ||= []).push(r.researcher_id)
      info[r.researcher_id] ||= { id: r.researcher_id, name: r.researchers.full_name, works: 0 }
      info[r.researcher_id].works++
    })
    const pair = {}
    Object.values(byPub).forEach(ids => {
      for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) {
        const [a, b] = ids[i] < ids[j] ? [ids[i], ids[j]] : [ids[j], ids[i]]
        const k = `${a}-${b}`
        pair[k] = pair[k] || { a, b, w: 0 }
        pair[k].w++
      }
    })
    const edges = Object.values(pair)
    const nodes = runLayout(Object.values(info), edges)
    const links = {}
    edges.forEach(e => { links[e.a] = (links[e.a] || 0) + 1; links[e.b] = (links[e.b] || 0) + 1 })
    return { nodes: nodes.map(x => ({ ...x, links: links[x.id] || 0 })), edges }
  }, [rows])

  const pos = id => graph.nodes.find(x => x.id === id)
  const top = [...graph.edges].sort((a, b) => b.w - a.w).slice(0, 5)
  const hot = hover ? new Set(graph.edges.filter(e => e.a === hover || e.b === hover).flatMap(e => [e.a, e.b])) : null

  return (
    <main className="container page">
      <div className="page-head">
        <h1>Mạng lưới cộng tác nghiên cứu</h1>
        <p>Mỗi điểm là một nhà nghiên cứu, mỗi đường nối là các công trình họ cùng thực hiện. Bấm vào điểm để xem hồ sơ.</p>
      </div>

      {loading && <div className="empty" style={{ marginTop: 24 }}>Đang tải...</div>}
      {!loading && graph.nodes.length === 0 && <div className="empty" style={{ marginTop: 24 }}>Chưa có dữ liệu cộng tác.</div>}

      {graph.nodes.length > 0 && (
        <div className="detail" style={{ marginTop: 24 }}>
          <div className="net-box">
            <svg viewBox={`0 0 ${W} ${H}`} width="100%">
              {graph.edges.map(e => {
                const a = pos(e.a), b = pos(e.b)
                const on = !hot || (hover && (e.a === hover || e.b === hover))
                return <line key={`${e.a}-${e.b}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                  stroke="#2563eb" strokeOpacity={on ? 0.7 : 0.1} strokeWidth={1.5 + e.w * 2} />
              })}
              {graph.nodes.map(n => {
                const r = 16 + n.works * 3
                const dim = hot && !hot.has(n.id) && n.id !== hover
                return (
                  <g key={n.id} style={{ cursor: 'pointer', opacity: dim ? 0.25 : 1 }}
                    onMouseEnter={() => setHover(n.id)} onMouseLeave={() => setHover(null)}
                    onClick={() => navigate(`/researchers/${n.id}`)}>
                    <circle cx={n.x} cy={n.y} r={r} fill="#1d4ed8" stroke="#fff" strokeWidth="3" />
                    <text x={n.x} y={n.y + 5} textAnchor="middle" fill="#fff" fontSize="14" fontWeight="700">
                      {n.name.trim().split(' ').pop()[0]}
                    </text>
                    <text x={n.x} y={n.y + r + 18} textAnchor="middle" fill="#0f172a" fontSize="14" fontWeight="600">{n.name}</text>
                  </g>
                )
              })}
            </svg>
          </div>

          <aside className="detail-side">
            <div className="side-card" style={{ position: 'static' }}>
              <h3>Cặp cộng tác nhiều nhất</h3>
              {top.length === 0 && <p className="muted">Chưa có cặp đồng tác giả.</p>}
              {top.map(e => (
                <div key={`${e.a}-${e.b}`} style={{ margin: '12px 0', fontSize: 14 }}>
                  <Link to={`/researchers/${e.a}`} className="link-btn">{pos(e.a).name}</Link> ↔{' '}
                  <Link to={`/researchers/${e.b}`} className="link-btn">{pos(e.b).name}</Link>
                  <div className="muted">{e.w} công trình chung</div>
                </div>
              ))}
              <h3 style={{ marginTop: 22 }}>Nhiều kết nối nhất</h3>
              {[...graph.nodes].sort((a, b) => b.links - a.links).slice(0, 3).map(n => (
                <div key={n.id} style={{ margin: '8px 0', fontSize: 14 }}>
                  <Link to={`/researchers/${n.id}`} className="link-btn">{n.name}</Link>
                  <span className="muted"> · {n.links} cộng sự</span>
                </div>
              ))}
              <p className="muted" style={{ marginTop: 16, fontSize: 12 }}>Kích thước điểm theo số công trình, độ dày đường nối theo số công trình chung.</p>
            </div>
          </aside>
        </div>
      )}
    </main>
  )
}