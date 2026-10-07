import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../supabase'

const typeNames = {
  JOURNAL: 'Bài báo', CONFERENCE: 'Hội nghị', BOOK: 'Sách',
  BOOK_CHAPTER: 'Chương sách', THESIS: 'Luận văn',
  RESEARCH_PROJECT: 'Đề tài', OTHER: 'Khác',
}

function Bars({ data, link }) {
  const max = Math.max(1, ...data.map(d => d.value))
  return (
    <div>
      {data.map(d => (
        <div className="bar-row wide-bar" key={d.label}>
          <span title={d.label}>{link ? <Link to={link(d)} className="link-btn">{d.label}</Link> : d.label}</span>
          <div className="bar"><i style={{ width: `${(d.value / max) * 100}%` }} /></div>
          <b>{d.value}</b>
        </div>
      ))}
    </div>
  )
}

export default function Stats() {
  const [pubs, setPubs] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.from('publications')
      .select(`id,publication_type,publication_year,citation_count,
        publication_authors(researchers(id,full_name)),
        publication_research_areas(research_areas(name))`)
      .eq('status', 'APPROVED')
      .then(({ data }) => { setPubs(data || []); setLoading(false) })
  }, [])

  const s = useMemo(() => {
    const count = (arr) => {
      const m = {}; arr.forEach(k => { if (k) m[k] = (m[k] || 0) + 1 }); return m
    }
    const toList = (m, f = x => x) => Object.entries(m).map(([label, value]) => ({ label: f(label), value }))
    const years = toList(count(pubs.map(p => p.publication_year))).sort((a, b) => a.label - b.label)
    const types = toList(count(pubs.map(p => p.publication_type)), k => typeNames[k] || k).sort((a, b) => b.value - a.value)
    const areas = toList(count(pubs.flatMap(p => p.publication_research_areas.map(a => a.research_areas.name)))).sort((a, b) => b.value - a.value)
    const people = {}
    pubs.forEach(p => p.publication_authors.forEach(a => {
      const r = a.researchers
      people[r.id] = people[r.id] || { id: r.id, label: r.full_name, value: 0 }
      people[r.id].value++
    }))
    const topPeople = Object.values(people).sort((a, b) => b.value - a.value).slice(0, 5)
    const topCited = [...pubs].sort((a, b) => b.citation_count - a.citation_count).slice(0, 1)[0]
    const cites = pubs.reduce((t, p) => t + p.citation_count, 0)
    return { years, types, areas, topPeople, cites, topCited }
  }, [pubs])

  return (
    <main className="container page">
      <div className="page-head">
        <h1>Thống kê và xu hướng nghiên cứu</h1>
        <p>Số liệu tổng hợp tự động từ các công trình đã được duyệt.</p>
      </div>

      {loading ? <div className="empty" style={{ marginTop: 24 }}>Đang tải...</div> : (
        <>
          <div className="cv-stats" style={{ marginTop: 24 }}>
            <div><b>{pubs.length}</b><span>Công trình</span></div>
            <div><b>{s.cites}</b><span>Tổng trích dẫn</span></div>
            <div><b>{pubs.length ? (s.cites / pubs.length).toFixed(1) : 0}</b><span>Trích dẫn trung bình</span></div>
            <div><b>{s.areas[0]?.label || '—'}</b><span>Lĩnh vực nổi bật nhất</span></div>
          </div>

          <div className="grid-2">
            <section className="cv-block"><h2>Công bố theo năm</h2><Bars data={s.years} /></section>
            <section className="cv-block"><h2>Theo loại tài liệu</h2><Bars data={s.types} /></section>
            <section className="cv-block"><h2>Xu hướng theo lĩnh vực</h2><Bars data={s.areas} /></section>
            <section className="cv-block"><h2>Nhà nghiên cứu nhiều công trình nhất</h2>
              <Bars data={s.topPeople} link={d => `/researchers/${d.id}`} />
            </section>
          </div>

          {s.topCited && (
            <section className="cv-block">
              <h2>Công trình được trích dẫn nhiều nhất</h2>
              <Link to={`/research/${s.topCited.id}`} className="link-btn">Xem chi tiết ({s.topCited.citation_count} trích dẫn)</Link>
            </section>
          )}
        </>
      )}
    </main>
  )
}