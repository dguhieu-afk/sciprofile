import Avatar from '../components/Avatar'
import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  Printer, Pencil, Mail, Globe, GraduationCap, FileText, Quote, Users,
  Link as LinkIcon, Lock,
} from 'lucide-react'
import { supabase } from '../supabase'
import { useAuth } from '../AuthContext'
import ExportCvButton from '../components/ExportCvButton'

const typeNames = {
  JOURNAL: 'Bài báo', CONFERENCE: 'Hội nghị', BOOK: 'Sách',
  BOOK_CHAPTER: 'Chương sách', THESIS: 'Luận văn',
  RESEARCH_PROJECT: 'Đề tài', OTHER: 'Khác',
}
const yearRange = (a, b) => (a ? `${a} – ${b || 'nay'}` : '')

export default function ResearcherProfile() {
  const { id } = useParams()
  const { researcher: me, isAdmin } = useAuth()
  const [r, setR] = useState(null)
  const [edu, setEdu] = useState([])
  const [exp, setExp] = useState([])
  const [awards, setAwards] = useState([])
  const [pubs, setPubs] = useState([])
  const [coauthors, setCoauthors] = useState(0)
  const [loading, setLoading] = useState(true)
  const [priv, setPriv] = useState(null)

  useEffect(() => {
    window.scrollTo(0, 0)
    async function load() {
      setLoading(true)
      const { data: res } = await supabase.from('researchers')
        .select('*, organizations(name)').eq('id', id).maybeSingle()
      setR(res)
      if (!res) { setLoading(false); return }

      const [e, x, a, pa] = await Promise.all([
        supabase.from('researcher_education').select('*').eq('researcher_id', id).order('start_year', { ascending: false }),
        supabase.from('researcher_experience').select('*').eq('researcher_id', id).order('start_year', { ascending: false }),
        supabase.from('researcher_awards').select('*').eq('researcher_id', id).order('year', { ascending: false }),
        supabase.from('publication_authors')
          .select('is_corresponding, publications(id,title,publication_type,publication_year,journal,citation_count,status)')
          .eq('researcher_id', id),
      ])
      setEdu(e.data || []); setExp(x.data || []); setAwards(a.data || [])
      const list = (pa.data || []).map(p => p.publications).filter(p => p && p.status === 'APPROVED')
        .sort((p, q) => (q.publication_year || 0) - (p.publication_year || 0))
      setPubs(list)

      if (list.length) {
        const { data: others } = await supabase.from('publication_authors')
          .select('researcher_id').in('publication_id', list.map(p => p.id))
        setCoauthors(new Set((others || []).map(o => o.researcher_id).filter(x => String(x) !== String(id))).size)
      } else setCoauthors(0)
      setLoading(false)
    }
    load()
  }, [id])

  // Thông tin riêng tư: chỉ nạp khi là admin hoặc chính chủ hồ sơ
  useEffect(() => {
    setPriv(null)
    const mine = me && String(me.id) === String(id)
    if (!isAdmin && !mine) return
    supabase.from('researcher_private').select('*').eq('researcher_id', id).maybeSingle()
      .then(({ data }) => setPriv(data || {}))
  }, [id, isAdmin, me])

  const byYear = useMemo(() => {
    const m = {}
    pubs.forEach(p => { if (p.publication_year) m[p.publication_year] = (m[p.publication_year] || 0) + 1 })
    return Object.entries(m).sort((a, b) => a[0] - b[0])
  }, [pubs])
  const maxYear = Math.max(1, ...byYear.map(y => y[1]))
  async function openUploadedCv() {
    if (!priv?.uploaded_cv_path) return
    const { data, error } = await supabase.storage.from('researcher-cvs')
      .createSignedUrl(priv.uploaded_cv_path, 60)
    if (error || !data?.signedUrl) { window.alert('Không mở được CV đính kèm: ' + (error?.message || 'Không có quyền')); return }
    window.open(data.signedUrl, '_blank', 'noopener,noreferrer')
  }

  const cites = pubs.reduce((s, p) => s + p.citation_count, 0)

  if (loading) return <main className="container page"><div className="empty">Đang tải...</div></main>
  if (!r) return <main className="container page"><div className="empty">Không tìm thấy nhà nghiên cứu.</div></main>

  const interests = (r.research_interests || '').split(',').map(s => s.trim()).filter(Boolean)
  const isMe = me && me.id === r.id
  const sub = [r.academic_title, r.academic_degree].filter(Boolean).join(' • ')

  return (
    <main className="container page cv">
      <section className="cv-head">
                <Avatar name={r.full_name} url={r.avatar_url} size="xl" />
        <div className="cv-id">
          <h1>{r.full_name}</h1>
          {sub && <p>{sub}</p>}
          {r.organizations?.name && <p className="muted">{r.organizations.name}</p>}
          {interests.length > 0 && (
            <div className="tags" style={{ marginTop: 10 }}>
              {interests.map(t => <span className="tag-sm" key={t}>{t}</span>)}
            </div>
          )}
        </div>
        <div className="cv-actions no-print">
          <button className="btn btn-ghost" onClick={() => window.print()}><Printer size={16} /> In / Lưu PDF</button>
          {(isMe || isAdmin) && <ExportCvButton researcherId={r.id} />}
          {(isMe || isAdmin) && priv?.uploaded_cv_path && <button type="button" className="btn btn-ghost" onClick={openUploadedCv}>
            <FileText size={16} /> Xem CV đính kèm{priv.uploaded_cv_name ? ` (${priv.uploaded_cv_name})` : ''}
          </button>}
          {isMe && <Link to="/profile/edit" className="btn btn-primary"><Pencil size={16} /> Chỉnh sửa</Link>}
        </div>
      </section>

      <section className="cv-stats">
        <div><FileText size={18} /><b>{pubs.length}</b><span>Công trình</span></div>
        <div><Quote size={18} /><b>{cites}</b><span>Trích dẫn</span></div>
        <div><Users size={18} /><b>{coauthors}</b><span>Đồng tác giả</span></div>
        <div><GraduationCap size={18} /><b>{edu.length}</b><span>Bậc đào tạo</span></div>
      </section>

      <div className="detail">
        <div className="cv-main">
          {r.bio && <section className="cv-block"><h2>Giới thiệu</h2><p className="abstract">{r.bio}</p></section>}

          {edu.length > 0 && (
            <section className="cv-block"><h2>Quá trình đào tạo</h2>
              <div className="timeline">
                {edu.map(i => (
                  <div className="tl-item" key={i.id}>
                    <b>{i.degree}{i.major ? ` – ${i.major}` : ''}</b>
                    <span>{[i.institution, yearRange(i.start_year, i.end_year)].filter(Boolean).join(' • ')}</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {exp.length > 0 && (
            <section className="cv-block"><h2>Quá trình công tác</h2>
              <div className="timeline">
                {exp.map(i => (
                  <div className="tl-item" key={i.id}>
                    <b>{i.position}{i.organization ? ` – ${i.organization}` : ''}</b>
                    <span>{yearRange(i.start_year, i.end_year)}</span>
                    {i.description && <p>{i.description}</p>}
                  </div>
                ))}
              </div>
            </section>
          )}

          {awards.length > 0 && (
            <section className="cv-block"><h2>Khen thưởng</h2>
              <div className="timeline">
                {awards.map(i => (
                  <div className="tl-item" key={i.id}>
                    <b>{i.title}</b>
                    <span>{[i.issuer, i.year].filter(Boolean).join(' • ')}</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          <section className="cv-block"><h2>Công trình nghiên cứu ({pubs.length})</h2>
            {pubs.length === 0 && <p className="muted">Chưa có công trình nào được duyệt.</p>}
            {pubs.map(p => (
              <Link to={`/research/${p.id}`} className="pub-row" key={p.id}>
                <span className="badge">{typeNames[p.publication_type] || 'Khác'}</span>
                <div><b>{p.title}</b><div className="muted">{p.journal} • {p.publication_year}</div></div>
                <span className="muted nowrap">{p.citation_count} trích dẫn</span>
              </Link>
            ))}
          </section>
        </div>

        <aside className="detail-side">
          <div className="side-card">
            <h3>Thông tin cá nhân</h3>
            <dl>
              {r.birth_year && <><dt>Năm sinh</dt><dd>{r.birth_year}</dd></>}
              {r.gender && <><dt>Giới tính</dt><dd>{r.gender}</dd></>}
              {r.nationality && <><dt>Quốc tịch</dt><dd>{r.nationality}</dd></>}
              {r.languages && <><dt>Ngoại ngữ</dt><dd>{r.languages}</dd></>}
              {r.orcid && <><dt>ORCID</dt><dd>{r.orcid}</dd></>}
            </dl>
            <div className="links">
              {r.contact_email && <a href={`mailto:${r.contact_email}`}><Mail size={14} /> {r.contact_email}</a>}
              {r.website && <a href={r.website} target="_blank" rel="noreferrer"><Globe size={14} /> Website</a>}
              {r.google_scholar_url && <a href={r.google_scholar_url} target="_blank" rel="noreferrer"><LinkIcon size={14} /> Google Scholar</a>}
            </div>
          </div>

          {priv && (
            <div className="side-card no-print" style={{ marginTop: 16, position: 'static', borderColor: '#bfdbfe', background: '#f8fbff' }}>
              <h3><Lock size={14} style={{ verticalAlign: '-1px' }} /> Thông tin riêng tư</h3>
              <p className="muted" style={{ fontSize: 12 }}>Chỉ quản trị viên và chính chủ hồ sơ xem được.</p>
              <dl>
                <dt>Thỉnh giảng</dt><dd>{priv.available_guest_lecturing ? 'Sẵn sàng' : 'Chưa đăng ký'}</dd>
                <dt>Tư vấn doanh nghiệp</dt><dd>{priv.available_business_consulting ? 'Sẵn sàng' : 'Chưa đăng ký'}</dd>
                <dt>Hợp tác nghiên cứu</dt><dd>{priv.wants_research_collaboration ? 'Muốn tìm đồng đội nghiên cứu' : 'Chưa đăng ký'}</dd>
                <dt>Tham gia hội đồng</dt><dd>{priv.available_committee_service ? 'Sẵn sàng' : 'Chưa đăng ký'}</dd>
                <dt>Hướng dẫn nghiên cứu</dt><dd>{priv.available_supervision ? 'Sẵn sàng' : 'Chưa đăng ký'}</dd>
                <dt>Năm công nhận PGS</dt><dd>{priv.associate_professor_year || '—'}</dd>
                <dt>Năm công nhận GS</dt><dd>{priv.professor_year || '—'}</dd>
                <dt>Ngày sinh</dt><dd>{priv.birth_date ? new Date(priv.birth_date).toLocaleDateString('vi-VN') : '—'}</dd>
                <dt>Nơi sinh</dt><dd>{priv.birth_place || '—'}</dd>
                <dt>Quê quán</dt><dd>{priv.hometown || '—'}</dd>
                <dt>Dân tộc</dt><dd>{priv.ethnicity || '—'}</dd>
                <dt>Địa chỉ liên lạc</dt><dd>{priv.address || '—'}</dd>
                <dt>Điện thoại di động (DĐ)</dt><dd>{priv.phone || '—'}</dd>
                <dt>Điện thoại cơ quan (CQ)</dt><dd>{priv.phone_office || '—'}</dd>
                <dt>Điện thoại nhà riêng (NR)</dt><dd>{priv.phone_home || '—'}</dd>
                <dt>Fax</dt><dd>{priv.fax || '—'}</dd>
              </dl>
            </div>
          )}

          {byYear.length > 0 && (
            <div className="side-card" style={{ marginTop: 16, position: 'static' }}>
              <h3>Công bố theo năm</h3>
              {byYear.map(([y, n]) => (
                <div className="bar-row" key={y}>
                  <span>{y}</span>
                  <div className="bar"><i style={{ width: `${(n / maxYear) * 100}%` }} /></div>
                  <b>{n}</b>
                </div>
              ))}
            </div>
          )}
        </aside>
      </div>
    </main>
  )
}