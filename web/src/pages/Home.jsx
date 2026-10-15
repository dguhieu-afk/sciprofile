import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Search, BookOpen, Users, FileText, Quote, ArrowRight,
  GraduationCap, Share2, FlaskConical, ShieldCheck, Cpu, Wrench, Briefcase, Leaf,
} from 'lucide-react'
import { supabase } from '../supabase'
import Avatar from '../components/Avatar'

const typeNames = {
  JOURNAL: 'Bài báo', CONFERENCE: 'Hội nghị', BOOK: 'Sách',
  BOOK_CHAPTER: 'Chương sách', THESIS: 'Luận văn',
  RESEARCH_PROJECT: 'Đề tài', OTHER: 'Khác',
}
const icons = [FlaskConical, ShieldCheck, GraduationCap, Share2, Cpu, Wrench, Briefcase, Leaf]

export default function Home() {
  const navigate = useNavigate()
  const [q, setQ] = useState('')
  const [papers, setPapers] = useState([])
  const [people, setPeople] = useState([])
  const [topics, setTopics] = useState([])
  const [counts, setCounts] = useState({ pubs: '…', res: '…', cites: '…', areas: '…' })

  useEffect(() => {
    async function load() {
      const { data: pubs } = await supabase
        .from('publications')
        .select('id,title,publication_type,publication_year,journal,citation_count,publication_authors(author_order,researchers(full_name))')
        .eq('status', 'APPROVED')
        .order('publication_year', { ascending: false })
        .limit(3)
      if (pubs) setPapers(pubs)

      // Chỉ hiển thị và đếm người có tài khoản đã đăng nhập UTEProfile.
      // Dùng cùng RPC với trang /researchers để hai số liệu luôn thống nhất.
      const [activeResult, researcherResult] = await Promise.all([
        supabase.rpc('public_logged_in_researcher_ids'),
        supabase.from('researchers')
          .select('id,user_id,avatar_url,full_name,academic_title,publication_authors(publication_id)'),
      ])
      const allowedIds = new Set(
        (activeResult.data || []).map(row => String(row.researcher_id))
      )
      const eligibleResearchers = activeResult.error || researcherResult.error
        ? []
        : (researcherResult.data || []).filter(r =>
            r.user_id && allowedIds.has(String(r.id))
          )
      setPeople(
        eligibleResearchers
          .map(r => ({ ...r, works: r.publication_authors?.length || 0 }))
          .sort((a, b) => b.works - a.works)
          .slice(0, 3)
      )

      const [a, c, d] = await Promise.all([
        supabase.from('publications').select('*', { count: 'exact', head: true }).eq('status', 'APPROVED'),
        supabase.from('publications').select('citation_count').eq('status', 'APPROVED'),
        supabase.from('publication_research_areas')
          .select('research_area_id,research_areas(id,name),publications!inner(status)')
          .eq('publications.status', 'APPROVED'),
      ])

      // Đếm số bài theo từng lĩnh vực (chỉ lĩnh vực đã có bài)
      const map = {}
      ;(d.data || []).forEach(r => {
        const ar = r.research_areas
        if (!ar) return
        map[ar.id] = map[ar.id] || { id: ar.id, name: ar.name, n: 0 }
        map[ar.id].n++
      })
      const list = Object.values(map).sort((x, y) => y.n - x.n)
      setTopics(list.slice(0, 8))

      const totalCites = (c.data || []).reduce((s, x) => s + x.citation_count, 0)
      setCounts({
        pubs: a.count ?? 0,
        res: activeResult.error || researcherResult.error ? '—' : eligibleResearchers.length,
        cites: totalCites,
        areas: list.length,
      })
    }
    load()
  }, [])

  function submit(e) {
    e.preventDefault()
    navigate(`/research?q=${encodeURIComponent(q)}`)
  }

  const stats = [
    { icon: <FileText size={22} />, value: counts.pubs, label: 'Công trình nghiên cứu' },
    { icon: <Users size={22} />, value: counts.res, label: 'Nhà nghiên cứu đã đăng nhập' },
    { icon: <Quote size={22} />, value: counts.cites, label: 'Lượt trích dẫn' },
    { icon: <BookOpen size={22} />, value: counts.areas, label: 'Lĩnh vực có bài' },
  ]

  return (
    <>
      <section className="hero">
        <div className="container">
          <span className="tag">Nền tảng lý lịch khoa học &amp; kho nghiên cứu mở</span>
          <h1>Khám phá tri thức, kết nối nhà nghiên cứu</h1>
          <p>Tìm kiếm công trình, xem hồ sơ khoa học và trích dẫn chỉ với vài cú nhấp chuột.</p>
          <form className="search" onSubmit={submit}>
            <Search size={20} style={{ alignSelf: 'center', marginLeft: 8, color: '#64748b' }} />
            <input
              value={q}
              onChange={e => setQ(e.target.value)}
              placeholder="Nhập từ khóa, tên bài báo hoặc tác giả..."
            />
            <button type="submit" className="btn btn-primary">Tìm kiếm</button>
          </form>
          <div className="chips">
            <span>Gợi ý:</span>
            {['Machine Learning', 'Education', 'Data Mining'].map(c => (
              <span key={c} className="chip" onClick={() => navigate(`/research?q=${encodeURIComponent(c)}`)}>{c}</span>
            ))}
          </div>
        </div>
      </section>

      <main className="container">
        <div className="stats">
          {stats.map(s => (
            <div className="stat" key={s.label}>
              <div className="icon">{s.icon}</div>
              <b>{s.value}</b>
              <span>{s.label}</span>
            </div>
          ))}
        </div>

        <section className="section">
          <div className="section-head">
            <h2>Nghiên cứu mới nhất</h2>
            <Link to="/research">Xem tất cả <ArrowRight size={16} /></Link>
          </div>
          <div className="grid-3">
            {papers.map(p => (
              <Link to={`/research/${p.id}`} className="card" key={p.id}>
                <span className="badge">{typeNames[p.publication_type] || 'Khác'}</span>
                <h3>{p.title}</h3>
                <p className="authors">
                  {[...p.publication_authors].sort((x, y) => x.author_order - y.author_order)
                    .map(a => a.researchers.full_name).join(', ')}
                </p>
                <p className="authors">{p.publication_year} • {p.journal}</p>
                <div className="meta">
                  <span>{p.citation_count} trích dẫn</span>
                  <span>Đọc thêm →</span>
                </div>
              </Link>
            ))}
          </div>
        </section>

        <section className="section">
          <div className="section-head">
            <h2>Nhà nghiên cứu nổi bật</h2>
            <Link to="/researchers">Xem tất cả <ArrowRight size={16} /></Link>
          </div>
          <div className="grid-3">
            {people.map(p => (
              <Link to={`/researchers/${p.id}`} className="card person" key={p.id}>
                <Avatar name={p.full_name} url={p.avatar_url} size="lg" />
                <h3>{p.full_name}</h3>
                <small>{p.academic_title}</small>
                <span className="badge">{p.works} công trình</span>
              </Link>
            ))}
          </div>
        </section>

        {topics.length > 0 && (
          <section className="section">
            <div className="section-head"><h2>Khám phá theo chủ đề</h2></div>
            <div className="topics">
              {topics.map((t, i) => {
                const Icon = icons[i % icons.length]
                return (
                  <div className="topic" key={t.id} onClick={() => navigate(`/research?area=${t.id}`)}>
                    <Icon size={22} />
                    <span>{t.name}</span>
                    <small className="topic-n">{t.n}</small>
                  </div>
                )
              })}
            </div>
          </section>
        )}
      </main>
    </>
  )
}